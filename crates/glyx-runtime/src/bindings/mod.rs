//! Native function bindings exposed to JavaScript.

use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use parking_lot::Mutex;

use base64::Engine as _;
use tokio::runtime::Handle;
use notify::RecommendedWatcher;

#[cfg(feature = "v8")]
use crate::Scope;

// All of these bind_*.rs submodules are V8 FunctionCallback-based glue —
// 100% V8-specific, unlike the shared data model below (InputEvent,
// SceneCommand, NodeProps, etc.). A QuickJS backend needs its own parallel
// binding layer written against rquickjs's callback signature; it cannot
// reuse these files as-is (see memory/quickjs-milestone0-progress.md).
#[cfg(feature = "v8")]
mod bind_core;
#[cfg(feature = "v8")]
mod bind_fs;
#[cfg(feature = "v8")]
mod bind_db;
#[cfg(feature = "v8")]
mod bind_net;
#[cfg(feature = "v8")]
mod bind_sys;
#[cfg(feature = "v8")]
mod bind_media;
#[cfg(feature = "v8")]
mod bind_canvas;
#[cfg(feature = "v8")]
mod bind_ai;
#[cfg(feature = "v8")]
mod bind_updater;
#[cfg(feature = "v8")]
mod bind_tray;
#[cfg(all(feature = "v8", feature = "shell"))]
mod bind_shell;

#[cfg(feature = "v8")]
pub use self::bind_core::*;
#[cfg(feature = "v8")]
pub use self::bind_fs::*;
#[cfg(feature = "v8")]
pub use self::bind_db::*;
#[cfg(feature = "v8")]
pub use self::bind_net::*;
#[cfg(feature = "v8")]
pub use self::bind_sys::*;
#[cfg(feature = "v8")]
pub use self::bind_media::*;
#[cfg(feature = "v8")]
pub use self::bind_canvas::*;
#[cfg(feature = "v8")]
pub use self::bind_ai::*;
#[cfg(feature = "v8")]
pub use self::bind_updater::*;
#[cfg(feature = "v8")]
pub use self::bind_tray::*;
#[cfg(all(feature = "v8", feature = "shell"))]
pub use self::bind_shell::*;

// IPC bus 
//
// Shared across all windows in the process.  Each window registers its inbox
// under its handle when it starts.  Any window can push a message to any other
// window by looking up the target's inbox in the bus.

/// Per-window IPC inbox (a thread-safe string queue).
pub type IpcInbox = Arc<Mutex<VecDeque<String>>>;

/// Shared IPC bus: window_handle †’ inbox.
pub type IpcBus = Arc<Mutex<HashMap<u32, IpcInbox>>>;

pub fn new_ipc_bus() -> IpcBus {
    Arc::new(Mutex::new(HashMap::new()))
}

// Completion queue
//
// We must not put v8::Global in the queue because v8::Global is !Send,
// which would make the Arc<Mutex<...>> !Send and break tokio::spawn.
//
// Instead we store:
//   - resolver_ptr: the v8::Global<PromiseResolver> boxed and cast to usize
//   - result:       the async result (plain Send types)
//
// The V8 thread (runtime.rs tick()) reconstructs the Global from the pointer.
// This is safe because:
//   1. The pointer is created on the V8 thread before spawn.
//   2. It is written into the queue by the Tokio thread (just a usize store).
//   3. It is read and dropped on the V8 thread in tick().
//   No two threads ever hold the Global simultaneously.

/// Opaque handle to a pending promise resolution, created by `make_promise`
/// and reconstructed only by the engine backend that created it (today,
/// `V8Runtime::tick()` — see `runtime.rs`). Binding code (`bind_*.rs`) only
/// ever moves this value from `make_promise` into a `Completion`; it must
/// never inspect or construct one, which is what keeps the ~90 async
/// binding call sites unaware of which JS engine is actually running.
/// This is the `PromiseHandle` building block QUICKJS_PERFORMANCE_PLAN.md's
/// Opt-1 (PromiseBridge) calls for — a QuickJS backend can wrap whatever
/// its own resolver representation needs behind the same opaque type
/// without touching a single binding file.
#[derive(Debug, Clone, Copy)]
pub struct PromiseHandle(usize);

impl PromiseHandle {
    /// Wrap a raw engine-specific pointer/id. Only an engine backend's own
    /// promise-allocator should call this (V8's `make_promise` here; the
    /// QuickJS backend has its own equivalent in `quickjs_runtime.rs`) —
    /// it's the single place per engine a handle is minted.
    pub(crate) fn from_raw(raw: usize) -> Self { PromiseHandle(raw) }

    /// Unwrap back to the raw value. Only an engine backend's own tick/poll
    /// implementation may call this — it's the one place that knows how to
    /// turn the raw value back into a real resolver (today: casting back to
    /// `*mut v8::Global<v8::PromiseResolver>` in `runtime.rs`).
    pub(crate) fn into_raw(self) -> usize { self.0 }
}

pub struct Completion {
    /// Opaque handle back to whatever promise-resolver representation the
    /// engine backend that created it uses. See `PromiseHandle`'s doc.
    pub resolver_ptr: PromiseHandle,
    pub result:       Result<String, String>,
}

// SAFETY: Completion only contains a usize and a Result<String,String>.
// The usize is a raw pointer that is only ever dereferenced on the V8 thread.
unsafe impl Send for Completion {}

pub type CompletionQueue = Arc<Mutex<VecDeque<Completion>>>;
pub type SceneQueue      = Arc<Mutex<VecDeque<SceneCommand>>>;
pub type RedrawRequest   = Arc<dyn Fn() + Send + Sync>;
/// Shared SQLite pool map  keyed by the integer handle returned to JS.
/// Exposed so glyx-core can drain it on window close for graceful shutdown.
pub type DbPools = Arc<Mutex<HashMap<u32, glyx_db::SqlitePool>>>;
pub fn new_db_pools() -> DbPools { Arc::new(Mutex::new(HashMap::new())) }

/// Shared video event queue  video decode threads push events here;
/// `__glyx_video_poll` drains them; glyx-core forwards them each frame.
pub type VideoEvents = Arc<Mutex<VecDeque<String>>>;
pub fn new_video_events() -> VideoEvents { Arc::new(Mutex::new(VecDeque::new())) }

/// Shared webview message-in queue — glyx-core drains each webview instance's
/// `poll_messages` cap call every frame and pushes JSON `{"id":N,"message":"..."}`
/// strings here; `__glyx_webview_poll` drains them for JS's `onMessage` dispatch.
pub type WebviewEvents = Arc<Mutex<VecDeque<String>>>;
pub fn new_webview_events() -> WebviewEvents { Arc::new(Mutex::new(VecDeque::new())) }

/// A pending `__glyx_canvas3d_raycast` request, queued by the binding and
/// drained by glyx-core once per frame (raycasting needs the live
/// `Renderer3D`/`Scene3D`, which only glyx-core has access to). `ndc_x`/
/// `ndc_y` are already-converted NDC coordinates (`[-1, 1]`), not raw
/// screen-space pixels — the JS wrapper does that conversion.
#[derive(Debug, Clone, Copy)]
pub struct RaycastRequest {
    pub req_id:    u32,
    pub canvas_id: u32,
    pub ndc_x:     f32,
    pub ndc_y:     f32,
}
pub type RaycastRequestQueue = Arc<Mutex<VecDeque<RaycastRequest>>>;
pub fn new_raycast_request_queue() -> RaycastRequestQueue { Arc::new(Mutex::new(VecDeque::new())) }

/// JSON-encoded raycast results (`{"reqId":N,"meshIndex":..,"point":[...],
/// "distance":..}` or `{"reqId":N,"hit":null}`), pushed by glyx-core once a
/// frame after draining `RaycastRequestQueue`; `__glyx_canvas3d_raycast_poll`
/// drains them for the JS-side pending-promise dispatch. Same
/// request/polled-response shape as `VideoEvents`/`WebviewEvents` above —
/// deliberately not routed through the engine's own promise-resolution
/// queue, since that machinery is kept engine-internal by design (V8
/// `Global`/QuickJS `Persistent` aren't interchangeable at this boundary).
pub type RaycastResults = Arc<Mutex<VecDeque<String>>>;
pub fn new_raycast_results() -> RaycastResults { Arc::new(Mutex::new(VecDeque::new())) }

/// An input event pushed by the Rust side and consumed by JS via __glyx_pollEvents.
#[derive(Debug, Clone)]
pub enum InputEvent {
    /// Mouse/touch press or release at window-relative pixel coordinates.
    MouseButton { x: f32, y: f32, button: u8, pressed: bool },
    /// Cursor moved to pixel position.
    CursorMoved { x: f32, y: f32 },
    /// Pointer drag started (left button down + first move).
    DragStart { x: f32, y: f32 },
    /// Pointer dragged  continuous move while left button held.
    DragMove { x: f32, y: f32, dx: f32, dy: f32 },
    /// Pointer drag ended (left button released after drag).
    DragEnd { x: f32, y: f32 },
    /// Keyboard key pressed or released.
    KeyInput { key: String, text: Option<String>, pressed: bool },
    /// Vertical scroll delta (positive = down).
    Scroll { delta_y: f32 },
    /// Absolute scroll position set by a scrollbar thumb drag.
    ScrollbarDrag { node_id: u32, scroll_y: f32 },
    /// Window resized to new physical pixel dimensions.
    Resize { width: u32, height: u32 },
    /// An image failed to load (missing file, unreadable format).
    ImageError { image_id: u32, path: String },
    /// A Rust-side system watcher (battery/memory/darkMode/…) detected a
    /// CHANGE.  Pushed only on deltas — JS stays idle between changes.
    SystemWatch { id: u32, payload: String },
    /// IME composition event, routed only to the currently-focused node
    /// (see `PerWindowState.focused_node`). `kind` is one of "enabled" /
    /// "preedit" / "commit" / "disabled"; `cursor` is a byte-offset (start,
    /// end) range within `text` for the actively-edited clause ("preedit" only).
    Ime { kind: String, text: Option<String>, cursor_start: Option<u32>, cursor_end: Option<u32> },
    /// An assistive technology requested keyboard focus on a node. Rust's
    /// `PerWindowState.focused_node` is already updated by the time this is
    /// pushed — this just tells JS's own (separate) focus tracker to follow,
    /// so React-side focus styling/onFocus stays in sync with an AT-driven
    /// focus change (as opposed to a mouse click, which JS already owns).
    AccessibilityFocus { node_id: u32 },
    /// An assistive technology requested a value change on a node —
    /// Increment/Decrement/SetValue from a screen reader's slider/spinbutton
    /// controls. `action` is "increment" / "decrement" / "setValue";
    /// `numeric_value` is only set for "setValue".
    AccessibilityValueChange { node_id: u32, action: String, numeric_value: Option<f64> },
}

/// Callbacks for window control operations.
/// Constructed by glyx-core from Arc<winit::window::Window> and passed to register_all.
#[derive(Clone)]
pub struct WindowController {
    pub get_window_size:   Arc<dyn Fn() -> (u32, u32) + Send + Sync>,
    pub get_screen_size:   Arc<dyn Fn() -> Option<(u32, u32)> + Send + Sync>,
    pub request_redraw:    RedrawRequest,
    pub set_fullscreen:    Arc<dyn Fn(bool) + Send + Sync>,
    pub set_maximized:     Arc<dyn Fn(bool) + Send + Sync>,
    pub set_minimized:     Arc<dyn Fn() + Send + Sync>,
    pub is_fullscreen:     Arc<dyn Fn() -> bool + Send + Sync>,
    pub is_maximized:      Arc<dyn Fn() -> bool + Send + Sync>,
    pub set_always_on_top: Arc<dyn Fn(bool) + Send + Sync>,
    pub set_title:         Arc<dyn Fn(String) + Send + Sync>,
    /// Set the mouse cursor icon by CSS-like name ("default", "pointer",
    /// "col-resize", ...).  Unknown names fall back to the default arrow.
    pub set_cursor:        Arc<dyn Fn(String) + Send + Sync>,
    /// Raw platform window handle (HWND on Windows) as a plain integer.
    /// Used to parent native dialogs so they appear in front of the Glyx window.
    pub hwnd:              Option<isize>,
    /// Create a secondary window with the given pre-assigned id, title, and size.
    /// Called by the `__glyx_window_create` binding.
    pub create_window: Option<Arc<dyn Fn(u32, String, u32, u32) + Send + Sync>>,
    /// Quit the application  closes all windows and exits the event loop.
    pub quit: Option<Arc<dyn Fn() + Send + Sync>>,
    /// Quit then re-launch the same executable.
    pub restart: Option<Arc<dyn Fn() + Send + Sync>>,
}

// Dialog parent HWND wrapper
//
// rfd::AsyncFileDialog::set_parent() requires impl HasWindowHandle.
// We construct a minimal wrapper from the raw isize stored in AsyncState.

// Only used by bind_sys.rs's dialog binding (V8-only for now — QuickJS's
// dialog binding doesn't parent native dialogs to the app window yet, a
// known gap, not addressed here).
#[cfg(all(target_os = "windows", feature = "v8"))]
struct WinParent(isize);

#[cfg(all(target_os = "windows", feature = "v8"))]
impl raw_window_handle::HasWindowHandle for WinParent {
    fn window_handle(
        &self,
    ) -> Result<raw_window_handle::WindowHandle<'_>, raw_window_handle::HandleError> {
        use raw_window_handle::{RawWindowHandle, Win32WindowHandle, WindowHandle};
        let nz = std::num::NonZero::new(self.0)
            .expect("non-null HWND for dialog parent");
        let win32 = Win32WindowHandle::new(nz);
        Ok(unsafe { WindowHandle::borrow_raw(RawWindowHandle::Win32(win32)) })
    }
}

/// Thread-safe queue of input events for JS to poll each frame.
pub type EventQueue   = Arc<Mutex<VecDeque<InputEvent>>>;

/// Per-node resolved layout cache, updated after each Taffy compute.
/// Key: JS node id, Value: (x, y, width, height) in physical pixels.
pub type LayoutCache  = Arc<Mutex<std::collections::HashMap<u32, [f32; 4]>>>;

pub fn new_completion_queue() -> CompletionQueue {
    Arc::new(Mutex::new(VecDeque::new()))
}

// ── H3: Network SSRF hardening (engine-neutral — shared by V8's
//    bind_net.rs and QuickJS's quickjs_net.rs) ─────────────────────────────

