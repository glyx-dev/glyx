//! glyx-core — application lifecycle coordinator.
//!
//! Wires together every framework subsystem and runs the main event loop.
//!
//! ## Frame budget
//!
//! We use `ControlFlow::Wait` so the event loop sleeps when nothing changes.
//! A redraw is requested explicitly when:
//!   - the window first appears,
//!   - the window is resized,
//!   - a JS async completion arrives (driven by the runtime tick), or
//!   - any other state mutation occurs (mouse, keyboard, scroll).
//!
//! This keeps idle CPU usage near zero — important for battery life and for
//! not saturating the GPU on a static UI.
//!
//! ## Incremental layout (Week 14)
//!
//! `apply_scene_commands` tracks whether any *layout-affecting* prop changed
//! in an UpdateNode command.  Layout props are: width, height, flex,
//! flex_direction, justify_content, align_items, padding, gap, text, font_size.
//! Visual-only props (color, background, border, clip, scroll_offset_y) skip
//! the Taffy rebuild entirely, saving ~1 ms per hover/scroll frame.
//!
//! ## Recursive renderer (Week 14)
//!
//! The flat `build_render_order` loop has been replaced by `render_subtree`,
//! a depth-first recursive function that carries a cumulative `scroll_y`
//! offset.  ScrollView nodes push a Vello clip layer, apply their
//! `scroll_offset_y` to all descendants, then pop the layer.
//!
//! ## Multi-line text / measure function (Week 15A)
//!
//! Text leaf nodes carry a `TextMeasureCtx` so Taffy can call a measure
//! closure during layout.  The closure shapes the text with Parley and
//! returns its natural (width, height).  If no explicit `height` prop is set,
//! Taffy uses the measured height — enabling dynamic multi-line text without
//! fixed height props in JS.
//!
//! ## ScrollView nested hit-test fix (Week 15A)
//!
//! After every layout pass, `update_scroll_positions` walks the JS tree and
//! writes *scroll-adjusted* Y values into the runtime layout cache.
//! JS hit-testing via `__glyx_getLayout` then returns the visually correct
//! position for Pressables inside scrolled containers.
//!
//! ## Text shaping
//!
//! `CachedLabel` holds a shaped result keyed by (text, font_size, max_width,
//! color).  Cache misses call Parley once; cache hits return instantly.

use mimalloc::MiMalloc;
#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;

use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::Mutex;
use std::time::{Duration, Instant};
use glyx_gpu::GpuContext;
use glyx_layout::{flex_column, LayoutTree, ResolvedLayout, TextMeasureCtx};
use glyx_renderer::{colors, peniko, AnyRenderer, AnyFrame, BackendKind, Scene};
use glyx_runtime::{
    new_ipc_bus,
    CanvasCmd, InputEvent, LengthValue, NodeProps, NodeType, SceneCommand,
    WindowController,
};
#[cfg(feature = "v8")]
use glyx_runtime::{init_v8, GlyxRuntime};

pub use glyx_runtime::GlyxExtension;
use glyx_security;
use glyx_media;
use glyx_shell::{ShellEvent, GlyxUserEvent};
use glyx_text::{TextLayout, TextSystem};
use glyx_layout::NodeId;

include!(concat!(env!("OUT_DIR"), "/embedded_snapshot.rs"));

/// Size (px) of the native fallback close control drawn top-right when a
/// `decorations: false` window's JS has never successfully rendered a scene
/// — see the `js_root.is_none()` branches in the render loop, `MouseInput`
/// handler, and keyboard handler below. Shared so the drawn hit-box and the
/// click hit-test always agree.
const CLOSE_BTN_SIZE: f64 = 32.0;

// ── JS plugin bundling ────────────────────────────────────────────────────────

pub use glyx_runtime::{JsPlugin, JsPlugins, CancellableTask};

pub use glyx_shell::ShellConfig as WindowConfig;
pub use glyx_shell::StartupMode;
pub use glyx_shell::RenderMode;
mod config;
mod state;
mod dev_mode;
mod scene;
mod layout;
mod render;
mod soft_present;
#[cfg(target_os = "windows")]
mod d2d_present;
#[cfg(feature = "a11y")]
mod a11y;

use self::config::*;
use self::state::*;
#[cfg(feature = "dev")]
use self::dev_mode::*;
#[cfg(feature = "dev")]
use arboard;

use scene::{apply_scene_commands, update_dirty_from_layout, build_dirty_subtrees, snapshot_resolved, tick_opacity_transitions};
use layout::{recompute_layout, update_scroll_positions};

// ── F1: Windows named-pipe DACL restricted to current user ───────────────────
//
// Creates a SECURITY_DESCRIPTOR with a DACL that grants GENERIC_ALL only to
// the current-user SID.  The raw pointer is passed to
// `ServerOptions::create_with_security_attributes_raw` so the OS rejects
// connections from any other local account.
//
// Memory: the security descriptor and SID are allocated by the Windows API
// via `ConvertStringSecurityDescriptorToSecurityDescriptorW` and must be
// freed with `LocalFree`.  We do this in a RAII guard.
#[cfg(target_os = "windows")]
mod pipe_dacl {
    use std::ptr;
    use std::ffi::c_void;

    use windows_sys::Win32::Foundation::{CloseHandle, LocalFree, HANDLE};
    use windows_sys::Win32::Security::{
        GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER,
    };
    use windows_sys::Win32::Security::Authorization::{
        ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
        SDDL_REVISION_1,
    };
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    /// RAII wrapper that frees a `LocalAlloc`-allocated security descriptor.
    pub struct SecurityDescriptorGuard {
        pub ptr: *mut c_void,
    }
    impl Drop for SecurityDescriptorGuard {
        fn drop(&mut self) {
            if !self.ptr.is_null() {
                unsafe { LocalFree(self.ptr as *mut std::ffi::c_void); }
            }
        }
    }
    // SAFETY: the pointer is not aliased; we only hold it for Drop.
    unsafe impl Send for SecurityDescriptorGuard {}

    /// Build a SECURITY_DESCRIPTOR whose DACL grants GENERIC_ALL only to the
    /// current user's SID.  Returns `None` on any Win32 error (fail-open).
    pub fn current_user_only_sd() -> Option<SecurityDescriptorGuard> {
        unsafe {
            // 1. Open the process token.
            let mut token: HANDLE = ptr::null_mut();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
                return None;
            }
            let _token_guard = HandleGuard(token);

            // 2. Query TOKEN_USER (variable-length structure).
            let mut needed: u32 = 0;
            GetTokenInformation(token, TokenUser, ptr::null_mut(), 0, &mut needed);
            if needed == 0 { return None; }
            let mut buf = vec![0u8; needed as usize];
            if GetTokenInformation(
                token, TokenUser,
                buf.as_mut_ptr() as *mut c_void,
                needed, &mut needed,
            ) == 0 { return None; }
            let tu = &*(buf.as_ptr() as *const TOKEN_USER);
            let sid = tu.User.Sid; // *mut c_void

            // 3. Convert SID to its string form "S-1-5-21-...".
            let mut sid_str_ptr: *mut u16 = ptr::null_mut();
            if ConvertSidToStringSidW(sid, &mut sid_str_ptr) == 0 { return None; }
            let _sid_str_guard = WstrGuard(sid_str_ptr);
            let sid_str: String = {
                let mut len = 0usize;
                while *sid_str_ptr.add(len) != 0 { len += 1; }
                String::from_utf16_lossy(std::slice::from_raw_parts(sid_str_ptr, len))
            };

            // 4. SDDL: DACL granting GENERIC_ALL to this user only.
            //    (A;;GA;;;<SID>) = Allow, no inherit flags, GENERIC_ALL, object=none, inherit=none, SID.
            let sddl = format!("D:(A;;GA;;;{})", sid_str);
            let sddl_wide: Vec<u16> = sddl.encode_utf16().chain(std::iter::once(0)).collect();

            // 5. Convert SDDL to a security descriptor (LocalAlloc'd).
            let mut sd_ptr: *mut c_void = ptr::null_mut();
            let mut sd_size: u32 = 0;
            if ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl_wide.as_ptr(),
                SDDL_REVISION_1 as u32,
                &mut sd_ptr,
                &mut sd_size,
            ) == 0 { return None; }

            Some(SecurityDescriptorGuard { ptr: sd_ptr })
        }
    }

    struct HandleGuard(HANDLE);
    impl Drop for HandleGuard {
        fn drop(&mut self) { unsafe { CloseHandle(self.0); } }
    }

    struct WstrGuard(*mut u16);
    impl Drop for WstrGuard {
        fn drop(&mut self) { unsafe { LocalFree(self.0 as *mut std::ffi::c_void); } }
    }
}
use render::{render_subtree, RenderCtx, compute_scrollbar_thumb};

/// Zero-allocation cache key for shaped text.
///
/// The text content is represented by a 64-bit hash rather than a heap-allocated
/// `String`, eliminating one (or two with `.clone()`) String allocations per
/// cache lookup — i.e. per text node per frame.
///
/// Hash collisions are astronomically unlikely for typical UI text and merely
/// produce a cache miss (re-shape), never a correctness bug.
#[derive(Hash, Eq, PartialEq)]
struct LabelKey {
    text_hash:      u64,
    font_size_bits: u32,
    max_width_bits: u32,
    bold:           bool,
    italic:         bool,
    // Color is intentionally NOT part of the key: CachedLabel stores only the
    // shaped layout, not color.  Color is applied at draw time via frame.draw_text,
    // so the same shaped result can be reused across all color variants of a string.
}

