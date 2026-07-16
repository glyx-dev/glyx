//! Stable C ABI contract for optional Glyx capabilities.
//!
//! Each capability is a `#[repr(C)]` vtable struct. Dynamic capability modules
//! (`.dll`/`.so`/`.dylib`) export a well-known C symbol that returns a pointer
//! to their vtable. The `glyx-runtime` `CapLoader` resolves the symbol and
//! dispatches through it.
//!
//! Static (compiled-in) implementations use the same vtable structs so the
//! dispatch path is identical whether a capability is loaded at build time or
//! at runtime.
//!
//! # ABI stability
//! All function pointers use `extern "C"` calling convention and only C-
//! compatible types (`*const u8`, `usize`, `u32`, `f32`, `f64`, `u8`). This
//! makes the boundary stable across Rust compiler versions.
//!
//! # Versioning
//! Every vtable starts with a `version: u32` field. Loaders reject modules
//! whose version is outside the supported range (`ABI_VERSION_MIN..=ABI_VERSION`).

pub const ABI_VERSION:     u32 = 1;
pub const ABI_VERSION_MIN: u32 = 1;

// ── Audio ─────────────────────────────────────────────────────────────────────

/// ABI export symbol for the audio capability.
pub const SYM_AUDIO: &[u8] = b"glyx_cap_audio\0";

/// Returned by `glyx_cap_audio` — must be the first symbol in an audio DLL.
///
/// All functions are thread-safe; implementations MUST be callable from any
/// thread (the binding layer calls them from the V8 isolate thread).
#[repr(C)]
pub struct AudioCap {
    pub version: u32,

    /// Initialise the audio subsystem.  Called once before any other function.
    /// Returns 0 on success, non-zero on error (audio unavailable).
    pub init: unsafe extern "C" fn() -> i32,

    /// Open and begin playing `path` (null-terminated UTF-8).
    /// `volume` ∈ [0.0, 2.0].  `looping` = 1 for repeat.
    /// Returns a non-zero handle ID, or 0 on error.
    pub play: unsafe extern "C" fn(
        path:    *const u8,
        path_len: usize,
        volume:  f32,
        looping: u8,
    ) -> u32,

    /// Pause a playing sink.  No-op if handle is unknown.
    pub pause:  unsafe extern "C" fn(handle: u32),

    /// Resume a paused sink.
    pub resume: unsafe extern "C" fn(handle: u32),

    /// Stop and release a sink.
    pub stop:   unsafe extern "C" fn(handle: u32),

    /// Set volume on a live sink.
    pub set_volume: unsafe extern "C" fn(handle: u32, volume: f32),

    /// Get volume of a live sink, or 1.0 if unknown.
    pub get_volume: unsafe extern "C" fn(handle: u32) -> f32,

    /// Current playback position in seconds, or 0.0 if unknown.
    pub get_time: unsafe extern "C" fn(handle: u32) -> f64,

    /// Total duration in seconds, or -1.0 if unknown / still loading.
    pub duration: unsafe extern "C" fn(handle: u32) -> f64,

    /// Seek to `seconds`.
    pub seek: unsafe extern "C" fn(handle: u32, seconds: f64),

    /// Drain completed-event queue into `out_buf` as a JSON array string
    /// (e.g. `[{"handle":3,"event":"ended"}]`).
    /// `out_len` is set to the number of bytes written (excluding NUL).
    /// The caller supplies a buffer of `buf_cap` bytes; output is truncated
    /// if the buffer is too small (never overflows).
    pub poll: unsafe extern "C" fn(
        out_buf: *mut u8,
        out_len: *mut usize,
        buf_cap: usize,
    ),

    /// Tear down the audio subsystem.  Called on shutdown.
    pub shutdown: unsafe extern "C" fn(),
}

// ── AI (embed / generate / transcribe) ───────────────────────────────────────

pub const SYM_AI: &[u8] = b"glyx_cap_ai\0";

/// Each AI operation is synchronous from the ABI's point of view; the caller
/// runs it on a blocking thread pool.  Results are returned as JSON strings
/// written into caller-supplied buffers.
#[repr(C)]
pub struct AiCap {
    pub version: u32,

    /// Embed `text` using the model at `model_path`.
    /// Writes a JSON float array to `out_buf` (e.g. `[0.1,0.2,...]`).
    /// Returns 0 on success.
    pub embed: unsafe extern "C" fn(
        model_path:     *const u8,
        model_path_len: usize,
        text:           *const u8,
        text_len:       usize,
        out_buf:        *mut u8,
        out_len:        *mut usize,
        buf_cap:        usize,
    ) -> i32,

