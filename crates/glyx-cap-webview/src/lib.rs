//! `glyx-cap-webview` — embeds an OS-native child webview (via `wry`) into a
//! parent window, exposed through the `glyx-cap-abi::WebviewCap` C ABI.
//!
//! One instance = one handle. `glyx-core` creates one per `WebView` scene
//! node, repositions it on layout change, and destroys it on node removal —
//! same lifecycle as every other per-node native resource in the framework.
//!
//! # Threading
//! `wry::WebView` wraps platform objects that are not `Send`/`Sync` (e.g.
//! WebView2's `ICoreWebView2Controller` is apartment-threaded COM). Per the
//! ABI contract (see `glyx-cap-abi` doc comments), every function here is
//! called from the same thread (glyx-core's main/UI thread) — so state lives
//! in a `thread_local!` `RefCell`, the same pattern this project already
//! uses for other `!Send` native handles (e.g. audio's `OutputStream`).

use std::cell::RefCell;
use std::collections::HashMap;
use std::ffi::c_void;
use std::path::{Component, Path, PathBuf};

use raw_window_handle::{
    DisplayHandle, HasDisplayHandle, HasWindowHandle, RawDisplayHandle, RawWindowHandle,
    WindowHandle,
};
use serde::Deserialize;
use wry::{Rect, WebView, WebViewBuilder};

use glyx_cap_abi::{WebviewCap, ABI_VERSION};

/// Wraps a raw platform window handle (received over FFI as `*mut c_void`)
/// so `wry::WebViewBuilder::build_as_child` can attach to it. The pointer's
/// validity for the lifetime of the created webview is the FFI caller's
/// responsibility (glyx-core keeps the parent `winit::window::Window` alive
/// for as long as any of its child webviews exist).
struct RawParentWindow(*mut c_void);

impl HasWindowHandle for RawParentWindow {
    fn window_handle(&self) -> Result<WindowHandle<'_>, raw_window_handle::HandleError> {
        #[cfg(target_os = "windows")]
        let raw = {
            let mut h = raw_window_handle::Win32WindowHandle::new(
                std::num::NonZeroIsize::new(self.0 as isize)
                    .ok_or(raw_window_handle::HandleError::Unavailable)?,
            );
            h.hinstance = None;
            RawWindowHandle::Win32(h)
        };
        #[cfg(target_os = "macos")]
        let raw = {
            let h = raw_window_handle::AppKitWindowHandle::new(
                std::ptr::NonNull::new(self.0).ok_or(raw_window_handle::HandleError::Unavailable)?,
            );
            RawWindowHandle::AppKit(h)
        };
        #[cfg(all(unix, not(target_os = "macos")))]
        let raw = {
            let h = raw_window_handle::XlibWindowHandle::new(self.0 as u64);
            RawWindowHandle::Xlib(h)
        };
        // SAFETY: `raw` is constructed from the FFI-supplied native handle,
        // valid for the lifetime the caller guarantees (see struct doc).
        Ok(unsafe { WindowHandle::borrow_raw(raw) })
    }
}

impl HasDisplayHandle for RawParentWindow {
    fn display_handle(&self) -> Result<DisplayHandle<'_>, raw_window_handle::HandleError> {
        // Windows/macOS have no separate display handle concept; wry ignores
        // this on those platforms. Linux (Xlib) would need a real display
        // pointer plumbed through the ABI if/when Linux webview support lands.
        Ok(unsafe {
            DisplayHandle::borrow_raw(RawDisplayHandle::Windows(
                raw_window_handle::WindowsDisplayHandle::new(),
            ))
        })
    }
}

#[derive(Deserialize, Default)]
struct CreateOpts {
    #[serde(default = "default_true")]
    sandbox: bool,
    #[serde(default)]
    allowed_origins: Vec<String>,
    #[serde(default)]
    assets_root: Option<String>,
}
fn default_true() -> bool { true }

struct Instance {
    webview: WebView,
}

#[derive(Default)]
struct WebviewState {
    instances: HashMap<u32, Instance>,
    /// Messages received from pages via the injected `window.ipc.postMessage(str)`,
    /// queued per-handle until `poll_messages` drains them.
    inbox: HashMap<u32, Vec<String>>,
    next_handle: u32,
}

thread_local! {
    static STATE: RefCell<WebviewState> = RefCell::new(WebviewState { next_handle: 1, ..Default::default() });
}