/// Extract just the hostname (no port, no userinfo, no path) from a URL string.
///
/// Uses `reqwest::Url` (which re-exports the `url` crate) for correct parsing,
/// matching what reqwest itself connects to.  Falls back to an empty string for
/// URLs that don't parse (non-http schemes, malformed).
#[cfg(any(feature = "fetch", feature = "websocket"))]
pub(crate) fn extract_host(url: &str) -> String {
    #[cfg(feature = "fetch")]
    {
        // `url::Url::host_str()` keeps the brackets on IPv6 literals
        // (`"[::1]"`), but `is_private_host` parses the host through
        // `str::parse::<IpAddr>()`, which rejects bracketed input — an
        // unbracketed host is required for the SSRF loopback/private-range
        // check downstream to actually recognize e.g. `https://[::1]/` as
        // loopback. Strip them here so both call sites agree.
        reqwest::Url::parse(url)
            .ok()
            .and_then(|u| u.host_str().map(|h| {
                h.trim_start_matches('[').trim_end_matches(']').to_lowercase()
            }))
            .unwrap_or_default()
    }
    #[cfg(not(feature = "fetch"))]
    {
        // Minimal fallback when reqwest is not compiled in.
        let after_scheme = url.find("://").map(|i| &url[i + 3..]).unwrap_or(url);
        let authority = after_scheme.find('@').map(|i| &after_scheme[i + 1..]).unwrap_or(after_scheme);
        let host_port = authority.split(['/', '?', '#']).next().unwrap_or(authority);
        let host = if host_port.starts_with('[') {
            host_port.split(']').next().unwrap_or("").trim_start_matches('[')
        } else {
            host_port.split(':').next().unwrap_or(host_port)
        };
        host.to_lowercase()
    }
}

/// Returns `true` if `host` is a private, loopback, or link-local address that
/// should never be reachable from JS fetch/WebSocket (SSRF guard).
///
/// Checked ranges:
/// - `127.0.0.0/8`   -- IPv4 loopback
/// - `10.0.0.0/8`    -- private class A
/// - `172.16.0.0/12` -- private class B
/// - `192.168.0.0/16`-- private class C
/// - `169.254.0.0/16`-- link-local / AWS IMDS
/// - `0.0.0.0`        -- unspecified
/// - `::1/128`        -- IPv6 loopback
/// - `fc00::/7`       -- IPv6 unique-local
/// - `fe80::/10`      -- IPv6 link-local
/// - `"localhost"`, `"*.local"`, `"*.internal"`, `"*.localhost"` hostnames
#[cfg(any(feature = "fetch", feature = "websocket"))]
pub(crate) fn is_private_host(host: &str) -> bool {
    if let Ok(ip) = host.parse::<std::net::IpAddr>() {
        return match ip {
            std::net::IpAddr::V4(v4) => {
                v4.is_loopback()
                    || v4.is_private()
                    || v4.is_link_local()
                    || v4.is_unspecified()
                    || v4.octets()[0] == 0
            }
            std::net::IpAddr::V6(v6) => {
                v6.is_loopback() || v6.is_unspecified() || {
                    let s = v6.segments();
                    (s[0] & 0xfe00) == 0xfc00   // fc00::/7 unique-local
                        || (s[0] & 0xffc0) == 0xfe80  // fe80::/10 link-local
                }
            }
        };
    }
    // Hostname heuristics.
    host == "localhost"
        || host.ends_with(".local")
        || host.ends_with(".internal")
        || host.ends_with(".localhost")
}

/// Scheme allowlist for fetch -- only `http://` and `https://`.
#[cfg(feature = "fetch")]
pub(crate) fn check_fetch_scheme(url: &str) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if lower.starts_with("https://") || lower.starts_with("http://") {
        Ok(())
    } else {
        let scheme = url.split("://").next().unwrap_or(url);
        Err(format!("fetch: scheme {scheme:?} not allowed; only http/https"))
    }
}

/// Scheme allowlist for WebSocket -- only `ws://` and `wss://`.
#[cfg(feature = "websocket")]
pub(crate) fn check_ws_scheme(url: &str) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if lower.starts_with("wss://") || lower.starts_with("ws://") {
        Ok(())
    } else {
        let scheme = url.split("://").next().unwrap_or(url);
        Err(format!("ws.connect: scheme {scheme:?} not allowed; only ws/wss"))
    }
}

/// Build a reqwest client with a redirect policy that re-checks `can_network`
/// and blocks private IPs on every redirect hop.
#[cfg(feature = "fetch")]
pub(crate) fn safe_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 10 {
                return attempt.error("too many redirects");
            }
            let next_host = extract_host(attempt.url().as_str());
            if is_private_host(&next_host) {
                return attempt.error(format!(
                    "redirect to private/loopback host {next_host:?} denied (SSRF)"
                ));
            }
            if !glyx_security::get().can_network(&next_host) {
                return attempt.error(format!(
                    "redirect to host {next_host:?} not in network.allow"
                ));
            }
            attempt.follow()
        }))
        .build()
        .map_err(|e| e.to_string())
}

// Validate a URL before passing it to the OS shell (engine-neutral — shared
// by V8's bind_sys.rs and QuickJS's quickjs_sys.rs `open_external`).
//
// Enforces:
// - Scheme must be `http`, `https`, or `mailto` (prevents `file://`, `javascript:`, etc.)
// - No ASCII control characters (0x00-0x1F, 0x7F)
// - No shell metacharacters that could cause re-interpretation if a platform
//   handler mis-uses them: `|  &  ;  $  (  )  >  <  \`  {  }`
//
// Returns `Err` with a log-safe reason string on denial.
pub(crate) fn validate_external_url(url: &str) -> Result<(), &'static str> {
    let lower = url.to_ascii_lowercase();
    let valid_scheme = lower.starts_with("https://")
        || lower.starts_with("http://")
        || lower.starts_with("mailto:");
    if !valid_scheme {
        return Err("scheme not in allowlist (http, https, mailto)");
    }
    if url.bytes().any(|b| b < 0x20 || b == 0x7F) {
        return Err("URL contains control characters");
    }
    // `&` and `(`/`)` are legal, extremely common URL characters (RFC 3986
    // sub-delims — `&`/`=` join query params on essentially every real URL
    // with 2+ params; `(`/`)` appear in ordinary paths, e.g. Wikipedia
    // disambiguation links). Blocking them as bare characters broke a huge
    // fraction of real-world URLs. The actual dangerous *patterns* are
    // `&&` (shell AND-chaining) and `$(` (command substitution) — checked
    // explicitly below — not the individual characters they're built from.
    if url.contains("&&") || url.contains("$(") {
        return Err("URL contains shell metacharacters");
    }
    const SHELL_META: &[char] = &['|', ';', '`', '<', '>', '{', '}'];
    if url.chars().any(|c| SHELL_META.contains(&c)) {
        return Err("URL contains shell metacharacters");
    }
    Ok(())
}

// ── Scoped shell exec (Tier 1 — engine-neutral, shared by V8's bind_shell.rs
//    and QuickJS's quickjs_shell.rs) ────────────────────────────────────────
//
// Guardrails (see glyx-security::ShellCapability's docs for the full
// rationale): `bin` must exact-match `shell.allow`; args are always passed
// as a real argv array via `tokio::process::Command`, never through a shell
// interpreter, which is what actually prevents injection. The metacharacter
// check below is defense-in-depth on top of that, not the primary defense.

#[cfg(feature = "shell")]
const SHELL_ARG_META: &[char] = &['|', '&', ';', '$', '`'];

/// Result of a completed `shell.run()` call.
#[cfg(feature = "shell")]
pub(crate) struct ShellRunResult {
    pub(crate) stdout:    String,
    pub(crate) stderr:    String,
    pub(crate) exit_code: i32,
}

/// Max buffered bytes per stream before the process is killed — guards
/// against a runaway/misbehaving command exhausting memory.
#[cfg(feature = "shell")]
const SHELL_OUTPUT_CAP: usize = 8 * 1024 * 1024; // 8 MiB

/// Default timeout for `shell.run()` — killed and reported as an error if
/// exceeded.
#[cfg(feature = "shell")]
const SHELL_DEFAULT_TIMEOUT_SECS: u64 = 30;

/// Validate `bin` against the `shell.allow` allowlist and reject
/// defense-in-depth-flagged args, then spawn (argv-only) and wait for
/// completion with a timeout + output cap. Capability check happens here so
/// both engines get identical enforcement.
#[cfg(feature = "shell")]
pub(crate) async fn shell_run_core(bin: &str, args: Vec<String>) -> Result<ShellRunResult, String> {
    if !glyx_security::get().can_shell_run(bin) {
        return Err(format!(
            "shell.allow[\"{bin}\"] — add to glyx.config.json under \"capabilities\": \
             {{ \"shell\": {{ \"allow\": [\"{bin}\"] }} }}"
        ));
    }
    if let Some(bad) = args.iter().find(|a| a.chars().any(|c| SHELL_ARG_META.contains(&c))) {
        return Err(format!("shell.run: argument {bad:?} contains disallowed characters"));
    }

    let mut cmd = tokio::process::Command::new(bin);
    cmd.args(&args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("shell.run: failed to spawn {bin:?}: {e}"))?;

    let stdout_task = child.stdout.take().map(|s| tokio::spawn(read_capped(s)));
    let stderr_task = child.stderr.take().map(|s| tokio::spawn(read_capped(s)));

    let wait = tokio::time::timeout(
        std::time::Duration::from_secs(SHELL_DEFAULT_TIMEOUT_SECS),
        child.wait(),
    ).await;

    let exit_code = match wait {
        Ok(Ok(status)) => status.code().unwrap_or(-1),
        Ok(Err(e))     => return Err(format!("shell.run: wait failed: {e}")),
        Err(_)         => {
            let _ = child.kill().await;
            return Err(format!("shell.run: {bin} timed out after {SHELL_DEFAULT_TIMEOUT_SECS}s"));
        }
    };

    let stdout = match stdout_task { Some(t) => t.await.unwrap_or_default(), None => String::new() };
    let stderr = match stderr_task { Some(t) => t.await.unwrap_or_default(), None => String::new() };

    log::info!("[shell] {bin} {args:?} → exit {exit_code}");
    Ok(ShellRunResult { stdout, stderr, exit_code })
}

/// Read an async stream to a `String`, stopping (not erroring) once
/// `SHELL_OUTPUT_CAP` is reached — the process keeps running to completion,
/// but further output from this stream is silently dropped.
#[cfg(feature = "shell")]
async fn read_capped(mut stream: impl tokio::io::AsyncRead + Unpin) -> String {
    use tokio::io::AsyncReadExt;
    let mut buf = Vec::new();
    let mut chunk = [0u8; 8192];
    loop {
        let Ok(n) = stream.read(&mut chunk).await else { break };
        if n == 0 { break; }
        buf.extend_from_slice(&chunk[..n]);
        if buf.len() >= SHELL_OUTPUT_CAP { break; }
    }
    String::from_utf8_lossy(&buf).into_owned()
}

// ── H4: DB path safety (engine-neutral — used by both V8's bind_db.rs and
//    QuickJS's quickjs_db.rs) ──────────────────────────────────────────────