impl LabelKey {
    fn new(text: &str, font_size: f32, max_width: f32, bold: bool, italic: bool) -> Self {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        text.hash(&mut h);
        Self {
            text_hash:      h.finish(),
            font_size_bits: font_size.to_bits(),
            max_width_bits: max_width.to_bits(),
            bold,
            italic,
        }
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Top-level configuration passed to [`run`].
pub struct AppConfig {
    /// Window / display settings.
    pub window: WindowConfig,
    /// JavaScript source evaluated at startup.
    ///
    /// Use `include_str!` in your example or application crate to embed a
    /// `.js` file at compile time:
    ///
    /// ```ignore
    /// // Illustrative — the include_str! path is relative to your crate.
    /// glyx_core::run(glyx_core::AppConfig {
    ///     window: glyx_core::WindowConfig::default(),
    ///     js_src: Some(include_str!("../js/app.js").to_string()),
    ///     snapshot_blob: None,
    ///     dev_mode: None,
    ///     extensions: vec![],
    ///     js_plugins: vec![],
    /// });
    /// ```
    pub js_src: Option<String>,
    /// Pre-executed V8 snapshot blob (from glyx-snapshot tool).
    ///
    /// When provided, the isolate is restored from the snapshot (fast startup ~50ms).
    /// Falls back to eval() if not provided or if in dev mode.
    pub snapshot_blob: Option<Vec<u8>>,
    pub dev_mode: Option<DevModeConfig>,
    /// Optional native Rust extensions that register custom __glyx_* bindings.
    pub extensions: Vec<Box<dyn GlyxExtension>>,
    /// Bundled JS plugins from `glyx.config.json` `plugins` array.
    /// Each plugin's exported async functions are callable via `backend.<name>.<fn>()`.
    pub js_plugins: Vec<JsPlugin>,
    /// ICU locale set for `Intl.*` / `.toLocaleString()`. The first entry becomes
    /// the default ICU locale. Read from the `locales` field of `glyx.config`,
    /// defaulting to `["en"]`.
    pub locales: Vec<String>,
}

impl AppConfig {
    /// Load configuration from `glyx.config.json` in the current directory.
    ///
    /// JS source is read from the path specified in `glyx.config.json`'s `dev.output`
    /// field (defaults to `dist/app.js`). This is the zero-boilerplate entry point:
    /// ```no_run
    /// fn main() {
    ///     glyx_core::run(glyx_core::AppConfig::from_config());
    /// }
    /// ```
    pub fn from_config() -> Self {
        let mut window = WindowConfig::default();
        let (caps, js_plugins) = load_glyx_config(&mut window);
        glyx_security::init(caps);
        let snapshot_blob = embedded_snapshot_blob();
        // Prefer build-time embedded app JS (snapshot mode), fall back to reading from disk.
        // The snapshot contains only stubs+polyfills; the app code is always eval'd at runtime.
        let js_src = embedded_app_js().or_else(read_output_js);
        let locales = window.locales.clone();
        AppConfig {
            window,
            js_src,
            snapshot_blob,
            dev_mode:      build_dev_mode_config(),
            extensions:    vec![],
            js_plugins,
            locales,
        }
    }

    /// Create an AppConfig from a binary trailer payload appended to the runner executable.
    ///
    /// Called by glyx-runner when it detects embedded payload in its own bytes.
    /// The trailer is written by `glyx build --mode snapshot` for JS-only projects
    /// without invoking cargo.
    pub fn from_trailer(snapshot_blob: Vec<u8>, js_src: String, config_json: &str) -> Self {
        let mut window = WindowConfig::default();
        let (caps, js_plugins) = apply_config_json(config_json, &mut window);
        glyx_security::init(caps);
        let locales = window.locales.clone();
        AppConfig {
            window,
            js_src: Some(js_src),
            snapshot_blob: Some(snapshot_blob),
            dev_mode: None,
            extensions: vec![],
            js_plugins,
            locales,
        }
    }
}

#[derive(Clone)]
pub struct DevModeConfig {
    pub project_root: PathBuf,
    pub entry_jsx: PathBuf,
    pub output_js: PathBuf,
    pub watch_paths: Vec<PathBuf>,
}

impl DevModeConfig {
    pub fn new(project_root: PathBuf, entry_jsx: PathBuf, output_js: PathBuf, watch_paths: Vec<PathBuf>) -> Self {
        Self { project_root, entry_jsx, output_js, watch_paths }
    }

    pub fn from_entry(project_root: PathBuf, entry_jsx: PathBuf, output_js: PathBuf) -> Self {
        let mut watch_paths = Vec::new();
        if let Some(parent) = entry_jsx.parent() {
            watch_paths.push(parent.to_path_buf());
        }
        Self { project_root, entry_jsx, output_js, watch_paths }
    }
}

// ── Cached label ──────────────────────────────────────────────────────────────

/// A shaped text label — holds the Parley layout plus pre-computed metrics
/// for centering inside a box without re-querying the layout object.
struct CachedLabel {
    layout: TextLayout,
    /// Pre-computed advance width for horizontal centering.
    width:       f64,
    /// Parley's full line-box height including all wrapped lines.
    /// Used to detect whether the layout box was auto-sized to the text —
    /// in which case we top-align rather than center-align vertically.
    text_height: f64,
    /// Offset from the layout-box top (`ty`) to where the cursor rect starts.
    /// Skips the leading above the ascenders so the cursor isn't drawn above
    /// the visible glyphs.
    cursor_top:    f64,
    /// Height of the cursor rect — spans from ascenders to descenders only,
    /// excluding any line leading.
    cursor_height: f64,
}

impl CachedLabel {
    fn new(ts: &mut TextSystem, text: &str, font_size: f32, max_width: f32, color: [u8; 4], bold: bool, italic: bool) -> Self {
        let layout      = ts.styled_label(text, font_size, max_width, bold, italic);
        let width       = layout.width() as f64;
        let text_height = layout.height() as f64;
        // For an empty string Parley produces no glyph runs, so ascent() = 0.
        // Shape a reference "M" at the same size to get the real font ascent.
        let ref_layout = if layout.ascent() > 0.1 {
            None
        } else {
            Some(ts.label_centered("M", font_size, max_width))
        };
        let _ = color; // used at draw time via frame.draw_text
        let src = ref_layout.as_ref().unwrap_or(&layout);
        let (cursor_top_raw, cursor_height_raw) = src.cursor_metrics();
        Self {
            layout,
            width,
            text_height,
            cursor_top:    cursor_top_raw    as f64,
            cursor_height: cursor_height_raw as f64,
        }
    }
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

fn rgba_to_vello(c: [u8; 4]) -> peniko::Color {
    peniko::Color::from_rgba8(c[0], c[1], c[2], c[3])
}

/// Returns `true` if any descendant of `id` with `pressable=true` covers (cx, cy).
/// Used by the drag check to yield window-drag priority to interactive children
/// inside a `glyxDraggable` region (e.g. buttons inside a custom title bar).
fn has_pressable_descendant_at(
    id:     u32,
    cx:     f32,
    cy:     f32,
    nodes:  &std::collections::HashMap<u32, JsNode>,
    cache:  &std::collections::HashMap<u32, [f32; 4]>,
) -> bool {
    let Some(node) = nodes.get(&id) else { return false };
    for &child_id in &node.children {
        if let Some(child) = nodes.get(&child_id) {
            // Direct pressable covering cursor → stop drag
            if child.props.pressable == Some(true) {
                if cache.get(&child_id).map_or(false, |&[x, y, w, h]| {
                    cx >= x && cx <= x + w && cy >= y && cy <= y + h
                }) {
                    return true;
                }
            }
            // Recurse into non-pressable containers (e.g. a row View wrapping buttons)
            if has_pressable_descendant_at(child_id, cx, cy, nodes, cache) {
                return true;
            }
        }
    }
    false
}

/// Try to start a scrollbar interaction at the current cursor position.
/// Thumb hit → drag from the current scroll position.  Track hit → JUMP the
/// scroll so the thumb centers on the click, then drag from there (standard
/// scrollbar behavior).  Pushes the jump event itself; returns the drag state.
fn try_start_scrollbar_drag(s: &mut PerWindowState) -> Option<ScrollbarDragState> {
    let cx = s.cursor_x as f64;
    let cy = s.cursor_y as f64;
    let mut result: Option<(ScrollbarDragState, Option<f64>, f64)> = None;
    {
        let layout_cache = s.runtime.layout_cache();
        let cache = layout_cache.lock();
        for (&id, node) in &s.js_nodes {
            // Only clip containers (ScrollViews) own scrollbars.
            let overflows = matches!(node.props.overflow.as_deref(), Some("hidden" | "scroll"));
            if !(node.props.clip.unwrap_or(false) || overflows) { continue; }
            if !node.props.show_scrollbar.unwrap_or(true) { continue; }
            // Hit-test with SCREEN-SPACE coords (scroll-adjusted cache), which is
            // where the scrollbar is actually painted — raw Taffy coords are wrong
            // for panes inside scrolled/offset ancestors.
            let Some(&[nx, ny, nw, nh]) = cache.get(&id) else { continue };
            let (rx, ry, rw, rh) = (nx as f64, ny as f64, nw as f64, nh as f64);
            let bar_w = node.props.scrollbar_width.unwrap_or(8.0) as f64;
            let track_x = rx + rw - bar_w;
            if cx < track_x || cx > rx + rw { continue; }
            if cy < ry || cy > ry + rh { continue; }
            let scroll_y = node.props.scroll_offset_y.unwrap_or(0.0) as f64;
            // Content height from raw Taffy child rects (scroll-independent).
            let Some(lid) = node.layout_id else { continue };
            let Some((_, rl)) = s.resolved.iter().find(|(nid, _)| *nid == lid) else { continue };
            let max_child_bottom: f64 = node.children.iter()
                .filter_map(|&cid| {
                    let cn   = s.js_nodes.get(&cid)?;
                    let clid = cn.layout_id?;
                    s.resolved.iter()
                        .find(|(nid, _)| *nid == clid)
                        .map(|(_, crl)| (crl.y + crl.height) as f64)
                })
                .fold(f64::NEG_INFINITY, f64::max);
            if !max_child_bottom.is_finite() { continue; }
            let content_h = max_child_bottom - rl.y as f64;
            let Some((_tx, ty, _tw, th)) = compute_scrollbar_thumb(
                rx, ry, rw, rh, scroll_y, content_h, bar_w,
            ) else { continue };
            let scroll_range = (content_h - rh).max(0.0);
            let on_thumb = cy >= ty && cy <= ty + th;
            // Track click: jump so the thumb centers on the cursor.
            let jump = if on_thumb { None } else {
                let drag_range = (rh - th).max(1.0);
                Some(((cy - ry - th / 2.0) / drag_range).clamp(0.0, 1.0) * scroll_range)
            };
            // Multiple clip nodes can cover this point (nested scrollables,
            // side-by-side panes under a common clipping ancestor).  Keep the
            // INNERMOST one — smallest area wins; js_nodes iteration order is
            // arbitrary HashMap order and must not decide.
            let area = rw * rh;
            let smaller = result.as_ref().map_or(true, |(_, _, prev_area)| area < *prev_area);
            if smaller {
                result = Some((ScrollbarDragState {
                    node_id: id,
                    track_h: rh,
                    thumb_h: th,
                    scroll_range,
                    start_scroll_y: jump.unwrap_or(scroll_y),
                    start_mouse_y: cy,
                }, jump, area));
            }
        }
    }
    let (drag, jump, _) = result?;
    if let Some(target) = jump {
        s.runtime.push_event(InputEvent::ScrollbarDrag {
            node_id: drag.node_id,
            scroll_y: target as f32,
        });
        (s.request_redraw)();
    }
    Some(drag)
}

// ── Window controller builder ─────────────────────────────────────────────────

/// Register `scheme://` as a URL handler in the Windows registry under HKCU.
/// Uses the built-in `reg.exe` tool — no extra dependencies, no admin rights.
/// Called once at startup; idempotent (safe to call on every launch).
#[cfg(target_os = "windows")]
fn register_deeplink_scheme_windows(scheme: &str) {
    let exe = match std::env::current_exe() {
        Ok(p) => p.to_string_lossy().into_owned(),
        Err(_) => return,
    };
    // Normalise forward slashes to backslashes (Windows registry convention).
    let exe = exe.replace('/', "\\");

    // The command value: "C:\path\to\app.exe" "%1"
    let cmd_value = format!("\"{}\" \"%1\"", exe);

    let entries = [
        (
            format!("HKCU\\Software\\Classes\\{scheme}"),
            None,  // default value
            format!("URL:{scheme} Protocol"),
        ),
        (
            format!("HKCU\\Software\\Classes\\{scheme}"),
            Some("URL Protocol"),
            String::new(),
        ),
        (
            format!("HKCU\\Software\\Classes\\{scheme}\\shell\\open\\command"),
            None,
            cmd_value,
        ),
    ];

    for (key, value_name, data) in &entries {
        let mut args = vec!["add", key, "/f", "/d", data];
        if let Some(vn) = value_name {
            args.extend_from_slice(&["/v", vn]);
        } else {
            args.push("/ve");  // default (unnamed) value
        }
        let _ = std::process::Command::new("reg").args(&args).output();
    }

    log::debug!("glyx: registered deep-link scheme {}:// → {}", scheme, exe);
}

fn build_window_controller(
    window: Arc<winit::window::Window>,
    create_window_fn: Option<Arc<dyn Fn(u32, String, u32, u32) + Send + Sync>>,
    quit_fn:    Option<Arc<dyn Fn() + Send + Sync>>,
    restart_fn: Option<Arc<dyn Fn() + Send + Sync>>,
) -> WindowController {
    use winit::window::Fullscreen;

    // Extract the raw platform HWND (Windows) so dialogs can be parented to
    // the Glyx window and appear in front of it rather than behind it.
    let hwnd: Option<isize> = {
        #[cfg(target_os = "windows")]
        {
            use winit::raw_window_handle::{HasWindowHandle, RawWindowHandle};
            window.window_handle().ok().and_then(|h| {
                match h.as_raw() {
                    RawWindowHandle::Win32(w) => Some(w.hwnd.get()),
                    _ => None,
                }
            })
        }
        #[cfg(not(target_os = "windows"))]
        { None }
    };

    let w1 = Arc::clone(&window);
    let w2 = Arc::clone(&window);
    let w3 = Arc::clone(&window);
    let w4 = Arc::clone(&window);
    let w5 = Arc::clone(&window);
    let w6 = Arc::clone(&window);
    let w7 = Arc::clone(&window);
    let w8 = Arc::clone(&window);
    let w9 = Arc::clone(&window);
    let w10 = Arc::clone(&window);
    let w11 = Arc::clone(&window);

    WindowController {
        get_window_size: Arc::new(move || {
            let s = w1.inner_size();
            (s.width, s.height)
        }),
        get_screen_size: Arc::new(move || {
            let monitor = w2.current_monitor()?;
            let s = monitor.size();
            Some((s.width, s.height))
        }),
        request_redraw: Arc::new(move || {
            w10.request_redraw();
        }),
        set_fullscreen: Arc::new(move |full| {
            if full {
                w3.set_fullscreen(Some(Fullscreen::Borderless(None)));
            } else {
                w3.set_fullscreen(None);
            }
        }),
        set_maximized: Arc::new(move |maximized| {
            w4.set_maximized(maximized);
        }),
        set_minimized: Arc::new(move |minimized| {
            w5.set_minimized(minimized);
        }),
        is_fullscreen: Arc::new(move || {
            w6.fullscreen().is_some()
        }),
        is_maximized: Arc::new(move || {
            w7.is_maximized()
        }),
        set_always_on_top: Arc::new(move |on| {
            use winit::window::WindowLevel;
            w8.set_window_level(if on { WindowLevel::AlwaysOnTop } else { WindowLevel::Normal });
        }),
        set_title: Arc::new(move |title| {
            w9.set_title(&title);
        }),
        set_cursor: Arc::new(move |name| {
            use winit::window::CursorIcon;
            let icon = match name.as_str() {
                "pointer"    => CursorIcon::Pointer,
                "text"       => CursorIcon::Text,
                "move"       => CursorIcon::Move,
                "grab"       => CursorIcon::Grab,
                "grabbing"   => CursorIcon::Grabbing,
                "col-resize" => CursorIcon::ColResize,
                "row-resize" => CursorIcon::RowResize,
                "ew-resize"  => CursorIcon::EwResize,
                "ns-resize"  => CursorIcon::NsResize,
                "crosshair"  => CursorIcon::Crosshair,
                "not-allowed"=> CursorIcon::NotAllowed,
                "wait"       => CursorIcon::Wait,
                _            => CursorIcon::Default,
            };
            w11.set_cursor(icon);
        }),
        hwnd,
        create_window: create_window_fn,
        quit:    quit_fn,
        restart: restart_fn,
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

pub fn run(mut config: AppConfig) -> bool {
    // On Windows, Ctrl+C causes STATUS_CONTROL_C_EXIT (0xc000013a) by default,
    // which cargo treats as a failure even though the user intentionally quit.
    // Install a console ctrl handler that exits cleanly with code 0.
    #[cfg(target_os = "windows")]
    {
        #[link(name = "kernel32")]
        extern "system" {
            fn SetConsoleCtrlHandler(
                handler: Option<unsafe extern "system" fn(u32) -> i32>,
                add: i32,
            ) -> i32;
        }
        unsafe extern "system" fn ctrl_handler(_ctrl_type: u32) -> i32 {
            std::process::exit(0);
        }
        unsafe { SetConsoleCtrlHandler(Some(ctrl_handler), 1); }
    }

    // Install Rust panic hook early so panics during init are also captured.
    install_panic_hook();

    // Set module-specific log levels first so they take precedence over any
    // global level set by RUST_LOG (e.g. RUST_LOG=info would otherwise
    // re-enable the very noisy wgpu_core submission-index spam).
    let mut log_builder = env_logger::Builder::new();
    log_builder
        .filter_module("wgpu_core", log::LevelFilter::Warn)
        .filter_module("wgpu_hal",  log::LevelFilter::Warn)
        .filter_module("naga",      log::LevelFilter::Warn)
        .filter_level(log::LevelFilter::Info);
    // RUST_LOG can still add more specific directives (e.g. glyx_core=debug)
    // but cannot remove the per-module suppression above.
    if let Ok(rust_log) = std::env::var("RUST_LOG") {
        log_builder.parse_filters(&rust_log);
    }
    // try_init silently skips if a logger is already registered (e.g. glyx-runner
    // calls env_logger::init() before invoking glyx_core::run()).
    let _ = log_builder.try_init();

    // Load .env from the working directory (or any parent) if one exists.
    match dotenvy::dotenv() {
        Ok(path) => log::info!("glyx: loaded env from {}", path.display()),
        Err(dotenvy::Error::Io(_)) => {}
        Err(e) => log::warn!("glyx: .env parse error: {e}"),
    }

    // Init security from config only if not already done (e.g. via AppConfig::from_config()).
    // This fallback ensures security is initialised even when AppConfig is built manually.
    if !glyx_security::is_initialized() {
        let (caps, _plugins) = load_glyx_config(&mut config.window);
        glyx_security::init(caps);
    }

    // ── Deep link: check launch args for a URL matching the configured scheme ──
    //
    // M4: Single-instance deep-link IPC via named pipe (Windows) or Unix socket
    // (Linux/macOS) instead of TCP.  Named IPC has no discoverable port and no
    // race window between reading the port file and connecting.
    //
    //   Windows: \.\pipe\glyx-{app_name}
    //   Unix:    /tmp/.glyx-{app_name}.sock  (or $XDG_RUNTIME_DIR/... if set)
    //
    // The variable carries the IPC name so the async listener can be created
    // inside the WindowReady block on the tokio runtime.
    let mut single_instance_ipc: Option<String> = {
        if let Some(ref dl) = glyx_security::get().deeplink {
            let scheme_prefix = format!("{}://", dl.scheme);
            let launch_url: Option<String> = std::env::args()
                .skip(1)
                .find(|a| a.starts_with(&scheme_prefix));

            if let Some(ref url) = launch_url {
                #[allow(unused_unsafe)]
                unsafe { std::env::set_var("GLYX_LAUNCH_URL", url); }
                log::info!("glyx: deep-link launch URL: {}", url);
            }

            #[cfg(target_os = "windows")]
            register_deeplink_scheme_windows(&dl.scheme);

            if dl.single_instance {
                let app_name = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.file_stem().map(|s| s.to_string_lossy().into_owned()))
                    .unwrap_or_else(|| "glyx-app".to_string());

                #[cfg(target_os = "windows")]
                let ipc_name = format!(r"\.\pipe\glyx-{}", app_name);

                #[cfg(not(target_os = "windows"))]
                let ipc_name = {
                    let dir = std::env::var("XDG_RUNTIME_DIR")
                        .unwrap_or_else(|_| std::env::temp_dir().to_string_lossy().into_owned());
                    format!("{}/.glyx-{}.sock", dir, app_name)
                };

                // Try to connect as a second instance.
                #[cfg(target_os = "windows")]
                let is_second = {
                    use std::io::Write;
                    // On Windows, named pipes can be opened with std::fs::File --
                    // OpenOptions wraps CreateFile internally.
                    std::fs::OpenOptions::new()
                        .write(true)
                        .open(&ipc_name)
                        .ok()
                        .and_then(|mut f| {
                            let payload = launch_url.as_deref().unwrap_or("").to_string() + "
";
                            f.write_all(payload.as_bytes()).ok()
                        })
                        .is_some()
                };

                #[cfg(not(target_os = "windows"))]
                let is_second = {
                    use std::io::Write;
                    std::os::unix::net::UnixStream::connect(&ipc_name)
                        .ok()
                        .and_then(|mut s| {
                            let payload = launch_url.as_deref().unwrap_or("").to_string() + "
";
                            s.write_all(payload.as_bytes()).ok()
                        })
                        .is_some()
                };

                if is_second {
                    log::info!("glyx: second instance -- forwarded URL and exiting");
                    std::process::exit(0);
                }

                // Clean up stale socket file on Unix before binding.
                #[cfg(not(target_os = "windows"))]
                {
                    let _ = std::fs::remove_file(&ipc_name);
                    // chmod 0600 is set after bind in the listener task below.
                }

                log::info!("glyx: single-instance IPC at {}", ipc_name);
                Some(ipc_name)
            } else {
                None
            }
        } else {
            None
        }
    };

    // GLYX_PERF_CHECK=<duration_secs>:<budget_ms> — set by `glyx build --check-performance`.
    // After the given duration the app prints a JSON perf summary and exits.
    let perf_check: Option<(u64, f64)> = std::env::var("GLYX_PERF_CHECK").ok().and_then(|v| {
        let mut parts = v.splitn(2, ':');
        let dur  = parts.next()?.parse::<u64>().ok()?;
        let bud  = parts.next()?.parse::<f64>().ok()?;
        Some((dur, bud))
    });

    let tokio_rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(1)
        .enable_io()
        .enable_time()
        .build()
        .expect("Failed to build Tokio runtime");
    let tokio_handle = tokio_rt.handle().clone();

    #[cfg(feature = "v8")]
    init_v8();

    // Apply the app's default ICU locale (first declared `locales` entry) so
    // `Intl.*` / `.toLocaleString()` format correctly when no locale is passed.
    // V8-only — QuickJS's own Intl support (if any) isn't wired up yet.
    #[cfg(feature = "v8")]
    if let Some(locale) = config.locales.first().filter(|l| !l.is_empty()) {
        glyx_runtime::icu::set_default_locale(locale);
    }

    let AppConfig { window, js_src, snapshot_blob, dev_mode: _dev_mode, extensions, js_plugins, locales: _locales } = config;
    // Capture before `window` is moved into glyx_shell::run().
    let window_decorations = window.decorations;

    // Load splash state from config (None = no splash configured).
    // Wrapped in Option so it can be moved into the main window's PerWindowState exactly once.
    let mut main_splash_state: Option<SplashState> = load_splash_state();

    // Shared across all windows.
    let ipc_bus        = new_ipc_bus();
    let next_window_id = Arc::new(std::sync::atomic::AtomicU32::new(1));

    // Wrap in Arc so secondary-window creation can reuse them.
    let js_src_arc        = Arc::new(js_src);
    // Only read in the #[cfg(feature = "v8")] snapshot-restore branch below —
    // QuickJS has no snapshot equivalent, so this is unused (by design) in a
    // quickjs-only build.
    #[cfg_attr(not(feature = "v8"), allow(unused_variables))]
    let snapshot_blob_arc = Arc::new(snapshot_blob);
    let extensions_arc    = Arc::new(extensions);
    let js_plugins_arc: glyx_runtime::JsPlugins = Arc::new(js_plugins);
    // Build the backend command registry once; share it across all windows.
    let backend_registry  = Arc::new(glyx_runtime::build_backend_registry(&*extensions_arc));

    // Per-window state: handle → PerWindowState.
    let mut windows: std::collections::HashMap<u32, PerWindowState> =
        std::collections::HashMap::new();

    // Save background color and render mode before `window` (ShellConfig) is moved into run().
    let window_bg = window.background_color;
    // Capture configured mode; Auto is resolved after GPU adapter is known.
    let render_mode_config = window.render_mode;
    // Canvas2D transport config — applied to each runtime after construction.
    let canvas_protocol  = window.canvas_protocol.clone();
    let canvas_buffer_kb = window.canvas_buffer_kb.unwrap_or(256) as usize;
    // Compute V8 heap cap: explicit config wins; otherwise auto-calculate from
    // bundle size. V8-only — QuickJS has no isolate-heap-limit equivalent
    // wired up yet (its `new_with_ipc` takes no heap-cap argument), a known gap.
    #[cfg(feature = "v8")]
    let heap_cap_mb: usize = match window.max_js_heap_mb {
        Some(mb) => mb as usize,
        None => {
            let bundle_bytes = (*js_src_arc).as_ref().map(|s| s.len()).unwrap_or(0);
            let is_dev = cfg!(feature = "dev");
            let cap = calc_heap_mb(bundle_bytes, is_dev);
            log::info!("[v8] heap cap: {cap} MB (auto from {:.2} MB bundle, dev={is_dev})", bundle_bytes as f64 / (1024.0 * 1024.0));
            cap
        }
    };

    let restart = glyx_shell::run(window, move |event| {
        match event {
            // ── Window ready — initialise per-window subsystems ──────────
            ShellEvent::WindowReady { window_handle, window, proxy: ev_proxy, #[cfg(feature = "a11y")] a11y_update } => {
                // Resolve RenderMode → BackendKind.
                // GLYX_CPU_RENDER=1 forces the cheapest CPU path (TinySkia) for
                // CI, headless testing, or machines without a supported GPU.
                let force_cpu = std::env::var("GLYX_CPU_RENDER")
                    .map(|v| v.trim() == "1").unwrap_or(false);
                // Probe the adapter tier WITHOUT creating a device/swapchain —
                // if the backend resolves to TinySkia, we present via softbuffer
                // and never initialise wgpu at all (saves ~20 MB private +
                // ~47 MB GPU-shared on iGPUs where GPU memory is system RAM).
                let (probe_tier, probe_name) =
                    pollster::block_on(glyx_gpu::probe_adapter_info())
                        .unwrap_or((glyx_gpu::GpuTier::None, "no adapter".into()));
                let backend_kind = resolve_backend(render_mode_config, probe_tier, force_cpu);
                // renderMode:'gpu' forced on a tier the 'auto' heuristic would have
                // routed to TinySkia (integrated/virtual GPU, or no adapter) puts
                // Vello's persistent compute buffer pool on what is effectively
                // system RAM — a real cost, not a false alarm. One-time warning so
                // apps that explicitly opted into 'gpu' know what they're trading.
                if render_mode_config == RenderMode::Gpu
                    && matches!(probe_tier, glyx_gpu::GpuTier::Integrated | glyx_gpu::GpuTier::None)
                {
                    log::warn!(
                        "[glyx] renderMode='gpu' forced on an integrated/virtual GPU ({}) — \
                         Vello's GPU buffer pool counts as system RAM here; 'auto' or \
                         'skia' would use TinySkia instead and use significantly less memory",
                        probe_name,
                    );
                }
                if render_mode_config == RenderMode::Auto {
                    log::info!(
                        "[glyx] renderMode=auto → {} ({})",
                        match &backend_kind {
                            BackendKind::TinySkia                 => "skia",
                            BackendKind::Vello { use_cpu: false } => "vello",
                            BackendKind::Vello { use_cpu: true  } => "vello/cpu",
                            // Auto never resolves to Direct2D (see resolve_backend
                            // and auto_never_selects_direct2d test) — unreachable
                            // in practice, kept for match exhaustiveness.
                            BackendKind::Direct2D                 => "direct2d",
                        },
                        probe_name,
                    );
                }
                // GLYX_NO_SOFT_PRESENT=1 keeps TinySkia on the wgpu present
                // path (escape hatch while the software path is new).
                let no_soft = std::env::var("GLYX_NO_SOFT_PRESENT")
                    .map(|v| v.trim() == "1").unwrap_or(false);
                let (present, mut renderer) =
                    if matches!(backend_kind, BackendKind::TinySkia) && !no_soft {
                        match soft_present::SoftPresent::new(Arc::clone(&window)) {
                            Ok(sp) => {
                                let size = window.inner_size();
                                let r = AnyRenderer::TinySkia(
                                    glyx_renderer::TinySkiaRenderer::new_cpu_only(
                                        size.width, size.height));
                                (Present::Soft(sp), r)
                            }
                            Err(e) => {
                                log::warn!("soft present unavailable ({e}); falling back to wgpu");
                                let gpu_ctx = pollster::block_on(GpuContext::new(window.clone()))
                                    .expect("Failed to initialise GPU");
                                let r = AnyRenderer::new(&gpu_ctx, backend_kind)
                                    .expect("Failed to initialise renderer");
                                (Present::Gpu(gpu_ctx), r)
                            }
                        }
                    } else if cfg!(target_os = "windows") && matches!(backend_kind, BackendKind::Direct2D) {
                        // Direct2D bypasses AnyRenderer::new entirely (same
                        // shape as the TinySkia soft-present branch above) —
                        // its device context comes from D2DPresent, which
                        // needs the window's raw HWND, not a wgpu GpuContext.
                        #[cfg(target_os = "windows")]
                        {
                            match d2d_present::D2DPresent::new(Arc::clone(&window)) {
                                Ok(dp) => {
                                    let r = AnyRenderer::Direct2D(
                                        glyx_renderer::Direct2DRenderer::new(
                                            dp.device_context().clone()));
                                    (Present::Direct2D(dp), r)
                                }
                                Err(e) => {
                                    log::warn!("Direct2D present unavailable ({e}); falling back to wgpu/TinySkia");
                                    let gpu_ctx = pollster::block_on(GpuContext::new(window.clone()))
                                        .expect("Failed to initialise GPU");
                                    let r = AnyRenderer::new(&gpu_ctx, BackendKind::TinySkia)
                                        .expect("Failed to initialise renderer");
                                    (Present::Gpu(gpu_ctx), r)
                                }
                            }
                        }
                        #[cfg(not(target_os = "windows"))]
                        unreachable!("cfg!(target_os = \"windows\") guard above")
                    } else {
                        let gpu_ctx = pollster::block_on(GpuContext::new(window.clone()))
                            .expect("Failed to initialise GPU");
                        let r = AnyRenderer::new(&gpu_ctx, backend_kind)
                            .expect("Failed to initialise renderer");
                        (Present::Gpu(gpu_ctx), r)
                    };
                // Apply window background color so the GPU clear matches the
                // app theme from frame zero — no blank white flash on startup.
                renderer.set_background_color(rgba_to_vello(window_bg));

                // Build callbacks that send events to the shell event loop.
                let proxy_for_fn = ev_proxy.clone();
                let create_fn: Arc<dyn Fn(u32, String, u32, u32) + Send + Sync> =
                    Arc::new(move |id, title, width, height| {
                        let _ = proxy_for_fn.send_event(
                            GlyxUserEvent::CreateWindow { id, title, width, height }
                        );
                    });

                let proxy_quit = ev_proxy.clone();
                let quit_fn: Arc<dyn Fn() + Send + Sync> =
                    Arc::new(move || { let _ = proxy_quit.send_event(GlyxUserEvent::Quit); });

                let proxy_restart = ev_proxy.clone();
                let restart_fn: Arc<dyn Fn() + Send + Sync> =
                    Arc::new(move || { let _ = proxy_restart.send_event(GlyxUserEvent::Restart); });

                let window_ctrl = build_window_controller(
                    Arc::clone(&window),
                    Some(Arc::clone(&create_fn)),
                    Some(Arc::clone(&quit_fn)),
                    Some(Arc::clone(&restart_fn)),
                );

                // Register in the window registry so duplicate-create calls
                // can find and focus this window.  The key for windows created
                // via glyxWindow.create was reserved by the binding; for the
                // main window the title is used (only matters when the
                // preventDuplicateWindows config is on).
                {
                    let wf = Arc::clone(&window);
                    glyx_runtime::window_registry_attach(
                        window_handle,
                        window.title(),
                        Arc::new(move || {
                            wf.set_minimized(false);
                            wf.focus_window();
                        }),
                    );
                }

                let ipc_clone  = Arc::clone(&ipc_bus);
                let nwid       = Arc::clone(&next_window_id);
                // Create the shared perf Arc BEFORE the runtime so both
                // PerWindowState (writer) and AsyncState binding (reader) share it.
                let shared_perf: Arc<Mutex<glyx_perf::PerfState>> =
                    Arc::new(Mutex::new(glyx_perf::PerfState::new()));

                // GLYX_PERF_CHECK: apply budget, then spawn a timer that exits after duration.
                if let Some((duration_secs, budget_ms)) = perf_check {
                    shared_perf.lock().budget_ms = budget_ms;
                    let perf_arc  = Arc::clone(&shared_perf);
                    let proxy_pc  = ev_proxy.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(duration_secs));
                        // Print perf summary to stdout for CLI to capture.
                        let p = perf_arc.lock();
                        let violations = p.violations.len();
                        let avg_ms = p.avg_frame_time();
                        let p99_ms = p.p99_frame_time();
                        let fps    = p.fps();
                        drop(p);
                        let pass = violations == 0;
                        println!("GLYX_PERF_RESULT:{{\"violations\":{violations},\"avgFrameMs\":{avg_ms:.2},\"p99FrameMs\":{p99_ms:.2},\"fps\":{fps:.1},\"pass\":{pass}}}");
                        let _ = proxy_pc.send_event(GlyxUserEvent::Quit);
                    });
                }

                // Construct the selected JsRuntime backend. Compile-time choice
                // (see memory/backend-droppability-goals.md — picking one drops
                // the other's dependency entirely, not a runtime toggle).
                // `Box<dyn JsRuntime>` from here on — everything past this point
                // (canvas init, register_extensions, eval, deeplink wiring) goes
                // through trait methods only, uniformly across backends.
                #[cfg(feature = "v8")]
                let mut rt: Box<dyn glyx_runtime::JsRuntime> = if let Some(ref blob) = *snapshot_blob_arc {
                    match GlyxRuntime::new_from_snapshot_with_ipc(
                        blob, tokio_handle.clone(), Some(window_ctrl),
                        Arc::clone(&ipc_clone), window_handle, Arc::clone(&nwid),
                        Arc::clone(&shared_perf),
                        Arc::clone(&backend_registry),
                        Arc::clone(&js_plugins_arc),
                        heap_cap_mb,
                    ) {
                        Ok(rt) => {
                            log::info!("Window {}: restored from snapshot", window_handle);
                            Box::new(rt)
                        }
                        Err(e) => {
                            log::warn!("Window {}: snapshot restore failed ({}); eval mode", window_handle, e);
                            let proxy_fb  = ev_proxy.clone();
                            let proxy_qfb = ev_proxy.clone();
                            let proxy_rfb = ev_proxy.clone();
                            let wc = build_window_controller(
                                Arc::clone(&window),
                                Some(Arc::new(move |id, title, width, height| {
                                    let _ = proxy_fb.send_event(
                                        GlyxUserEvent::CreateWindow { id, title, width, height }
                                    );
                                })),
                                Some(Arc::new(move || {
                                    let _ = proxy_qfb.send_event(GlyxUserEvent::Quit);
                                })),
                                Some(Arc::new(move || {
                                    let _ = proxy_rfb.send_event(GlyxUserEvent::Restart);
                                })),
                            );
                            Box::new(GlyxRuntime::new_with_ipc(
                                tokio_handle.clone(), Some(wc),
                                Arc::clone(&ipc_clone), window_handle, Arc::clone(&nwid),
                                Arc::clone(&shared_perf),
                                Arc::clone(&backend_registry),
                                Arc::clone(&js_plugins_arc),
                                heap_cap_mb,
                            ))
                        }
                    }
                } else {
                    Box::new(GlyxRuntime::new_with_ipc(
                        tokio_handle.clone(), Some(window_ctrl),
                        Arc::clone(&ipc_clone), window_handle, Arc::clone(&nwid),
                        Arc::clone(&shared_perf),
                        Arc::clone(&backend_registry),
                        Arc::clone(&js_plugins_arc),
                        heap_cap_mb,
                    ))
                };

                // QuickJS has no snapshot equivalent — this uses eval-from-source
                // every time, no bytecode precompilation path yet. IPC/multi-window,
                // the async-Rust-command half of backend_call, AND JS plugins
                // (backend.<name>.<fn>()) are all wired via `new_with_ipc`. Unlike
                // V8, there's no dev-mode hot-reload for a plugin edit yet — a
                // full window restart picks up the change instead.
                #[cfg(feature = "quickjs")]
                let mut rt: Box<dyn glyx_runtime::JsRuntime> = Box::new(
                    glyx_runtime::QuickJsRuntime::new_with_ipc(
                        Arc::clone(&shared_perf), tokio_handle.clone(),
                        Some(Arc::clone(&window_ctrl.request_redraw)),
                        Some(window_ctrl.clone()),
                        Arc::clone(&ipc_clone), window_handle, Arc::clone(&nwid),
                        Arc::clone(&backend_registry),
                        Arc::clone(&js_plugins_arc),
                    ).expect("QuickJsRuntime::new_with_ipc")
                );

                // Set up the Canvas2D binary command buffer (or mark json mode).
                // No-op under quickjs (canvas bindings aren't ported yet).
                rt.init_canvas_buffers(&canvas_protocol, canvas_buffer_kb);

                rt.register_extensions(&*extensions_arc);

                // ── Single-instance deep-link listener (main window only) ──
                // Accepts IPC connections from second instances and pushes their
                // forwarded deep-link URLs into the runtime's url queue.
                if window_handle == 0 {
                    if let Some(ipc_name) = single_instance_ipc.take() {
                        let queue_clone = rt.deeplink_url_queue();

                        // F1: Build SD before spawning to avoid holding *mut c_void across await.
                        // Transmit as usize (Send); valid for the lifetime of sd_guard below.
                        #[cfg(target_os = "windows")]
                        let (_sd_guard, sd_ptr_usize) = {
                            let g = pipe_dacl::current_user_only_sd();
                            let p = g.as_ref().map(|sd| sd.ptr as usize).unwrap_or(0);
                            (g, p)
                        };

                        tokio_handle.spawn(async move {
                            use tokio::io::AsyncBufReadExt;

                            #[cfg(target_os = "windows")]
                            {
                                // Windows named pipe listener loop.
                                loop {
                                    let mut opts = tokio::net::windows::named_pipe::ServerOptions::new();
                                    opts.first_pipe_instance(false)
                                        .reject_remote_clients(true);

                                    let server = if sd_ptr_usize != 0 {
                                        // SAFETY: sd_ptr_usize is the LocalAlloc'd SD kept alive
                                        // by sd_guard, which is captured by this async block.
                                        let sa = windows_sys::Win32::Security::SECURITY_ATTRIBUTES {
                                            nLength: std::mem::size_of::<windows_sys::Win32::Security::SECURITY_ATTRIBUTES>() as u32,
                                            lpSecurityDescriptor: sd_ptr_usize as *mut std::ffi::c_void,
                                            bInheritHandle: 0,
                                        };
                                        unsafe { opts.create_with_security_attributes_raw(
                                            &ipc_name,
                                            &sa as *const _ as *mut _,
                                        ) }
                                    } else {
                                        log::warn!("glyx: could not build user-restricted pipe DACL; pipe accessible to all local users");
                                        opts.create(&ipc_name)
                                    };
                                    let server = match server {
                                        Ok(s)  => s,
                                        Err(e) => { log::warn!("glyx: pipe create error: {e}"); return; }
                                    };
                                    if server.connect().await.is_err() { continue; }
                                    let queue = Arc::clone(&queue_clone);
                                    tokio::spawn(async move {
                                        let reader = tokio::io::BufReader::new(server);
                                        let mut lines = reader.lines();
                                        while let Ok(Some(line)) = lines.next_line().await {
                                            let url = line.trim().to_string();
                                            if !url.is_empty() {
                                                log::info!("glyx: deep-link forwarded: {}", url);
                                                queue.lock().push_back(url);
                                            }
                                        }
                                    });
                                }
                            }
                            #[cfg(not(target_os = "windows"))]
                            {
                                let listener = match tokio::net::UnixListener::bind(&ipc_name) {
                                    Ok(l)  => l,
                                    Err(e) => { log::warn!("glyx: Unix socket bind error: {e}"); return; }
                                };
                                // R2: restrict socket to current user only.
                                #[cfg(unix)]
                                {
                                    use std::os::unix::fs::PermissionsExt;
                                    let _ = std::fs::set_permissions(
                                        &ipc_name,
                                        std::fs::Permissions::from_mode(0o600),
                                    );
                                }
                                loop {
                                    match listener.accept().await {
                                        Ok((stream, _)) => {
                                            let queue = Arc::clone(&queue_clone);
                                            tokio::spawn(async move {
                                                let reader = tokio::io::BufReader::new(stream);
                                                let mut lines = reader.lines();
                                                while let Ok(Some(line)) = lines.next_line().await {
                                                    let url = line.trim().to_string();
                                                    if !url.is_empty() {
                                                        log::info!("glyx: deep-link forwarded: {}", url);
                                                        queue.lock().push_back(url);
                                                    }
                                                }
                                            });
                                        }
                                        Err(e) => log::warn!("glyx: IPC accept error: {e}"),
                                    }
                                }
                            }
                        });
                    }
                }

                // Captured so the dev-mode error overlay can show it below —
                // previously only HMR-reload errors set `last_js_error`, so a
                // syntax/eval error present from the very first launch left
                // the window blank with only a log line nobody sees. Only
                // consumed by the `dev_mode` field below, which is itself
                // `dev`-only — write-only (and warns) otherwise.
                #[cfg(feature = "dev")]
                let mut initial_eval_error: Option<String> = None;
                if let Some(ref js) = *js_src_arc {
                    match rt.eval(js) {
                        Ok(_)  => log::info!("Window {}: JS eval complete.", window_handle),
                        Err(e) => {
                            log::error!("Window {}: JS eval error: {}", window_handle, e);
                            #[cfg(feature = "dev")]
                            { initial_eval_error = Some(format!("Eval error: {}", e)); }
                        }
                    }
                }

                let win = window.clone();
                let request_redraw: Arc<dyn Fn() + Send + Sync> =
                    Arc::new(move || win.request_redraw());

                let proxy_quit_fallback = ev_proxy.clone();
                let quit_fn: Arc<dyn Fn() + Send + Sync> =
                    Arc::new(move || { let _ = proxy_quit_fallback.send_event(GlyxUserEvent::Quit); });

                // Frameless drag closure — captures the window directly.
                let drag_window_fn: Option<Arc<dyn Fn() + Send + Sync>> =
                    if !window_decorations {
                        let w_drag = Arc::clone(&window);
                        Some(Arc::new(move || { w_drag.drag_window().ok(); }))
                    } else {
                        None
                    };

                let ws = PerWindowState {
                    gpu:          present,
                    window:       Arc::clone(&window),
                    gpu_upgrade_failed: false,
                    #[cfg(feature = "canvas3d")]
                    gpu_was_upgraded: false,
                    #[cfg(feature = "canvas3d")]
                    canvas3d_last_used: None,
                    #[cfg(feature = "canvas3d")]
                    downgrade_timer_armed: false,
                    renderer,
                    text_sys:     TextSystem::new(),
                    layout:       LayoutTree::new(),
                    runtime:      rt,
                    layout_dirty:           true,
                    layout_structure_dirty: true,
                    resolved:               Vec::new(),
                    js_nodes:     std::collections::HashMap::with_capacity(256),
                    js_root:      None,
                    opacity_transitions: std::collections::HashMap::new(),
                    images:       std::collections::HashMap::with_capacity(32),
                    images_by_path: ByteBudgetImageCache::new(256 * 1024 * 1024),
                    image_cache_hits: 0,
                    image_cache_misses: 0,
                    label_cache:  lru::LruCache::new(std::num::NonZeroUsize::new(256).unwrap()),
                    cursor_x:     0.0,
                    cursor_y:     0.0,
                    drag_active:  false,
                    drag_start_x: 0.0,
                    drag_start_y: 0.0,
                    request_redraw: Arc::clone(&request_redraw),
                    quit_fn: Arc::clone(&quit_fn),
                    cursor_blink_on:       true,
                    cursor_blink_deadline: Instant::now() + Duration::from_millis(500),
                    cursor_was_active:     false,
                    idle_gate_frames:      0,
                    gpu_tier:              probe_tier,
                    last_idle_trim_check:  Instant::now(),
                    last_trim_reserved_bytes: 0,
                    cursor_node_rect:      None,
                    focused_node:          None,
                    #[cfg(feature = "a11y")]
                    a11y_update,
                    #[cfg(feature = "a11y")]
                    a11y_dirty: true, // force the first-ever tree push
                    cursor_blink_tx:       None,
                    perf:          shared_perf,
                    rss_bytes:     {
                        // Spawn a background task that polls RSS every 2 s via sysinfo.
                        // This keeps the heavy OS syscall off the render thread entirely,
                        // eliminating the P99 spikes that the previous per-30-frame poll caused.
                        let rss_atomic = Arc::new(std::sync::atomic::AtomicU64::new(0));
                        let rss_clone  = Arc::clone(&rss_atomic);
                        let pid        = sysinfo::Pid::from_u32(std::process::id());
                        tokio_handle.spawn(async move {
                            let mut sys = sysinfo::System::new();
                            loop {
                                sys.refresh_processes(
                                    sysinfo::ProcessesToUpdate::Some(&[pid]), false,
                                );
                                let rss = sys.process(pid)
                                    .map(|p| p.memory())
                                    .unwrap_or(0);
                                rss_clone.store(rss, std::sync::atomic::Ordering::Relaxed);
                                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                            }
                        });
                        rss_atomic
                    },
                    gc_frame_counter: 0,
                    canvas_cmds:     std::collections::HashMap::new(),
                    #[cfg(feature = "canvas3d")]
                    canvas3d_scenes: std::collections::HashMap::new(),
                    #[cfg(feature = "canvas3d")]
                    canvas3d_dirty:  std::collections::HashSet::new(),
                    #[cfg(feature = "canvas3d")]
                    renderer_3d:     None,
                    #[cfg(feature = "camera")]
                    camera_streams:  std::collections::HashMap::new(),
                    video_streams:   std::collections::HashMap::new(),
                    #[cfg(feature = "webview")]
                    webview_cap: {
                        let cap = glyx_runtime::load_caps().webview;
                        if let Some(c) = cap { unsafe { (c.init)(); } }
                        cap
                    },
                    #[cfg(feature = "webview")]
                    webview_instances: std::collections::HashMap::new(),
                    #[cfg(feature = "webview")]
                    webview_last_src:    std::collections::HashMap::new(),
                    #[cfg(feature = "webview")]
                    webview_last_bounds: std::collections::HashMap::new(),
                    #[cfg(feature = "webview")]
                    webview_hidden:      std::collections::HashSet::new(),
                    #[cfg(feature = "webview")]
                    webview_overlays:    Vec::new(),
                    // Splash only applies to the main window; secondary windows get None.
                    splash_state: if window_handle == 0 { main_splash_state.take() } else { None },
                    decorations:     window_decorations,
                    drag_window_fn,
                    scrollbar_drag:  None,
                    dirty_nodes:              std::collections::HashSet::new(),
                    descendant_cascade_nodes: std::collections::HashSet::new(),
                    dirty_subtrees:           std::collections::HashSet::new(),
                    prev_resolved:   std::collections::HashMap::new(),
                    scene_cache:              std::collections::HashMap::new(),
                    scene_cache_new:          std::collections::HashMap::new(),
                    boundary_scene_cache:     std::collections::HashMap::new(),
                    boundary_scene_cache_new: std::collections::HashMap::new(),
                    pipeline_cache_saved:     false,
                    #[cfg(feature = "dev")]
                    dev_mode: if window_handle == 0 {
                        // Hot-reload dev overlay is only wired to the main window.
                        start_dev_mode_worker(
                            Arc::clone(&request_redraw),
                            _dev_mode.clone(),
                            Arc::clone(&js_plugins_arc),
                        )
                        .map(|rx| DevModeState {
                            rx,
                            overlay_visible: false,
                            overlay_verbose: false,
                            last_reload: None,
                            last_build_message: "watching changes".to_string(),
                            ctrl_down: false,
                            shift_down: false,
                            overlay_lines:         Vec::new(),
                            overlay_next_refresh:  Instant::now(),
                            overlay_next_redraw:    Instant::now(),
                            last_js_error:          initial_eval_error,
                            startup_rss_bytes:      0,
                            startup_v8_total_bytes: 0,
                        })
                    } else {
                        None
                    },
                };
                windows.insert(window_handle, ws);
                window.request_redraw();

                // Kick off ffmpeg-sidecar download in the background once, on the
                // main window only.  The download is a no-op when ffmpeg is already
                // reachable via PATH or the sidecar dir.
                #[cfg(feature = "dev")]
                if window_handle == 0 {
                    crate::scene::ensure_dev_ffmpeg();
                }
            }

            // ── Resize ────────────────────────────────────────────────────
            ShellEvent::Resized { window_handle, width, height } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    let prev_w = s.gpu.width();
                    let prev_h = s.gpu.height();
                    s.gpu.resize(width, height);
                    if s.gpu.width() != prev_w || s.gpu.height() != prev_h {
                        s.layout_dirty = true;
                        s.runtime.push_event(InputEvent::Resize { width, height });
                    }
                }
            }

            // ── Cursor movement ───────────────────────────────────────────
            ShellEvent::CursorMoved { window_handle, x, y } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    let prev_x = s.cursor_x;
                    let prev_y = s.cursor_y;
                    s.cursor_x = x as f32;
                    s.cursor_y = y as f32;
                    s.runtime.push_event(InputEvent::CursorMoved {
                        x: s.cursor_x,
                        y: s.cursor_y,
                    });

                    // Scrollbar thumb drag
                    if let Some(ref drag) = s.scrollbar_drag {
                        let cursor_y = y as f64;
                        let mouse_delta = cursor_y - drag.start_mouse_y;
                        let drag_range = drag.track_h - drag.thumb_h;
                        if drag_range > 0.0 && drag.scroll_range > 0.0 {
                            let ratio = drag.scroll_range / drag_range;
                            let new_scroll_y =
                                (drag.start_scroll_y + mouse_delta * ratio).clamp(0.0, drag.scroll_range);
                            s.runtime.push_event(InputEvent::ScrollbarDrag {
                                node_id: drag.node_id,
                                scroll_y: new_scroll_y as f32,
                            });
                        }
                    }

                    if s.drag_active {
                        s.runtime.push_event(InputEvent::DragMove {
                            x: s.cursor_x,
                            y: s.cursor_y,
                            dx: s.cursor_x - prev_x,
                            dy: s.cursor_y - prev_y,
                        });
                    }
                    (s.request_redraw)();
                }
            }