/// `..` under an asset root would escape it; reject any component that isn't
/// a plain filename segment (mirrors the traversal-safety approach used by
/// the framework's fs capability's globset scoping).
fn resolve_scoped_asset(root: &Path, requested: &str) -> Option<PathBuf> {
    let requested = requested.trim_start_matches('/');
    let mut out = root.to_path_buf();
    for seg in Path::new(requested).components() {
        match seg {
            Component::Normal(s) => out.push(s),
            _ => return None, // reject .., prefix, root, curdir — no ambiguity allowed
        }
    }
    let canon_root = root.canonicalize().ok()?;
    let canon_out = out.canonicalize().ok()?;
    canon_out.starts_with(&canon_root).then_some(canon_out)
}

/// Wake the parent glyx window's render loop after a page→JS message arrives.
///
/// wry's IPC handler fires on WebView2's own message pump, entirely outside
/// glyx-core's winit event loop — nothing else schedules a new frame, so a
/// message posted while the app is otherwise idle (no mouse movement, no
/// animation) would sit in the inbox until some unrelated input event
/// happened to trigger a redraw. `InvalidateRect` marks the window dirty,
/// which generates a WM_PAINT that winit's Win32 backend turns into a
/// `RedrawRequested` event — the same mechanism `Window::request_redraw()`
/// uses internally, without needing to plumb a callback across the C ABI.
#[cfg(target_os = "windows")]
fn wake_parent(hwnd_addr: usize) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::Graphics::Gdi::InvalidateRect;
    unsafe {
        InvalidateRect(hwnd_addr as HWND, std::ptr::null(), 0);
    }
}
#[cfg(not(target_os = "windows"))]
fn wake_parent(_hwnd_addr: usize) {
    // TODO: macOS (setNeedsDisplay:) / Linux (gtk_widget_queue_draw) — only
    // the Windows path has been exercised so far.
}

fn origin_of(url: &str) -> Option<String> {
    let scheme_end = url.find("://")? + 3;
    let rest = &url[scheme_end..];
    let end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    Some(format!("{}{}", &url[..scheme_end], &rest[..end]))
}

unsafe extern "C" fn webview_init() -> i32 {
    0
}

unsafe extern "C" fn webview_create(
    parent_handle: *mut c_void,
    url_or_html: *const u8,
    len: usize,
    is_html: u8,
    x: f32, y: f32, w: f32, h: f32,
    opts_json: *const u8,
    opts_json_len: usize,
) -> u32 {
    if parent_handle.is_null() || url_or_html.is_null() {
        return 0;
    }
    let content = unsafe { std::slice::from_raw_parts(url_or_html, len) };
    let Ok(content) = std::str::from_utf8(content) else { return 0 };

    let opts: CreateOpts = if opts_json.is_null() || opts_json_len == 0 {
        CreateOpts { sandbox: true, ..Default::default() }
    } else {
        let raw = unsafe { std::slice::from_raw_parts(opts_json, opts_json_len) };
        std::str::from_utf8(raw).ok().and_then(|s| serde_json::from_str(s).ok()).unwrap_or_default()
    };

    let parent = RawParentWindow(parent_handle);

    // Navigation allowlist: explicit list if given, else pin to the initial
    // URL's own origin (so a plain `<WebView src="https://x.com"/>` can't be
    // redirected off-site by the loaded page unless the app opts in).
    let mut allowed_origins = opts.allowed_origins.clone();
    if allowed_origins.is_empty() && is_html == 0 {
        if let Some(o) = origin_of(content) {
            allowed_origins.push(o);
        }
    }
    let assets_root = opts.assets_root.clone();

    let mut builder = WebViewBuilder::new()
        .with_bounds(Rect {
            position: wry::dpi::LogicalPosition::new(x, y).into(),
            size: wry::dpi::LogicalSize::new(w, h).into(),
        })
        .with_devtools(!opts.sandbox);

    if !allowed_origins.is_empty() {
        builder = builder.with_navigation_handler(move |target: String| {
            // Always allow the app's own asset scheme.
            if target.starts_with("glyx-asset://") {
                return true;
            }
            match origin_of(&target) {
                Some(o) => allowed_origins.iter().any(|a| a == &o),
                None => false,
            }
        });
    }

    if let Some(root) = assets_root {
        let root_path = PathBuf::from(root);
        builder = builder.with_custom_protocol("glyx-asset".into(), move |_id, request| {
            let path_str = request.uri().path();
            let body: Vec<u8> = resolve_scoped_asset(&root_path, path_str)
                .and_then(|p| std::fs::read(p).ok())
                .unwrap_or_default();
            let status = if body.is_empty() { 404 } else { 200 };
            wry::http::Response::builder()
                .status(status)
                .body(std::borrow::Cow::Owned(body))
                .unwrap_or_else(|_| {
                    wry::http::Response::builder()
                        .status(500)
                        .body(std::borrow::Cow::Owned(Vec::new()))
                        .expect("static 500 response is well-formed")
                })
        });
    }

    builder = if is_html != 0 { builder.with_html(content) } else { builder.with_url(content) };

    let handle_id = STATE.with(|s| {
        let mut s = s.borrow_mut();
        let id = s.next_handle;
        s.next_handle += 1;
        id
    });

    let parent_addr = parent_handle as usize;
    builder = builder.with_ipc_handler(move |msg: wry::http::Request<String>| {
        STATE.with(|s| {
            s.borrow_mut().inbox.entry(handle_id).or_default().push(msg.into_body());
        });
        wake_parent(parent_addr);
    });

    let webview = match builder.build_as_child(&parent) {
        Ok(wv) => wv,
        Err(e) => {
            log::warn!("glyx-cap-webview: failed to create child webview: {e}");
            return 0;
        }
    };

    STATE.with(|s| s.borrow_mut().instances.insert(handle_id, Instance { webview }));
    handle_id
}