/// Compute the app-local DB data directory:
///   Windows:  %APPDATA%\{exe}\data\
///   macOS:    ~/Library/Application Support/{exe}/data/
///   Linux:    $XDG_DATA_HOME/{exe}/data/  (falls back to ~/.local/share)
pub(crate) fn app_db_dir() -> std::path::PathBuf {
    let exe_stem = std::env::current_exe()
        .ok()
        .and_then(|p| p.file_stem().map(|s| s.to_string_lossy().into_owned()))
        .unwrap_or_else(|| "glyx".to_string());

    #[cfg(target_os = "windows")]
    let base = std::env::var("APPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::var("USERPROFILE")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| std::path::PathBuf::from(".")));

    #[cfg(target_os = "macos")]
    let base = std::env::var("HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("Library").join("Application Support");

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let base = std::env::var("XDG_DATA_HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::var("HOME")
            .map(|h| std::path::PathBuf::from(h).join(".local").join("share"))
            .unwrap_or_else(|_| std::path::PathBuf::from(".")));

    base.join(&exe_stem).join("data")
}

/// Resolve and security-check a DB path supplied by JS.
///
/// Rules (H4):
/// - `:memory:` requires `capabilities.db.path: true` (explicit grant).
/// - Absolute paths require `capabilities.db.path: true`.
/// - Relative paths are rooted at the app data dir and verified via
///   `glyx_security::resolve_and_check_write` -- symlinks are resolved and
///   the result must fall within a declared `fs.write` glob OR the app data
///   dir is added to the allowlist implicitly (see note below).
///
/// Returns `Ok(resolved_string)` for use in `glyx_db::open`, or `Err` with
/// a user-visible message on denial.
///
/// Note on implicit data-dir grant: apps using `db: true` but no `fs.write`
/// are the common case. We allow the resolved path if it is a descendant of
/// `app_db_dir()` -- that directory is the intended default scope for db files.
pub fn resolve_db_path_checked(path: &str) -> Result<String, String> {
    let caps = glyx_security::get();

    // ── :memory: -- requires explicit db.path grant ───────────────────────────
    if path == ":memory:" {
        if caps.db_path {
            return Ok(":memory:".to_string());
        }
        return Err("db.open(\":memory:\") requires capabilities.db.path: true".to_string());
    }

    let p = std::path::Path::new(path);

    // ── Absolute paths -- require explicit db.path grant ──────────────────────
    if p.is_absolute() {
        if !caps.db_path {
            return Err(format!(
                "db.open with absolute path requires capabilities.db.path: true (got {path:?})"
            ));
        }
        // Still canonicalize + check via fs.write if declared.
        return glyx_security::resolve_and_check_write(p)
            .map(|c| c.to_string_lossy().into_owned())
            .map_err(|e| format!("db path denied: {e}"));
    }

    // ── Relative path -- root under app data dir ───────────────────────────────
    let data_dir = app_db_dir();
    let _ = std::fs::create_dir_all(&data_dir);
    let joined = data_dir.join(path);

    // Resolve symlinks. For a new file the parent must exist (created above).
    let canonical = if joined.exists() {
        joined.canonicalize()
    } else {
        joined.parent()
            .unwrap_or(&data_dir)
            .canonicalize()
            .map(|p| p.join(joined.file_name().unwrap_or_default()))
    }.map_err(|e| format!("db path resolve error: {e}"))?;

    // Accept if canonical path is within the app data dir (implicit grant).
    let canon_data = data_dir.canonicalize().unwrap_or(data_dir.clone());
    if canonical.starts_with(&canon_data) {
        return Ok(canonical.to_string_lossy().into_owned());
    }

    // Fall back: check fs.write allowlist.
    glyx_security::resolve_and_check_write(&canonical)
        .map(|c| c.to_string_lossy().into_owned())
        .map_err(|e| format!("db path outside app data dir and not in fs.write grant: {e}"))
}

pub fn new_scene_queue() -> SceneQueue {
    Arc::new(Mutex::new(VecDeque::new()))
}

pub fn new_event_queue() -> EventQueue {
    Arc::new(Mutex::new(VecDeque::new()))
}

pub fn new_layout_cache() -> LayoutCache {
    Arc::new(Mutex::new(std::collections::HashMap::new()))
}

// Node types & props   

#[derive(Debug, Clone, PartialEq)]
pub enum NodeType {
    View,
    Text,
    Image,
    Canvas,
    Canvas3D,
    Camera,
    Video,
    /// Explicit render-layer boundary.  When the subtree rooted here has no
    /// dirty nodes, the cached Vello scene fragment is replayed directly
    /// skipping all child traversal and draw-call construction for this frame.
    RepaintBoundary,
    /// Native OS-embedded webview (via the `webview` capability). Composited
    /// by the OS as a real child window, not drawn into the Vello scene.
    WebView,
}

/// A length value that can be either absolute (px) or relative (%).
/// Parsed from JS numbers (pixels) or strings like `"50%"`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LengthValue {
    Px(f32),
    Percent(f32),
}

impl Default for LengthValue {
    fn default() -> Self { Self::Px(0.0) }
}

/// All layout + visual props that JS can set on a node.
///
/// All fields are `Option`  `None` means "not set / inherit / use default".
/// `parse_props` only sets fields that are present in the JS object.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct NodeProps {
    // Dimensions (px or %)
    pub width:  Option<LengthValue>,
    pub height: Option<LengthValue>,

    // Text
    pub text:            Option<String>,
    pub font_size:       Option<f32>,
    /// `"bold"` or `"normal"` (default). Maps to Parley FontWeight.
    pub font_weight:     Option<String>,
    /// `"italic"` or `"normal"` (default). Maps to Parley FontStyle.
    pub font_style:      Option<String>,
    /// `"underline"` draws a line beneath the text; `"none"` or absent = no decoration.
    pub text_decoration_line: Option<String>,
    /// Maximum number of visible lines before clipping (like CSS `overflow: hidden` + height cap).
    pub number_of_lines: Option<u32>,
    /// Text / foreground colour as RGBA [r, g, b, a] 0€“255.
    pub color:     Option<[u8; 4]>,

    //  Background / border 
    /// Background fill colour as RGBA [r, g, b, a] 0€“255.
    pub background_color: Option<[u8; 4]>,
    pub border_radius:    Option<f32>,

    //  Flex layout 
    /// `flex` shorthand  like CSS `flex: 1`.
    pub flex:            Option<f32>,
    /// `"row"` | `"column"` (default `"column"`).
    pub flex_direction:  Option<String>,
    /// `"flex-start"` | `"center"` | `"flex-end"` | `"space-between"` | `"space-around"`.
    pub justify_content: Option<String>,
    /// `"flex-start"` | `"center"` | `"flex-end"` | `"stretch"`.
    pub align_items:     Option<String>,
    /// Uniform padding (px or %).
    pub padding:         Option<LengthValue>,
    /// Gap between children (px or %).
    pub gap:             Option<LengthValue>,

    //  Cursor UI / selection 
    /// When true, draw a text cursor rect after the text.
    pub show_cursor: Option<bool>,
    /// Character index (0-based) where the blinking cursor is drawn.
    /// `None` †’ cursor drawn after the last character (legacy behaviour).
    pub cursor_position: Option<u32>,
    /// Selection start character index (inclusive).  `None` †’ no selection.
    pub selection_start: Option<u32>,
    /// Selection end character index (exclusive).  `None` †’ no selection.
    pub selection_end: Option<u32>,
    /// IME composition (preedit) underline range — character indices into
    /// this node's `text`, `None` → no active composition. Set by TextInput
    /// while the user is composing CJK/etc input via an IME.
    pub ime_preedit_start: Option<u32>,
    pub ime_preedit_end:   Option<u32>,

    //  Accessibility €€€
    /// Explicit accessibility role ("button","textbox","checkbox","link",
    /// "image","heading", ...). `None` → inferred from `NodeType` (View →
    /// generic container, Text → label/static-text, etc).
    pub role: Option<String>,
    /// Accessible name (screen-reader label). Falls back to `text` for Text
    /// nodes when unset.
    pub aria_label: Option<String>,
    /// Toggled/checked state for checkbox/radio/switch roles. `None` → the
    /// AT reports no toggle state at all (use for non-toggle controls).
    pub checked: Option<bool>,
    /// Current/min/max for range-like roles (slider, progress). `None` →
    /// omitted from the accessibility tree.
    pub numeric_value: Option<f64>,
    pub numeric_min:   Option<f64>,
    pub numeric_max:   Option<f64>,

    //  Text alignment 
    /// `"left"` | `"center"` (default). Controls horizontal text origin.
    pub text_align: Option<String>,

    //  Border €€€
    /// Border stroke width in logical pixels.
    pub border_width: Option<f32>,
    /// Border stroke colour as RGBA [r, g, b, a] 0€“255.
    pub border_color: Option<[u8; 4]>,

    //  Scroll / clip / overflow €€
    /// When true, clip children rendering to this node's layout bounds.
    /// Used by ScrollView to prevent children from overflowing visually.
    pub clip: Option<bool>,
    /// Overflow behaviour: `"visible"` (default), `"hidden"`, or `"scroll"`.
    /// Maps to Taffy's `Overflow` and controls whether children are clipped.
    pub overflow: Option<String>,
    /// Vertical scroll offset in pixels (positive = scrolled toward bottom).
    /// Children are rendered offset upward by this amount, producing the
    /// visual effect of scrolling down through content taller than the node.
    pub scroll_offset_y: Option<f32>,

    //  Image €€€
    /// Native image resource identifier returned by `__glyx_createImage`.
    pub image_id: Option<u32>,
    /// `"cover"` | `"contain"` | `"stretch"` (default).
    pub image_resize_mode: Option<String>,

    //  Stacking 
    /// Z-index for draw ordering within the same parent.
    /// Higher values render on top. Default 0.
    pub z_index: Option<i32>,

    //  Window drag €€€
    /// When `true`, a mouse-down on this node (and not on an interactive child)
    /// initiates an OS-level window drag. Used to implement custom title bars.
    /// Only effective when `window.decorations` is `false` in the app config.
    pub draggable: Option<bool>,
    /// Set to `true` by the Pressable component so the drag check can detect
    /// interactive descendants and skip window-drag when a Pressable is under
    /// the cursor inside a `glyxDraggable` region.
    pub pressable: Option<bool>,

    //  Testing 
    /// Stable identifier used by `@glyx-dev/testing` `getByTestId` queries.
    pub test_id: Option<String>,

    //  Text input scroll 
    /// Horizontal scroll offset (px) for single-line text nodes inside a clipped
    /// input.  Positive values shift the text left so the caret stays in view.
    pub text_scroll_x: Option<f32>,

    //  Camera €€€
    /// Handle ID returned by `__glyx_camera_open`. The render loop maps this
    /// to a `CameraStream` in `PerWindowState` and renders the live frame.
    pub camera_handle: Option<u32>,
    /// When `true`, draw the camera frame mirrored horizontally (selfie mode).
    pub mirror: Option<bool>,
    //  Video 
    /// Handle ID returned by `__glyx_video_open`. The render loop maps this
    /// to a `VideoStream` in `PerWindowState` and renders the current decoded frame.
    pub video_handle: Option<u32>,

    //  WebView €€€
    /// URL to load. Mutually exclusive with `webview_html` — `webview_html`
    /// wins if both are set (matches the ABI's `is_html` flag semantics).
    pub webview_src: Option<String>,
    /// Raw HTML to load in place of navigating to a URL.
    pub webview_html: Option<String>,
    /// JSON-encoded creation options — `{ sandbox?, allowedOrigins?, assetsRoot? }`.
    /// See `glyx_cap_abi::WebviewCap::create` doc comment for the shape.
    pub webview_opts: Option<String>,

    //  Margin (uniform + per-side, px or %) €
    /// Uniform margin (applied to all four sides).
    pub margin: Option<LengthValue>,
    /// Axis shorthands (override uniform; overridden by per-side).
    pub margin_horizontal: Option<LengthValue>,
    pub margin_vertical:   Option<LengthValue>,
    /// Per-side margins override the uniform `margin` value.
    pub margin_left:   Option<LengthValue>,
    pub margin_right:  Option<LengthValue>,
    pub margin_top:    Option<LengthValue>,
    pub margin_bottom: Option<LengthValue>,

    //  Per-side padding (px or %, overrides uniform `padding`) 
    /// Axis shorthands (override uniform; overridden by per-side).
    pub padding_horizontal: Option<LengthValue>,
    pub padding_vertical:   Option<LengthValue>,
    pub padding_left:   Option<LengthValue>,
    pub padding_right:  Option<LengthValue>,
    pub padding_top:    Option<LengthValue>,
    pub padding_bottom: Option<LengthValue>,

    //  Min / max dimensions (px or %) €€
    pub min_width:  Option<LengthValue>,
    pub min_height: Option<LengthValue>,
    pub max_width:  Option<LengthValue>,
    pub max_height: Option<LengthValue>,

    //  Visibility €€€
    /// When true, the node and its children are not rendered and do not
    /// participate in hit-testing.  They still occupy layout space.
    pub hidden: Option<bool>,

    //  Interaction 
    /// When true, the node does not respond to pointer / keyboard events.
    /// Children inherit this behaviour.  The JS event dispatcher in events.js
    /// checks a parallel `disabledRegistry` before firing callbacks.
    pub disabled: Option<bool>,
    /// `"auto"` (default) or `"none"`.  When `"none"`, the element is invisible
    /// to hit-testing; events pass through to nodes underneath.
    pub pointer_events: Option<String>,

    //  Flex item properties (override container flex distribution) 
    /// `flex_grow`  rate at which this item grows to fill space (CSS `flex-grow`).
    pub flex_grow: Option<f32>,
    /// `flex_shrink`  rate at which this item shrinks when space is tight (CSS `flex-shrink`).
    pub flex_shrink: Option<f32>,
    /// `flex_basis`  initial main-axis size before growing/shrinking (px or %).
    pub flex_basis: Option<LengthValue>,
    /// `flex_wrap`  `"nowrap"`, `"wrap"`, or `"wrap-reverse"` (CSS `flex-wrap`).
    pub flex_wrap: Option<String>,

    //  CSS Grid €€€
    /// `display`  `"flex"` (default for View), `"grid"`, or `"none"`.
    pub display: Option<String>,
    /// `gridTemplateColumns`  space-separated track sizes (e.g. `"1fr 1fr 1fr 1fr"`).
    /// Supports `repeat(N, ...)` for repeated tracks.
    pub grid_template_columns: Option<String>,
    /// `gridTemplateRows`  same format as `gridTemplateColumns`.
    pub grid_template_rows: Option<String>,
    /// `gridColumn`  CSS grid column placement (e.g. `"1 / -1"`, `"span 2"`).
    pub grid_column: Option<String>,
    /// `gridRow`  CSS grid row placement (e.g. `"1 / 3"`, `"auto"`).
    pub grid_row: Option<String>,

    //  Item-level alignment overrides (override what the parent specifies) 
    /// `align_self`  overrides this item's cross-axis alignment.  Values: `"auto"`,
    /// `"flex-start"`, `"flex-end"`, `"center"`, `"baseline"`, `"stretch"`.
    pub align_self: Option<String>,
    /// `align_content`  cross-axis alignment of multi-line content.  Values:
    /// `"flex-start"`, `"flex-end"`, `"center"`, `"space-between"`, `"space-around"`,
    /// `"space-evenly"`, `"stretch"`.
    pub align_content: Option<String>,
    /// `justify_self`  inline-axis alignment override for grid items.
    /// Values: `"auto"`, `"flex-start"`, `"flex-end"`, `"center"`, `"baseline"`, `"stretch"`.
    pub justify_self: Option<String>,
    /// `justify_items`  inline-axis alignment for children (grid).
    /// Values: same as `align_items`.
    pub justify_items: Option<String>,

    //  Visual effects €€€
    /// Opacity multiplier (0.0 €“ 1.0).  Applied via Vello compositing layer.
    pub opacity: Option<f32>,
    /// `@glyx-dev/motion` v1: when set, an `opacity` change on this node
    /// interpolates over `transition_ms` (ease-out cubic) instead of
    /// snapping — driven by `glyx-core`'s render loop, not JS. `None` means
    /// opacity changes always snap immediately (existing behavior).
    pub transition_ms: Option<u32>,
    /// Box shadow string: `"dx dy blur color"` (e.g. `"2 2 4 #00000044"`).
    pub box_shadow: Option<String>,
    /// Linear background gradient: `"startColor endColor"` (e.g. `"#ff0000 #0000ff"`).
    /// The gradient always goes from top to bottom.
    pub background_gradient: Option<String>,

    //  Position / transform 
    /// `"relative"` (default) or `"absolute"`.
    pub position: Option<String>,
    /// Inset from the containing block's top edge (px or %).  Used with absolute
    /// positioning.
    pub top:    Option<LengthValue>,
    /// Inset from the containing block's left edge (px or %).
    pub left:   Option<LengthValue>,
    /// Inset from the containing block's right edge (px or %).
    pub right:  Option<LengthValue>,
    /// Inset from the containing block's bottom edge (px or %).
    pub bottom: Option<LengthValue>,
    /// Transform string: `"translate(x, y)"`, `"rotate(deg)"`, `"scale(sx, sy)"`,
    /// or chained: `"translate(10,20) rotate(45)"`.  Applied as an Affine transform
    /// to the node and all its descendants.
    pub transform: Option<String>,
    /// Box-sizing model: `"border-box"` | `"content-box"` (default).
    /// With `"border-box"`, `width`/`height` include padding so the element
    /// never overflows its declared size (matches the CSS `box-sizing` property).
    pub box_sizing: Option<String>,

    //  Scrollbar €€€
    /// Width of the scrollbar in logical pixels (default 8).
    pub scrollbar_width: Option<f32>,
    /// Scrollbar thumb colour as RGBA string, e.g. `"rgba(100,100,120,0.6)"`.
    pub scrollbar_color: Option<String>,
    /// When false, the scrollbar is hidden entirely (default true).
    pub show_scrollbar: Option<bool>,
}

//  Canvas 2D draw commands 

