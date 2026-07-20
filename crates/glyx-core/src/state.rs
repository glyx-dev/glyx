/// Per-window application-state type definitions for glyx-core.

use std::sync::Arc;
use std::time::Instant;
use parking_lot::Mutex;
use smallvec::SmallVec;

use glyx_layout::{LayoutTree, ResolvedLayout, NodeId};
use glyx_renderer::{peniko, AnyRenderer, Scene};
use glyx_runtime::{CanvasCmd, NodeProps, NodeType, JsRuntime};
use glyx_gpu::GpuContext;
use glyx_text::TextSystem;

use crate::{LabelKey, CachedLabel};
use crate::soft_present::SoftPresent;
#[cfg(target_os = "windows")]
use crate::d2d_present::D2DPresent;

// ── Present target ───────────────────────────────────────────────────────────

/// How rendered pixels reach the window.
///
/// `Gpu` — wgpu device + swapchain (Vello / FemtoVG, or TinySkia when soft
/// present is disabled via `GLYX_NO_SOFT_PRESENT=1`).
/// `Soft` — softbuffer OS blit (TinySkia only). No wgpu objects exist at all.
pub(super) enum Present {
    Gpu(GpuContext),
    Soft(SoftPresent),
    /// Direct2D (Windows only, experimental — see `d2d_present.rs`). Owns its
    /// own D3D11 device + DXGI swap chain, entirely separate from `Gpu`'s
    /// wgpu device — the two never coexist for the same window in Phase 1-5
    /// (Canvas3D-on-Direct2D compatibility is Phase 6, deferred).
    #[cfg(target_os = "windows")]
    Direct2D(D2DPresent),
}

impl Present {
    pub(super) fn width(&self) -> u32 {
        match self {
            Present::Gpu(g)  => g.width(),
            Present::Soft(s) => s.width(),
            #[cfg(target_os = "windows")]
            Present::Direct2D(d) => d.width(),
        }
    }
    pub(super) fn height(&self) -> u32 {
        match self {
            Present::Gpu(g)  => g.height(),
            Present::Soft(s) => s.height(),
            #[cfg(target_os = "windows")]
            Present::Direct2D(d) => d.height(),
        }
    }
    pub(super) fn resize(&mut self, w: u32, h: u32) {
        match self {
            Present::Gpu(g)  => g.resize(w, h),
            Present::Soft(s) => s.resize(w, h),
            #[cfg(target_os = "windows")]
            Present::Direct2D(d) => d.resize(w, h),
        }
    }
    pub(super) fn poll(&self) {
        if let Present::Gpu(g) = self { g.poll(); }
    }
    pub(super) fn memory_counters(&self) -> (u64, u64, u64, u32, u32) {
        match self {
            Present::Gpu(g)  => g.memory_counters(),
            Present::Soft(_) => (0, 0, 0, 0, 0),
            #[cfg(target_os = "windows")]
            Present::Direct2D(_) => (0, 0, 0, 0, 0),
        }
    }
}

#[cfg(feature = "dev")]
use std::sync::mpsc::Receiver;

// ── Splash state ─────────────────────────────────────────────────────────────