            // ── Mouse button ──────────────────────────────────────────────
            ShellEvent::MouseInput { window_handle, button, pressed } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    // Native fallback close control (see CLOSE_BTN_SIZE doc)
                    // — only live when JS has never rendered anything, so it
                    // can never intercept a real app's own clicks.
                    if button == 0 && pressed && !s.decorations && s.js_root.is_none() {
                        let win_w = s.gpu.width() as f32;
                        let btn = CLOSE_BTN_SIZE as f32;
                        if s.cursor_x >= win_w - btn && s.cursor_x <= win_w
                            && s.cursor_y >= 0.0 && s.cursor_y <= btn {
                            (s.quit_fn)();
                            return;
                        }
                    }

                    // When frameless and left button pressed: check for a glyxDraggable
                    // node under the cursor. If found, initiate an OS window drag and
                    // skip the normal DragStart event so JS sliders/etc. aren't affected.
                    if button == 0 && pressed && !s.decorations {
                        if let Some(ref drag_fn) = s.drag_window_fn.clone() {
                            let cx = s.cursor_x;
                            let cy = s.cursor_y;
                            let hit = {
                                let layout_cache = s.runtime.layout_cache();
                                let cache = layout_cache.lock();
                                s.js_nodes.iter().any(|(&id, node)| {
                                    node.props.draggable == Some(true)
                                        && cache.get(&id).map_or(false, |&[x, y, w, h]| {
                                            cx >= x && cx <= x + w && cy >= y && cy <= y + h
                                        })
                                        // Skip drag if a Pressable descendant is under cursor.
                                        // Clicking a button inside the title bar should press
                                        // the button, not drag the window.
                                        && !has_pressable_descendant_at(id, cx, cy, &s.js_nodes, &cache)
                                })
                            };
                            if hit {
                                drag_fn();
                                // Still send MouseButton so onPressIn handlers fire, but
                                // do NOT start a DragStart — the OS owns this drag now.
                                s.runtime.push_event(InputEvent::MouseButton {
                                    x: cx, y: cy, button, pressed,
                                });
                                return;
                            }
                        }
                    }

