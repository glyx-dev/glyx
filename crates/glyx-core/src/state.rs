/// Per-window application-state type definitions for glyx-core.

use std::sync::Arc;
use std::time::{Duration, Instant};
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

/// One decoded splash frame. A static image (PNG/JPEG/etc.) is represented
/// as a single-element frame list with an irrelevant `delay`; an animated
/// GIF decodes to one `SplashFrame` per GIF frame, each carrying that
/// frame's own delay straight from the file — no separate "static vs
/// animated" code path anywhere else in the splash logic.
pub(super) struct SplashFrame {
    pub(super) image: peniko::ImageData,
    pub(super) delay: Duration,
}

/// Splash screen overlay state. Active from window open until dismissed.
pub(super) struct SplashState {
    pub(super) frames:       Vec<SplashFrame>,
    pub(super) current_frame: usize,
    pub(super) last_advance: Instant,
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

    /// Current frame's image, advancing `current_frame` first if its delay
    /// has elapsed. Single-frame (static) splashes never advance — `delay`
    /// is meaningless for them, `frames.len() == 1` short-circuits below.
    pub(super) fn current_image(&mut self) -> Option<&peniko::ImageData> {
        if self.frames.len() > 1 {
            let now = Instant::now();
            let cur_delay = self.frames[self.current_frame].delay;
            if cur_delay > Duration::ZERO && now.duration_since(self.last_advance) >= cur_delay {
                self.current_frame = (self.current_frame + 1) % self.frames.len();
                self.last_advance = now;
            }
        }
        self.frames.get(self.current_frame).map(|f| &f.image)
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
    /// `layout_id → rect` overlay over `resolved`, rebuilt in the same layout
    /// pass — replaces the old `resolved.iter().find()` linear scan.
    ///
    /// This is a `HashMap`, not a `Vec` indexed by the raw id: Taffy's
    /// `NodeId` is a `slotmap` key, and `usize::from(NodeId)` decodes to
    /// `(version << 32) | index` (see `slotmap::KeyData::as_ffi`, an opaque
    /// FFI value with no documented guarantees about its numeric range other
    /// than round-tripping). `version` starts at 1, so even the very first
    /// node ever allocated produces an id north of 4 billion — indexing a
    /// `Vec` by that tries to allocate tens of gigabytes and aborts the
    /// process. (This was shipped once and caught by actually running the
    /// app, not by the unit tests — none of them exercise a real
    /// Taffy-backed layout pass end-to-end.) Do not go back to a raw-index
    /// `Vec` here without a documented, version-stable way to recover a
    /// small dense index from `NodeId`.
    pub(super) resolved_by_id: std::collections::HashMap<NodeId, ResolvedLayout>,
    pub(super) js_nodes:     std::collections::HashMap<u32, JsNode>,
    pub(super) js_root:      Option<u32>,
    /// Active property transitions, keyed by node id — see `crate::motion`
    /// and `scene::tick_transitions`. JS declares a `transition` prop once;
    /// Rust owns the interpolation from there, sampled fresh every frame with
    /// zero JS re-entry (the worklet-style architecture from the QuickJS perf
    /// plan's §8a).
    pub(super) transitions: std::collections::HashMap<u32, crate::motion::Transition>,
    /// Running keyframe animations (`animation` prop), keyed by node id —
    /// see `crate::motion::Animation` and `scene::tick_transitions`.
    pub(super) animations:  std::collections::HashMap<u32, crate::motion::Animation>,
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
    /// Global keyboard-focus registry — the currently focused node id, set
    /// either by JS via `__glyx_setFocus` or natively by Tab/Shift+Tab
    /// cycling (see `focus.rs`). Drives IME composition routing (attach to
    /// this node's rect) and the accessibility tree's reported focus.
    pub(super) focused_node: Option<u32>,
    /// Focus arrived by keyboard or assistive tech (Tab, AT focus action), so
    /// its ring is showing. Cleared by any mouse press, like the web's
    /// `:focus-visible`. When the focused node is removed and focus moves on,
    /// the ring only follows if this is set.
    pub(super) focus_visible: bool,
    /// Tracks Shift key state for Tab-cycling direction. Independent of
    /// `DevModeState::shift_down`, which only exists under the `dev`
    /// feature and is scoped to the dev-overlay shortcut — this one is
    /// always compiled since focus navigation isn't dev-only.
    pub(super) shift_down: bool,
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
    /// Per text field (keyed by the field's node id): the screen-reader text
    /// run bookkeeping (`glyx_text::TextAccess`). Must persist across tree
    /// updates so run node ids stay stable while text is edited, and so an
    /// AT's `SetTextSelection` (which names run ids) can be mapped back.
    /// Entries for fields that disappear are dropped on the next tree build.
    #[cfg(feature = "a11y")]
    pub(super) a11y_text: std::collections::HashMap<u32, glyx_text::TextAccess>,
    /// Next AccessKit id for a text-run node. Starts at `a11y::RUN_ID_BASE`,
    /// far above any scene node id, so run ids never collide with node ids.
    #[cfg(feature = "a11y")]
    pub(super) a11y_next_run_id: u64,
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
    /// Canvas3D-on-Direct2D bridge (Phase 6) — lazily created on first
    /// Canvas3D node under a Direct2D-backed window, torn down after 60s of
    /// 3D inactivity. `None` on non-Direct2D windows and on Direct2D windows
    /// with no live 3D content. See `glyx_renderer::Direct2DGpuBridge`.
    #[cfg(all(target_os = "windows", feature = "canvas3d"))]
    pub(super) d2d_3d_bridge: Option<glyx_renderer::Direct2DGpuBridge>,
    /// Set after a failed bridge creation so we only log the error once
    /// (mirrors `gpu_upgrade_failed`'s role for the TinySkia/Vello path).
    #[cfg(all(target_os = "windows", feature = "canvas3d"))]
    pub(super) d2d_3d_bridge_failed: bool,
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
    /// Screen bounds `(l, t, r, b)` each node was last drawn at, transforms
    /// and shadows included (`scene::record_visual_bounds`). Lets partial
    /// redraw erase where a moved/rotated node WAS, not just its layout box.
    pub(super) prev_visual:   std::collections::HashMap<u32, (f64, f64, f64, f64)>,
    /// `z_index`-sorted children per js node id. Built by
    /// `scene::reconcile_z_order` ONLY when flagged dirty, so a clean frame
    /// renders with zero sorting (previously every View/RepaintBoundary cloned
    /// + sorted its children each frame). Keyed by the current js node ids —
    /// entries for removed nodes are dropped on the next reconcile.
    pub(super) z_order: std::collections::HashMap<u32, SmallVec<[u32; 4]>>,
    /// Js node ids whose `z_order` entry is stale (child list membership or a
    /// child's `z_index` changed since it was built). Drained by
    /// `scene::reconcile_z_order`.
    pub(super) z_order_dirty: std::collections::HashSet<u32>,
    pub(super) scene_cache:     std::collections::HashMap<u32, Scene>,
    pub(super) scene_cache_new: std::collections::HashMap<u32, Scene>,
    pub(super) boundary_scene_cache:     std::collections::HashMap<u32, Scene>,
    pub(super) boundary_scene_cache_new: std::collections::HashMap<u32, Scene>,
    pub(super) pipeline_cache_saved: bool,
    #[cfg(feature = "dev")]
    pub(super) dev_mode: Option<DevModeState>,
    /// Devtools `Inspector.highlightNode` target, outlined on every frame.
    #[cfg(feature = "dev")]
    pub(super) devtools_highlight: Option<u32>,
    /// Per-frame damage records while a devtools client subscribes
    /// (`Inspector.enableDamage`); `None` otherwise, so nothing is kept.
    #[cfg(feature = "dev")]
    pub(super) damage_log: Option<Vec<DamageRecord>>,
}

impl PerWindowState {
    /// Resolved-rect lookup by taffy layout id — replaces the old
    /// `resolved.iter().find(|(nid, _)| *nid == id)` linear scan.
    pub(super) fn resolved_rect(&self, layout_id: NodeId) -> Option<&ResolvedLayout> {
        self.resolved_by_id.get(&layout_id)
    }
}

pub(super) struct JsNode {
    pub(super) node_type: NodeType,
    pub(super) props:     NodeProps,
    /// Pre-parsed `transform` prop — built once per prop change by scene
    /// commands via `render_props` instead of re-parsing the string every
    /// frame during render.
    pub(super) transform: Option<peniko::kurbo::Affine>,
    /// Pre-parsed `box_shadow` prop → (dx, dy, colour).
    pub(super) box_shadow: Option<(f64, f64, peniko::Color)>,
    /// Pre-parsed `background_gradient` prop → gradient endpoints.
    pub(super) gradient: Option<(peniko::Color, peniko::Color)>,
    pub(super) children:  SmallVec<[u32; 4]>,
    /// Parent JS id, maintained by `apply_scene_commands` on every
    /// append/insert/remove/set-root. Lets damage analysis and dirty-subtree
    /// building walk ancestors without rebuilding a child→parent map per frame.
    pub(super) parent:    Option<u32>,
    pub(super) layout_id: Option<NodeId>,
}

impl JsNode {
    /// Create a node with its render props pre-parsed (transform / box-shadow /
    /// gradient) so the render pass never re-parses strings.
    pub(super) fn new(node_type: NodeType, props: NodeProps) -> Self {
        use crate::render_props::{parse_box_shadow, parse_gradient, parse_transform};
        let transform   = props.transform.as_deref().and_then(parse_transform);
        let box_shadow  = props.box_shadow.as_deref().and_then(parse_box_shadow);
        let gradient    = props.background_gradient.as_deref().and_then(parse_gradient);
        JsNode {
            node_type,
            props,
            transform,
            box_shadow,
            gradient,
            children:  SmallVec::new(),
            parent:    None,
            layout_id: None,
        }
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

/// One rendered frame's damage, for the devtools damage stream.
#[cfg(feature = "dev")]
#[derive(Debug, Clone)]
pub(crate) struct DamageRecord {
    /// Redrawn area `[x, y, w, h]`; `None` = the whole window.
    pub rect: Option<[f64; 4]>,
    pub dirty_nodes: usize,
    pub timestamp_ms: u64,
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