    /// Generate text from `prompt` using the model at `model_path`.
    /// `opts_json` is an optional JSON object (`{ max_tokens?, temperature? }`).
    /// Writes the generated text to `out_buf`.  Returns 0 on success.
    pub generate: unsafe extern "C" fn(
        model_path:     *const u8,
        model_path_len: usize,
        prompt:         *const u8,
        prompt_len:     usize,
        opts_json:      *const u8,
        opts_json_len:  usize,
        out_buf:        *mut u8,
        out_len:        *mut usize,
        buf_cap:        usize,
    ) -> i32,

    /// Transcribe audio file at `audio_path` using Whisper model at `model_path`.
    /// Writes transcript text to `out_buf`.  Returns 0 on success.
    pub transcribe: unsafe extern "C" fn(
        model_path:     *const u8,
        model_path_len: usize,
        audio_path:     *const u8,
        audio_path_len: usize,
        out_buf:        *mut u8,
        out_len:        *mut usize,
        buf_cap:        usize,
    ) -> i32,

    /// Unload a model from memory.  `kind` = 0 embed, 1 generate, 2 transcribe.
    pub unload: unsafe extern "C" fn(kind: u8),

    pub shutdown: unsafe extern "C" fn(),
}

// ── Camera ────────────────────────────────────────────────────────────────────

pub const SYM_CAMERA: &[u8] = b"glyx_cap_camera\0";

#[repr(C)]
pub struct CameraCap {
    pub version: u32,

    /// Write a JSON array of camera device names to `out_buf`.
    pub list: unsafe extern "C" fn(
        out_buf: *mut u8,
        out_len: *mut usize,
        buf_cap: usize,
    ) -> i32,

    /// Open camera `index`.  Returns a non-zero handle, or 0 on error.
    pub open: unsafe extern "C" fn(index: u32) -> u32,

    /// Close a camera handle.
    pub close: unsafe extern "C" fn(handle: u32),

    /// Capture a JPEG frame from `handle`.
    /// Writes raw JPEG bytes to `out_buf`.  Returns byte count, or 0 on error.
    pub capture: unsafe extern "C" fn(
        handle:  u32,
        out_buf: *mut u8,
        buf_cap: usize,
    ) -> usize,

    /// Start recording.  Writes output path (null-terminated) to `out_path`.
    pub record_start: unsafe extern "C" fn(handle: u32),

    /// Stop recording.  Writes output file path to `out_buf`.
    pub record_stop: unsafe extern "C" fn(
        handle:  u32,
        out_buf: *mut u8,
        out_len: *mut usize,
        buf_cap: usize,
    ) -> i32,

    pub shutdown: unsafe extern "C" fn(),
}

// ── Gamepad ───────────────────────────────────────────────────────────────────

pub const SYM_GAMEPAD: &[u8] = b"glyx_cap_gamepad\0";

#[repr(C)]
pub struct GamepadCap {
    pub version: u32,

    /// Initialise the gamepad subsystem.
    pub init: unsafe extern "C" fn() -> i32,

    /// Drain the event queue into `out_buf` as a JSON array.
    pub poll: unsafe extern "C" fn(
        out_buf: *mut u8,
        out_len: *mut usize,
        buf_cap: usize,
    ),

    pub shutdown: unsafe extern "C" fn(),
}

// ── HID ───────────────────────────────────────────────────────────────────────

pub const SYM_HID: &[u8] = b"glyx_cap_hid\0";

#[repr(C)]
pub struct HidCap {
    pub version: u32,

    /// Write a JSON array of HID device descriptors to `out_buf`.
    pub enumerate: unsafe extern "C" fn(
        out_buf: *mut u8,
        out_len: *mut usize,
        buf_cap: usize,
    ) -> i32,

    /// Open device by vendor + product ID.  Returns handle, or 0 on error.
    pub open: unsafe extern "C" fn(vendor_id: u16, product_id: u16) -> u32,

    /// Read up to `buf_cap` bytes from `handle`.  Returns byte count.
    pub read: unsafe extern "C" fn(
        handle:  u32,
        out_buf: *mut u8,
        buf_cap: usize,
    ) -> usize,

    /// Write `data` bytes to `handle`.  Returns bytes written, or 0 on error.
    pub write: unsafe extern "C" fn(
        handle:  u32,
        data:    *const u8,
        data_len: usize,
    ) -> usize,