                    // ── Scrollbar thumb drag ─────────────────────────────
                    if button == 0 {
                        if pressed {
                            // Clear any stale drag (e.g. from focus loss).
                            s.scrollbar_drag = None;
                            if let Some(drag) = try_start_scrollbar_drag(s) {
                                s.scrollbar_drag = Some(drag);
                                return;
                            }
                        } else if s.scrollbar_drag.take().is_some() {
                            return;
                        }
                    }

                    s.runtime.push_event(InputEvent::MouseButton {
                        x: s.cursor_x, y: s.cursor_y, button, pressed,
                    });
                    // Track left-button drag state (button == 0).
                    if button == 0 {
                        if pressed {
                            s.drag_active  = true;
                            s.drag_start_x = s.cursor_x;
                            s.drag_start_y = s.cursor_y;
                            s.runtime.push_event(InputEvent::DragStart {
                                x: s.cursor_x, y: s.cursor_y,
                            });
                        } else if s.drag_active {
                            s.drag_active = false;
                            s.runtime.push_event(InputEvent::DragEnd {
                                x: s.cursor_x, y: s.cursor_y,
                            });
                        }
                    }
                }
            }

            // ── Keyboard ──────────────────────────────────────────────────
            ShellEvent::KeyInput { window_handle, key, text, pressed } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    // Same native fallback as the close control drawn/hit-tested
                    // above: Escape closes the app, but only while JS has never
                    // rendered a scene — never intercepts a real app's own
                    // Escape handling once it's actually running.
                    if key.as_str() == "Escape" && pressed && !s.decorations && s.js_root.is_none() {
                        (s.quit_fn)();
                        return;
                    }

                    #[cfg(feature = "dev")]
                    if let Some(dev) = s.dev_mode.as_mut() {
                        match key.as_str() {
                            "ControlLeft" | "ControlRight" => dev.ctrl_down = pressed,
                            "ShiftLeft" | "ShiftRight"     => dev.shift_down = pressed,
                            "KeyD" if pressed && dev.ctrl_down && dev.shift_down => {
                                // Cycle: hidden → compact → verbose → hidden
                                match (dev.overlay_visible, dev.overlay_verbose) {
                                    (false, _)     => { dev.overlay_visible = true;  dev.overlay_verbose = false; }
                                    (true, false)  => { dev.overlay_verbose = true; }
                                    (true, true)   => { dev.overlay_visible = false; dev.overlay_verbose = false; }
                                }
                                (s.request_redraw)();
                            }
                            "KeyC" if pressed && dev.ctrl_down && dev.last_js_error.is_some() => {
                                #[cfg(feature = "dev")]
                                if let Some(ref err) = dev.last_js_error.clone() {
                                    if let Ok(mut cb) = arboard::Clipboard::new() {
                                        let _ = cb.set_text(err.clone());
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                    s.runtime.push_event(InputEvent::KeyInput { key, text, pressed });
                }
            }

            // ── Accessibility action requests (screen reader, etc.) ──────
            #[cfg(feature = "a11y")]
            ShellEvent::AccessibilityAction { window_handle, target, action, numeric_value } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    match action.as_str() {
                        "focus" => {
                            if s.js_nodes.contains_key(&target) {
                                s.focused_node = Some(target);
                                s.window.set_ime_allowed(true);
                                s.runtime.push_event(InputEvent::AccessibilityFocus { node_id: target });
                                // This path bypasses apply_scene_commands (which
                                // marks a11y_dirty for SceneCommand-driven focus
                                // changes), so the AT-driven focus move would
                                // otherwise never get re-announced until an
                                // unrelated scene command happened to fire.
                                s.a11y_dirty = true;
                                (s.request_redraw)();
                            }
                        }
                        "click" => {
                            if let Some(node) = s.js_nodes.get(&target) {
                                if let Some(layout_id) = node.layout_id {
                                    if let Some((_, rl)) = s.resolved.iter().find(|(nid, _)| *nid == layout_id) {
                                        let cx = rl.x + rl.width  / 2.0;
                                        let cy = rl.y + rl.height / 2.0;
                                        s.runtime.push_event(InputEvent::MouseButton { x: cx, y: cy, button: 0, pressed: true });
                                        s.runtime.push_event(InputEvent::MouseButton { x: cx, y: cy, button: 0, pressed: false });
                                        (s.request_redraw)();
                                    }
                                }
                            }
                        }
                        // Increment/Decrement/SetValue don't have a generic
                        // scene-graph meaning (unlike click, which is just a
                        // synthesized mouse event) — the actual step/range
                        // logic lives in the JS control (e.g. Slider knows
                        // its own min/max/step), so these are just forwarded
                        // for JS's a11yValueRegistry to act on.
                        "increment" | "decrement" | "setValue" => {
                            if s.js_nodes.contains_key(&target) {
                                s.runtime.push_event(InputEvent::AccessibilityValueChange {
                                    node_id: target,
                                    action: action.clone(),
                                    numeric_value,
                                });
                            }
                        }
                        _ => {}
                    }
                }
            }

            // ── IME (CJK/etc composition) ────────────────────────────────
            // Only forwarded to JS when a node currently has keyboard focus —
            // matches the OS's own behavior of routing IME to the focused
            // control, and avoids composition events reaching JS with no
            // target to attach to.
            ShellEvent::Ime { window_handle, kind, text, cursor } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    if s.focused_node.is_some() {
                        let (cursor_start, cursor_end) = match cursor {
                            Some((a, b)) => (Some(a), Some(b)),
                            None => (None, None),
                        };
                        s.runtime.push_event(InputEvent::Ime { kind, text, cursor_start, cursor_end });
                    }
                }
            }

            // ── Scroll ────────────────────────────────────────────────────
            ShellEvent::Scroll { window_handle, delta_y } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    s.runtime.push_event(InputEvent::Scroll { delta_y });
                }
            }

            // ── Draw ──────────────────────────────────────────────────────
            ShellEvent::RedrawRequested { window_handle } => {
                let Some(s) = windows.get_mut(&window_handle) else { return };

                #[cfg(feature = "dev")]
                handle_dev_build_events(s);

                // ── Perf: wall-clock frame time ───────────────────────────
                let frame_start = Instant::now();
                let frame_time_ms = {
                    let perf = s.perf.lock();
                    if let Some(prev) = perf.last_frame_at {
                        (frame_start - prev).as_secs_f64() * 1000.0
                    } else {
                        0.0
                    }
                };

                // 0. Drain page→JS webview messages (window.ipc.postMessage from
                // inside each webview) BEFORE the JS tick below, so a message that
                // just arrived (and woke this frame via InvalidateRect — see
                // glyx-cap-webview's wake_parent) is visible to THIS frame's
                // __glyx_webview_poll() call, not next frame's. Draining this after
                // frame_tick (where the video-events queue is drained, for example)
                // is fine for continuous streams but introduces a one-frame lag for
                // discrete click-triggered messages, which IS perceptible.
                #[cfg(feature = "webview")]
                if let Some(cap) = s.webview_cap {
                    let mut buf = vec![0u8; 64 * 1024];
                    for (&id, &handle) in s.webview_instances.iter() {
                        let mut out_len: usize = 0;
                        unsafe {
                            (cap.poll_messages)(handle, buf.as_mut_ptr(), &mut out_len, buf.len());
                        }
                        if out_len == 0 { continue; }
                        let Ok(json) = std::str::from_utf8(&buf[..out_len]) else { continue };
                        let Ok(messages) = serde_json::from_str::<Vec<String>>(json) else { continue };
                        if messages.is_empty() { continue; }
                        let webview_events = s.runtime.webview_events();
                        let mut events = webview_events.lock();
                        for msg in messages {
                            let Ok(wrapped) = serde_json::to_string(&serde_json::json!({ "id": id, "message": msg })) else { continue };
                            events.push_back(wrapped);
                        }
                    }
                }

                // 1. Resolve async JS Promises.
                s.runtime.tick();

                // 2. Pre-frame scene commands (initial mount, async completions).
                let pre_commands = s.runtime.drain_scene_commands();
                let pre_changed  = apply_scene_commands(s, pre_commands);

                // 3. JS frame callback — dispatchEvents, React state updates.
                let js_start = Instant::now();
                let frame_tick_err = s.runtime.frame_tick();
                let js_time_ms = js_start.elapsed().as_secs_f64() * 1000.0;

                // An uncaught exception here never reaches JS's own
                // `globalThis.onerror` shim (nothing in either engine fires
                // that global for engine-caught errors) — so this is the
                // only place a JS crash gets persisted in a release build.
                // Runs in every build, not just dev; see record_js_crash's docs.
                if let Some(err) = &frame_tick_err {
                    glyx_runtime::bindings::record_js_crash(err, "frame_tick");
                }

                // In dev mode, also surface JS exceptions as a visual overlay.
                #[cfg(feature = "dev")]
                if let Some(err) = frame_tick_err {
                    if let Some(dev) = s.dev_mode.as_mut() {
                        dev.last_js_error = Some(err);
                    }
                }
                #[cfg(not(feature = "dev"))]
                let _ = frame_tick_err;

                // 4. Post-frame commands (React re-renders from step 3 events).
                let post_commands = s.runtime.drain_scene_commands();
                let post_changed  = apply_scene_commands(s, post_commands);

                // 4b. Advance any active opacity transitions (@glyx-dev/motion v1) —
                // Rust-owned interpolation, no JS re-entry. If any are still
                // running after this tick, force this frame to render and
                // schedule the next one (nothing else would wake the loop).
                let transitions_active = tick_opacity_transitions(s);
                if transitions_active {
                    (s.request_redraw)();
                }

                // 5a. Pull latest camera frames and dirty only the nodes displaying them.
                #[cfg(feature = "camera")]
                let mut updated_camera_handles: Vec<u32> = Vec::new();
                #[cfg(feature = "camera")]
                for (handle_id, stream) in s.camera_streams.iter_mut() {
                    if let Some((w, h, data)) = stream.frame_buf.lock().take() {
                        stream.latest_image = Some(peniko::ImageData {
                            data: peniko::Blob::from(data),
                            format: peniko::ImageFormat::Rgba8,
                            alpha_type: peniko::ImageAlphaType::Alpha,
                            width: w, height: h,
                        });
                        updated_camera_handles.push(*handle_id);
                    }
                }
                #[cfg(not(feature = "camera"))]
                let updated_camera_handles: Vec<u32> = Vec::new();
                // 5b. Pull latest video frames and dirty only the nodes displaying them.
                // Also drain video events into the runtime's video_events queue.
                let mut updated_video_handles: Vec<u32> = Vec::new();
                for (handle_id, stream) in s.video_streams.iter_mut() {
                    if let Some((w, h, data)) = stream.frame_buf.lock().take() {
                        stream.latest_image = Some(peniko::ImageData {
                            data: peniko::Blob::from(data),
                            format: peniko::ImageFormat::Rgba8,
                            alpha_type: peniko::ImageAlphaType::Alpha,
                            width: w, height: h,
                        });
                        updated_video_handles.push(*handle_id);
                    }
                    let pending: Vec<_> = stream.events.lock().drain(..).collect();
                    if !pending.is_empty() {
                        let video_events = s.runtime.video_events();
                        let mut ve = video_events.lock();
                        ve.extend(pending);
                    }
                }
                let media_changed = !updated_camera_handles.is_empty() || !updated_video_handles.is_empty();
                // Collect media-node IDs into a local vec first to avoid a simultaneous
                // shared borrow of js_nodes and mutable borrow of dirty_nodes.
                if media_changed {
                    let media_dirty: Vec<u32> = s.js_nodes.iter()
                        .filter_map(|(&nid, node)| {
                            let cam_hit = node.props.camera_handle
                                .map_or(false, |h| updated_camera_handles.contains(&h));
                            let vid_hit = node.props.video_handle
                                .map_or(false, |h| updated_video_handles.contains(&h));
                            if cam_hit || vid_hit { Some(nid) } else { None }
                        })
                        .collect();
                    for nid in media_dirty { s.dirty_nodes.insert(nid); }
                }

                // 5. Single layout pass.
                let layout_start = Instant::now();
                recompute_layout(s);
                // Detect any position/size changes that cascaded out of layout and
                // add them to dirty_nodes before building the dirty subtree set.
                update_dirty_from_layout(s);
                build_dirty_subtrees(s);
                let layout_time_ms = layout_start.elapsed().as_secs_f64() * 1000.0;

                // Placeholder for gpu_time_ms; set after render_frame+present below.
                let perf_snapshot_pre = (frame_time_ms, js_time_ms, layout_time_ms);
                let perf_node_count   = s.js_nodes.len();

                // 6. Scroll-adjusted positions for next frame's hit-testing.
                update_scroll_positions(s);

                // 6b. Cursor blink phase — only relevant when a TextInput was visible
                //     last frame.  Skipping when no cursor is active avoids a forced
                //     full GPU render every 500 ms for apps with no focused text field.
                let now = Instant::now();
                let blink_changed = if s.cursor_was_active && now >= s.cursor_blink_deadline {
                    s.cursor_blink_on       = !s.cursor_blink_on;
                    s.cursor_blink_deadline = now + Duration::from_millis(500);
                    true
                } else {
                    false
                };

                // ── Frame gate ────────────────────────────────────────────────
                // Skip GPU work entirely when nothing changed visually.
                //
                // Two-level decision:
                //   • Release: nothing changed → return immediately, no GPU work.
                //   • Dev: overlay timer fires every ~50ms regardless of scene changes.
                //     Full Vello render only when scene changed OR overlay text is due
                //     for its 250ms refresh.  All other overlay-timer ticks blit the
                //     previous frame — skipping all 35 compute passes.
                let scene_needs_gpu = pre_changed || post_changed || transitions_active || media_changed || blink_changed;

                // Release: skip entirely when nothing changed.
                #[cfg(not(feature = "dev"))]
                if !scene_needs_gpu {
                    // Defense in depth against a stray/self-rearming timer keeping
                    // the loop awake on an otherwise-static screen: after enough
                    // consecutive no-op frames, reclaim Vello's scratch buffer pool
                    // the same way occlusion/focus-loss already do. Re-fires every
                    // IDLE_GATE_TRIM_THRESHOLD frames, not just once per streak.
                    const IDLE_GATE_TRIM_THRESHOLD: u32 = 120;
                    s.idle_gate_frames = s.idle_gate_frames.saturating_add(1);
                    let mut should_trim = s.idle_gate_frames % IDLE_GATE_TRIM_THRESHOLD == 0;

                    // Wall-clock check, independent of the frame streak above: a
                    // screen with a focused blinking text cursor forces a real
                    // render every ~500ms (blink_changed), which resets
                    // idle_gate_frames well before it reaches the streak
                    // threshold — that screen would otherwise never trim. Scaled
                    // by GPU tier: integrated/none tiers pay real system RAM for
                    // the pool and get checked often; discrete tiers have their
                    // own VRAM budget and are checked rarely.
                    let trim_check_interval = match s.gpu_tier {
                        glyx_gpu::GpuTier::Integrated | glyx_gpu::GpuTier::None => Duration::from_secs(2),
                        glyx_gpu::GpuTier::DiscreteIntel | glyx_gpu::GpuTier::Discrete => Duration::from_secs(15),
                    };
                    if now.duration_since(s.last_idle_trim_check) >= trim_check_interval {
                        s.last_idle_trim_check = now;
                        // Only actually trim if the reserved pool has grown
                        // meaningfully since the last trim — skips the
                        // reallocation cost on a pool that's already small and
                        // stable (memory_counters() is atomic reads, cheap to
                        // call on every check either way).
                        const TRIM_GROWTH_MARGIN_BYTES: u64 = 24 * 1024 * 1024;
                        let (_, _, reserved, _, _) = s.gpu.memory_counters();
                        if reserved >= s.last_trim_reserved_bytes.saturating_add(TRIM_GROWTH_MARGIN_BYTES) {
                            should_trim = true;
                        }
                    }

                    if should_trim {
                        s.renderer.trim_resources();
                        if let Present::Gpu(gpu) = &s.gpu { gpu.poll(); }
                        let (_, _, reserved_after, _, _) = s.gpu.memory_counters();
                        s.last_trim_reserved_bytes = reserved_after;
                    }
                    return;
                }
                #[cfg(not(feature = "dev"))]
                { s.idle_gate_frames = 0; }

                // Dev: compute whether a full render is actually required.
                #[cfg(feature = "dev")]
                let needs_full_render = {
                    let overlay_refresh_due = s.dev_mode.as_ref().map(|d| {
                        d.overlay_lines.is_empty()                   // first overlay draw
                        || Instant::now() >= d.overlay_next_refresh  // 250ms text refresh
                        || d.last_js_error.is_some()                 // error banner active
                    }).unwrap_or(false);
                    scene_needs_gpu || overlay_refresh_due
                };
                #[cfg(not(feature = "dev"))]
                let _needs_full_render = true;

                // 7. Acquire swapchain texture (wgpu present path only; soft
                //    present writes straight into the OS surface buffer).
                let mut surface_lost = false;
                let texture = match &s.gpu {
                    Present::Gpu(gpu) => match gpu.current_texture() {
                        Some(t) => Some(t),
                        None    => { surface_lost = true; None }
                    },
                    Present::Soft(_) => None,
                    #[cfg(target_os = "windows")]
                    Present::Direct2D(_) => None,
                };
                if surface_lost {
                    log::warn!("Surface lost or outdated; reconfiguring.");
                    let (w, h) = (s.gpu.width(), s.gpu.height());
                    s.gpu.resize(w, h);
                    return;
                }

                // ── Overlay timer reschedule ───────────────────────────────────
                // Placed here — before any early return — so the timer keeps
                // firing on blit-only frames and static apps don't freeze.
                #[cfg(feature = "dev")]
                if let Some(dev) = s.dev_mode.as_mut() {
                    if dev.overlay_visible {
                        let now = Instant::now();
                        if now >= dev.overlay_next_redraw {
                            dev.overlay_next_redraw = now + Duration::from_millis(200);
                            let req = Arc::clone(&s.request_redraw);
                            tokio_handle.spawn(async move {
                                tokio::time::sleep(Duration::from_millis(200)).await;
                                req();
                            });
                        }
                    }
                }

                // ── Fast path: blit cached frame ──────────────────────────────
                // Neither the scene nor the overlay text changed.  Re-blit the
                // previous rendered frame — skips all Vello compute passes and
                // TinySkia CPU rasterization + write_texture upload.
                //
                // Guard: `pipeline_cache_saved` is set after the first successful
                // render_frame(), so the upload texture / Vello target always
                // holds a valid image when we enter this path.
                // `!scene_cache.is_empty()` covers the Vello-specific case where
                // pipeline_cache_saved is unavailable (shouldn't happen, but safe).
                //
                // Without this fix, TinySkia (supports_caching=false) never
                // populates scene_cache, so the old guard was always false and
                // TinySkia ran a full 60fps re-rasterize even on static screens.
                // Direct2D has no cached-frame blit yet (Phase 1) — always
                // take the full-render path there rather than risk presenting
                // a stale/nonexistent cached frame.
                #[cfg(all(feature = "dev", target_os = "windows"))]
                let direct2d_active = matches!(s.gpu, Present::Direct2D(_));
                #[cfg(all(feature = "dev", not(target_os = "windows")))]
                let direct2d_active = false;

                #[cfg(feature = "dev")]
                if !needs_full_render && !direct2d_active
                    && (s.pipeline_cache_saved || !s.scene_cache.is_empty()) {
                    // Stamp last_frame_at so FPS reflects the visual refresh rate
                    // (~20fps from the overlay timer), not the full-render rate (~4fps).
                    s.perf.lock().last_frame_at = Some(frame_start);
                    match &mut s.gpu {
                        Present::Gpu(gpu) => {
                            let texture = texture.expect("wgpu path always acquires a texture");
                            if let Err(e) = s.renderer.blit_cached_frame(gpu, &texture) {
                                log::warn!("blit_cached_frame: {e}");
                            } else {
                                texture.present();
                                gpu.poll();
                            }
                        }
                        Present::Soft(sp) => sp.re_present(),
                        #[cfg(target_os = "windows")]
                        Present::Direct2D(_) => unreachable!("excluded via direct2d_active guard above"),
                    }
                    return;
                }

                // 9. Render JS scene graph.
                // Sync renderer dims before begin_frame — TinySkia/FemtoVG create
                // their per-frame buffer at their stored size; if the window was
                // just maximized/resized, Resized only updated gpu, not the renderer.
                s.renderer.notify_resize(s.gpu.width().max(1), s.gpu.height().max(1));

                // ── Damage computation (soft present + TinySkia only) ─────────
                // Redraw + push only the changed region.  Full frame when the
                // splash is up, a dev-overlay refresh is due (overlay draws on
                // top of arbitrary content), or the damage analysis bails.
                //
                // Caret blink: the caret isn't in dirty_nodes (it's render-side
                // state), so blink frames contribute the focused TextInput's
                // rect — captured during the previous render — to the damage
                // union.  An idle focused editor repaints one input at 2 Hz,
                // not the whole window.
                let frame_damage: Option<(f64, f64, f64, f64)> = {
                    let soft = matches!(s.gpu, Present::Soft(_));
                    let splash_up = s.splash_state.as_ref().map_or(false, |sp| sp.is_visible());
                    #[cfg(feature = "dev")]
                    let overlay_up = s.dev_mode.as_ref()
                        .map_or(false, |d| d.overlay_visible || d.last_js_error.is_some());
                    #[cfg(not(feature = "dev"))]
                    let overlay_up = false;

                    if !soft || splash_up || overlay_up {
                        None
                    } else {
                        // Dirty-node contribution: empty set → no rect;
                        // non-empty → union rect, or bail (full frame).
                        let dirty_damage: Option<Option<(f64, f64, f64, f64)>> =
                            if s.dirty_nodes.is_empty() {
                                Some(None)
                            } else {
                                match scene::compute_frame_damage(s) {
                                    Some(d) => Some(Some(d)),
                                    None    => None, // bail → full
                                }
                            };
                        match dirty_damage {
                            None => None,
                            Some(dd) => {
                                if blink_changed {
                                    match s.cursor_node_rect {
                                        // Pad matches compute_frame_damage's AA slack.
                                        Some((cx, cy, cw, ch)) => {
                                            let cr = (cx - 4.0, cy - 4.0, cw + 8.0, ch + 8.0);
                                            Some(match dd {
                                                None => cr,
                                                Some((dx, dy, dw, dh)) => {
                                                    let l = dx.min(cr.0);
                                                    let t = dy.min(cr.1);
                                                    let r = (dx + dw).max(cr.0 + cr.2);
                                                    let b = (dy + dh).max(cr.1 + cr.3);
                                                    (l, t, r - l, b - t)
                                                }
                                            })
                                        }
                                        // Caret position unknown (first blink
                                        // before any render) → full frame.
                                        None => None,
                                    }
                                } else {
                                    dd
                                }
                            }
                        }
                    }
                };

                let mut frame = match (&s.renderer, frame_damage) {
                    (glyx_renderer::AnyRenderer::TinySkia(_), Some(_)) => {
                        match &mut s.renderer {
                            glyx_renderer::AnyRenderer::TinySkia(r) =>
                                glyx_renderer::AnyFrame::TinySkia(r.begin_frame_damaged(frame_damage)),
                            _ => unreachable!(),
                        }
                    }
                    _ => s.renderer.begin_frame(),
                };
                let mut any_cursor_active = false;
                #[cfg(feature = "canvas3d")]
                let mut canvas3d_overlays: Vec<(u32, f32, f32, f32, f32)> = Vec::new();
                #[cfg(feature = "webview")]
                let mut webview_overlays: Vec<(u32, f32, f32, f32, f32)> = Vec::new();

                // Sample each active opacity transition's current value once,
                // fresh every frame — this is the actual interpolation step.
                let opacity_overrides: std::collections::HashMap<u32, f32> = s.opacity_transitions
                    .iter()
                    .map(|(&id, t)| (id, t.sample(Instant::now()).0))
                    .collect();

                if let Some(root_id) = s.js_root {
                    let mut render_ctx = RenderCtx {
                        nodes:             &s.js_nodes,
                        opacity_overrides: &opacity_overrides,
                        images:            &s.images,
                        resolved:          &s.resolved,
                        frame:             &mut frame,
                        text_sys:          &mut s.text_sys,
                        label_cache:       &mut s.label_cache,
                        canvas_cmds:       &s.canvas_cmds,
                        #[cfg(feature = "canvas3d")]
                        canvas3d_overlays: &mut canvas3d_overlays,
                        #[cfg(feature = "webview")]
                        webview_overlays: &mut webview_overlays,
                        #[cfg(feature = "camera")]
                        camera_streams:    &s.camera_streams,
                        video_streams:     &s.video_streams,
                        cursor_blink_on:   s.cursor_blink_on,
                        any_cursor_active: &mut any_cursor_active,
                        cursor_node_rect:  &mut s.cursor_node_rect,
                        dirty_subtrees:      &s.dirty_subtrees,
                        scene_cache:         &mut s.scene_cache,
                        scene_cache_new:     &mut s.scene_cache_new,
                        boundary_cache:      &mut s.boundary_scene_cache,
                        boundary_cache_new:  &mut s.boundary_scene_cache_new,
                        win_w: s.gpu.width()  as f64,
                        win_h: s.gpu.height() as f64,
                    };
                    render_subtree(root_id, 0.0, 1.0, &mut render_ctx);
                } else if !s.decorations {
                    // JS never produced a scene (crashed / failed to eval)
                    // and there's no OS titlebar to fall back on — the
                    // window would otherwise be fully blank and
                    // unclosable via any visible control. Same fixed
                    // top-right hit-box used by the MouseInput handler
                    // below and the Escape-key fallback.
                    let win_w = s.gpu.width()  as f64;
                    let win_h = s.gpu.height() as f64;
                    frame.fill_rect(0.0, 0.0, win_w, win_h, peniko::Color::from_rgba8(20, 20, 24, 255));
                    frame.fill_rect(win_w - CLOSE_BTN_SIZE, 0.0, CLOSE_BTN_SIZE, CLOSE_BTN_SIZE,
                        peniko::Color::from_rgba8(70, 30, 30, 255));
                    let x_lbl = s.text_sys.label("✕", 14.0);
                    frame.draw_text(&x_lbl, win_w - CLOSE_BTN_SIZE + 11.0, 9.0,
                        peniko::Color::from_rgba8(255, 190, 190, 255));
                }

                // Position the OS IME candidate window at the focused text
                // field's caret. Only meaningful while a node is focused —
                // `cursor_node_rect` is written by render.rs's Text case
                // whenever a focused, cursor-showing TextInput is drawn.
                if s.focused_node.is_some() {
                    if let Some((cx, cy, cw, ch)) = s.cursor_node_rect {
                        s.window.set_ime_cursor_area(
                            winit::dpi::PhysicalPosition::new(cx, cy),
                            winit::dpi::PhysicalSize::new(cw.max(1.0), ch.max(1.0)),
                        );
                    }
                }

                // Push the accessibility tree — only when something actually
                // changed since the last push (`a11y_dirty`, set by
                // `apply_scene_commands`). `update_if_active` is cheap when no
                // AT is running, but rebuilding the whole tree from `js_nodes`
                // every frame is real work once one IS running, so this is
                // gated rather than unconditional.
                #[cfg(feature = "a11y")]
                if s.a11y_dirty {
                    if let Some(update) = a11y::build_tree(s) {
                        (s.a11y_update.0)(update);
                    }
                    s.a11y_dirty = false;
                }

                // Native webview children: create/reposition/hide to match this
                // frame's `webview_overlays`. A webview is a real OS child window
                // the OS composites itself — not Vello content — so this runs
                // unconditionally here rather than inside the Present::Gpu-only
                // 3D-overlay blit block below.
                #[cfg(feature = "webview")]
                if let Some(cap) = s.webview_cap.filter(|_| glyx_security::get().webview) {
                    use raw_window_handle::HasWindowHandle;
                    let mut seen: std::collections::HashSet<u32> = std::collections::HashSet::new();
                    for (id, x, y, w, h) in &webview_overlays {
                        seen.insert(*id);
                        if let Some(&handle) = s.webview_instances.get(id) {
                            // Only call set_bounds on an actual change — calling it every
                            // frame with an unchanged rect made WebView2 behave as if
                            // continuously resizing and stop repainting until an input
                            // event (e.g. mouse hover) forced it to catch up.
                            let bounds_changed = s.webview_last_bounds.get(id) != Some(&(*x, *y, *w, *h));
                            if bounds_changed {
                                unsafe { (cap.set_bounds)(handle, *x, *y, *w, *h); }
                                s.webview_last_bounds.insert(*id, (*x, *y, *w, *h));
                            }
                            if s.webview_hidden.remove(id) {
                                unsafe { (cap.set_visible)(handle, 1); }
                            }
                            // Reconcile URL/HTML changes without recreating the instance.
                            if let Some(node) = s.js_nodes.get(id) {
                                let src = node.props.webview_html.as_deref()
                                    .or(node.props.webview_src.as_deref());
                                if let Some(src) = src {
                                    let changed = s.webview_last_src.get(id).map(|s| s.as_str()) != Some(src);
                                    if changed {
                                        unsafe { (cap.load_url)(handle, src.as_ptr(), src.len()); }
                                        s.webview_last_src.insert(*id, src.to_string());
                                    }
                                }
                            }
                        } else if let Some(node) = s.js_nodes.get(id) {
                            let (content, is_html) = match (&node.props.webview_html, &node.props.webview_src) {
                                (Some(html), _) => (html.as_str(), 1u8),
                                (None, Some(src)) => (src.as_str(), 0u8),
                                (None, None) => continue,
                            };
                            let opts = node.props.webview_opts.as_deref().unwrap_or("{}");
                            let Ok(raw) = s.window.window_handle() else { continue };
                            let parent_ptr = match raw.as_raw() {
                                #[cfg(target_os = "windows")]
                                raw_window_handle::RawWindowHandle::Win32(h) => {
                                    h.hwnd.get() as *mut std::ffi::c_void
                                }
                                #[cfg(target_os = "macos")]
                                raw_window_handle::RawWindowHandle::AppKit(h) => {
                                    h.ns_view.as_ptr()
                                }
                                #[cfg(all(unix, not(target_os = "macos")))]
                                raw_window_handle::RawWindowHandle::Xlib(h) => {
                                    h.window as *mut std::ffi::c_void
                                }
                                _ => continue,
                            };
                            let handle = unsafe {
                                (cap.create)(
                                    parent_ptr,
                                    content.as_ptr(), content.len(), is_html,
                                    *x, *y, *w, *h,
                                    opts.as_ptr(), opts.len(),
                                )
                            };
                            if handle != 0 {
                                s.webview_instances.insert(*id, handle);
                                s.webview_last_src.insert(*id, content.to_string());
                                s.webview_last_bounds.insert(*id, (*x, *y, *w, *h));
                            }
                        }
                    }
                    // Anything tracked but not seen this frame (display:none,
                    // scrolled out, node about to be removed next tick) — hide
                    // rather than destroy, so quick re-shows don't pay init cost.
                    for (&id, &handle) in s.webview_instances.iter() {
                        if !seen.contains(&id) && s.webview_hidden.insert(id) {
                            unsafe { (cap.set_visible)(handle, 0); }
                        }
                    }
                }

                // Splash screen overlay — drawn on top of JS scene.
                if let Some(sp) = &s.splash_state {
                    if sp.is_visible() {
                        let sw = s.gpu.width()  as f64;
                        let sh = s.gpu.height() as f64;
                        let bg = rgba_to_vello(sp.background);
                        frame.fill_rect(0.0, 0.0, sw, sh, bg);
                        if let Some(img) = &sp.image {
                            let iw = img.width  as f64;
                            let ih = img.height as f64;
                            // Two caps, take the smaller: (1) fit within the
                            // window at all, (2) never exceed `image_scale`
                            // of the smaller window dimension — this is what
                            // keeps a full-bleed source image (an app icon
                            // with no transparent margin, say) from filling
                            // the whole window and swallowing `background`.
                            let fit_scale = (sw / iw).min(sh / ih).min(1.0);
                            let max_dim   = sw.min(sh) * sp.image_scale;
                            let cap_scale = (max_dim / iw).min(max_dim / ih);
                            let scale = fit_scale.min(cap_scale);
                            let dw = iw * scale;
                            let dh = ih * scale;
                            let dx = (sw - dw) * 0.5;
                            let dy = (sh - dh) * 0.5;
                            frame.draw_image(img, dx, dy, dw, dh);
                        }
                        // Request another frame so the splash keeps redrawing until hidden.
                        (s.request_redraw)();
                    }
                }

                #[cfg(feature = "dev")]
                draw_dev_overlay(s, &mut frame);

                #[cfg(feature = "dev")]
                draw_error_overlay(s, &mut frame);

                // (overlay timer reschedule moved to before the blit-only fast path above)

                // ── Idle wgpu→soft downgrade ─────────────────────────────────
                // If this window was lazily upgraded for Canvas3D and no 3D
                // overlay has been composited for 60 s, release the entire
                // wgpu layer and return to software present.  The debounce
                // prevents device-creation thrash when 3D views mount and
                // unmount rapidly (e.g. tab switching).
                #[cfg(feature = "canvas3d")]
                {
                    const IDLE_3D: Duration = Duration::from_secs(60);
                    if !canvas3d_overlays.is_empty() {
                        s.canvas3d_last_used = Some(Instant::now());
                        s.downgrade_timer_armed = false;
                    } else if s.gpu_was_upgraded && matches!(s.gpu, Present::Gpu(_)) {
                        let last = s.canvas3d_last_used.unwrap_or(frame_start);
                        if last.elapsed() >= IDLE_3D {
                            match soft_present::SoftPresent::new(Arc::clone(&s.window)) {
                                Ok(sp) => {
                                    log::info!(
                                        "Canvas3D idle for 60 s — releasing wgpu, \
                                         back to software present."
                                    );
                                    let size = s.window.inner_size();
                                    s.renderer = AnyRenderer::TinySkia(
                                        glyx_renderer::TinySkiaRenderer::new_cpu_only(
                                            size.width, size.height));
                                    s.renderer.set_background_color(rgba_to_vello(window_bg));
                                    s.gpu = Present::Soft(sp);
                                    s.renderer_3d = None;
                                    s.gpu_was_upgraded = false;
                                    s.gpu_upgrade_failed = false;
                                    s.pipeline_cache_saved = false;
                                    // This frame targeted the old wgpu renderer;
                                    // discard and re-render through soft present.
                                    (s.request_redraw)();
                                    return;
                                }
                                Err(e) => {
                                    // Keep the wgpu path; don't retry every frame.
                                    log::warn!("idle downgrade unavailable: {e}");
                                    s.gpu_was_upgraded = false;
                                }
                            }
                        } else if !s.downgrade_timer_armed {
                            // Static 3D-less screens get no further frames, so
                            // arm one wake-up at the deadline to run this check.
                            s.downgrade_timer_armed = true;
                            let req = Arc::clone(&s.request_redraw);
                            let wait = IDLE_3D.saturating_sub(last.elapsed())
                                + Duration::from_millis(100);
                            tokio_handle.spawn(async move {
                                tokio::time::sleep(wait).await;
                                req();
                            });
                        }
                    }
                }

                // ── Lazy soft→wgpu upgrade for Canvas3D ──────────────────────
                // 2D-only apps never create a wgpu device (35 MB baseline);
                // the first Canvas3D node pays the GPU cost on demand, once.
                #[cfg(feature = "canvas3d")]
                if !canvas3d_overlays.is_empty()
                    && matches!(s.gpu, Present::Soft(_))
                    && !s.gpu_upgrade_failed
                {
                    log::info!("Canvas3D node detected — initialising wgpu present path.");
                    match pollster::block_on(GpuContext::new(Arc::clone(&s.window))) {
                        Ok(gpu_ctx) => match AnyRenderer::new(&gpu_ctx, BackendKind::TinySkia) {
                            Ok(mut r) => {
                                r.set_background_color(rgba_to_vello(window_bg));
                                s.renderer = r;
                                s.gpu = Present::Gpu(gpu_ctx);
                                s.pipeline_cache_saved = false;
                                s.gpu_was_upgraded = true;
                                s.canvas3d_last_used = Some(Instant::now());
                                // This frame was rasterized for the soft path;
                                // discard it and re-render through wgpu.  The
                                // frame owns the old renderer's shared state,
                                // which dies with the replaced renderer.
                                (s.request_redraw)();
                                return;
                            }
                            Err(e) => {
                                s.gpu_upgrade_failed = true;
                                log::error!("Canvas3D wgpu upgrade failed (renderer): {e}");
                            }
                        },
                        Err(e) => {
                            s.gpu_upgrade_failed = true;
                            log::error!("Canvas3D wgpu upgrade failed (GPU): {e}");
                        }
                    }
                }

                let gpu_start = Instant::now();
                match &mut s.gpu {
                    Present::Gpu(gpu) => {
                        let texture = texture.expect("wgpu path always acquires a texture");
                        if let Err(e) = s.renderer.render_frame(gpu, &texture, frame) {
                            log::error!("Render error: {}", e);
                            return;
                        }

                        // 3D overlays — blitted on top of Vello with LoadOp::Load.
                        #[cfg(feature = "canvas3d")]
                        if !canvas3d_overlays.is_empty() {
                            let surface_view = texture.texture.create_view(&Default::default());
                            let sw = gpu.width()  as f32;
                            let sh = gpu.height() as f32;
                            for (id, x, y, w, h) in &canvas3d_overlays {
                                // Lazy-initialise Renderer3D on first use.
                                if s.renderer_3d.is_none() {
                                    s.renderer_3d = Some(glyx_3d::Renderer3D::new(
                                        &gpu.device,
                                        &gpu.queue,
                                        gpu.surface_format(),
                                    ));
                                }
                                if s.canvas3d_dirty.contains(id) {
                                    // Scene changed this frame: full re-render.
                                    if let Some(scene) = s.canvas3d_scenes.get(id) {
                                        let gltf_paths: Vec<&str> = scene.meshes.iter()
                                            .filter_map(|m| match &m.geometry {
                                                glyx_3d::Geometry3D::Gltf { path, .. } => Some(path.as_str()),
                                                _ => None,
                                            })
                                            .collect();
                                        let r3d = s.renderer_3d.as_mut().unwrap();
                                        for path in gltf_paths {
                                            if let Err(e) = r3d.load_gltf(&gpu.device, &gpu.queue, path) {
                                                log::warn!("GLTF load error '{}': {}", path, e);
                                            }
                                        }
                                        r3d.render(&gpu.device, &gpu.queue,
                                                   *id, scene, *x, *y, *w, *h,
                                                   &surface_view, sw, sh);
                                    }
                                    s.canvas3d_dirty.remove(id);
                                } else if s.canvas3d_scenes.contains_key(id) {
                                    // Scene unchanged: blit cached texture, skip the 3D pipeline.
                                    let r3d = s.renderer_3d.as_mut().unwrap();
                                    r3d.blit_only(&gpu.device, &gpu.queue,
                                                  *id, *x, *y, *w, *h,
                                                  &surface_view, sw, sh);
                                }
                            }
                        }

                        // Drain pending __glyx_canvas3d_raycast requests — needs the
                        // live Renderer3D + Scene3D, which only glyx-core has, so
                        // this can't be answered synchronously from the binding
                        // call site. Answered as JSON, polled by JS each frame via
                        // __glyx_canvas3d_raycast_poll (same shape as video/webview
                        // events) rather than resolving a promise directly, since
                        // promise-resolution machinery is kept engine-internal.
                        #[cfg(feature = "canvas3d")]
                        {
                            let pending: Vec<_> = s.runtime.raycast_requests().lock().drain(..).collect();
                            if !pending.is_empty() {
                                let mut out = Vec::with_capacity(pending.len());
                                for req in pending {
                                    let hit = s.renderer_3d.as_ref()
                                        .zip(s.canvas3d_scenes.get(&req.canvas_id))
                                        .and_then(|(r3d, scene)| r3d.raycast(req.canvas_id, scene, req.ndc_x, req.ndc_y));
                                    out.push(match hit {
                                        Some(h) => format!(
                                            r#"{{"reqId":{},"meshIndex":{},"point":[{},{},{}],"distance":{}}}"#,
                                            req.req_id, h.mesh_index, h.point[0], h.point[1], h.point[2], h.distance,
                                        ),
                                        None => format!(r#"{{"reqId":{},"hit":null}}"#, req.req_id),
                                    });
                                }
                                s.runtime.raycast_results().lock().extend(out);
                            }
                        }

                        texture.present();
                    }
                    Present::Soft(sp) => {
                        // CPU path: finalize the tiny-skia frame and blit it to
                        // the window via the OS software surface.  No wgpu.
                        #[cfg(feature = "canvas3d")]
                        if !canvas3d_overlays.is_empty() {
                            // Only reachable when the automatic wgpu upgrade
                            // above failed (gpu_upgrade_failed set, logged once).
                            log::debug!("Canvas3D overlays skipped: wgpu unavailable.");
                        }
                        match (&mut s.renderer, frame) {
                            (glyx_renderer::AnyRenderer::TinySkia(r),
                             glyx_renderer::AnyFrame::TinySkia(f)) => {
                                r.finish_frame_soft(f, |rgba, w, h, damage| {
                                    sp.present_rgba(rgba, w, h, damage);
                                });
                            }
                            _ => {
                                log::error!("soft present requires the TinySkia renderer");
                                return;
                            }
                        }
                    }
                    #[cfg(target_os = "windows")]
                    Present::Direct2D(dp) => {
                        // D2D draws directly into its own device context during
                        // frame-build (no CPU pixel buffer, no wgpu texture) —
                        // finish_frame_d2d is EndDraw() + reclaiming the font
                        // cache moved into the frame at begin_frame; presenting
                        // the swap chain is D2DPresent's own job, called right after.
                        #[cfg(feature = "canvas3d")]
                        if !canvas3d_overlays.is_empty() {
                            // Canvas3D-on-Direct2D lazy GPU sharing is Phase 6
                            // (deferred) — not yet supported.
                            log::debug!("Canvas3D overlays skipped: not yet supported on the Direct2D backend.");
                        }
                        match (&mut s.renderer, frame) {
                            (glyx_renderer::AnyRenderer::Direct2D(r),
                             glyx_renderer::AnyFrame::Direct2D(f)) => {
                                if let Err(e) = r.finish_frame_d2d(f) {
                                    log::error!("Direct2D render error: {e}");
                                    return;
                                }
                                dp.present();
                            }
                            _ => {
                                log::error!("Direct2D present requires the Direct2D renderer");
                                return;
                            }
                        }
                    }
                }

                // Release staging buffers and D3D12 command allocators from
                // completed GPU submissions.  Without this, wgpu's upload ring
                // buffer accumulates every frame (especially on DX12/iGPU where
                // GPU memory = system RAM), causing unbounded RSS growth.
                s.gpu.poll();

                // Periodic V8 major GC — every ~5 s at 60 fps.
                // Animation loops (Canvas3D at 30 fps, Canvas2D at 60 fps) promote
                // short-lived React objects into V8's old generation faster than
                // automatic minor GC can drain them, causing ~46 KB/s RSS growth.
                // `gc_hint()` forces a full collection that reclaims them (<2 ms).
                s.gc_frame_counter = s.gc_frame_counter.wrapping_add(1);
                if s.gc_frame_counter % 180 == 0 {
                    s.runtime.gc_hint();
                    // After V8 reclaims its heap, force mimalloc to immediately
                    // decommit any segments that are now completely free rather
                    // than waiting for its background purge timer (which can
                    // take 20+ minutes to trigger a large segment decommit).
                    // mi_collect(force=true) is a no-op if nothing is free,
                    // so it is safe to call unconditionally here.
                    extern "C" { fn mi_collect(force: bool); }
                    unsafe { mi_collect(true); }
                }

                // Persist compiled shader bytecode once so subsequent launches
                // skip Vulkan shader recompilation.  Runs exactly once per
                // process (no-op after the first frame; no-op on DX12/Metal).
                if !s.pipeline_cache_saved {
                    s.renderer.try_save_pipeline_cache();
                    s.pipeline_cache_saved = true;
                }

                // Update prev_resolved snapshot and clear per-frame dirty sets.
                snapshot_resolved(s);
                s.dirty_nodes.clear();
                s.dirty_subtrees.clear();

                // Rotate scene cache: scene_cache_new becomes the cache for the
                // next frame; the old scene_cache (stale entries for hidden /
                // removed nodes) is cleared and reused as the write buffer.
                std::mem::swap(&mut s.scene_cache, &mut s.scene_cache_new);
                s.scene_cache_new.clear();
                // Same rotation for RepaintBoundary fragment cache.
                std::mem::swap(&mut s.boundary_scene_cache, &mut s.boundary_scene_cache_new);
                s.boundary_scene_cache_new.clear();

                let gpu_time_ms = gpu_start.elapsed().as_secs_f64() * 1000.0;

                // Record perf sample (skips the first frame where frame_time_ms = 0).
                let (frame_time_ms, js_time_ms, layout_time_ms) = perf_snapshot_pre;
                if frame_time_ms > 0.0 {
                    let heap = s.runtime.heap_stats();
                    // RSS is updated by a background tokio task every 2 s — zero OS cost here.
                    let process_rss = s.rss_bytes.load(std::sync::atomic::Ordering::Relaxed);
                    // wgpu GPU memory counters — reads atomics, zero GPU cost.
                    let (gpu_buf_bytes, gpu_tex_bytes, gpu_reserved_bytes,
                         gpu_buf_count, gpu_tex_count) = s.gpu.memory_counters();
                    let mut perf = s.perf.lock();
                    perf.last_frame_at = Some(frame_start);

                    // Dev mode: simple node-count leak heuristic.
                    // If the node count grows monotonically for 600 frames (5s at 120fps),
                    // emit a warning suggesting a possible render leak.
                    #[cfg(feature = "dev")]
                    {
                        if perf._node_history.len() >= 600 { perf._node_history.pop_front(); }
                        let prev = perf._node_history.back().copied().unwrap_or(0);
                        perf._node_history.push_back(perf_node_count);
                        if perf_node_count > prev {
                            perf._monotonic_frames += 1;
                            if perf._monotonic_frames == 600 {
                                perf.push_leak_warning(format!(
                                    "{{\"type\":\"nodeCount\",\"count\":{},\"frames\":600,\"msg\":\"Node count has grown monotonically for 600 frames — possible render leak\"}}",
                                    perf_node_count
                                ));
                            }
                        } else {
                            perf._monotonic_frames = 0;
                        }
                    }

                    // Capture startup baseline on first frame with valid RSS.
                    #[cfg(feature = "dev")]
                    if let Some(dev) = s.dev_mode.as_mut() {
                        if dev.startup_rss_bytes == 0 && process_rss > 0 {
                            dev.startup_rss_bytes      = process_rss;
                            dev.startup_v8_total_bytes = heap.total_heap_size;
                        }
                    }

                    perf.push(glyx_perf::PerfFrame {
                        frame_time_ms,
                        js_time_ms,
                        layout_time_ms,
                        gpu_time_ms,
                        node_count: perf_node_count,
                        heap_used_bytes:  heap.used_heap_size,
                        heap_total_bytes: heap.total_heap_size,
                        process_rss_bytes: process_rss,
                        gpu_buffer_bytes:   gpu_buf_bytes,
                        gpu_texture_bytes:  gpu_tex_bytes,
                        gpu_reserved_bytes: gpu_reserved_bytes,
                        gpu_buffer_count:   gpu_buf_count,
                        gpu_texture_count:  gpu_tex_count,
                    });
                } else {
                    s.perf.lock().last_frame_at = Some(frame_start);
                }

                s.cursor_was_active = any_cursor_active;
                if any_cursor_active {
                    // One persistent timer thread per window (lazy). Each frame we
                    // send the next blink deadline; the thread coalesces deadlines
                    // received while waiting and fires a single redraw per blink.
                    let tx = s.cursor_blink_tx.get_or_insert_with(|| {
                        let (tx, rx) = std::sync::mpsc::channel::<Instant>();
                        let redraw = Arc::clone(&s.request_redraw);
                        std::thread::Builder::new()
                            .name("glyx-cursor-blink".into())
                            .stack_size(64 * 1024)
                            .spawn(move || {
                                while let Ok(mut deadline) = rx.recv() {
                                    loop {
                                        let now = Instant::now();
                                        if deadline <= now { break; }
                                        match rx.recv_timeout(deadline - now) {
                                            Ok(newer) => deadline = newer,
                                            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => break,
                                            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => return,
                                        }
                                    }
                                    redraw();
                                }
                            })
                            .expect("spawn cursor-blink timer");
                        tx
                    });
                    let _ = tx.send(s.cursor_blink_deadline);
                }
            }

            // ── Close ─────────────────────────────────────────────────────
            // ── Window occluded (minimised / hidden) ──────────────────────
            // Release the ~100–170 MB Vello GPU buffer pool while the window
            // is not visible.  Buffers are reallocated lazily on first redraw
            // after restore (µs cost; compiled shaders stay cached in driver).
            ShellEvent::Occluded { window_handle, occluded: true } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    s.renderer.trim_resources();
                    // Also drop CPU-side decoded image pixels. They'll be re-decoded
                    // from disk on restore (fast; atlas re-upload is the slow part,
                    // and that cost is paid anyway after trim_resources clears GPU buffers).
                    s.images_by_path.clear();
                    log::debug!("Window {window_handle} occluded — GPU buffer pool + image CPU cache released.");
                }
            }

            ShellEvent::Occluded { .. } => {} // un-occlude: nothing to do, buffers reallocate lazily

            ShellEvent::FocusChanged { focused: false, .. } => {
                // Window lost focus — user switched to another app.
                // Run V8 GC + renderer pool trim + mimalloc segment decommit
                // immediately while no frame is in flight. This is the primary
                // intelligent trigger for memory recovery; no developer action
                // required. The renderer pools (Vello GPU buffers, skia
                // glyph caches) rebuild lazily over the next few frames on return.
                for s in windows.values_mut() {
                    s.runtime.gc_hint();
                    s.renderer.trim_resources();
                }
                extern "C" { fn mi_collect(force: bool); }
                unsafe { mi_collect(true); }
                log::debug!("Focus lost — GC + renderer trim + mi_collect triggered.");
            }

            ShellEvent::FocusChanged { .. } => {} // gained focus: nothing to do

            ShellEvent::CloseRequested { window_handle } => {
                log::info!("Window {} closed.", window_handle);
                // Close SQLite pools gracefully before dropping the window state.
                if let Some(s) = windows.get(&window_handle) {
                    s.runtime.shutdown_db_pools();
                }
                // Free the dedupe slot so the window can be reopened.
                glyx_runtime::window_registry_remove(window_handle);
                windows.remove(&window_handle);
            }
        }
    });

    drop(tokio_rt);
    restart
}

