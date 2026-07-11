/// Per-window application-state type definitions for glyx-core.

use std::sync::Arc;
use std::time::Instant;
use parking_lot::Mutex;
use smallvec::SmallVec;

use glyx_layout::{LayoutTree, ResolvedLayout, NodeId};
use glyx_renderer::{peniko, AnyRenderer, Scene};
use glyx_runtime::{CanvasCmd, NodeProps, NodeType, GlyxRuntime};
use glyx_gpu::GpuContext;
use glyx_text::TextSystem;

use crate::{LabelKey, CachedLabel};
use crate::soft_present::SoftPresent;

// ── Present target ───────────────────────────────────────────────────────────

/// How rendered pixels reach the window.
///
/// `Gpu` — wgpu device + swapchain (Vello / FemtoVG, or TinySkia when soft
/// present is disabled via `GLYX_NO_SOFT_PRESENT=1`).
/// `Soft` — softbuffer OS blit (TinySkia only). No wgpu objects exist at all.
pub(super) enum Present {
    Gpu(GpuContext),
    Soft(SoftPresent),
}

impl Present {
    pub(super) fn width(&self) -> u32 {
        match self { Present::Gpu(g) => g.width(),  Present::Soft(s) => s.width() }
    }
    pub(super) fn height(&self) -> u32 {
        match self { Present::Gpu(g) => g.height(), Present::Soft(s) => s.height() }
    }
    pub(super) fn resize(&mut self, w: u32, h: u32) {
        match self { Present::Gpu(g) => g.resize(w, h), Present::Soft(s) => s.resize(w, h) }
    }
    pub(super) fn poll(&self) {
        if let Present::Gpu(g) = self { g.poll(); }
    }
    pub(super) fn memory_counters(&self) -> (u64, u64, u64, u32, u32) {
        match self {
            Present::Gpu(g)  => g.memory_counters(),
            Present::Soft(_) => (0, 0, 0, 0, 0),
        }
    }
}

#[cfg(feature = "dev")]
use std::sync::mpsc::Receiver;

// ── Splash state ─────────────────────────────────────────────────────────────

/// Splash screen overlay state. Active from window open until dismissed.
pub(super) struct SplashState {
    pub(super) image:        Option<peniko::ImageData>,
    pub(super) background:   [u8; 4],
    pub(super) min_until:    Instant,
    pub(super) auto_hide_at: Instant,
    pub(super) hidden:       bool,
}

impl SplashState {
    pub(super) fn is_visible(&self) -> bool {
        let now = Instant::now();
        if now < self.min_until { return true; }
        if now >= self.auto_hide_at { return false; }
        !self.hidden
    }
}

// ── Camera / Video streams ────────────────────────────────────────────────────

/// Live camera capture stream. Owned by `PerWindowState`.
#[cfg(feature = "camera")]
pub(super) struct CameraStream {
    pub(super) frame_buf:      Arc<Mutex<Option<(u32, u32, Vec<u8>)>>>,
    pub(super) last_raw_frame: Arc<Mutex<Option<(u32, u32, Vec<u8>)>>>,
    pub(super) stop_flag:      Arc<std::sync::atomic::AtomicBool>,
    pub(super) latest_image:   Option<peniko::ImageData>,
    #[allow(dead_code)]
    pub(super) capture_fps:    Arc<std::sync::atomic::AtomicU32>,
    pub(super) record_frame_tx: Arc<Mutex<Option<std::sync::mpsc::SyncSender<(u32, u32, Vec<u8>)>>>>,
    pub(super) record_done_rx:  Option<std::sync::mpsc::Receiver<Result<String, String>>>,
}

/// Live video playback stream. Owned by `PerWindowState`.
pub(super) struct VideoStream {
    pub(super) frame_buf:       Arc<Mutex<Option<(u32, u32, Vec<u8>)>>>,
    pub(super) stop_flag:       Arc<std::sync::atomic::AtomicBool>,
    pub(super) pause_flag:      Arc<std::sync::atomic::AtomicBool>,
    pub(super) audio_stop_flag: Arc<std::sync::atomic::AtomicBool>,
    pub(super) seek_tx:         std::sync::mpsc::SyncSender<f64>,
    pub(super) events:          Arc<Mutex<std::collections::VecDeque<String>>>,
    pub(super) latest_image:    Option<peniko::ImageData>,
    pub(super) video_volume:    Arc<Mutex<f32>>,
    pub(super) url:             String,
}