/// Splash screen overlay state. Active from window open until dismissed.
pub(super) struct SplashState {
    pub(super) image:        Option<peniko::ImageData>,
    /// Max fraction (0.0-1.0) of the smaller window dimension the splash
    /// image may occupy — keeps a full-bleed source image (e.g. an app
    /// icon with no transparent margin) from filling the whole window and
    /// swallowing `background`. Default 0.5 (see `load_splash_state`).
    pub(super) image_scale:  f64,
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
#[allow(dead_code)]
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
    pub(super) runtime:      Box<dyn JsRuntime>,
    pub(super) layout_dirty: bool,
    pub(super) layout_structure_dirty: bool,
    pub(super) resolved:     Vec<(NodeId, ResolvedLayout)>,
    pub(super) js_nodes:     std::collections::HashMap<u32, JsNode>,
    pub(super) js_root:      Option<u32>,
    /// Active `opacity` transitions, keyed by node id — see `scene::tick_opacity_transitions`.
    /// `@glyx-dev/motion` v1: JS declares a `transition` prop once on a style
    /// change; Rust owns the interpolation entirely from here, evaluated
    /// fresh every frame with zero JS re-entry (the worklet-style
    /// architecture from the QuickJS perf plan's §8a, scoped to `opacity`
    /// for v1 — `transform`/other properties are a natural v1.1 follow-up
    /// once this proves out).
    pub(super) opacity_transitions: std::collections::HashMap<u32, OpacityTransition>,
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
    /// Quits the app. Used by the native fallback close control drawn when
    /// `!decorations && js_root.is_none()` — a custom-titlebar app whose JS
    /// crashed/failed to eval has no OS chrome and no JS-drawn chrome, so
    /// without this there is no discoverable way to close the window.
    pub(super) quit_fn: Arc<dyn Fn() + Send + Sync>,
    pub(super) cursor_blink_on:       bool,
    pub(super) cursor_blink_deadline: Instant,
    pub(super) cursor_was_active: bool,
    /// Consecutive frames that hit the early-return gate (nothing changed).
    /// Once this crosses the trim threshold, GPU scratch buffers are
    /// reclaimed via `trim_resources()` even though the window never lost
    /// focus/occlusion — bounds RSS if a stray timer keeps waking the loop.
    pub(super) idle_gate_frames: u32,
    /// GPU capability tier probed at window creation — reused (not
    /// re-probed) to scale the idle-trim check interval: integrated/none
    /// tiers pay real system RAM for the GPU pool and get checked often,
    /// discrete tiers have their own VRAM budget and are checked rarely.
    pub(super) gpu_tier: glyx_gpu::GpuTier,
    /// Wall-clock time of the last idle-trim check (not necessarily the
    /// last actual trim — a check can decide the pool hasn't grown enough
    /// to bother). Independent of `idle_gate_frames` so a periodically
    /// (but not fully) idle screen — e.g. a blinking text cursor resetting
    /// the frame-streak counter every ~500ms — still gets checked.
    pub(super) last_idle_trim_check: Instant,
    /// `allocator_reserved_bytes` (from `memory_counters()`) as of the last
    /// actual trim. The next check only trims again once reserved bytes
    /// have grown past this by the trim margin.
    pub(super) last_trim_reserved_bytes: u64,
    /// Screen rect of the focused TextInput (captured during render) — the
    /// damage region for blink-only frames under software present.
    pub(super) cursor_node_rect: Option<(f64, f64, f64, f64)>,
    /// Global keyboard-focus registry — the node id JS last reported as
    /// focused via `__glyx_setFocus`, or `None`. Foundation for IME
    /// composition routing (attach to this node's rect) and, later,
    /// accessibility (expose focus to the AT). Not yet consumed by anything;
    /// this is step 1 of that work — see [[accessibility-and-ime-plan]].
    pub(super) focused_node: Option<u32>,
    /// Push an accessibility tree update to this window's `accesskit_winit`
    /// adapter. `None` when built without the `a11y` feature. Cheap to call
    /// every frame — no-ops internally when no AT is actually running.
    #[cfg(feature = "a11y")]
    pub(super) a11y_update: glyx_shell::A11yUpdateFn,
    /// Set whenever a scene command actually changes something (see
    /// `scene::apply_scene_commands`); cleared after the tree is rebuilt and
    /// pushed. Avoids rebuilding the accessibility tree on frames where
    /// nothing changed (e.g. a blink-only caret redraw).
    #[cfg(feature = "a11y")]
    pub(super) a11y_dirty: bool,
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
    /// Resolved once at window-creation time (mirrors `renderer_3d`'s lazy-init
    /// style, except the webview cap vtable itself is stateless to resolve —
    /// only the native webview instances it creates carry per-window state).
    #[cfg(feature = "webview")]
    pub(super) webview_cap: Option<&'static glyx_cap_abi::WebviewCap>,
    /// node id -> cap-returned webview handle.
    #[cfg(feature = "webview")]
    pub(super) webview_instances: std::collections::HashMap<u32, u32>,
    /// node id -> last URL/HTML content sent to that instance, so the
    /// per-frame reconcile loop only calls `load_url` when it actually changes.
    #[cfg(feature = "webview")]
    pub(super) webview_last_src: std::collections::HashMap<u32, String>,
    /// node id -> last (x,y,w,h) sent via `set_bounds`. Calling `set_bounds`
    /// every frame with an UNCHANGED rect made WebView2 behave as if it were
    /// under continuous resize and stop repainting until an input event (e.g.
    /// mouse hover) forced it to catch up — only call it on an actual change.
    #[cfg(feature = "webview")]
    pub(super) webview_last_bounds: std::collections::HashMap<u32, (f32, f32, f32, f32)>,
    /// node ids currently `set_visible(0)`d — tracked so the reconcile loop
    /// only calls `set_visible` on an actual show/hide transition, not every
    /// frame (same repeated-call-suppresses-repaint issue as bounds above).
    #[cfg(feature = "webview")]
    pub(super) webview_hidden: std::collections::HashSet<u32>,
    /// (node_id, x, y, w, h) accumulated during `render_subtree` each frame,
    /// consumed right after to create/reposition/hide native webview children.
    #[cfg(feature = "webview")]
    pub(super) webview_overlays: Vec<(u32, f32, f32, f32, f32)>,
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

/// One in-progress `opacity` interpolation, driven entirely by Rust — see
/// `PerWindowState::opacity_transitions`'s docs for the architecture.
pub(super) struct OpacityTransition {
    pub(super) from:        f32,
    pub(super) to:          f32,
    pub(super) start:       Instant,
    pub(super) duration_ms: u32,
}

impl OpacityTransition {
    /// Current eased value and whether the transition has finished.
    /// Eases with a simple ease-out cubic — the common "settle in" curve
    /// used by most CSS-transition defaults.
    pub(super) fn sample(&self, now: Instant) -> (f32, bool) {
        let elapsed_ms = now.saturating_duration_since(self.start).as_secs_f32() * 1000.0;
        let t = (elapsed_ms / self.duration_ms.max(1) as f32).clamp(0.0, 1.0);
        let eased = 1.0 - (1.0 - t).powi(3);
        (self.from + (self.to - self.from) * eased, t >= 1.0)
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opacity_transition_samples_start_mid_and_end() {
        let start = Instant::now();
        let tr = OpacityTransition { from: 0.0, to: 1.0, start, duration_ms: 1000 };

        let (v0, done0) = tr.sample(start);
        assert_eq!(v0, 0.0);
        assert!(!done0);

        let (v_end, done_end) = tr.sample(start + std::time::Duration::from_millis(2000));
        assert_eq!(v_end, 1.0);
        assert!(done_end);

        let (v_mid, done_mid) = tr.sample(start + std::time::Duration::from_millis(500));
        assert!(v_mid > 0.0 && v_mid < 1.0);
        assert!(!done_mid);
    }
}