#[cfg(test)]
mod tests {
    use super::*;
    use glyx_gpu::GpuTier;
    use glyx_security::Capabilities;

    // ── Backend selection (renderMode + GPU tier → concrete backend) ──────────

    #[test]
    fn auto_selects_tinyskia_for_no_gpu_and_integrated() {
        // Integrated GPUs share system RAM, so GPU buffer pools inflate RSS —
        // the heuristic must route both tiers to the CPU rasterizer.
        assert_eq!(resolve_backend(RenderMode::Auto, GpuTier::None, false), BackendKind::TinySkia);
        assert_eq!(resolve_backend(RenderMode::Auto, GpuTier::Integrated, false), BackendKind::TinySkia);
    }

    #[test]
    fn auto_selects_vello_for_intel_arc() {
        assert_eq!(resolve_backend(RenderMode::Auto, GpuTier::DiscreteIntel, false), BackendKind::Vello { use_cpu: false });
    }

    #[test]
    fn auto_selects_vello_gpu_for_discrete() {
        assert_eq!(
            resolve_backend(RenderMode::Auto, GpuTier::Discrete, false),
            BackendKind::Vello { use_cpu: false },
        );
    }

    #[test]
    fn explicit_pin_beats_auto_detection() {
        // Even on a discrete GPU, an explicit backend pin must win.
        assert_eq!(resolve_backend(RenderMode::TinySkia, GpuTier::Discrete, false), BackendKind::TinySkia);
        assert_eq!(
            resolve_backend(RenderMode::Cpu, GpuTier::Discrete, false),
            BackendKind::Vello { use_cpu: true },
        );
    }