#[derive(Debug, Clone, PartialEq, serde::Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CanvasCmd {
    Clear,
    FillRect   { x: f32, y: f32, w: f32, h: f32, color: [u8; 4] },
    StrokeRect { x: f32, y: f32, w: f32, h: f32, color: [u8; 4], #[serde(rename = "lineWidth")] line_width: f32 },
    FillCircle { cx: f32, cy: f32, r: f32, color: [u8; 4] },
    StrokeCircle { cx: f32, cy: f32, r: f32, color: [u8; 4], #[serde(rename = "lineWidth")] line_width: f32 },
    StrokeLine { x0: f32, y0: f32, x1: f32, y1: f32, color: [u8; 4], #[serde(rename = "lineWidth")] line_width: f32 },
    FillText   { text: String, x: f32, y: f32, #[serde(rename = "fontSize")] font_size: f32, color: [u8; 4] },
    /// Filled polygon from a flat `[x0,y0,x1,y1,€¦]` point list (auto-closed).
    FillPath   { points: Vec<f32>, color: [u8; 4] },
    /// Stroked polyline from a flat point list; `closed` joins last†’first.
    StrokePath { points: Vec<f32>, color: [u8; 4], #[serde(rename = "lineWidth")] line_width: f32, #[serde(default)] closed: bool },
}

//  Canvas 2D binary protocol 
//
// JS writes a stream of draw commands directly into a shared backing store
// (no JSON.stringify / serde parse). Each command is `[opcode, ...f32 args]`;
// colors occupy one slot read as 4 raw RGBA bytes; `fillText` references a
// parallel UTF-8 string region by (offset, len). See `decode_canvas_binary`.
mod canvas_op {
    pub const CLEAR:         u32 = 0;
    pub const FILL_RECT:     u32 = 1;
    pub const STROKE_RECT:   u32 = 2;
    pub const FILL_CIRCLE:   u32 = 3;
    pub const STROKE_CIRCLE: u32 = 4;
    pub const STROKE_LINE:   u32 = 5;
    pub const FILL_TEXT:     u32 = 6;
    pub const FILL_PATH:     u32 = 7;  // [op, pointCount, color, x0,y0,€¦]
    pub const STROKE_PATH:   u32 = 8;  // [op, pointCount, color, lineW, closed, x0,y0,€¦]
}

/// Decode the binary command stream into `Vec<CanvasCmd>`.
///
/// `cmd_bytes` is the f32 command region (little-endian, as written by JS's
/// Float32Array/Uint32Array views); `float_count` is how many f32 slots are
/// live this flush; `str_bytes` is the UTF-8 string region for `fillText`.
///
/// Fully bounds-checked  the buffer is JS-controlled, so a malformed or
/// truncated stream must never panic: any out-of-range read stops decoding.
pub(crate) fn decode_canvas_binary(cmd_bytes: &[u8], float_count: usize, str_bytes: &[u8]) -> Vec<CanvasCmd> {
    let slots = (cmd_bytes.len() / 4).min(float_count);
    let f32_at = |i: usize| -> f32 {
        let b = i * 4;
        f32::from_le_bytes([cmd_bytes[b], cmd_bytes[b + 1], cmd_bytes[b + 2], cmd_bytes[b + 3]])
    };
    // A color slot holds packed RGBA; JS writes it via a Uint32Array alias as a
    // little-endian u32, so the bytes land in memory as [r, g, b, a] directly.
    let color_at = |i: usize| -> [u8; 4] {
        let b = i * 4;
        [cmd_bytes[b], cmd_bytes[b + 1], cmd_bytes[b + 2], cmd_bytes[b + 3]]
    };

    // Read `n` point floats starting at slot `start`, guarding the bound.
    let read_points = |start: usize, n: usize| -> Vec<f32> {
        (0..n).map(|k| f32_at(start + k)).collect()
    };

    let mut cmds = Vec::new();
    let mut i = 0usize;
    while i < slots {
        let op = f32_at(i) as u32;
        i += 1;
        match op {
            canvas_op::CLEAR => cmds.push(CanvasCmd::Clear),
            canvas_op::FILL_RECT => {
                if i + 5 > slots { break; }
                cmds.push(CanvasCmd::FillRect {
                    x: f32_at(i), y: f32_at(i + 1), w: f32_at(i + 2), h: f32_at(i + 3),
                    color: color_at(i + 4),
                });
                i += 5;
            }
            canvas_op::STROKE_RECT => {
                if i + 6 > slots { break; }
                cmds.push(CanvasCmd::StrokeRect {
                    x: f32_at(i), y: f32_at(i + 1), w: f32_at(i + 2), h: f32_at(i + 3),
                    color: color_at(i + 4), line_width: f32_at(i + 5),
                });
                i += 6;
            }
            canvas_op::FILL_CIRCLE => {
                if i + 4 > slots { break; }
                cmds.push(CanvasCmd::FillCircle {
                    cx: f32_at(i), cy: f32_at(i + 1), r: f32_at(i + 2), color: color_at(i + 3),
                });
                i += 4;
            }
            canvas_op::STROKE_CIRCLE => {
                if i + 5 > slots { break; }
                cmds.push(CanvasCmd::StrokeCircle {
                    cx: f32_at(i), cy: f32_at(i + 1), r: f32_at(i + 2),
                    color: color_at(i + 3), line_width: f32_at(i + 4),
                });
                i += 5;
            }
            canvas_op::STROKE_LINE => {
                if i + 6 > slots { break; }
                cmds.push(CanvasCmd::StrokeLine {
                    x0: f32_at(i), y0: f32_at(i + 1), x1: f32_at(i + 2), y1: f32_at(i + 3),
                    color: color_at(i + 4), line_width: f32_at(i + 5),
                });
                i += 6;
            }
            canvas_op::FILL_TEXT => {
                if i + 6 > slots { break; }
                let off = f32_at(i + 4) as usize;
                let len = f32_at(i + 5) as usize;
                // checked_add: off/len are JS-controlled and saturate at
                // usize::MAX, so a plain `off + len` could overflow-panic.
                let text = off.checked_add(len)
                    .and_then(|end| str_bytes.get(off..end))
                    .and_then(|b| std::str::from_utf8(b).ok())
                    .unwrap_or("")
                    .to_string();
                cmds.push(CanvasCmd::FillText {
                    text, x: f32_at(i), y: f32_at(i + 1), font_size: f32_at(i + 2),
                    color: color_at(i + 3),
                });
                i += 6;
            }
            canvas_op::FILL_PATH => {
                // [count, color, x0,y0,€¦]
                if i + 2 > slots { break; }
                let count = f32_at(i) as usize;
                let color = color_at(i + 1);
                let start = i + 2;
                // count is JS-controlled: checked math so huge values break
                // out of the decode loop instead of overflow-panicking.
                let npts = match count.checked_mul(2) { Some(n) => n, None => break };
                if start.checked_add(npts).map_or(true, |end| end > slots) { break; }
                cmds.push(CanvasCmd::FillPath { points: read_points(start, npts), color });
                i = start + npts;
            }
            canvas_op::STROKE_PATH => {
                // [count, color, lineW, closed, x0,y0,€¦]
                if i + 4 > slots { break; }
                let count  = f32_at(i) as usize;
                let color  = color_at(i + 1);
                let lw     = f32_at(i + 2);
                let closed = f32_at(i + 3) != 0.0;
                let start  = i + 4;
                let npts = match count.checked_mul(2) { Some(n) => n, None => break };
                if start.checked_add(npts).map_or(true, |end| end > slots) { break; }
                cmds.push(CanvasCmd::StrokePath {
                    points: read_points(start, npts), color, line_width: lw, closed,
                });
                i = start + npts;
            }
            _ => break, // unknown opcode †’ corrupt/truncated stream
        }
    }
    cmds
}

/// Thin wrapper around `tokio::sync::oneshot::Sender<T>` that implements `Debug`.
/// Needed because `SceneCommand` derives `Debug` but oneshot::Sender does not.
pub struct OneshotSender<T>(pub tokio::sync::oneshot::Sender<T>);
impl<T> std::fmt::Debug for OneshotSender<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "OneshotSender")
    }
}

#[derive(Debug)]
pub enum SceneCommand {
    CreateNode    { id: u32, node_type: NodeType, props: NodeProps },
    CreateImage   { id: u32, path: String, width: Option<f32>, height: Option<f32> },
    AppendChild   { parent_id: u32, child_id: u32 },
    InsertBefore  { parent_id: u32, child_id: u32, before_id: u32 },
    UpdateNode    { id: u32, props: NodeProps },
    RemoveNode    { id: u32 },
    SetRoot       { id: u32 },
    /// Global keyboard-focus registry — set by JS on a control's onFocus/onBlur.
    /// `None` clears focus (e.g. blur with no next focus target). Rust-side
    /// consumers: IME composition routing (attach to the focused node's rect)
    /// and, later, accessibility (expose the focused node to the AT).
    SetFocus      { id: Option<u32> },
    /// `append=false` replaces the canvas's command list (normal flush);
    /// `append=true` extends it (overflow continuation chunk in binary mode).
    CanvasUpdate  { id: u32, cmds: Vec<CanvasCmd>, append: bool },
    #[cfg(feature = "canvas3d")]
    Canvas3DUpdate { id: u32, scene: glyx_3d::Scene3D },
    #[cfg(feature = "canvas3d")]
    Canvas3DUnloadGltf { path: String },
    /// Post a message INTO a webview page's `window` (delivered as a
    /// `message` event) — the JS→page half of the postMessage bridge.
    #[cfg(feature = "webview")]
    WebviewPostMessage { id: u32, msg: String },
    /// Open a camera device and start the capture loop in glyx-core.
    #[cfg(feature = "camera")]
    OpenCamera  { handle_id: u32, device_index: u32 },
    /// Stop the capture loop and release the camera device.
    #[cfg(feature = "camera")]
    CloseCamera { handle_id: u32 },
    /// Capture the current frame to a PNG file. Resolves with the file path.
    #[cfg(feature = "camera")]
    CaptureCamera { handle_id: u32, tx: OneshotSender<Result<String, String>> },
    /// Start recording the camera feed to an MP4 file via ffmpeg.
    #[cfg(feature = "camera")]
    StartCameraRecord { handle_id: u32, output_path: String },
    /// Stop recording and flush the MP4. Resolves with the final file path.
    #[cfg(feature = "camera")]
    StopCameraRecord { handle_id: u32, tx: OneshotSender<Result<String, String>> },
    //  Video player €€€
    /// Open a video file/URL for playback. glyx-core spawns a decode thread.
    OpenVideo  { handle_id: u32, url: String },
    /// Seek the video to `seconds`. The decode thread resyncs from the new position.
    SeekVideo      { handle_id: u32, seconds: f64 },
    /// Set playback volume (0.0€“2.0). Applied to the audio sink within 50ms.
    SetVideoVolume { handle_id: u32, volume: f32 },
    /// Pause decode + audio threads.
    PauseVideo  { handle_id: u32 },
    /// Resume decode + audio threads.
    ResumeVideo { handle_id: u32 },
    /// Stop playback and release all resources for this video handle.
    CloseVideo { handle_id: u32 },
    /// Signal glyx-core to hide the splash screen overlay.
    HideSplash,
}

//  Registration €€€

/// Returned by `register_all`; cast back to `*mut AsyncState` for `reload_plugin`.
/// Stored as `usize` so it is `Copy + Send + Sync` (V8Runtime is `!Send` regardless).
#[cfg(feature = "v8")]
pub type StatePtrUsize = usize;

#[cfg(feature = "v8")]
pub fn register_all(
    scope:        &mut v8::PinScope<'_, '_, v8::Context>,
    global:       v8::Local<v8::Object>,
    queue:        CompletionQueue,
    tokio:        Handle,
    scene:        SceneQueue,
    events:       EventQueue,
    layout_cache: LayoutCache,
    window:       Option<WindowController>,
    ipc_bus:      IpcBus,
    my_handle:    u32,
    next_window_id: Arc<std::sync::atomic::AtomicU32>,
    perf_state:   Arc<Mutex<glyx_perf::PerfState>>,
    deeplink_url_queue: Arc<Mutex<VecDeque<String>>>,
    db_pools:     DbPools,
    video_events: VideoEvents,
    webview_events: WebviewEvents,
    raycast_requests: RaycastRequestQueue,
    raycast_results: RaycastResults,
    cdp_log_tx:   Arc<Mutex<Option<tokio::sync::mpsc::UnboundedSender<String>>>>,
    backend_commands: crate::BackendRegistry,
    js_plugins:   crate::JsPlugins,
) -> StatePtrUsize {
    set_func(scope, global, "__glyx_getTime", get_time);

    // Audio and gamepad are initialised lazily on first use to avoid
    // wasting resources in apps that don't use them.

    // Store all shared state in a heap-allocated struct, hand the raw
    // pointer to V8 via External so callbacks can recover it.
    let hwnd = window.as_ref().and_then(|w| w.hwnd);
    let mut state = Box::new(AsyncState {
        queue,
        tokio,
        request_redraw: window.as_ref().map(|w| Arc::clone(&w.request_redraw)),
        scene,
        events,
        layout_cache,
        next_id:    std::sync::atomic::AtomicU32::new(1),
        next_image_id: std::sync::atomic::AtomicU32::new(1),
        window,
        hwnd,
        db_pools,
        next_db_id:    std::sync::atomic::AtomicU32::new(1),
        vector_stores: Arc::new(Mutex::new(HashMap::new())),
        next_vdb_id:   std::sync::atomic::AtomicU32::new(1),
        #[cfg(feature = "websocket")]
        ws_handles:    Arc::new(Mutex::new(HashMap::new())),
        #[cfg(feature = "websocket")]
        next_ws_id:    std::sync::atomic::AtomicU32::new(1),
        ipc_bus,
        my_handle,
        next_window_id,
        perf_state,
        sleep_guards:   std::cell::RefCell::new(HashMap::new()),
        text_measure:   std::cell::RefCell::new(glyx_text::TextSystem::new()),
        next_guard_id:  std::sync::atomic::AtomicU32::new(1),
        #[cfg(feature = "gamepad")]
        gamepad_gilrs:  std::cell::RefCell::new(None),
        hotkey_state:   std::cell::RefCell::new(None),
        next_hotkey_id: std::sync::atomic::AtomicU32::new(1),
        deeplink_url_queue,
        #[cfg(feature = "audio")]
        audio_stream:   std::cell::RefCell::new(None),
        #[cfg(feature = "audio")]
        audio_handle:   std::cell::RefCell::new(None),
        #[cfg(feature = "audio")]
        audio_sinks:    Arc::new(Mutex::new(HashMap::new())),
        #[cfg(feature = "audio")]
        audio_events:   Arc::new(Mutex::new(VecDeque::new())),
        #[cfg(feature = "audio")]
        next_audio_id:  std::sync::atomic::AtomicU32::new(1),
        #[cfg(feature = "audio")]
        audio_trackers: Arc::new(Mutex::new(HashMap::new())),
        next_camera_id: std::sync::atomic::AtomicU32::new(1),
        next_video_id:  std::sync::atomic::AtomicU32::new(1),
        video_events,
        webview_events,
        raycast_requests,
        raycast_results,
        next_raycast_id: std::sync::atomic::AtomicU32::new(1),
        #[cfg(feature = "hid")]
        hid_api:     Arc::new(Mutex::new(None)),
        #[cfg(feature = "hid")]
        hid_devices: Arc::new(Mutex::new(HashMap::new())),
        #[cfg(feature = "hid")]
        next_hid_id: std::sync::atomic::AtomicU32::new(1),
        #[cfg(feature = "ai")]
        ai_embed_model:    Arc::new(Mutex::new(None)),
        #[cfg(feature = "ai")]
        ai_generate_model: Arc::new(Mutex::new(None)),
        #[cfg(feature = "ai")]
        ai_whisper_model:  Arc::new(Mutex::new(None)),
        fs_watch_events:   Arc::new(Mutex::new(VecDeque::new())),
        fs_watchers:       std::cell::RefCell::new(HashMap::new()),
        next_fs_watch_id:  std::sync::atomic::AtomicU32::new(1),
        cdp_log_tx,
        backend_commands,
        js_backend_commands: HashMap::new(),
        caps: crate::cap_loader::load_caps(),
    });

    //  Evaluate JS plugins and register their exported functions 
    //
    // All plugins are concatenated and compiled in a single V8 pass (one parse
    // + one compile instead of N).  Each IIFE sets `globalThis.<global_name>`.
    // We then walk each plugin's own properties to collect Function exports.
    if !js_plugins.is_empty() {
        // Build one combined source: "iife1;\niife2;\n..."
        let combined: String = js_plugins.iter()
            .map(|p| p.bundled_js.as_str())
            .collect::<Vec<_>>()
            .join(";\n");
        if let Some(code_str) = v8::String::new(scope, &combined) {
            v8::tc_scope!(let try_catch, scope);
            if let Some(script) = v8::Script::compile(try_catch, code_str, None) {
                let _ = script.run(try_catch);
            }
            if try_catch.has_caught() {
                let msg = try_catch.exception()
                    .and_then(|e| e.to_string(try_catch))
                    .map(|s| s.to_rust_string_lossy(try_catch.as_ref()))
                    .unwrap_or_else(|| "unknown error".into());
                log::error!("[plugins] eval error: {msg}");
            }
        }
    }
    for plugin in js_plugins.iter() {

        // Read exports from globalThis.<global_name>.
        let gname = match v8::String::new(scope, &plugin.global_name) {
            Some(s) => s,
            None => continue,
        };
        let ctx = scope.get_current_context();
        let gobj = ctx.global(scope);
        let exports_val = gobj.get(scope, gname.into());
        let exports = match exports_val.and_then(|v| v8::Local::<v8::Object>::try_from(v).ok()) {
            Some(o) => o,
            None => {
                log::warn!("[plugins] plugin {:?} did not set global '{}'", plugin.prefix, plugin.global_name);
                continue;
            }
        };

        // Walk own property names and collect Function values.
        let prop_names = exports.get_own_property_names(scope, Default::default());
        let prop_names = match prop_names { Some(p) => p, None => continue };
        for i in 0..prop_names.length() {
            let key = match prop_names.get_index(scope, i) { Some(k) => k, None => continue };
            let val = match exports.get(scope, key) { Some(v) => v, None => continue };
            if let Ok(fn_local) = v8::Local::<v8::Function>::try_from(val) {
                let key_str = key.to_string(scope)
                    .map(|s| s.to_rust_string_lossy(scope.as_ref()))
                    .unwrap_or_default();
                if key_str.is_empty() { continue; }
                let cmd_name = match &plugin.prefix {
                    Some(ns) => format!("{ns}.{key_str}"),
                    None     => key_str.clone(),
                };
                state.js_backend_commands.insert(cmd_name, v8::Global::new(scope, fn_local));
                log::info!("[plugins] registered JS command '{}' from plugin {:?}", key_str, plugin.prefix);
            }
        }
    }

    // Capture cap presence flags before moving `state` into the raw pointer.
    let has_audio   = state.caps.audio.is_some();
    let has_ai      = state.caps.ai.is_some();
    let has_gamepad = state.caps.gamepad.is_some();
    let has_hid     = state.caps.hid.is_some();

    let raw   = Box::into_raw(state);
    let ptr   = raw as *mut std::ffi::c_void;
    // Safety: ptr is valid for the lifetime of the isolate.
    let ext   = v8::External::new(scope, ptr);
    let state_usize = ptr as usize;

    macro_rules! register {
        ($name:literal, $cb:ident) => {
            let tmpl = v8::FunctionTemplate::builder($cb)
                .data(ext.into())
                .build(scope);
            let func = tmpl.get_function(scope).unwrap();
            let key  = v8::String::new(scope, $name).unwrap();
            global.set(scope, key.into(), func.into());
        };
    }

    register!("__glyx_request_frame", request_frame_callback);
    register!("__glyx_log",         js_log);
    register!("__glyx_getEnv",      get_env_callback);
    register!("__glyx_readFile",      read_file_callback);
    register!("__glyx_readFileBytes", read_file_bytes_callback);
    register!("__glyx_createImage",   create_image_callback);
    register!("__glyx_createNode",  create_node_callback);
    register!("__glyx_appendChild",   append_child_callback);
    register!("__glyx_insertBefore",  insert_before_callback);
    register!("__glyx_updateNode",    update_node_callback);
    register!("__glyx_removeNode",  remove_node_callback);
    register!("__glyx_setRoot",     set_root_callback);
    register!("__glyx_setFocus",    set_focus_callback);
    #[cfg(feature = "a11y")]
    register!("__glyx_hasA11y",     has_a11y_callback);
    register!("__glyx_pollEvents",  poll_events_callback);
    register!("__glyx_getLayout",   get_layout_callback);
    register!("__glyx_measure_text",    measure_text_callback);
    register!("__glyx_text_char_at_x", text_char_at_x_callback);
    register!("__glyx_text_pos_at",    text_pos_at_callback);

    register!("__glyx_getWindowSize", get_window_size_callback);
    register!("__glyx_getScreenSize", get_screen_size_callback);
    register!("__glyx_setFullscreen", set_fullscreen_callback);
    register!("__glyx_setMaximized",  set_maximized_callback);
    register!("__glyx_setMinimized",  set_minimized_callback);
    register!("__glyx_isFullscreen",  is_fullscreen_callback);
    register!("__glyx_isMaximized",   is_maximized_callback);

    //  File system €€
    register!("__glyx_writeFile",      write_file_callback);
    register!("__glyx_appendFile",     append_file_callback);
    register!("__glyx_listDir",        list_dir_callback);
    register!("__glyx_deleteFile",     delete_file_callback);
    register!("__glyx_mkdirp",         mkdirp_callback);
    register!("__glyx_stat",           stat_callback);
    register!("__glyx_rename",         rename_callback);
    register!("__glyx_copyFile",       copy_file_callback);
    register!("__glyx_fs_watch",       fs_watch_callback);
    register!("__glyx_fs_unwatch",     fs_unwatch_callback);
    register!("__glyx_fs_watch_poll",  fs_watch_poll_callback);

    //  SQLite database 
    register!("__glyx_db_open",        db_open_callback);
    register!("__glyx_db_query",       db_query_callback);
    register!("__glyx_db_run",         db_run_callback);
    register!("__glyx_db_close",       db_close_callback);
    register!("__glyx_db_transaction", db_transaction_callback);
    register!("__glyx_db_backup",      db_backup_callback);

    //  Vector database 
    register!("__glyx_vectorDb_open",   vectordb_open_callback);
    register!("__glyx_vectorDb_upsert", vectordb_upsert_callback);
    register!("__glyx_vectorDb_search", vectordb_search_callback);
    register!("__glyx_vectorDb_close",  vectordb_close_callback);

    //  Window extras (sync) 
    register!("__glyx_setAlwaysOnTop", set_always_on_top_callback);
    register!("__glyx_setTitle",       set_title_callback);
    register!("__glyx_setCursor",      set_cursor_callback);
    register!("__glyx_system_watch",   system_watch_callback);
    register!("__glyx_system_unwatch", system_unwatch_callback);

    //  File dialogs €€€
    register!("__glyx_dialog_openFile",   dialog_open_file_callback);
    register!("__glyx_dialog_saveFile",   dialog_save_file_callback);
    register!("__glyx_dialog_openFolder", dialog_open_folder_callback);

    //  Clipboard 
    register!("__glyx_clipboard_readText",  clipboard_read_text_callback);
    register!("__glyx_clipboard_writeText", clipboard_write_text_callback);

    //  Notifications 
    register!("__glyx_notification_send", notification_send_callback);

    // System tray
    register!("__glyx_tray_create",        tray_create_callback);
    register!("__glyx_tray_destroy",       tray_destroy_callback);
    register!("__glyx_tray_update_menu",   tray_update_menu_callback);
    register!("__glyx_tray_set_tooltip",   tray_set_tooltip_callback);
    register!("__glyx_tray_poll_events",   tray_poll_events_callback);

    //  Shell (Tier 1: scoped exec)
    #[cfg(feature = "shell")]
    register!("__glyx_shell_run", shell_run_callback);

    //  Network
    #[cfg(feature = "fetch")]
    register!("__glyx_fetch",      fetch_callback);

    //  WebSocket €€€
    #[cfg(feature = "websocket")]
    register!("__glyx_ws_connect", ws_connect_callback);
    #[cfg(feature = "websocket")]
    register!("__glyx_ws_send",    ws_send_callback);
    #[cfg(feature = "websocket")]
    register!("__glyx_ws_poll",    ws_poll_callback);
    #[cfg(feature = "websocket")]
    register!("__glyx_ws_close",   ws_close_callback);

    //  mDNS service discovery €€
    register!("__glyx_mdns_discover", mdns_discover_callback);

    //  Multi-window + IPC 
    register!("__glyx_window_create", window_create_callback);
    register!("__glyx_ipc_send",      ipc_send_callback);
    register!("__glyx_ipc_poll",      ipc_poll_callback);

    //  Performance metrics 
    register!("__glyx_perf_snapshot",            perf_snapshot_callback);
    register!("__glyx_perf_set_budget",          perf_set_budget_callback);
    register!("__glyx_perf_poll_violations",     perf_poll_violations_callback);
    register!("__glyx_perf_poll_leak_warnings",  perf_poll_leak_warnings_callback);

    //  OS system APIs 
    register!("__glyx_battery_getStatus",      battery_get_status_callback);
    register!("__glyx_system_getInfo",         system_get_info_callback);
    register!("__glyx_system_getDarkMode",     system_get_dark_mode_callback);
    register!("__glyx_system_getBatterySaver", system_get_battery_saver_callback);
    register!("__glyx_power_preventSleep",     power_prevent_sleep_callback);
    register!("__glyx_power_allowSleep",    power_allow_sleep_callback);
    register!("__glyx_storage_getDrives",   storage_get_drives_callback);
    if has_gamepad {
        register!("__glyx_gamepad_poll", gamepad_poll_callback);
    }
    register!("__glyx_shortcut_register",   shortcut_register_callback);
    register!("__glyx_shortcut_unregister", shortcut_unregister_callback);
    register!("__glyx_shortcut_poll",       shortcut_poll_callback);

    //  Credentials (OS keychain) €€
    register!("__glyx_credentials_set",    credentials_set_callback);
    register!("__glyx_credentials_get",    credentials_get_callback);
    register!("__glyx_credentials_delete", credentials_delete_callback);

    //  Audio playback — registered when audio cap is available (static or DLL)
    if has_audio {
        register!("__glyx_audio_play",      audio_play_callback);
        register!("__glyx_audio_pause",     audio_pause_callback);
        register!("__glyx_audio_resume",    audio_resume_callback);
        register!("__glyx_audio_stop",      audio_stop_callback);
        register!("__glyx_audio_setVolume", audio_set_volume_callback);
        register!("__glyx_audio_getVolume", audio_get_volume_callback);
        register!("__glyx_audio_poll",      audio_poll_callback);
        register!("__glyx_audio_get_time",  audio_get_time_callback);
        register!("__glyx_audio_duration",  audio_duration_callback);
        register!("__glyx_audio_seek",      audio_seek_callback);
    }

    //  App lifecycle €€€
    register!("__glyx_quit",            quit_callback);
    register!("__glyx_window_close",    quit_callback);  // alias: close the window / app
    register!("__glyx_restart",         restart_callback);
    register!("__glyx_platform",        platform_callback);
    register!("__glyx_collect_memory",  collect_memory_callback);
    register!("__glyx_open_external",   open_external_callback);

    //  Deep links 
    register!("__glyx_deeplink_getInitialUrl", deeplink_get_initial_url_callback);
    register!("__glyx_deeplink_poll",          deeplink_poll_callback);

    //  Canvas 2D / 3D 
    register!("__glyx_canvas_update",   canvas_update_callback);
    register!("__glyx_canvas_flush",    canvas_flush_callback);
    #[cfg(feature = "canvas3d")]
    register!("__glyx_canvas3d_update", canvas3d_update_callback);
    #[cfg(feature = "canvas3d")]
    register!("__glyx_canvas3d_load_gltf",   canvas3d_load_gltf_callback);
    #[cfg(feature = "canvas3d")]
    register!("__glyx_canvas3d_unload_gltf", canvas3d_unload_gltf_callback);
    #[cfg(feature = "canvas3d")]
    register!("__glyx_canvas3d_raycast",      canvas3d_raycast_callback);
    #[cfg(feature = "canvas3d")]
    register!("__glyx_canvas3d_raycast_poll", canvas3d_raycast_poll_callback);

    //  WebView
    #[cfg(feature = "webview")]
    register!("__glyx_webview_post_message", webview_post_message_callback);
    #[cfg(feature = "webview")]
    register!("__glyx_webview_poll",         webview_poll_callback);

    //  Local AI — registered when AI cap is available (static or DLL)
    if has_ai {
        register!("__glyx_ai_embed",             ai_embed_callback);
        register!("__glyx_ai_generate",          ai_generate_callback);
        register!("__glyx_ai_transcribe",        ai_transcribe_callback);
        register!("__glyx_ai_unload_embed",      ai_unload_embed_callback);
        register!("__glyx_ai_unload_generate",   ai_unload_generate_callback);
        register!("__glyx_ai_unload_transcribe", ai_unload_transcribe_callback);
    }

    //  Camera + Microphone
    #[cfg(feature = "camera")]
    register!("__glyx_camera_list",         camera_list_callback);
    #[cfg(feature = "camera")]
    register!("__glyx_camera_open",         camera_open_callback);
    #[cfg(feature = "camera")]
    register!("__glyx_camera_close",        camera_close_callback);
    #[cfg(feature = "camera")]
    register!("__glyx_camera_capture",      camera_capture_callback);
    #[cfg(feature = "camera")]
    register!("__glyx_camera_record_start", camera_record_start_callback);
    #[cfg(feature = "camera")]
    register!("__glyx_camera_record_stop",  camera_record_stop_callback);
    register!("__glyx_microphone_list",     microphone_list_callback);
    register!("__glyx_microphone_record",   microphone_record_callback);

    //  Video player 
    register!("__glyx_video_open",       video_open_callback);
    register!("__glyx_video_seek",       video_seek_callback);
    register!("__glyx_video_set_volume", video_set_volume_callback);
    register!("__glyx_video_pause",      video_pause_callback);
    register!("__glyx_video_play",       video_play_callback);
    register!("__glyx_video_close",      video_close_callback);
    register!("__glyx_video_poll",       video_poll_callback);

    //  HID devices — registered when HID cap is available (static or DLL)
    if has_hid {
        register!("__glyx_hid_enumerate", hid_enumerate_callback);
        register!("__glyx_hid_open",      hid_open_callback);
        register!("__glyx_hid_read",      hid_read_callback);
        register!("__glyx_hid_write",     hid_write_callback);
        register!("__glyx_hid_close",     hid_close_callback);
    }
    //  Updater €€€
    #[cfg(feature = "updater")]
    register!("__glyx_updater_check",            updater_check_callback);
    #[cfg(feature = "updater")]
    register!("__glyx_updater_update",           updater_update_callback);
    #[cfg(feature = "updater")]
    register!("__glyx_updater_get_version",      updater_get_version_callback);
    #[cfg(feature = "updater")]
    register!("__glyx_updater_check_manifest",   updater_check_manifest_callback);
    #[cfg(feature = "updater")]
    register!("__glyx_updater_download_js",      updater_download_js_callback);
    //  Crash reporter 
    register!("__glyx_crash_report_js",    crash_report_js_callback);
    register!("__glyx_crash_get_reports",  crash_get_reports_callback);
    register!("__glyx_crash_clear_reports", crash_clear_reports_callback);
    //  Splash screen €€€
    register!("__glyx_splash_hide", splash_hide_callback);
    //  Backend command dispatch €€
    register!("__glyx_backend_call", backend_call_callback);

    state_usize
}

#[cfg(feature = "v8")]
struct AsyncState {
    queue:        CompletionQueue,
    tokio:        Handle,
    request_redraw: Option<RedrawRequest>,
    scene:        SceneQueue,
    events:       EventQueue,
    layout_cache: LayoutCache,
    next_id:      std::sync::atomic::AtomicU32,
    next_image_id: std::sync::atomic::AtomicU32,
    window:       Option<WindowController>,
    /// Raw window handle (HWND on Windows) for parenting native dialogs.
    hwnd:         Option<isize>,
    //  SQLite handles 
    db_pools:     Arc<Mutex<HashMap<u32, glyx_db::SqlitePool>>>,
    next_db_id:   std::sync::atomic::AtomicU32,
    //  Vector store handles 
    vector_stores: Arc<Mutex<HashMap<u32, glyx_db::VectorStore>>>,
    next_vdb_id:   std::sync::atomic::AtomicU32,
    //  WebSocket handles 
    #[cfg(feature = "websocket")]
    ws_handles:    Arc<Mutex<HashMap<u32, WsHandle>>>,
    #[cfg(feature = "websocket")]
    next_ws_id:    std::sync::atomic::AtomicU32,
    //  Multi-window / IPC 
    ipc_bus:       IpcBus,
    my_handle:     u32,
    next_window_id: Arc<std::sync::atomic::AtomicU32>,
    //  Performance metrics 
    perf_state:    Arc<Mutex<glyx_perf::PerfState>>,
    //  OS system APIs (single-threaded, RefCell for interior mutability) 
    sleep_guards:  std::cell::RefCell<HashMap<u32, glyx_sysapi::SleepGuard>>,
    /// Text shaper for `__glyx_measure_text` (table column sizing, rich-text
    /// cursor math). RefCell: single-threaded V8; `measure` needs `&mut`.
    text_measure:  std::cell::RefCell<glyx_text::TextSystem>,
    next_guard_id: std::sync::atomic::AtomicU32,
    #[cfg(feature = "gamepad")]
    gamepad_gilrs: std::cell::RefCell<Option<gilrs::Gilrs>>,
    hotkey_state:  std::cell::RefCell<Option<HotkeyState>>,
    next_hotkey_id: std::sync::atomic::AtomicU32,
    //  Deep links 
    /// Forwarded deep-link URLs from single-instance pipe listener.
    /// Drained by `__glyx_deeplink_poll` each frame.
    deeplink_url_queue: Arc<Mutex<VecDeque<String>>>,
    //  Audio playback (rodio) €€
    /// The OutputStream keeps the audio device open for the app lifetime.
    /// Stored in RefCell because rodio::OutputStream is !Send.
    /// Never read directly  held purely to keep the audio device alive.
    #[cfg(feature = "audio")]
    #[allow(dead_code)]
    audio_stream:  std::cell::RefCell<Option<rodio::OutputStream>>,
    /// Handle cloned into async tasks to create Sinks.
    /// Wrapped in RefCell so lazy init can mutate through &AsyncState.
    #[cfg(feature = "audio")]
    audio_handle:  std::cell::RefCell<Option<rodio::OutputStreamHandle>>,
    /// Live sink map  keyed by glyx audio handle ID.
    #[cfg(feature = "audio")]
    audio_sinks:   Arc<Mutex<HashMap<u32, rodio::Sink>>>,
    /// Events (e.g. "ended") produced by the audio subsystem, drained each frame.
    #[cfg(feature = "audio")]
    audio_events:  Arc<Mutex<VecDeque<String>>>,
    #[cfg(feature = "audio")]
    next_audio_id: std::sync::atomic::AtomicU32,
    /// Wall-clock position tracker for each audio handle (no get_pos in rodio 0.17).
    #[cfg(feature = "audio")]
    audio_trackers: Arc<Mutex<HashMap<u32, AudioTracker>>>,
    //  Camera €€€
    #[allow(dead_code)] // used when camera feature is enabled
    next_camera_id: std::sync::atomic::AtomicU32,
    //  Video player €€€
    /// Handle ID counter. VideoStream lives in glyx-core; we only track IDs here.
    next_video_id: std::sync::atomic::AtomicU32,
    /// Events from VideoStream threads: `{"type":"ended","id":N}` / `{"type":"metadata","id":N,...}`.
    video_events: Arc<Mutex<VecDeque<String>>>,
    //  WebView €€€
    /// Messages drained from webview pages each frame by glyx-core:
    /// `{"id":N,"message":"..."}`. See `WebviewEvents` type doc.
    #[allow(dead_code)] // read by webview_poll_callback when the "webview" feature is enabled
    webview_events: WebviewEvents,
    //  Canvas3D raycasting €€€
    /// Pending `__glyx_canvas3d_raycast` requests, drained by glyx-core once
    /// per frame. See `RaycastRequestQueue`'s type doc.
    #[allow(dead_code)] // read by canvas3d_raycast_callback when the "canvas3d" feature is enabled
    raycast_requests: RaycastRequestQueue,
    /// JSON raycast results, pushed by glyx-core once a frame; drained by
    /// `__glyx_canvas3d_raycast_poll`. See `RaycastResults`'s type doc.
    #[allow(dead_code)] // read by canvas3d_raycast_poll_callback when the "canvas3d" feature is enabled
    raycast_results: RaycastResults,
    /// Monotonic id generator for raycast requests, so the JS wrapper can
    /// correlate a `__glyx_canvas3d_raycast` call with its eventual result.
    #[allow(dead_code)]
    next_raycast_id: std::sync::atomic::AtomicU32,
    //  Local AI model cache (glyx-ai / Candle) €
    /// Lazily initialised embedding model. Locked during init, then shared.
    #[cfg(feature = "ai")]
    ai_embed_model:    Arc<Mutex<Option<glyx_ai::EmbedModel>>>,
    /// Phi-2 generation model (requires &mut self for KV-cache, so Mutex needed).
    #[cfg(feature = "ai")]
    ai_generate_model: Arc<Mutex<Option<glyx_ai::GenerateModel>>>,
    /// Whisper transcription model (requires &mut self for decoder state).
    #[cfg(feature = "ai")]
    ai_whisper_model:  Arc<Mutex<Option<glyx_ai::WhisperModel>>>,
    //  HID devices €€€
    /// Lazily initialised HidApi context (singleton, guarded by Mutex).
    #[cfg(feature = "hid")]
    hid_api:     Arc<Mutex<Option<hidapi::HidApi>>>,
    /// Open HID device handles keyed by glyx handle ID.
    #[cfg(feature = "hid")]
    hid_devices: Arc<Mutex<HashMap<u32, hidapi::HidDevice>>>,
    #[cfg(feature = "hid")]
    next_hid_id: std::sync::atomic::AtomicU32,
    //  File-system watchers (notify) €€
    /// Events produced by fs.watch — drained each frame by `__glyx_fs_watch_poll`.
    /// Triple: (watch_id, changed_path, event_kind_str).
    fs_watch_events: Arc<Mutex<VecDeque<(u32, String, String)>>>,
    /// Live notify watcher handles keyed by watchId.  Dropping a handle stops the watch.
    fs_watchers: std::cell::RefCell<HashMap<u32, RecommendedWatcher>>,
    next_fs_watch_id: std::sync::atomic::AtomicU32,
    //  CDP Inspector console bridge €€
    /// When the CDP inspector is active, this holds the outbox sender so
    /// __glyx_log can forward console messages as Runtime.consoleAPICalled events.
    cdp_log_tx: Arc<Mutex<Option<tokio::sync::mpsc::UnboundedSender<String>>>>,
    //  Backend command registry €€
    /// Named async commands registered by `GlyxExtension::register_commands`.
    /// Dispatched by `__glyx_backend_call(name, argsJson) †’ Promise<resultJson>`.
    backend_commands: crate::BackendRegistry,
    /// Named JS plugin commands collected at startup (from `glyx.config.json` plugins).
    /// These are called synchronously in V8 (they return Promises)  no Tokio bridge needed.
    js_backend_commands: HashMap<String, v8::Global<v8::Function>>,
    //  Capability vtables ── resolved once at startup by cap_loader
    caps: glyx_cap_abi::CapSet,
}

/// Re-eval a bundled plugin IIFE and update `js_backend_commands` for its exports.
///
/// Called on plugin file-change in dev mode.  The V8 scope must be active.
/// Clears all old commands for this plugin's prefix before re-registering.
#[cfg(feature = "v8")]
pub fn reload_plugin_in_scope(
    scope:      &mut v8::PinScope<'_, '_, v8::Context>,
    state_ptr:  StatePtrUsize,
    global_name: &str,
    prefix:     Option<&str>,
    bundled_js: &str,
) {
    let state = unsafe { &mut *(state_ptr as *mut AsyncState) };

    // Remove old commands for this prefix.
    match prefix {
        Some(ns) => {
            let pfx = format!("{ns}.");
            state.js_backend_commands.retain(|k, _| !k.starts_with(&pfx));
        }
        None => {
            // Flat prefix: remove keys that don't contain '.'.
            state.js_backend_commands.retain(|k, _| k.contains('.'));
        }
    }

    // Re-eval the IIFE.
    let ctx = scope.get_current_context();
    let global_obj = ctx.global(scope);
    if let Some(code_str) = v8::String::new(scope, bundled_js) {
        v8::tc_scope!(let try_catch, scope);
        let origin_name: v8::Local<v8::Value> =
            v8::String::new(try_catch, &format!("plugin:{}", global_name))
                .unwrap().into();
        let empty: v8::Local<v8::Value> = v8::String::new(try_catch, "").unwrap().into();
        let origin = v8::ScriptOrigin::new(
            try_catch, origin_name, 0, 0, false, -1, Some(empty), false, false, false, None,
        );
        if let Some(script) = v8::Script::compile(try_catch, code_str, Some(&origin)) {
            let _ = script.run(try_catch);
        }
        if try_catch.has_caught() {
            let msg = try_catch.exception()
                .and_then(|e| e.to_string(try_catch))
                .map(|s| s.to_rust_string_lossy(try_catch.as_ref()))
                .unwrap_or_default();
            log::error!("[plugin HMR] eval error for '{}': {msg}", global_name);
            return;
        }
    }

    // Re-collect exports from globalThis.<global_name>.
    if let Some(gname) = v8::String::new(scope, global_name) {
        if let Some(exports_val) = global_obj.get(scope, gname.into()) {
            if let Ok(exports) = v8::Local::<v8::Object>::try_from(exports_val) {
                let names = exports.get_own_property_names(scope, Default::default());
                let names = match names { Some(n) => n, None => return };
                for i in 0..names.length() {
                    let key     = match names.get_index(scope, i) { Some(k) => k, None => continue };
                    let val     = match exports.get(scope, key)   { Some(v) => v, None => continue };
                    let Ok(fn_local) = v8::Local::<v8::Function>::try_from(val) else { continue };
                    let key_str = key.to_string(scope)
                        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
                        .unwrap_or_default();
                    if key_str.is_empty() { continue; }
                    let cmd_name = match prefix {
                        Some(ns) => format!("{ns}.{key_str}"),
                        None     => key_str.clone(),
                    };
                    state.js_backend_commands.insert(cmd_name, v8::Global::new(scope, fn_local));
                    log::info!("[plugin HMR] re-registered '{}' from '{}'", key_str, global_name);
                }
            }
        }
    }
}

/// Tracks playback position for a rodio audio handle.
/// rodio 0.17 has no `get_pos()`  we maintain wall-clock state manually.
/// Engine-neutral — shared by V8's `bind_media.rs` and QuickJS's
/// `quickjs_media.rs` (only gated on the `audio` feature, not `v8`).
#[cfg(feature = "audio")]
pub(crate) struct AudioTracker {
    pub(crate) path:        String,
    pub(crate) offset_secs: f64,                        // saved offset when paused / seeked
    pub(crate) started_at:  Option<std::time::Instant>, // None = paused
}
#[cfg(feature = "audio")]
impl AudioTracker {
    pub(crate) fn current_time(&self) -> f64 {
        self.offset_secs
            + self.started_at.map(|t| t.elapsed().as_secs_f64()).unwrap_or(0.0)
    }
}

/// Engine-neutral — used by both V8's `bind_net.rs` and QuickJS's
/// `quickjs_net.rs`. Not gated behind `v8`, only `websocket` (glyx-runtime's
/// own optional-dependency feature, independent of engine choice).
#[cfg(feature = "websocket")]
pub(crate) struct WsHandle {
    pub(crate) outbox_tx: tokio::sync::mpsc::UnboundedSender<String>,
    pub(crate) inbox:     Arc<Mutex<VecDeque<String>>>,
}

pub(crate) struct HotkeyState {
    pub(crate) manager: global_hotkey::GlobalHotKeyManager,
    /// Maps glyx-assigned ID †’ registered HotKey (needed for unregister).
    pub(crate) hotkeys: HashMap<u32, global_hotkey::hotkey::HotKey>,
}

pub(crate) fn parse_accelerator(acc: &str) -> Option<global_hotkey::hotkey::HotKey> {
    use global_hotkey::hotkey::{HotKey, Modifiers};
    let mut mods     = Modifiers::empty();
    let mut key_code = None;
    for part in acc.to_lowercase().split('+') {
        match part.trim() {
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "shift"            => mods |= Modifiers::SHIFT,
            "alt"              => mods |= Modifiers::ALT,
            "meta" | "cmd" | "super" | "win" => mods |= Modifiers::META,
            key => key_code = str_to_code(key),
        }
    }
    let code = key_code?;
    Some(HotKey::new(if mods.is_empty() { None } else { Some(mods) }, code))
}

pub(crate) fn str_to_code(key: &str) -> Option<global_hotkey::hotkey::Code> {
    use global_hotkey::hotkey::Code;
    Some(match key {
        "a" => Code::KeyA,    "b" => Code::KeyB,    "c" => Code::KeyC,
        "d" => Code::KeyD,    "e" => Code::KeyE,    "f" => Code::KeyF,
        "g" => Code::KeyG,    "h" => Code::KeyH,    "i" => Code::KeyI,
        "j" => Code::KeyJ,    "k" => Code::KeyK,    "l" => Code::KeyL,
        "m" => Code::KeyM,    "n" => Code::KeyN,    "o" => Code::KeyO,
        "p" => Code::KeyP,    "q" => Code::KeyQ,    "r" => Code::KeyR,
        "s" => Code::KeyS,    "t" => Code::KeyT,    "u" => Code::KeyU,
        "v" => Code::KeyV,    "w" => Code::KeyW,    "x" => Code::KeyX,
        "y" => Code::KeyY,    "z" => Code::KeyZ,
        "0" => Code::Digit0,  "1" => Code::Digit1,  "2" => Code::Digit2,
        "3" => Code::Digit3,  "4" => Code::Digit4,  "5" => Code::Digit5,
        "6" => Code::Digit6,  "7" => Code::Digit7,  "8" => Code::Digit8,
        "9" => Code::Digit9,
        "f1"  => Code::F1,  "f2"  => Code::F2,  "f3"  => Code::F3,
        "f4"  => Code::F4,  "f5"  => Code::F5,  "f6"  => Code::F6,
        "f7"  => Code::F7,  "f8"  => Code::F8,  "f9"  => Code::F9,
        "f10" => Code::F10, "f11" => Code::F11, "f12" => Code::F12,
        "space"                    => Code::Space,
        "enter" | "return"         => Code::Enter,
        "escape" | "esc"           => Code::Escape,
        "tab"                      => Code::Tab,
        "backspace"                => Code::Backspace,
        "delete"                   => Code::Delete,
        "insert"                   => Code::Insert,
        "home"                     => Code::Home,
        "end"                      => Code::End,
        "pageup"                   => Code::PageUp,
        "pagedown"                 => Code::PageDown,
        "up"    | "arrowup"        => Code::ArrowUp,
        "down"  | "arrowdown"      => Code::ArrowDown,
        "left"  | "arrowleft"      => Code::ArrowLeft,
        "right" | "arrowright"     => Code::ArrowRight,
        _ => return None,
    })
}

#[cfg(feature = "v8")]
fn set_func(
    scope:  &mut v8::PinScope<'_, '_, v8::Context>,
    global: v8::Local<v8::Object>,
    name:   &str,
    cb:     impl v8::MapFnTo<v8::FunctionCallback>,
) {
    let key  = v8::String::new(scope, name).unwrap();
    let func = v8::Function::new(scope, cb).unwrap();
    global.set(scope, key.into(), func.into());
}

//  Prop parsing €€€

#[cfg(feature = "v8")]
fn parse_node_type(scope: &mut v8::PinScope<'_, '_, v8::Context>, value: v8::Local<v8::Value>) -> NodeType {
    let s = value
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_default()
        .to_lowercase();
    match s.as_str() {
        "text"            => NodeType::Text,
        "image"           => NodeType::Image,
        "canvas"          => NodeType::Canvas,
        "canvas3d"        => NodeType::Canvas3D,
        "camera"          => NodeType::Camera,
        "video"           => NodeType::Video,
        "repaintboundary" => NodeType::RepaintBoundary,
        "webview"         => NodeType::WebView,
        _                 => NodeType::View,
    }
}

/// Parse a CSS hex colour string (`#RGB`, `#RRGGBB`, `#RRGGBBAA`) into RGBA bytes.
/// Returns `None` if the string is not a valid hex colour. Engine-neutral —
/// used by both the V8 `parse_props` (below) and QuickJS's JSON-based
/// equivalent in `quickjs_runtime.rs`.
pub(crate) fn parse_hex_color(s: &str) -> Option<[u8; 4]> {
    let s = s.trim().trim_start_matches('#');
    match s.len() {
        3 => {
            let r = u8::from_str_radix(&s[0..1].repeat(2), 16).ok()?;
            let g = u8::from_str_radix(&s[1..2].repeat(2), 16).ok()?;
            let b = u8::from_str_radix(&s[2..3].repeat(2), 16).ok()?;
            Some([r, g, b, 255])
        }
        6 => {
            let r = u8::from_str_radix(&s[0..2], 16).ok()?;
            let g = u8::from_str_radix(&s[2..4], 16).ok()?;
            let b = u8::from_str_radix(&s[4..6], 16).ok()?;
            Some([r, g, b, 255])
        }
        8 => {
            let r = u8::from_str_radix(&s[0..2], 16).ok()?;
            let g = u8::from_str_radix(&s[2..4], 16).ok()?;
            let b = u8::from_str_radix(&s[4..6], 16).ok()?;
            let a = u8::from_str_radix(&s[6..8], 16).ok()?;
            Some([r, g, b, a])
        }
        _ => None,
    }
}

/// Read a string property from a JS object, if present.
#[cfg(feature = "v8")]
fn get_str_prop(
    scope: &mut Scope,
    obj:   v8::Local<v8::Object>,
    key:   &str,
) -> Option<String> {
    let k = v8::String::new(scope, key).unwrap();
    let v = obj.get(scope, k.into())?;
    if v.is_string() || v.is_number() {
        Some(v.to_string(scope)?.to_rust_string_lossy(scope.as_ref()))
    } else {
        None
    }
}

/// Read a number property from a JS object as f32, if present.
#[cfg(feature = "v8")]
fn get_num_prop(
    scope: &mut Scope,
    obj:   v8::Local<v8::Object>,
    key:   &str,
) -> Option<f32> {
    let k = v8::String::new(scope, key).unwrap();
    let v = obj.get(scope, k.into())?;
    if v.is_number() {
        Some(v.number_value(scope)? as f32)
    } else {
        None
    }
}

/// Read a length value from a JS object: either a plain number (px) or a
/// `"50%"` string (percent). Returns `None` if the property is absent.
#[cfg(feature = "v8")]
fn get_length_prop(
    scope: &mut Scope,
    obj:   v8::Local<v8::Object>,
    key:   &str,
) -> Option<LengthValue> {
    let k = v8::String::new(scope, key).unwrap();
    let v = obj.get(scope, k.into())?;

    // String: "50%" †’ Percent(0.5), "123" †’ Px(123.0)
    if v.is_string() {
        let s = v.to_string(scope)?.to_rust_string_lossy(scope.as_ref());
        if let Some(pct) = s.strip_suffix('%') {
            return pct.parse::<f32>().ok().map(|n| LengthValue::Percent(n / 100.0));
        }
        return s.parse::<f32>().ok().map(LengthValue::Px);
    }

    // Number: 123 †’ Px(123.0)
    if v.is_number() {
        return Some(LengthValue::Px(v.number_value(scope)? as f32));
    }

    None
}

/// Read a boolean property from a JS object, if present.
#[cfg(feature = "v8")]
fn get_bool_prop(
    scope: &mut Scope,
    obj:   v8::Local<v8::Object>,
    key:   &str,
) -> Option<bool> {
    let k = v8::String::new(scope, key).unwrap();
    let v = obj.get(scope, k.into())?;
    if v.is_boolean() {
        Some(v.boolean_value(scope))
    } else {
        None
    }
}

/// Read a hex colour string property, if present and parseable.
#[cfg(feature = "v8")]
fn get_color_prop(
    scope: &mut Scope,
    obj:   v8::Local<v8::Object>,
    key:   &str,
) -> Option<[u8; 4]> {
    let s = get_str_prop(scope, obj, key)?;
    parse_hex_color(&s)
}

#[cfg(feature = "v8")]
fn parse_props(
    scope: &mut Scope,
    value: v8::Local<v8::Value>,
) -> NodeProps {
    let mut props = NodeProps::default();
    let Some(obj) = value.to_object(scope) else { return props };

    props.width       = get_length_prop(scope, obj, "width");
    props.height      = get_length_prop(scope, obj, "height");
    props.font_size             = get_num_prop(scope, obj, "fontSize");
    props.font_weight           = get_str_prop(scope, obj, "fontWeight").map(|s| s.to_string());
    props.font_style            = get_str_prop(scope, obj, "fontStyle").map(|s| s.to_string());
    props.text_decoration_line  = get_str_prop(scope, obj, "textDecorationLine").map(|s| s.to_string());
    props.border_radius = get_num_prop(scope, obj, "borderRadius");
    props.padding     = get_length_prop(scope, obj, "padding");
    props.gap         = get_length_prop(scope, obj, "gap");
    props.flex        = get_num_prop(scope, obj, "flex");
    props.flex_grow   = get_num_prop(scope, obj, "flexGrow");
    props.flex_shrink = get_num_prop(scope, obj, "flexShrink");
    props.flex_basis  = get_length_prop(scope, obj, "flexBasis");
    props.flex_wrap   = get_str_prop(scope, obj, "flexWrap");

    props.text             = get_str_prop(scope, obj, "text");
    props.number_of_lines  = get_num_prop(scope, obj, "numberOfLines").map(|n| n as u32);
    props.flex_direction  = get_str_prop(scope, obj, "flexDirection");
    props.justify_content = get_str_prop(scope, obj, "justifyContent");
    props.align_items     = get_str_prop(scope, obj, "alignItems");
    props.align_self      = get_str_prop(scope, obj, "alignSelf");
    props.align_content   = get_str_prop(scope, obj, "alignContent");
    props.justify_self    = get_str_prop(scope, obj, "justifySelf");
    props.justify_items   = get_str_prop(scope, obj, "justifyItems");

    //  CSS Grid 
    props.display               = get_str_prop(scope, obj, "display");
    props.grid_template_columns = get_str_prop(scope, obj, "gridTemplateColumns");
    props.grid_template_rows    = get_str_prop(scope, obj, "gridTemplateRows");
    props.grid_column           = get_str_prop(scope, obj, "gridColumn");
    props.grid_row              = get_str_prop(scope, obj, "gridRow");

    props.background_color = get_color_prop(scope, obj, "backgroundColor");
    props.color            = get_color_prop(scope, obj, "color");

    props.show_cursor     = get_bool_prop(scope, obj, "showCursor");
    props.cursor_position = get_num_prop(scope, obj, "cursorPosition").map(|v| v as u32);
    props.selection_start = get_num_prop(scope, obj, "selectionStart").map(|v| v as u32);
    props.selection_end   = get_num_prop(scope, obj, "selectionEnd").map(|v| v as u32);
    props.ime_preedit_start = get_num_prop(scope, obj, "imePreeditStart").map(|v| v as u32);
    props.ime_preedit_end   = get_num_prop(scope, obj, "imePreeditEnd").map(|v| v as u32);
    props.role       = get_str_prop(scope, obj, "role");
    props.aria_label = get_str_prop(scope, obj, "ariaLabel");
    props.checked        = get_bool_prop(scope, obj, "checked");
    props.numeric_value  = get_num_prop(scope, obj, "numericValue").map(|v| v as f64);
    props.numeric_min    = get_num_prop(scope, obj, "numericMin").map(|v| v as f64);
    props.numeric_max    = get_num_prop(scope, obj, "numericMax").map(|v| v as f64);
    props.text_align    = get_str_prop(scope, obj, "textAlign");
    props.border_width  = get_num_prop(scope, obj, "borderWidth");
    props.border_color  = get_color_prop(scope, obj, "borderColor");

    props.clip            = get_bool_prop(scope, obj, "clip");
    props.scroll_offset_y = get_num_prop(scope, obj, "scrollOffsetY");
    props.image_id        = get_num_prop(scope, obj, "imageId").map(|v| v as u32);
    props.image_resize_mode = get_str_prop(scope, obj, "resizeMode");
    props.z_index         = get_num_prop(scope, obj, "zIndex").map(|v| v as i32);
    props.draggable       = get_bool_prop(scope, obj, "draggable");
    props.pressable       = get_bool_prop(scope, obj, "pressable");
    props.test_id         = get_str_prop(scope, obj, "testID").map(|s| s.to_string());
    props.text_scroll_x   = get_num_prop(scope, obj, "textScrollX").map(|v| v as f32);
    props.camera_handle   = get_num_prop(scope, obj, "cameraHandle").map(|v| v as u32);
    props.mirror          = get_bool_prop(scope, obj, "mirror");
    props.video_handle    = get_num_prop(scope, obj, "videoHandle").map(|v| v as u32);
    props.webview_src     = get_str_prop(scope, obj, "webviewSrc");
    props.webview_html    = get_str_prop(scope, obj, "webviewHtml");
    props.webview_opts    = get_str_prop(scope, obj, "webviewOpts");

    //  Margin 
    props.margin            = get_length_prop(scope, obj, "margin");
    props.margin_horizontal = get_length_prop(scope, obj, "marginHorizontal");
    props.margin_vertical   = get_length_prop(scope, obj, "marginVertical");
    props.margin_left       = get_length_prop(scope, obj, "marginLeft");
    props.margin_right      = get_length_prop(scope, obj, "marginRight");
    props.margin_top        = get_length_prop(scope, obj, "marginTop");
    props.margin_bottom     = get_length_prop(scope, obj, "marginBottom");

    //  Per-side padding 
    props.padding_horizontal = get_length_prop(scope, obj, "paddingHorizontal");
    props.padding_vertical   = get_length_prop(scope, obj, "paddingVertical");
    props.padding_left    = get_length_prop(scope, obj, "paddingLeft");
    props.padding_right   = get_length_prop(scope, obj, "paddingRight");
    props.padding_top     = get_length_prop(scope, obj, "paddingTop");
    props.padding_bottom  = get_length_prop(scope, obj, "paddingBottom");

    //  Min / max 
    props.min_width  = get_length_prop(scope, obj, "minWidth");
    props.min_height = get_length_prop(scope, obj, "minHeight");
    props.max_width  = get_length_prop(scope, obj, "maxWidth");
    props.max_height = get_length_prop(scope, obj, "maxHeight");

    //  Visibility / interaction €€
    props.overflow        = get_str_prop(scope, obj, "overflow");
    props.hidden          = get_bool_prop(scope, obj, "hidden");
    props.disabled        = get_bool_prop(scope, obj, "disabled");
    props.pointer_events  = get_str_prop(scope, obj, "pointerEvents");

    //  Visual effects 
    props.opacity             = get_num_prop(scope, obj, "opacity");
    props.transition_ms       = get_num_prop(scope, obj, "transitionMs").map(|n| n as u32);
    props.box_shadow          = get_str_prop(scope, obj, "boxShadow");
    props.background_gradient = get_str_prop(scope, obj, "backgroundGradient");

    //  Position / transform €€
    props.position  = get_str_prop(scope, obj, "position");
    props.top       = get_length_prop(scope, obj, "top");
    props.left      = get_length_prop(scope, obj, "left");
    props.right     = get_length_prop(scope, obj, "right");
    props.bottom    = get_length_prop(scope, obj, "bottom");
    props.transform = get_str_prop(scope, obj, "transform");
    props.box_sizing = get_str_prop(scope, obj, "boxSizing");

    //  Scrollbar 
    props.scrollbar_width  = get_num_prop(scope, obj, "scrollbarWidth");
    props.scrollbar_color  = get_str_prop(scope, obj, "scrollbarColor");
    props.show_scrollbar   = get_bool_prop(scope, obj, "showScrollbar");

    props
}

//  Sync bindings 

#[cfg(feature = "v8")]
fn v8_arg_to_string(
    scope: &mut Scope,
    args:  &v8::FunctionCallbackArguments,
    idx:   i32,
) -> String {
    args.get(idx)
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_default()
}

/// Allocate a `PromiseResolver`, return `(resolver_handle, promise, queue_clone)`.
#[cfg(feature = "v8")]
fn make_promise<'s>(
    scope: &mut Scope<'s, '_>,
    state: &AsyncState,
) -> (PromiseHandle, v8::Local<'s, v8::Promise>, CompletionQueue, Option<RedrawRequest>) {
    let resolver     = v8::PromiseResolver::new(scope).unwrap();
    let promise      = resolver.get_promise(scope);
    let global_res   = v8::Global::new(scope, resolver);
    let resolver_ptr = Box::into_raw(Box::new(global_res)) as usize;
    let queue_clone  = Arc::clone(&state.queue);
    let redraw       = state.request_redraw.as_ref().map(Arc::clone);
    (PromiseHandle::from_raw(resolver_ptr), promise, queue_clone, redraw)
}