// ── Image cache ───────────────────────────────────────────────────────────────

/// Image cache with a byte budget instead of an entry count.
pub(super) struct ByteBudgetImageCache {
    pub(super) inner:       lru::LruCache<String, peniko::ImageData>,
    pub(super) total_bytes: usize,
    pub(super) budget:      usize,
}

impl ByteBudgetImageCache {
    pub(super) fn new(budget_bytes: usize) -> Self {
        Self {
            inner:       lru::LruCache::unbounded(),
            total_bytes: 0,
            budget:      budget_bytes,
        }
    }

    pub(super) fn get(&mut self, key: &str) -> Option<&peniko::ImageData> {
        self.inner.get(key)
    }

    pub(super) fn put(&mut self, key: String, img: peniko::ImageData) {
        let cost = img.data.len();
        if let Some(old) = self.inner.peek(&key) {
            self.total_bytes = self.total_bytes.saturating_sub(old.data.len());
        }
        while self.total_bytes + cost > self.budget {
            if let Some((_, evicted)) = self.inner.pop_lru() {
                self.total_bytes = self.total_bytes.saturating_sub(evicted.data.len());
            } else {
                break;
            }
        }
        self.total_bytes += cost;
        self.inner.put(key, img);
    }

    #[allow(dead_code)]
    pub(super) fn len(&self) -> usize { self.inner.len() }
    pub(super) fn clear(&mut self) { self.inner.clear(); self.total_bytes = 0; }
}

// ── Per-window state ──────────────────────────────────────────────────────────