    #[test]
    fn force_cpu_downgrades_auto_and_gpu_but_not_pins() {
        // GLYX_CPU_RENDER=1: Auto behaves as if there were no GPU...
        assert_eq!(resolve_backend(RenderMode::Auto, GpuTier::Discrete, true), BackendKind::TinySkia);
        // ...an explicit Gpu pin falls back to Vello's CPU path...
        assert_eq!(
            resolve_backend(RenderMode::Gpu, GpuTier::Discrete, true),
            BackendKind::Vello { use_cpu: true },
        );
        // ...and explicit CPU-safe pins are unaffected.
        assert_eq!(resolve_backend(RenderMode::TinySkia, GpuTier::None, true), BackendKind::TinySkia);
    }

    #[test]
    fn auto_never_selects_direct2d() {
        // Direct2D is experimental/opt-in — Auto must only ever choose between
        // Vello and TinySkia, regardless of tier, even on Windows.
        for tier in [GpuTier::None, GpuTier::Integrated, GpuTier::DiscreteIntel, GpuTier::Discrete] {
            let backend = resolve_backend(RenderMode::Auto, tier, false);
            assert_ne!(backend, BackendKind::Direct2D);
        }
    }

    #[test]
    fn explicit_direct2d_pin_resolves_per_platform() {
        let backend = resolve_backend(RenderMode::Direct2D, GpuTier::Integrated, false);
        #[cfg(target_os = "windows")]
        assert_eq!(backend, BackendKind::Direct2D);
        // Non-Windows: falls back to TinySkia (with a logged warning) rather
        // than erroring, since Direct2D isn't a real option on that platform.
        #[cfg(not(target_os = "windows"))]
        assert_eq!(backend, BackendKind::TinySkia);
    }