#[cfg(feature = "v8")]
fn enqueue_completion(
    queue: &CompletionQueue,
    redraw: Option<&RedrawRequest>,
    completion: Completion,
) {
    queue.lock().push_back(completion);
    if let Some(redraw) = redraw {
        redraw();
    }
}

/// Throw a JS Error for a missing capability (sync bindings only).
#[cfg(feature = "v8")]
fn throw_cap_error(scope: &mut v8::PinScope<'_, '_, v8::Context>, cap: &str) {
    let msg = format!(
        "Capability required: {cap}  add it to glyx.config.json under \"capabilities\""
    );
    throw_js_error(scope, &msg);
}

/// Return a pre-rejected Promise with a JS Error  use this in **async** bindings
/// so the caller always gets a settled Promise instead of a synchronous exception.
#[cfg(feature = "v8")]
fn reject_promise_with_error<'s>(scope: &mut v8::PinScope<'s, '_, v8::Context>, msg: &str) -> v8::Local<'s, v8::Promise> {
    let s        = v8::String::new(scope, msg).unwrap_or_else(|| v8::String::empty(scope));
    let exc      = v8::Exception::error(scope, s);
    let resolver = v8::PromiseResolver::new(scope).unwrap();
    resolver.reject(scope, exc);
    resolver.get_promise(scope)
}