    /// Close a HID handle.
    pub close: unsafe extern "C" fn(handle: u32),

    pub shutdown: unsafe extern "C" fn(),
}

// ── WebView ───────────────────────────────────────────────────────────────────

pub const SYM_WEBVIEW: &[u8] = b"glyx_cap_webview\0";

/// Embeds an OS-native child webview (wry: WebView2 / WKWebView / WebKitGTK)
/// positioned over a region of a parent window. One handle == one embedded
/// webview instance, keyed by the caller (glyx-core keys by scene node id).
///
/// `parent_handle` is the platform-native window handle (HWND on Windows,
/// NSView* on macOS, GtkWindow* on Linux) as an opaque pointer — glyx-cap-abi
/// stays dependency-free, so it does not know about `raw-window-handle`; the
/// caller extracts the right pointer for the host platform before calling in.
#[repr(C)]
pub struct WebviewCap {
    pub version: u32,

    /// Initialise the webview subsystem. Called once before any other function.
    /// Returns 0 on success, non-zero on error.
    pub init: unsafe extern "C" fn() -> i32,

    /// Create a child webview attached to `parent_handle`, loading `url`
    /// (or raw `html` if `is_html` != 0), positioned at (x,y,w,h) in logical
    /// pixels relative to the parent window's client area.
    ///
    /// `opts_json` is a UTF-8 JSON object (may be empty/`{}`):
    /// ```json
    /// {
    ///   "sandbox": true,                          // devtools off, strict nav (default true)
    ///   "allowedOrigins": ["https://example.com"], // navigation allowlist; [] or absent = only the initial url's origin
    ///   "assetsRoot": "C:/app/assets"               // enables glyx-asset://<path> serving files under this dir
    /// }
    /// ```
    /// Returns a non-zero handle, or 0 on error.
    pub create: unsafe extern "C" fn(
        parent_handle: *mut core::ffi::c_void,
        url_or_html:   *const u8,
        len:           usize,
        is_html:       u8,
        x: f32, y: f32, w: f32, h: f32,
        opts_json:     *const u8,
        opts_json_len: usize,
    ) -> u32,

    /// Reposition/resize an existing webview (called every frame the node's
    /// layout rect changes — implementations should no-op on unchanged bounds).
    pub set_bounds: unsafe extern "C" fn(handle: u32, x: f32, y: f32, w: f32, h: f32),

    /// Show or hide the webview without destroying it (e.g. off-screen/occluded).
    pub set_visible: unsafe extern "C" fn(handle: u32, visible: u8),

    /// Navigate an existing webview to a new URL.
    pub load_url: unsafe extern "C" fn(handle: u32, url: *const u8, url_len: usize),

    /// Post a message INTO the webview page (delivered as a `message` event
    /// on the page's `window.chrome.webview`/`window.ipc` bridge, whichever
    /// the implementation wires up). `msg` is a UTF-8 string (JSON expected).
    pub post_message: unsafe extern "C" fn(handle: u32, msg: *const u8, msg_len: usize),

    /// Drain the queue of messages the page has posted OUT (via the injected
    /// `window.ipc.postMessage(str)`) into `out_buf` as a JSON array of
    /// strings, e.g. `["hello","world"]`. Same truncation contract as
    /// `AudioCap::poll` — never overflows `buf_cap`.
    pub poll_messages: unsafe extern "C" fn(
        handle:  u32,
        out_buf: *mut u8,
        out_len: *mut usize,
        buf_cap: usize,
    ),

    /// Destroy a webview instance, tearing down its native child surface.
    pub destroy: unsafe extern "C" fn(handle: u32),

    pub shutdown: unsafe extern "C" fn(),
}

// ── CapSet ────────────────────────────────────────────────────────────────────

/// Resolved set of capability vtables.  Each field is `None` when the
/// capability is neither compiled in nor available as a dynamic module.
pub struct CapSet {
    pub audio:   Option<&'static AudioCap>,
    pub ai:      Option<&'static AiCap>,
    pub camera:  Option<&'static CameraCap>,
    pub gamepad: Option<&'static GamepadCap>,
    pub hid:     Option<&'static HidCap>,
    pub webview: Option<&'static WebviewCap>,
}

impl CapSet {
    pub const fn empty() -> Self {
        Self { audio: None, ai: None, camera: None, gamepad: None, hid: None, webview: None }
    }
}