/// Per-window rendering + runtime state.
pub(super) struct PerWindowState {
    pub(super) gpu:          Present,
    /// Window handle — needed to lazily create a wgpu context when a
    /// Canvas3D node first appears under the soft present path.
    pub(super) window:       Arc<winit::window::Window>,
    /// Set after a failed soft→wgpu upgrade so we only log the error once.
    pub(super) gpu_upgrade_failed: bool,
    /// True when the wgpu path was created lazily for Canvas3D (as opposed to
    /// being the configured backend).  Only lazily-upgraded windows are
    /// eligible for the idle downgrade back to software present.
    #[cfg(feature = "canvas3d")]
    pub(super) gpu_was_upgraded: bool,
    /// Last frame that actually composited a Canvas3D overlay.
    #[cfg(feature = "canvas3d")]
    pub(super) canvas3d_last_used: Option<Instant>,
    /// True while a wake-up timer for the idle downgrade check is in flight.
    #[cfg(feature = "canvas3d")]
    pub(super) downgrade_timer_armed: bool,
    pub(super) renderer:     AnyRenderer,
    pub(super) text_sys:     TextSystem,
    pub(super) layout:       LayoutTree,
    pub(super) runtime:      GlyxRuntime,
    pub(super) layout_dirty: bool,
    pub(super) layout_structure_dirty: bool,
    pub(super) resolved:     Vec<(NodeId, ResolvedLayout)>,
    pub(super) js_nodes:     std::collections::HashMap<u32, JsNode>,
    pub(super) js_root:      Option<u32>,
    pub(super) images:       std::collections::HashMap<u32, peniko::ImageData>,
    pub(super) images_by_path: ByteBudgetImageCache,
    pub(super) image_cache_hits: u64,
    pub(super) image_cache_misses: u64,
    pub(super) label_cache: lru::LruCache<LabelKey, CachedLabel>,
    pub(super) cursor_x:     f32,
    pub(super) cursor_y:     f32,
    pub(super) drag_active:  bool,
    pub(super) drag_start_x: f32,
    pub(super) drag_start_y: f32,
    pub(super) request_redraw: Arc<dyn Fn() + Send + Sync>,
    pub(super) cursor_blink_on:       bool,
    pub(super) cursor_blink_deadline: Instant,
    pub(super) cursor_was_active: bool,
    /// Sender to the persistent blink-timer thread (spawned lazily on first
    /// focused TextInput). Sending a deadline schedules one redraw at that
    /// instant; newer deadlines received while waiting replace the pending one.
    pub(super) cursor_blink_tx: Option<std::sync::mpsc::Sender<Instant>>,
    pub(super) perf: Arc<Mutex<glyx_perf::PerfState>>,
    pub(super) rss_bytes: Arc<std::sync::atomic::AtomicU64>,
    pub(super) gc_frame_counter: u32,
    pub(super) canvas_cmds: std::collections::HashMap<u32, Vec<CanvasCmd>>,
    #[cfg(feature = "canvas3d")]
    pub(super) canvas3d_scenes: std::collections::HashMap<u32, glyx_3d::Scene3D>,
    #[cfg(feature = "canvas3d")]
    pub(super) canvas3d_dirty: std::collections::HashSet<u32>,
    #[cfg(feature = "canvas3d")]
    pub(super) renderer_3d: Option<glyx_3d::Renderer3D>,
    #[cfg(feature = "camera")]
    pub(super) camera_streams: std::collections::HashMap<u32, CameraStream>,
    pub(super) video_streams: std::collections::HashMap<u32, VideoStream>,
    pub(super) splash_state: Option<SplashState>,
    pub(super) decorations: bool,
    pub(super) drag_window_fn: Option<Arc<dyn Fn() + Send + Sync>>,
    pub(super) scrollbar_drag: Option<ScrollbarDragState>,
    pub(super) dirty_nodes: std::collections::HashSet<u32>,
    pub(super) descendant_cascade_nodes: std::collections::HashSet<u32>,
    pub(super) dirty_subtrees: std::collections::HashSet<u32>,
    pub(super) prev_resolved: std::collections::HashMap<u32, ResolvedLayout>,
    pub(super) scene_cache:     std::collections::HashMap<u32, Scene>,
    pub(super) scene_cache_new: std::collections::HashMap<u32, Scene>,
    pub(super) boundary_scene_cache:     std::collections::HashMap<u32, Scene>,
    pub(super) boundary_scene_cache_new: std::collections::HashMap<u32, Scene>,
    pub(super) pipeline_cache_saved: bool,
    #[cfg(feature = "dev")]
    pub(super) dev_mode: Option<DevModeState>,
}

pub(super) struct JsNode {
    pub(super) node_type: NodeType,
    pub(super) props:     NodeProps,
    pub(super) children:  SmallVec<[u32; 4]>,
    pub(super) layout_id: Option<NodeId>,
}

/// State for an active scrollbar thumb drag.
pub(super) struct ScrollbarDragState {
    pub(super) node_id: u32,
    pub(super) track_h: f64,
    pub(super) thumb_h: f64,
    pub(super) scroll_range: f64,
    pub(super) start_scroll_y: f64,
    pub(super) start_mouse_y: f64,
}

#[cfg(feature = "dev")]
pub(super) enum DevBuildEvent {
    BuildOk(String),
    BuildErr(String),
    /// A plugin was changed, rebundled, and is ready to be hot-reloaded in V8.
    PluginReload {
        global_name: String,
        prefix:      Option<String>,
        bundled_js:  String,
    },
}

#[cfg(feature = "dev")]
pub(super) struct DevModeState {
    pub(super) rx: Receiver<DevBuildEvent>,
    pub(super) overlay_visible: bool,
    pub(super) overlay_verbose: bool,
    pub(super) last_reload: Option<Instant>,
    pub(super) last_build_message: String,
    pub(super) ctrl_down: bool,
    pub(super) shift_down: bool,
    pub(super) overlay_lines:        Vec<String>,
    pub(super) overlay_next_refresh: Instant,
    pub(super) overlay_next_redraw:  Instant,
    pub(super) last_js_error: Option<String>,
    pub(super) startup_rss_bytes: u64,
    pub(super) startup_v8_total_bytes: usize,
}