/// Convenience wrapper for capability-gate rejections in async bindings.
#[cfg(feature = "v8")]
fn reject_cap_promise<'s>(scope: &mut v8::PinScope<'s, '_, v8::Context>, cap: &str) -> v8::Local<'s, v8::Promise> {
    let msg = format!(
        "Capability required: {cap}  add it to glyx.config.json under \"capabilities\""
    );
    reject_promise_with_error(scope, &msg)
}

//  OS system APIs €€€

/// `__glyx_battery_getStatus()` †’ Promise<JSON | null>
#[cfg(feature = "v8")]
fn fs_denied_msg(kind: &str, path: &str) -> String {
    format!(
        "Capability denied: fs.{kind} does not cover {path:?}. Add a matching \
         glob to glyx.config.json under \"capabilities\": {{ \"fs\": {{ \"{kind}\": \
         [\"...\"] }} }}  e.g. \"assets/**\" (app-relative) or \"**\" (all paths)."
    )
}

/// Throw a generic JS Error with the given message.
#[cfg(feature = "v8")]
fn throw_js_error(scope: &mut v8::PinScope<'_, '_, v8::Context>, msg: &str) {
    let s  = v8::String::new(scope, msg).unwrap();
    let ex = v8::Exception::error(scope, s);
    scope.throw_exception(ex);
}