    // ── renderMode string parsing ──────────────────────────────────────────────

    #[test]
    fn render_mode_strings_map_to_variants() {
        assert_eq!(parse_render_mode("auto"), RenderMode::Auto);
        assert_eq!(parse_render_mode("skia"), RenderMode::TinySkia);
        assert_eq!(parse_render_mode("cpu"), RenderMode::Cpu);
        assert_eq!(parse_render_mode("gpu"), RenderMode::Gpu);
        assert_eq!(parse_render_mode("direct2d"), RenderMode::Direct2D);
        // Unknown values fall back to Gpu rather than erroring.
        assert_eq!(parse_render_mode("not-a-mode"), RenderMode::Gpu);
    }

    // ── glyx.config.json → WindowConfig ───────────────────────────────────────

    fn apply(json: &str) -> (WindowConfig, Capabilities) {
        let mut cfg = WindowConfig::default();
        let (caps, _plugins) = apply_config_json(json, &mut cfg);
        (cfg, caps)
    }

    #[test]
    fn config_window_overrides_apply() {
        let (cfg, _) = apply(r#"{
            "window": {
                "title": "My App", "width": 900, "height": 600,
                "renderMode": "skia", "decorations": false
            }
        }"#);
        assert_eq!(cfg.title, "My App");
        assert_eq!(cfg.width, 900);
        assert_eq!(cfg.height, 600);
        assert_eq!(cfg.render_mode, RenderMode::TinySkia);
        assert!(!cfg.decorations);
    }