unsafe extern "C" fn webview_set_bounds(handle: u32, x: f32, y: f32, w: f32, h: f32) {
    STATE.with(|s| {
        if let Some(inst) = s.borrow().instances.get(&handle) {
            let _ = inst.webview.set_bounds(Rect {
                position: wry::dpi::LogicalPosition::new(x, y).into(),
                size: wry::dpi::LogicalSize::new(w, h).into(),
            });
        }
    });
}

unsafe extern "C" fn webview_set_visible(handle: u32, visible: u8) {
    STATE.with(|s| {
        if let Some(inst) = s.borrow().instances.get(&handle) {
            let _ = inst.webview.set_visible(visible != 0);
        }
    });
}

unsafe extern "C" fn webview_load_url(handle: u32, url: *const u8, url_len: usize) {
    if url.is_null() {
        return;
    }
    let bytes = unsafe { std::slice::from_raw_parts(url, url_len) };
    let Ok(url) = std::str::from_utf8(bytes) else { return };
    STATE.with(|s| {
        if let Some(inst) = s.borrow().instances.get(&handle) {
            let _ = inst.webview.load_url(url);
        }
    });
}

unsafe extern "C" fn webview_post_message(handle: u32, msg: *const u8, msg_len: usize) {
    if msg.is_null() {
        return;
    }
    let bytes = unsafe { std::slice::from_raw_parts(msg, msg_len) };
    let Ok(msg) = std::str::from_utf8(bytes) else { return };
    // Delivered to the page as a `message` event.
    let script = format!(
        "window.dispatchEvent(new MessageEvent('message',{{data:{}}}));",
        serde_json::to_string(msg).unwrap_or_else(|_| "null".into())
    );
    STATE.with(|s| {
        if let Some(inst) = s.borrow().instances.get(&handle) {
            let _ = inst.webview.evaluate_script(&script);
        }
    });
}

unsafe extern "C" fn webview_poll_messages(
    handle: u32,
    out_buf: *mut u8,
    out_len: *mut usize,
    buf_cap: usize,
) {
    if out_buf.is_null() || out_len.is_null() {
        return;
    }
    let drained: Vec<String> = STATE.with(|s| s.borrow_mut().inbox.remove(&handle).unwrap_or_default());
    let json = serde_json::to_string(&drained).unwrap_or_else(|_| "[]".into());
    let bytes = json.as_bytes();
    let n = bytes.len().min(buf_cap);
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), out_buf, n);
        *out_len = n;
    }
}

unsafe extern "C" fn webview_destroy(handle: u32) {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.instances.remove(&handle);
        s.inbox.remove(&handle);
    });
}

unsafe extern "C" fn webview_shutdown() {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.instances.clear();
        s.inbox.clear();
    });
}

static WEBVIEW_CAP: WebviewCap = WebviewCap {
    version: ABI_VERSION,
    init: webview_init,
    create: webview_create,
    set_bounds: webview_set_bounds,
    set_visible: webview_set_visible,
    load_url: webview_load_url,
    post_message: webview_post_message,
    poll_messages: webview_poll_messages,
    destroy: webview_destroy,
    shutdown: webview_shutdown,
};

pub fn static_cap() -> &'static WebviewCap {
    &WEBVIEW_CAP
}

#[no_mangle]
pub extern "C" fn glyx_cap_webview() -> *const WebviewCap {
    &WEBVIEW_CAP
}