#[cfg(test)]
mod tests {
    use super::*;

    //  Canvas binary protocol 
    //
    // Mirrors what @glyx-dev/react's VeloxCanvasContext writes: f32 slots, with
    // color slots written through a Uint32Array alias (raw RGBA bytes).

    /// Little-endian f32 slot stream builder.
    struct Stream(Vec<u8>);
    impl Stream {
        fn new() -> Self { Stream(Vec::new()) }
        fn f(mut self, v: f32) -> Self { self.0.extend_from_slice(&v.to_le_bytes()); self }
        fn color(mut self, rgba: [u8; 4]) -> Self { self.0.extend_from_slice(&rgba); self }
        fn decode(self, strs: &[u8]) -> Vec<CanvasCmd> {
            let count = self.0.len() / 4;
            decode_canvas_binary(&self.0, count, strs)
        }
    }

    const RED: [u8; 4] = [255, 0, 0, 255];

    #[test]
    fn binary_decodes_fill_rect() {
        let cmds = Stream::new()
            .f(canvas_op::FILL_RECT as f32)
            .f(1.0).f(2.0).f(30.0).f(40.0).color(RED)
            .decode(&[]);
        assert_eq!(cmds, vec![CanvasCmd::FillRect { x: 1.0, y: 2.0, w: 30.0, h: 40.0, color: RED }]);
    }