    #[test]
    fn config_no_size_implies_maximized() {
        let (cfg, _) = apply(r#"{ "window": { "title": "x" } }"#);
        assert_eq!(cfg.startup_mode, glyx_shell::StartupMode::Maximized);

        let (cfg, _) = apply(r#"{ "window": { "width": 800, "height": 500 } }"#);
        assert_eq!(cfg.startup_mode, glyx_shell::StartupMode::Windowed);

        let (cfg, _) = apply(r#"{ "window": { "startupMode": "fullscreen" } }"#);
        assert_eq!(cfg.startup_mode, glyx_shell::StartupMode::Fullscreen);
    }

    #[test]
    fn config_heap_cap_is_clamped() {
        let (cfg, _) = apply(r#"{ "window": { "maxJsHeapMb": 4 } }"#);
        assert_eq!(cfg.max_js_heap_mb, Some(16));
        let (cfg, _) = apply(r#"{ "window": { "maxJsHeapMb": 9999 } }"#);
        assert_eq!(cfg.max_js_heap_mb, Some(512));
        let (cfg, _) = apply(r#"{ "window": {} }"#);
        assert_eq!(cfg.max_js_heap_mb, None);
    }

    #[test]
    fn config_canvas_transport_defaults_and_clamps() {
        // Unknown protocol → binary (the default).
        let (cfg, _) = apply(r#"{ "canvas": { "protocol": "carrier-pigeon" } }"#);
        assert_eq!(cfg.canvas_protocol, "binary");
        let (cfg, _) = apply(r#"{ "canvas": { "protocol": "json" } }"#);
        assert_eq!(cfg.canvas_protocol, "json");
        // bufferKB clamped to [16, 4096].
        let (cfg, _) = apply(r#"{ "canvas": { "bufferKB": 1 } }"#);
        assert_eq!(cfg.canvas_buffer_kb, Some(16));
        let (cfg, _) = apply(r#"{ "canvas": { "bufferKB": 100000 } }"#);
        assert_eq!(cfg.canvas_buffer_kb, Some(4096));
    }

    #[test]
    fn config_capabilities_pass_through() {
        let (_, caps) = apply(r#"{
            "capabilities": {
                "db": true,
                "network": { "allow": ["api.example.com"] }
            }
        }"#);
        assert!(caps.db);
        assert!(caps.can_network("api.example.com"));
        assert!(!caps.can_network("other.example.com"));
    }

    #[test]
    fn config_webview_capability_defaults_false_and_parses_true() {
        // webview used to be entirely unenforced (no field on Capabilities at
        // all) — declaring it a real, parsed capability so a <WebView> node
        // fails closed without it, matching every other capability.
        let (_, caps_off) = apply(r#"{ "capabilities": { "db": true } }"#);
        assert!(!caps_off.webview);
        let (_, caps_on) = apply(r#"{ "capabilities": { "webview": true } }"#);
        assert!(caps_on.webview);
    }

    #[test]
    fn config_invalid_json_yields_defaults() {
        // A corrupt config must not panic — it logs and leaves defaults intact.
        let (cfg, caps) = apply("{ this is not json");
        assert_eq!(cfg.render_mode, RenderMode::default());
        assert!(!caps.db);
        assert!(!caps.can_read_fs());
    }
}