    #[test]
    fn binary_decodes_mixed_command_sequence() {
        let cmds = Stream::new()
            .f(canvas_op::CLEAR as f32)
            .f(canvas_op::FILL_CIRCLE as f32).f(10.0).f(20.0).f(5.0).color(RED)
            .f(canvas_op::STROKE_LINE as f32).f(0.0).f(0.0).f(9.0).f(9.0).color(RED).f(2.0)
            .decode(&[]);
        assert_eq!(cmds, vec![
            CanvasCmd::Clear,
            CanvasCmd::FillCircle { cx: 10.0, cy: 20.0, r: 5.0, color: RED },
            CanvasCmd::StrokeLine { x0: 0.0, y0: 0.0, x1: 9.0, y1: 9.0, color: RED, line_width: 2.0 },
        ]);
    }

    #[test]
    fn binary_decodes_fill_text_from_string_region() {
        let strs = "hello world".as_bytes();
        let cmds = Stream::new()
            .f(canvas_op::FILL_TEXT as f32)
            .f(5.0).f(6.0).f(14.0).color(RED)
            .f(6.0)  // offset: "world"
            .f(5.0)  // length
            .decode(strs);
        assert_eq!(cmds, vec![CanvasCmd::FillText {
            text: "world".into(), x: 5.0, y: 6.0, font_size: 14.0, color: RED,
        }]);
    }

    #[test]
    fn binary_decodes_variable_length_paths() {
        // FILL_PATH: [op, count, color, x0,y0,x1,y1,x2,y2], then another command
        // after it  proves the per-arm index advance is correct.
        let cmds = Stream::new()
            .f(canvas_op::FILL_PATH as f32).f(3.0).color(RED)
            .f(0.0).f(0.0).f(10.0).f(0.0).f(5.0).f(8.0)
            .f(canvas_op::STROKE_PATH as f32).f(2.0).color(RED).f(1.5).f(1.0)
            .f(1.0).f(1.0).f(2.0).f(2.0)
            .decode(&[]);
        assert_eq!(cmds, vec![
            CanvasCmd::FillPath { points: vec![0.0, 0.0, 10.0, 0.0, 5.0, 8.0], color: RED },
            CanvasCmd::StrokePath {
                points: vec![1.0, 1.0, 2.0, 2.0], color: RED, line_width: 1.5, closed: true,
            },
        ]);
    }

    #[test]
    fn binary_and_json_paths_decode_identically() {
        // The same drawing through both transports must yield the same commands
        //  this pins the two decoders against drifting apart.
        let from_binary = Stream::new()
            .f(canvas_op::FILL_RECT as f32).f(1.0).f(2.0).f(3.0).f(4.0).color(RED)
            .f(canvas_op::FILL_PATH as f32).f(2.0).color(RED).f(0.0).f(0.0).f(7.0).f(7.0)
            .decode(&[]);
        let from_json: Vec<CanvasCmd> = serde_json::from_str(r#"[
            { "type": "fillRect", "x": 1, "y": 2, "w": 3, "h": 4, "color": [255,0,0,255] },
            { "type": "fillPath", "points": [0,0,7,7], "color": [255,0,0,255] }
        ]"#).unwrap();
        assert_eq!(from_binary, from_json);
    }

    #[test]
    fn binary_truncated_stream_stops_cleanly() {
        // FILL_RECT needs 5 args; only 2 are present †’ decode stops, no panic.
        let cmds = Stream::new()
            .f(canvas_op::CLEAR as f32)
            .f(canvas_op::FILL_RECT as f32).f(1.0).f(2.0)
            .decode(&[]);
        assert_eq!(cmds, vec![CanvasCmd::Clear]);
    }

    #[test]
    fn binary_unknown_opcode_stops_cleanly() {
        let cmds = Stream::new()
            .f(canvas_op::FILL_CIRCLE as f32).f(1.0).f(2.0).f(3.0).color(RED)
            .f(999.0) // corrupt
            .f(canvas_op::CLEAR as f32)
            .decode(&[]);
        assert_eq!(cmds.len(), 1); // everything after the corrupt opcode is dropped
    }

    #[test]
    fn binary_float_count_limits_live_slots() {
        // Buffer holds two commands but float_count says only the first is live.
        let mut bytes = Vec::new();
        for v in [canvas_op::CLEAR as f32, canvas_op::CLEAR as f32] {
            bytes.extend_from_slice(&v.to_le_bytes());
        }
        assert_eq!(decode_canvas_binary(&bytes, 1, &[]).len(), 1);
    }

    #[test]
    fn binary_hostile_values_never_panic() {
        // JS controls every slot: saturating offsets/counts must fail closed.
        // (These were real overflow panics before checked math was added.)
        let huge = f32::MAX;

        // fillText with off/len that saturate to usize::MAX.
        let cmds = Stream::new()
            .f(canvas_op::FILL_TEXT as f32)
            .f(0.0).f(0.0).f(14.0).color(RED).f(huge).f(huge)
            .decode(b"abc");
        assert_eq!(cmds, vec![CanvasCmd::FillText {
            text: String::new(), x: 0.0, y: 0.0, font_size: 14.0, color: RED,
        }]);

        // Path with a count that saturates (count*2 would overflow).
        let cmds = Stream::new()
            .f(canvas_op::FILL_PATH as f32).f(huge).color(RED)
            .decode(&[]);
        assert!(cmds.is_empty());

        // NaN / negative floats in numeric positions must not panic either.
        let _ = Stream::new()
            .f(canvas_op::STROKE_PATH as f32).f(f32::NAN).color(RED).f(-1.0).f(f32::INFINITY)
            .decode(&[]);
    }

    #[test]
    fn binary_text_out_of_range_offset_yields_empty_text() {
        let cmds = Stream::new()
            .f(canvas_op::FILL_TEXT as f32)
            .f(0.0).f(0.0).f(12.0).color(RED).f(100.0).f(5.0)
            .decode(b"short");
        assert_eq!(cmds, vec![CanvasCmd::FillText {
            text: String::new(), x: 0.0, y: 0.0, font_size: 12.0, color: RED,
        }]);
    }

    //  extract_host (network capability gate input) €

    #[cfg(all(feature = "v8", any(feature = "fetch", feature = "websocket")))]
    #[test]
    fn extract_host_strips_scheme_path_and_port() {
        assert_eq!(extract_host("https://api.example.com/v1/users"), "api.example.com");
        assert_eq!(extract_host("http://api.example.com:8080/x"), "api.example.com");
        assert_eq!(extract_host("wss://ws.example.com/socket"), "ws.example.com");
        // Bare-hostname (no scheme) input is only supported by the
        // non-`fetch` fallback parser. Every real call site passes a URL
        // already validated by check_fetch_scheme/check_ws_scheme (always
        // schemed) or a redirect target from `reqwest` (also always
        // schemed) — the `fetch`-enabled `url`-crate-backed branch requires
        // an absolute URL and fails closed (returns "") on schemeless
        // input, which is correct/safe (not a bug), just a real behavioral
        // difference between the two branches.
        #[cfg(not(feature = "fetch"))]
        assert_eq!(extract_host("api.example.com"), "api.example.com");
    }

    #[cfg(all(feature = "v8", any(feature = "fetch", feature = "websocket")))]
    #[test]
    fn extract_host_lowercases() {
        assert_eq!(extract_host("https://API.Example.COM/x"), "api.example.com");
    }

    #[cfg(all(feature = "v8", any(feature = "fetch", feature = "websocket")))]
    #[test]
    fn extract_host_hostile_urls_fail_closed() {
        // Userinfo trick: "http://allowed.com@evil.com/x" — the actual host is
        // evil.com; allowed.com is the username.  url::Url parses this correctly.
        let h = extract_host("https://api.example.com@evil.com/x");
        assert_ne!(h, "api.example.com",
            "userinfo@host must resolve to the real host (evil.com), not the username");
        // Standard userinfo (user:pass@host) — host is api.example.com.
        // The old hand-rolled parser accidentally returned "user" here; the
        // url::Url parser returns the correct hostname.
        assert_eq!(extract_host("https://user:pass@api.example.com/x"), "api.example.com",
            "user:pass@ prefix must be stripped; host is api.example.com");
    }
}
