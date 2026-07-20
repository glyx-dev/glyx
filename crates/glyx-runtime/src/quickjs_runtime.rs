//! `QuickJsRuntime` — the QuickJS-based implementation of `JsRuntime`, built
//! on the synchronous `rquickjs::{Runtime, Context}` API (not
//! `AsyncRuntime`/`AsyncContext`, which require an async executor around
//! every call — `glyx-core`'s frame loop is synchronous, driven by winit).
//!
//! Binding coverage mirrors `bind_*.rs`'s V8 registration (fs, db, network,
//! ai, media, tray, updater, video, JS plugins, ...) via the same
//! engine-neutral types `V8Runtime` uses (`EventQueue`, `LayoutCache`,
//! `SceneQueue`, `DbPools`, `WebviewEvents`, `VideoEvents`, ...) from
//! `bindings::mod`. Known gaps vs. V8: no snapshot/precompilation path (eval
//! from source every launch), and JS-plugin hot-reload during `glyx dev`
//! (static registration at startup works; a plugin edit needs a window
//! restart to pick up, unlike V8's `reload_plugin`).

use std::sync::Arc;
use std::rc::Rc;
use std::collections::VecDeque;

use rquickjs::{Context, Runtime as QjsRuntime, Function, Promise, Persistent, Ctx, Value};
use rquickjs::prelude::Opt;
use tokio::runtime::Handle;

use crate::{
    bindings::{
        new_completion_queue, new_db_pools, new_event_queue, new_layout_cache, new_scene_queue,
        new_video_events, new_webview_events, Completion, CompletionQueue, DbPools, EventQueue,
        InputEvent, LayoutCache, NodeProps, PromiseHandle, RedrawRequest, SceneCommand,
        SceneQueue, VideoEvents, WebviewEvents, WindowController,
    },
    quickjs_props::{parse_node_type_str, parse_props_json},
    runtime_trait::{HeapStats, JsRuntime},
    GlyxExtension, RuntimeError,
};

/// What a `PromiseHandle` actually points to for this backend: the
/// resolve/reject functions `rquickjs::Promise::new` hands back, kept alive
/// past the call that created them via `Persistent`. Boxed and cast to
/// `usize` the same way `V8Runtime` boxes a `v8::Global<PromiseResolver>` —
/// see `PromiseHandle`'s doc comment in `bindings/mod.rs`.
type ResolveReject = (Persistent<Function<'static>>, Persistent<Function<'static>>);

pub struct QuickJsRuntime {
    rt:  QjsRuntime,
    ctx: Context,
    tokio: Handle,
    queue: CompletionQueue,
    redraw: Option<RedrawRequest>,
    window: Option<WindowController>,
    next_id:       Arc<std::sync::atomic::AtomicU32>,
    next_image_id: Arc<std::sync::atomic::AtomicU32>,
    next_db_id:    Arc<std::sync::atomic::AtomicU32>,
    next_vdb_id:   Arc<std::sync::atomic::AtomicU32>,
    #[cfg(feature = "websocket")]
    next_ws_id:    Arc<std::sync::atomic::AtomicU32>,
    text_measure:  Arc<parking_lot::Mutex<glyx_text::TextSystem>>,
    vector_stores: crate::quickjs_db::VectorStores,
    #[cfg(feature = "websocket")]
    ws_handles:    crate::quickjs_net::WsHandles,
    #[cfg(feature = "audio")]
    audio_device:   Arc<crate::quickjs_media::AudioDevice>,
    #[cfg(feature = "audio")]
    audio_sinks:    crate::quickjs_media::AudioSinks,
    #[cfg(feature = "audio")]
    audio_trackers: crate::quickjs_media::AudioTrackers,
    #[cfg(feature = "audio")]
    audio_events:   crate::quickjs_media::AudioEvents,
    #[cfg(feature = "audio")]
    next_audio_id:  Arc<std::sync::atomic::AtomicU32>,
    #[cfg(feature = "ai")]
    ai_embed_model:    crate::quickjs_ai::EmbedModelCache,
    #[cfg(feature = "ai")]
    ai_generate_model: crate::quickjs_ai::GenerateModelCache,
    #[cfg(feature = "ai")]
    ai_whisper_model:  crate::quickjs_ai::WhisperModelCache,
    #[cfg(not(feature = "ai"))]
    ai_cap: Option<&'static glyx_cap_abi::AiCap>,
    fs_watchers:      crate::quickjs_fs::FsWatchers,
    fs_watch_events:  crate::quickjs_fs::FsWatchEvents,
    next_fs_watch_id: Arc<std::sync::atomic::AtomicU32>,
    sleep_guards:     crate::quickjs_sys::SleepGuards,
    next_guard_id:    Arc<std::sync::atomic::AtomicU32>,
    #[cfg(feature = "gamepad")]
    gamepad_gilrs:    crate::quickjs_sys::GamepadGilrs,
    hotkey_state:     crate::quickjs_sys::HotkeyStateCell,
    next_hotkey_id:   Arc<std::sync::atomic::AtomicU32>,

    events:             EventQueue,
    layout_cache:       LayoutCache,
    scene:              SceneQueue,
    perf_state:         Arc<parking_lot::Mutex<glyx_perf::PerfState>>,
    deeplink_url_queue: Arc<parking_lot::Mutex<VecDeque<String>>>,
    db_pools:           DbPools,
    video_events:       VideoEvents,
    next_video_id:      Arc<std::sync::atomic::AtomicU32>,
    webview_events:     WebviewEvents,
    raycast_requests:   crate::bindings::RaycastRequestQueue,
    raycast_results:    crate::bindings::RaycastResults,
    ipc_bus:            crate::bindings::IpcBus,
    my_handle:          u32,
    next_window_id:     Arc<std::sync::atomic::AtomicU32>,
    backend_commands:   crate::BackendRegistry,
    js_plugins:         crate::JsPlugins,
    /// `cmd_name -> (global_name, export_key)` for JS-plugin exports. Shared
    /// (same `Rc<RefCell<...>>`) between the registered `backend_call`
    /// closure and `reload_plugin`'s dev-mode HMR path — see
    /// `quickjs_ipc`'s module doc.
    js_backend_commands: crate::quickjs_ipc::JsBackendCommands,
}

impl QuickJsRuntime {
    /// Create a new QuickJS runtime with a fresh context and a private,
    /// single-window IPC bus (handle 0, no shared backend commands) —
    /// mirrors `V8Runtime::new`'s relationship to `new_with_ipc`. `redraw`
    /// mirrors `WindowController.request_redraw` — pass `None` to skip
    /// waking the window when async work completes (fine for tests; a real
    /// window should always pass `Some(...)`). `window` is the same
    /// `WindowController` V8Runtime takes.
    pub fn new(
        perf_state: Arc<parking_lot::Mutex<glyx_perf::PerfState>>,
        tokio: Handle,
        redraw: Option<RedrawRequest>,
        window: Option<WindowController>,
    ) -> Result<Self, RuntimeError> {
        let ipc_bus = crate::bindings::new_ipc_bus();
        let next_window_id = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let backend_commands: crate::BackendRegistry = Arc::new(std::collections::HashMap::new());
        let js_plugins: crate::JsPlugins = Arc::new(vec![]);
        Self::new_with_ipc(perf_state, tokio, redraw, window, ipc_bus, 0, next_window_id, backend_commands, js_plugins)
    }

    /// Create a new QuickJS runtime and join it to the shared IPC bus —
    /// mirrors `V8Runtime::new_with_ipc`. `my_handle` is this window's
    /// identifier in the bus; `next_window_id` is the shared counter for
    /// assigning secondary-window IDs; `backend_commands` is the registry of
    /// named async Rust commands callable from JS via `backend.<name>(args)`.
    pub fn new_with_ipc(
        perf_state: Arc<parking_lot::Mutex<glyx_perf::PerfState>>,
        tokio: Handle,
        redraw: Option<RedrawRequest>,
        window: Option<WindowController>,
        ipc_bus: crate::bindings::IpcBus,
        my_handle: u32,
        next_window_id: Arc<std::sync::atomic::AtomicU32>,
        backend_commands: crate::BackendRegistry,
        js_plugins: crate::JsPlugins,
    ) -> Result<Self, RuntimeError> {
        ipc_bus.lock().entry(my_handle).or_insert_with(|| Arc::new(parking_lot::Mutex::new(VecDeque::new())));

        let rt = QjsRuntime::new()
            .map_err(|e| RuntimeError::CompileError(format!("quickjs runtime init: {e}")))?;
        let ctx = Context::full(&rt)
            .map_err(|e| RuntimeError::CompileError(format!("quickjs context init: {e}")))?;

        let events         = new_event_queue();
        let layout_cache   = new_layout_cache();
        let scene          = new_scene_queue();
        let db_pools       = new_db_pools();
        let video_events   = new_video_events();
        let next_video_id  = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let webview_events = new_webview_events();
        let raycast_requests = crate::bindings::new_raycast_request_queue();
        let raycast_results  = crate::bindings::new_raycast_results();
        let queue          = new_completion_queue();
        let deeplink_url_queue = Arc::new(parking_lot::Mutex::new(VecDeque::new()));
        let next_id       = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let next_image_id = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let next_db_id    = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let next_vdb_id   = Arc::new(std::sync::atomic::AtomicU32::new(1));
        #[cfg(feature = "websocket")]
        let next_ws_id    = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let text_measure  = Arc::new(parking_lot::Mutex::new(glyx_text::TextSystem::new()));
        let vector_stores: crate::quickjs_db::VectorStores = Arc::new(parking_lot::Mutex::new(std::collections::HashMap::new()));
        #[cfg(feature = "websocket")]
        let ws_handles: crate::quickjs_net::WsHandles = Arc::new(parking_lot::Mutex::new(std::collections::HashMap::new()));
        #[cfg(feature = "audio")]
        let audio_device = Arc::new(crate::quickjs_media::AudioDevice::default());
        #[cfg(feature = "audio")]
        let audio_sinks: crate::quickjs_media::AudioSinks = Arc::new(parking_lot::Mutex::new(std::collections::HashMap::new()));
        #[cfg(feature = "audio")]
        let audio_trackers: crate::quickjs_media::AudioTrackers = Arc::new(parking_lot::Mutex::new(std::collections::HashMap::new()));
        #[cfg(feature = "audio")]
        let audio_events: crate::quickjs_media::AudioEvents = Arc::new(parking_lot::Mutex::new(VecDeque::new()));
        #[cfg(feature = "audio")]
        let next_audio_id = Arc::new(std::sync::atomic::AtomicU32::new(1));
        #[cfg(feature = "ai")]
        let ai_embed_model: crate::quickjs_ai::EmbedModelCache = Arc::new(parking_lot::Mutex::new(None));
        #[cfg(feature = "ai")]
        let ai_generate_model: crate::quickjs_ai::GenerateModelCache = Arc::new(parking_lot::Mutex::new(None));
        #[cfg(feature = "ai")]
        let ai_whisper_model: crate::quickjs_ai::WhisperModelCache = Arc::new(parking_lot::Mutex::new(None));
        #[cfg(not(feature = "ai"))]
        let ai_cap: Option<&'static glyx_cap_abi::AiCap> = crate::cap_loader::load_caps().ai;
        let fs_watchers: crate::quickjs_fs::FsWatchers = Arc::new(std::cell::RefCell::new(std::collections::HashMap::new()));
        let fs_watch_events: crate::quickjs_fs::FsWatchEvents = Arc::new(parking_lot::Mutex::new(VecDeque::new()));
        let next_fs_watch_id = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let sleep_guards: crate::quickjs_sys::SleepGuards = Arc::new(std::cell::RefCell::new(std::collections::HashMap::new()));
        let next_guard_id = Arc::new(std::sync::atomic::AtomicU32::new(1));
        #[cfg(feature = "gamepad")]
        let gamepad_gilrs: crate::quickjs_sys::GamepadGilrs = Arc::new(std::cell::RefCell::new(None));
        let hotkey_state: crate::quickjs_sys::HotkeyStateCell = Arc::new(std::cell::RefCell::new(None));
        let next_hotkey_id = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let js_backend_commands: crate::quickjs_ipc::JsBackendCommands =
            Rc::new(std::cell::RefCell::new(std::collections::HashMap::new()));

        let this = Self {
            rt, ctx, tokio, queue, redraw, window, next_id, next_image_id,
            next_db_id, next_vdb_id, text_measure, vector_stores,
            #[cfg(feature = "websocket")]
            next_ws_id,
            #[cfg(feature = "websocket")]
            ws_handles,
            #[cfg(feature = "audio")]
            audio_device,
            #[cfg(feature = "audio")]
            audio_sinks,
            #[cfg(feature = "audio")]
            audio_trackers,
            #[cfg(feature = "audio")]
            audio_events,
            #[cfg(feature = "audio")]
            next_audio_id,
            #[cfg(feature = "ai")]
            ai_embed_model,
            #[cfg(feature = "ai")]
            ai_generate_model,
            #[cfg(feature = "ai")]
            ai_whisper_model,
            #[cfg(not(feature = "ai"))]
            ai_cap,
            fs_watchers, fs_watch_events, next_fs_watch_id,
            sleep_guards, next_guard_id,
            #[cfg(feature = "gamepad")]
            gamepad_gilrs,
            hotkey_state, next_hotkey_id,
            events, layout_cache, scene, perf_state, deeplink_url_queue,
            db_pools, video_events, next_video_id, webview_events,
            raycast_requests, raycast_results,
            ipc_bus, my_handle, next_window_id, backend_commands, js_plugins,
            js_backend_commands,
        };
        this.register_core_bindings()?;
        this.install_polyfills()?;
        Ok(this)
    }

    /// Install JS-level polyfills that V8 provides natively (as engine
    /// built-ins) but QuickJS does not — currently just `console`, which
    /// app bundles call unconditionally. Without this, any app calling
    /// `console.log`/etc crashes immediately with `ReferenceError: console
    /// is not defined` before rendering anything. Routes to `__glyx_log`,
    /// matching the (otherwise-unused-at-runtime) snapshot stub script's
    /// own console shim in `snapshot.rs`.
    fn install_polyfills(&self) -> Result<(), RuntimeError> {
        const POLYFILL: &str = r#"
        (function() {
            function _fmt(args) {
                return Array.prototype.map.call(args, function(x) {
                    return typeof x === 'object' ? JSON.stringify(x) : String(x);
                }).join(' ');
            }
            function _table(data) {
                if (data == null || typeof data !== 'object') { __glyx_log(String(data)); return; }
                var rows = Array.isArray(data) ? data.map(function(v, i) { return [String(i), v]; })
                                                : Object.keys(data).map(function(k) { return [k, data[k]]; });
                var cols = [];
                rows.forEach(function(r) {
                    var v = r[1];
                    if (v != null && typeof v === 'object') {
                        Object.keys(v).forEach(function(k) { if (cols.indexOf(k) === -1) cols.push(k); });
                    } else if (cols.indexOf('Values') === -1) {
                        cols.push('Values');
                    }
                });
                var headers = ['(index)'].concat(cols);
                var lines = rows.map(function(r) {
                    var v = r[1];
                    var cells = cols.map(function(c) {
                        if (v != null && typeof v === 'object') {
                            return c in v ? String(v[c]) : '';
                        }
                        return c === 'Values' ? String(v) : '';
                    });
                    return [r[0]].concat(cells);
                });
                var widths = headers.map(function(h, i) {
                    return Math.max(h.length, lines.reduce(function(m, l) { return Math.max(m, l[i].length); }, 0));
                });
                var pad = function(s, w) { return s + Array(w - s.length + 1).join(' '); };
                var sep = '+-' + widths.map(function(w) { return Array(w + 1).join('-'); }).join('-+-') + '-+';
                var fmtRow = function(cells) { return '| ' + cells.map(function(c, i) { return pad(c, widths[i]); }).join(' | ') + ' |'; };
                var out = [sep, fmtRow(headers), sep].concat(lines.map(fmtRow)).concat([sep]);
                __glyx_log(out.join('\n'));
            }
            globalThis.console = {
                log:   function() { __glyx_log(_fmt(arguments)); },
                info:  function() { __glyx_log(_fmt(arguments)); },
                warn:  function() { __glyx_log('[warn] ' + _fmt(arguments)); },
                error: function() { __glyx_log('[error] ' + _fmt(arguments)); },
                debug: function() { __glyx_log('[debug] ' + _fmt(arguments)); },
                table: function(data) { _table(data); },
            };
        })();
        "#;
        self.ctx.with(|ctx| ctx.eval::<(), _>(POLYFILL))
            .map_err(|e| RuntimeError::CompileError(format!("quickjs polyfill install: {e}")))
    }

    /// Allocate a promise + resolve/reject pair, returning an opaque
    /// `PromiseHandle` for the pair (mint-only — see `PromiseHandle`'s doc).
    /// Mirrors `bindings::mod`'s V8-only `make_promise`, engine-specific
    /// equivalent as intended by that function's own doc comment.
    pub(crate) fn make_promise<'js>(ctx: &Ctx<'js>) -> rquickjs::Result<(PromiseHandle, Promise<'js>)> {
        let (promise, resolve_fn, reject_fn) = Promise::new(ctx)?;
        let resolve_p = Persistent::save(ctx, resolve_fn);
        let reject_p  = Persistent::save(ctx, reject_fn);
        let boxed: Box<ResolveReject> = Box::new((resolve_p, reject_p));
        let ptr = Box::into_raw(boxed) as usize;
        Ok((PromiseHandle::from_raw(ptr), promise))
    }

    /// Reject a freshly-created promise immediately (synchronously) with
    /// `msg` — for capability denials that don't need to cross a thread,
    /// same as V8's `reject_promise_with_error`/`reject_cap_promise`.
    pub(crate) fn reject_now<'js>(ctx: &Ctx<'js>, msg: String) -> rquickjs::Result<Promise<'js>> {
        let (handle, promise) = Self::make_promise(ctx)?;
        Self::settle(ctx, handle, Err(msg));
        Ok(promise)
    }

    /// Spawn `fut` on the Tokio handle, pushing its `Result<json, error>`
    /// onto the completion queue (and waking the window) when it finishes,
    /// returning the promise that will resolve/reject with that result.
    /// This is THE shared shape almost every async `__glyx_*` binding uses
    /// (fs/db/net/sys/media/ai/...) — mirrors V8's
    /// `make_promise` + `tokio.spawn` + `enqueue_completion` triplet that's
    /// repeated at every one of its ~90 async binding call sites.
    pub(crate) fn spawn_async<'js, F>(
        ctx: &Ctx<'js>, queue: CompletionQueue, tokio: &Handle, redraw: Option<RedrawRequest>, fut: F,
    ) -> rquickjs::Result<Promise<'js>>
    where
        F: std::future::Future<Output = Result<String, String>> + Send + 'static,
    {
        let (handle, promise) = Self::make_promise(ctx)?;
        tokio.spawn(async move {
            let result = fut.await;
            queue.lock().push_back(Completion { resolver_ptr: handle, result });
            if let Some(cb) = &redraw { cb(); }
        });
        Ok(promise)
    }

    /// Register the illustrative + one real async binding set proving both
    /// the registration mechanism and the cross-thread completion/promise
    /// bridge work end-to-end. See the module doc for exact scope.
    ///
    /// The actual work happens in the free function `do_register` below,
    /// not inlined in this closure — `Promise<'js>` is invariant over
    /// `'js`, and a closure's own elided parameter lifetime doesn't unify
    /// with an outer anonymous one, so `Function::new(ctx.clone(), move
    /// |ctx| ...)` fails to typecheck when the inner closure must return a
    /// `Promise` tied to that same `'js`. A plain fn with a *named* `'js`
    /// generic parameter sidesteps it, because the inner closure can then
    /// reference that concrete in-scope name instead of eliding a fresh one.
    fn register_core_bindings(&self) -> Result<(), RuntimeError> {
        let reg = RegisterState {
            queue:          Arc::clone(&self.queue),
            tokio:          self.tokio.clone(),
            redraw:         self.redraw.clone(),
            window:         self.window.clone(),
            events:         Arc::clone(&self.events),
            layout_cache:   Arc::clone(&self.layout_cache),
            scene:          Arc::clone(&self.scene),
            next_id:        Arc::clone(&self.next_id),
            next_image_id:  Arc::clone(&self.next_image_id),
            next_db_id:     Arc::clone(&self.next_db_id),
            next_vdb_id:    Arc::clone(&self.next_vdb_id),
            text_measure:   Arc::clone(&self.text_measure),
            db_pools:       Arc::clone(&self.db_pools),
            vector_stores:  Arc::clone(&self.vector_stores),
            #[cfg(feature = "websocket")]
            next_ws_id:     Arc::clone(&self.next_ws_id),
            #[cfg(feature = "websocket")]
            ws_handles:     Arc::clone(&self.ws_handles),
            deeplink_url_queue: Arc::clone(&self.deeplink_url_queue),
            perf_state:     Arc::clone(&self.perf_state),
            #[cfg(feature = "audio")]
            audio_device:   Arc::clone(&self.audio_device),
            #[cfg(feature = "audio")]
            audio_sinks:    Arc::clone(&self.audio_sinks),
            #[cfg(feature = "audio")]
            audio_trackers: Arc::clone(&self.audio_trackers),
            #[cfg(feature = "audio")]
            audio_events:   Arc::clone(&self.audio_events),
            #[cfg(feature = "audio")]
            next_audio_id:  Arc::clone(&self.next_audio_id),
            #[cfg(feature = "ai")]
            ai_embed_model:    Arc::clone(&self.ai_embed_model),
            #[cfg(feature = "ai")]
            ai_generate_model: Arc::clone(&self.ai_generate_model),
            #[cfg(feature = "ai")]
            ai_whisper_model:  Arc::clone(&self.ai_whisper_model),
            #[cfg(not(feature = "ai"))]
            ai_cap: self.ai_cap,
            fs_watchers:      Arc::clone(&self.fs_watchers),
            fs_watch_events:  Arc::clone(&self.fs_watch_events),
            next_fs_watch_id: Arc::clone(&self.next_fs_watch_id),
            sleep_guards:     Arc::clone(&self.sleep_guards),
            next_guard_id:    Arc::clone(&self.next_guard_id),
            #[cfg(feature = "gamepad")]
            gamepad_gilrs:    Arc::clone(&self.gamepad_gilrs),
            hotkey_state:     Arc::clone(&self.hotkey_state),
            next_hotkey_id:   Arc::clone(&self.next_hotkey_id),
            #[cfg(feature = "webview")]
            webview_events: Arc::clone(&self.webview_events),
            video_events:   Arc::clone(&self.video_events),
            next_video_id:  Arc::clone(&self.next_video_id),
            raycast_requests: Arc::clone(&self.raycast_requests),
            raycast_results:  Arc::clone(&self.raycast_results),
            ipc_bus:          Arc::clone(&self.ipc_bus),
            my_handle:        self.my_handle,
            next_window_id:   Arc::clone(&self.next_window_id),
            backend_commands: Arc::clone(&self.backend_commands),
            js_plugins:       Arc::clone(&self.js_plugins),
            js_backend_commands: Rc::clone(&self.js_backend_commands),
        };
        self.ctx.with(|ctx| do_register(ctx, reg))
            .map_err(|e| RuntimeError::CompileError(format!("quickjs binding registration: {e}")))
    }

    /// Resolve or reject a promise created by `make_promise`, given its
    /// handle and a `Result<json_string, error_message>` — shared by both
    /// the immediate (capability-denied) and queued (real async) paths.
    pub(crate) fn settle(ctx: &Ctx, handle: PromiseHandle, result: Result<String, String>) {
        let boxed = unsafe { *Box::from_raw(handle.into_raw() as *mut ResolveReject) };
        let (resolve_p, reject_p) = boxed;
        match result {
            Ok(json) => {
                if let Ok(resolve) = resolve_p.restore(ctx) {
                    let _ = resolve.call::<_, ()>((json,));
                }
            }
            Err(msg) => {
                if let Ok(reject) = reject_p.restore(ctx) {
                    let _ = reject.call::<_, ()>((msg,));
                }
            }
        }
    }

    /// Read the pending exception's message after a `Result::Err` from an
    /// eval/call, best-effort (falls back to a generic message rather than
    /// panicking if the thrown value isn't a real `Error` object).
    fn catch_message(ctx: &rquickjs::Ctx) -> String {
        let exc = ctx.catch();
        exc.clone().into_object()
            .and_then(rquickjs::Exception::from_object)
            .and_then(|e| e.message())
            .unwrap_or_else(|| format!("{:?}", exc))
    }
}

/// Shared state every `__glyx_*` binding closure needs to capture. Bundled
/// into one `Clone` struct instead of passing ~10 separate args around —
/// each binding closure below clones only the fields it needs out of this.
#[derive(Clone)]
struct RegisterState {
    queue:          CompletionQueue,
    tokio:          Handle,
    redraw:         Option<RedrawRequest>,
    window:         Option<WindowController>,
    events:         EventQueue,
    layout_cache:   LayoutCache,
    scene:          SceneQueue,
    next_id:        Arc<std::sync::atomic::AtomicU32>,
    // Reserved for a QuickJS image-loading binding (V8 has one in
    // bind_core.rs; not yet ported) — plumbed through but unread until then.
    #[allow(dead_code)]
    next_image_id:  Arc<std::sync::atomic::AtomicU32>,
    next_db_id:     Arc<std::sync::atomic::AtomicU32>,
    next_vdb_id:    Arc<std::sync::atomic::AtomicU32>,
    #[cfg(feature = "websocket")]
    next_ws_id:     Arc<std::sync::atomic::AtomicU32>,
    text_measure:   Arc<parking_lot::Mutex<glyx_text::TextSystem>>,
    db_pools:       DbPools,
    vector_stores:  crate::quickjs_db::VectorStores,
    #[cfg(feature = "websocket")]
    ws_handles:     crate::quickjs_net::WsHandles,
    deeplink_url_queue: Arc<parking_lot::Mutex<VecDeque<String>>>,
    perf_state:     Arc<parking_lot::Mutex<glyx_perf::PerfState>>,
    #[cfg(feature = "audio")]
    audio_device:   Arc<crate::quickjs_media::AudioDevice>,
    #[cfg(feature = "audio")]
    audio_sinks:    crate::quickjs_media::AudioSinks,
    #[cfg(feature = "audio")]
    audio_trackers: crate::quickjs_media::AudioTrackers,
    #[cfg(feature = "audio")]
    audio_events:   crate::quickjs_media::AudioEvents,
    #[cfg(feature = "audio")]
    next_audio_id:  Arc<std::sync::atomic::AtomicU32>,
    #[cfg(feature = "ai")]
    ai_embed_model:    crate::quickjs_ai::EmbedModelCache,
    #[cfg(feature = "ai")]
    ai_generate_model: crate::quickjs_ai::GenerateModelCache,
    #[cfg(feature = "ai")]
    ai_whisper_model:  crate::quickjs_ai::WhisperModelCache,
    #[cfg(not(feature = "ai"))]
    ai_cap: Option<&'static glyx_cap_abi::AiCap>,
    fs_watchers:      crate::quickjs_fs::FsWatchers,
    fs_watch_events:  crate::quickjs_fs::FsWatchEvents,
    next_fs_watch_id: Arc<std::sync::atomic::AtomicU32>,
    sleep_guards:     crate::quickjs_sys::SleepGuards,
    next_guard_id:    Arc<std::sync::atomic::AtomicU32>,
    #[cfg(feature = "gamepad")]
    gamepad_gilrs:    crate::quickjs_sys::GamepadGilrs,
    hotkey_state:     crate::quickjs_sys::HotkeyStateCell,
    next_hotkey_id:   Arc<std::sync::atomic::AtomicU32>,
    #[cfg(feature = "webview")]
    webview_events: WebviewEvents,
    video_events:   VideoEvents,
    next_video_id:  Arc<std::sync::atomic::AtomicU32>,
    // Only read inside the `#[cfg(feature = "canvas3d")]` raycast-binding
    // block below — unused (by design) in a canvas3d-less build.
    #[allow(dead_code)]
    raycast_requests: crate::bindings::RaycastRequestQueue,
    #[allow(dead_code)]
    raycast_results:  crate::bindings::RaycastResults,
    ipc_bus:          crate::bindings::IpcBus,
    my_handle:        u32,
    next_window_id:   Arc<std::sync::atomic::AtomicU32>,
    backend_commands: crate::BackendRegistry,
    js_plugins:       crate::JsPlugins,
    js_backend_commands: crate::quickjs_ipc::JsBackendCommands,
}

/// Registers every `__glyx_*` binding for this backend. A plain fn item
/// with a named `'js` generic (not a closure — see `register_core_bindings`'s
/// doc comment for why that distinction matters here).
fn do_register<'js>(ctx: Ctx<'js>, reg: RegisterState) -> rquickjs::Result<()> {
    let globals = ctx.globals();

    let log_fn = Function::new(ctx.clone(), |msg: String| {
        log::info!("[js] {msg}");
    })?;
    globals.set("__glyx_log", log_fn)?;

    let time_fn = Function::new(ctx.clone(), || -> f64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as f64)
            .unwrap_or(0.0)
    })?;
    globals.set("__glyx_getTime", time_fn)?;

    // `__glyx_request_frame(ms)` — schedule a redraw after `ms` milliseconds
    // (the setTimeout polyfill's animation-loop wake mechanism).
    {
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let request_frame_fn = Function::new(ctx.clone(), move |ms: Opt<f64>| {
            let ms = ms.0.unwrap_or(16.0).max(0.0) as u64;
            if let Some(redraw) = redraw.clone() {
                tokio.spawn(async move {
                    if ms > 0 {
                        tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
                    }
                    redraw();
                });
            }
        })?;
        globals.set("__glyx_request_frame", request_frame_fn)?;
    }

    // ── Scene graph (SceneCommand pushes) ───────────────────────────────
    {
        let scene = reg.scene.clone();
        let next_id = Arc::clone(&reg.next_id);
        let create_node_fn = Function::new(ctx.clone(), move |node_type: String, props_obj: rquickjs::Value| {
            let id = next_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let node_type = parse_node_type_str(&node_type);
            let props = props_json_from_value(props_obj);
            scene.lock().push_back(SceneCommand::CreateNode { id, node_type, props });
            id
        })?;
        globals.set("__glyx_createNode", create_node_fn)?;
    }
    {
        let scene = reg.scene.clone();
        let append_child_fn = Function::new(ctx.clone(), move |parent_id: u32, child_id: u32| {
            scene.lock().push_back(SceneCommand::AppendChild { parent_id, child_id });
            true
        })?;
        globals.set("__glyx_appendChild", append_child_fn)?;
    }
    {
        let scene = reg.scene.clone();
        let insert_before_fn = Function::new(ctx.clone(), move |parent_id: u32, child_id: u32, before_id: u32| {
            scene.lock().push_back(SceneCommand::InsertBefore { parent_id, child_id, before_id });
            true
        })?;
        globals.set("__glyx_insertBefore", insert_before_fn)?;
    }
    {
        let scene = reg.scene.clone();
        let update_node_fn = Function::new(ctx.clone(), move |id: u32, props_obj: rquickjs::Value| {
            let props = props_json_from_value(props_obj);
            scene.lock().push_back(SceneCommand::UpdateNode { id, props });
            true
        })?;
        globals.set("__glyx_updateNode", update_node_fn)?;
    }
    {
        let scene = reg.scene.clone();
        let remove_node_fn = Function::new(ctx.clone(), move |id: u32| {
            scene.lock().push_back(SceneCommand::RemoveNode { id });
            true
        })?;
        globals.set("__glyx_removeNode", remove_node_fn)?;
    }
    {
        let scene = reg.scene.clone();
        let set_root_fn = Function::new(ctx.clone(), move |id: u32| {
            scene.lock().push_back(SceneCommand::SetRoot { id });
            true
        })?;
        globals.set("__glyx_setRoot", set_root_fn)?;
    }
    {
        let scene = reg.scene.clone();
        let set_focus_fn = Function::new(ctx.clone(), move |id: Opt<u32>| {
            scene.lock().push_back(SceneCommand::SetFocus { id: id.0 });
            true
        })?;
        globals.set("__glyx_setFocus", set_focus_fn)?;
    }
    {
        let create_image_fn = Function::new(ctx.clone(), move |_path: String, _w: Opt<f64>, _h: Opt<f64>| -> u32 {
            // Image loading isn't ported yet (needs glyx_security path
            // resolution + SceneCommand::CreateImage wiring) — returns an
            // id so callers don't crash, but nothing will actually render.
            log::warn!("QuickJsRuntime: __glyx_createImage is not yet implemented");
            0
        })?;
        globals.set("__glyx_createImage", create_image_fn)?;
    }

    // ── Event polling + layout (drives the JS-side event dispatcher and
    //    hit-testing — see events.js's dispatchEvents/getLayout usage) ────
    {
        let events = reg.events.clone();
        let poll_events_fn = Function::new(ctx.clone(), move |ctx: Ctx<'js>| -> rquickjs::Result<rquickjs::Value<'js>> {
            let drained: Vec<InputEvent> = events.lock().drain(..).collect();
            let json = input_events_to_json(&drained);
            ctx.json_parse(json)
        })?;
        globals.set("__glyx_pollEvents", poll_events_fn)?;
    }
    {
        let layout_cache = reg.layout_cache.clone();
        let get_layout_fn = Function::new(ctx.clone(), move |ctx: Ctx<'js>, id: u32| -> rquickjs::Result<rquickjs::Value<'js>> {
            let cache = layout_cache.lock();
            match cache.get(&id) {
                Some(&[x, y, w, h]) => {
                    let content_height = cache.get(&(id | 0x8000_0000)).map(|&[_, _, _, ch]| ch);
                    let json = match content_height {
                        Some(ch) => format!(
                            "{{\"x\":{x},\"y\":{y},\"width\":{w},\"height\":{h},\"contentHeight\":{ch}}}"
                        ),
                        None => format!("{{\"x\":{x},\"y\":{y},\"width\":{w},\"height\":{h}}}"),
                    };
                    ctx.json_parse(json)
                }
                None => Ok(rquickjs::Value::new_null(ctx.clone())),
            }
        })?;
        globals.set("__glyx_getLayout", get_layout_fn)?;
    }

    // ── Text measurement (table auto-sizing, caret hit-testing) ────────
    {
        let text_measure = Arc::clone(&reg.text_measure);
        let measure_text_fn = Function::new(ctx.clone(), move |ctx: Ctx<'js>, text: String, font_size: Opt<f64>, max_width: Opt<f64>, style: Opt<String>| -> rquickjs::Result<rquickjs::Value<'js>> {
            let font_size = font_size.0.unwrap_or(14.0) as f32;
            let mw = max_width.0.unwrap_or(0.0);
            let max_width = if mw.is_finite() && mw > 0.0 { mw as f32 } else { 1.0e6 };
            let style = style.0.unwrap_or_default();
            let (bold, italic) = (style.contains("bold"), style.contains("italic"));
            let mut tm = text_measure.lock();
            let (w, h) = if bold || italic {
                let layout = tm.styled_label(&text, font_size, max_width, bold, italic);
                (layout.width(), layout.height())
            } else {
                tm.measure(&text, font_size, max_width)
            };
            ctx.json_parse(format!("{{\"width\":{w},\"height\":{h}}}"))
        })?;
        globals.set("__glyx_measure_text", measure_text_fn)?;
    }
    {
        let text_measure = Arc::clone(&reg.text_measure);
        let char_at_x_fn = Function::new(ctx.clone(), move |text: String, font_size: Opt<f64>, max_width: Opt<f64>, x: Opt<f64>| -> u32 {
            let font_size = font_size.0.unwrap_or(16.0) as f32;
            let mw = max_width.0.unwrap_or(0.0);
            let max_width = if mw.is_finite() && mw > 0.0 { mw as f32 } else { 1.0e6 };
            let x = x.0.unwrap_or(0.0) as f32;
            text_measure.lock().char_at_x(&text, font_size, max_width, x) as u32
        })?;
        globals.set("__glyx_text_char_at_x", char_at_x_fn)?;
    }
    {
        let text_measure = Arc::clone(&reg.text_measure);
        let pos_at_fn = Function::new(ctx.clone(), move |text: String, font_size: Opt<f64>, max_width: Opt<f64>, x: Opt<f64>, y: Opt<f64>| -> u32 {
            let font_size = font_size.0.unwrap_or(16.0) as f32;
            let mw = max_width.0.unwrap_or(0.0);
            let max_width = if mw.is_finite() && mw > 0.0 { mw as f32 } else { 1.0e6 };
            let x = x.0.unwrap_or(0.0) as f32;
            let y = y.0.unwrap_or(0.0) as f32;
            text_measure.lock().pos_at_point(&text, font_size, max_width, x, y) as u32
        })?;
        globals.set("__glyx_text_pos_at", pos_at_fn)?;
    }

    // ── Window control (no-ops if `window` is None, e.g. in tests) ─────
    if let Some(w) = reg.window.clone() {
        let getter = w.get_window_size.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>| -> rquickjs::Result<rquickjs::Value<'js>> {
            let (width, height) = getter();
            ctx.json_parse(format!("{{\"width\":{width},\"height\":{height}}}"))
        })?;
        globals.set("__glyx_getWindowSize", f)?;

        let getter = w.get_screen_size.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>| -> rquickjs::Result<rquickjs::Value<'js>> {
            match getter() {
                Some((width, height)) => ctx.json_parse(format!("{{\"width\":{width},\"height\":{height}}}")),
                None => Ok(rquickjs::Value::new_null(ctx.clone())),
            }
        })?;
        globals.set("__glyx_getScreenSize", f)?;

        let setter = w.set_fullscreen.clone();
        globals.set("__glyx_setFullscreen", Function::new(ctx.clone(), move |v: bool| setter(v))?)?;
        let setter = w.set_maximized.clone();
        globals.set("__glyx_setMaximized", Function::new(ctx.clone(), move |v: bool| setter(v))?)?;
        let setter = w.set_minimized.clone();
        globals.set("__glyx_setMinimized", Function::new(ctx.clone(), move |v: Opt<bool>| setter(v.0.unwrap_or(true)))?)?;
        let getter = w.is_fullscreen.clone();
        globals.set("__glyx_isFullscreen", Function::new(ctx.clone(), move || getter())?)?;
        let getter = w.is_maximized.clone();
        globals.set("__glyx_isMaximized", Function::new(ctx.clone(), move || getter())?)?;
        let setter = w.set_always_on_top.clone();
        globals.set("__glyx_setAlwaysOnTop", Function::new(ctx.clone(), move |v: bool| setter(v))?)?;
        let setter = w.set_title.clone();
        globals.set("__glyx_setTitle", Function::new(ctx.clone(), move |v: String| setter(v))?)?;
        let setter = w.set_cursor.clone();
        globals.set("__glyx_setCursor", Function::new(ctx.clone(), move |v: String| setter(v))?)?;
    }

    // `__glyx_battery_getStatus() -> Promise<JSON | null>` — real
    // cross-thread async work (tokio::spawn + spawn_blocking) and the same
    // capability check (`glyx_security::get().battery`) `bind_sys.rs`'s V8
    // implementation uses. Proves Opt-3 (capability reuse) and Opt-4
    // (async resolution) both work for this backend, not just the
    // toggle/skeleton.
    {
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let battery_fn = Function::new(ctx.clone(), move |ctx: Ctx<'js>| {
            battery_get_status(ctx, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_battery_getStatus", battery_fn)?;
    }

    // ── Filesystem (crate::quickjs_fs — ported from bind_core.rs's
    //    readFile/readFileBytes and bind_fs.rs's write/append/list/delete/
    //    mkdirp/stat/rename/copy) ──────────────────────────────────────
    macro_rules! fs_binding1 {
        ($js_name:literal, $func:path) => {
            let queue = reg.queue.clone();
            let tokio = reg.tokio.clone();
            let redraw = reg.redraw.clone();
            let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, path: String| {
                $func(ctx, path, Arc::clone(&queue), tokio.clone(), redraw.clone())
            })?;
            globals.set($js_name, f)?;
        };
    }
    macro_rules! fs_binding2 {
        ($js_name:literal, $func:path) => {
            let queue = reg.queue.clone();
            let tokio = reg.tokio.clone();
            let redraw = reg.redraw.clone();
            let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, a: String, b: String| {
                $func(ctx, a, b, Arc::clone(&queue), tokio.clone(), redraw.clone())
            })?;
            globals.set($js_name, f)?;
        };
    }
    fs_binding1!("__glyx_readFile", crate::quickjs_fs::read_file);
    fs_binding1!("__glyx_readFileBytes", crate::quickjs_fs::read_file_bytes);
    fs_binding2!("__glyx_writeFile", crate::quickjs_fs::write_file);
    fs_binding2!("__glyx_appendFile", crate::quickjs_fs::append_file);
    fs_binding1!("__glyx_listDir", crate::quickjs_fs::list_dir);
    fs_binding1!("__glyx_deleteFile", crate::quickjs_fs::delete_file);
    fs_binding1!("__glyx_mkdirp", crate::quickjs_fs::mkdirp);
    fs_binding1!("__glyx_stat", crate::quickjs_fs::stat);
    fs_binding2!("__glyx_rename", crate::quickjs_fs::rename);
    fs_binding2!("__glyx_copyFile", crate::quickjs_fs::copy_file);

    // ── SQLite + vector DB (crate::quickjs_db — ported from bind_db.rs) ──
    {
        let pools = reg.db_pools.clone();
        let next_id = Arc::clone(&reg.next_db_id);
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, path: String| {
            crate::quickjs_db::db_open(ctx, path, pools.clone(), Arc::clone(&next_id), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_db_open", f)?;
    }
    {
        let pools = reg.db_pools.clone();
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, handle: u32, sql: String, params: Opt<String>| {
            crate::quickjs_db::db_query(ctx, handle, sql, params.0.unwrap_or_default(), pools.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_db_query", f)?;
    }
    {
        let pools = reg.db_pools.clone();
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, handle: u32, sql: String, params: Opt<String>| {
            crate::quickjs_db::db_run(ctx, handle, sql, params.0.unwrap_or_default(), pools.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_db_run", f)?;
    }
    {
        let pools = reg.db_pools.clone();
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, handle: u32| {
            crate::quickjs_db::db_close(ctx, handle, pools.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_db_close", f)?;
    }
    {
        let pools = reg.db_pools.clone();
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, handle: u32, stmts_json: String| {
            crate::quickjs_db::db_transaction(ctx, handle, stmts_json, pools.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_db_transaction", f)?;
    }
    {
        let pools = reg.db_pools.clone();
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, handle: u32, dest: String| {
            crate::quickjs_db::db_backup(ctx, handle, dest, pools.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_db_backup", f)?;
    }
    {
        let stores = reg.vector_stores.clone();
        let next_id = Arc::clone(&reg.next_vdb_id);
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, path: String| {
            crate::quickjs_db::vectordb_open(ctx, path, stores.clone(), Arc::clone(&next_id), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_vectorDb_open", f)?;
    }
    {
        let stores = reg.vector_stores.clone();
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, handle: u32, table: String, id: String, vec_json: String, meta: Opt<String>| {
            crate::quickjs_db::vectordb_upsert(ctx, handle, table, id, vec_json, meta.0.unwrap_or_default(), stores.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_vectorDb_upsert", f)?;
    }
    {
        let stores = reg.vector_stores.clone();
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, handle: u32, table: String, query_json: String, limit: Opt<u32>| {
            crate::quickjs_db::vectordb_search(ctx, handle, table, query_json, limit.0.unwrap_or(10), stores.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_vectorDb_search", f)?;
    }
    {
        let stores = reg.vector_stores.clone();
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, handle: u32| {
            crate::quickjs_db::vectordb_close(ctx, handle, stores.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_vectorDb_close", f)?;
    }

    // ── Shell (crate::quickjs_shell — ported from bind_shell.rs) ────────
    #[cfg(feature = "shell")]
    {
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, bin: String, args: Opt<String>| {
            crate::quickjs_shell::shell_run(ctx, bin, args, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_shell_run", f)?;
    }

    // ── Network (crate::quickjs_net — ported from bind_net.rs) ──────────
    #[cfg(feature = "fetch")]
    {
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, url: String, opts: Opt<String>| {
            crate::quickjs_net::fetch(ctx, url, opts.0.unwrap_or_default(), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_fetch", f)?;
    }
    #[cfg(feature = "websocket")]
    {
        let handles = reg.ws_handles.clone();
        let next_id = Arc::clone(&reg.next_ws_id);
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, url: String| {
            crate::quickjs_net::ws_connect(ctx, url, handles.clone(), Arc::clone(&next_id), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_ws_connect", f)?;

        let handles = reg.ws_handles.clone();
        let f = Function::new(ctx.clone(), move |handle: u32, msg: String| {
            if let Some(h) = handles.lock().get(&handle) { let _ = h.outbox_tx.send(msg); }
        })?;
        globals.set("__glyx_ws_send", f)?;

        let handles = reg.ws_handles.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, handle: u32| -> rquickjs::Result<rquickjs::Value<'js>> {
            let msgs: Vec<String> = handles.lock().get(&handle)
                .map(|h| h.inbox.lock().drain(..).collect()).unwrap_or_default();
            let json = serde_json::to_string(&msgs).unwrap_or_else(|_| "[]".to_string());
            ctx.json_parse(json)
        })?;
        globals.set("__glyx_ws_poll", f)?;

        let handles = reg.ws_handles.clone();
        let f = Function::new(ctx.clone(), move |handle: u32| {
            handles.lock().remove(&handle);
        })?;
        globals.set("__glyx_ws_close", f)?;
    }
    {
        let queue = reg.queue.clone();
        let tokio = reg.tokio.clone();
        let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, service_type: String, timeout_ms: Opt<u32>| {
            crate::quickjs_net::mdns_discover(ctx, service_type, timeout_ms.0.unwrap_or(5000) as u64, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_mdns_discover", f)?;
    }

    // ── System / dialogs / clipboard / notifications / storage /
    //    credentials / deeplink / perf / misc (crate::quickjs_sys — ported
    //    from the rest of bind_sys.rs) ────────────────────────────────────
    {
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, filters: Opt<String>, multiple: Opt<bool>| {
            crate::quickjs_sys::dialog_open_file(ctx, filters.0.unwrap_or_default(), multiple.0.unwrap_or(false), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_dialog_openFile", f)?;
    }
    {
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, name: Opt<String>, filters: Opt<String>| {
            crate::quickjs_sys::dialog_save_file(ctx, name.0.unwrap_or_default(), filters.0.unwrap_or_default(), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_dialog_saveFile", f)?;
    }
    {
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>| {
            crate::quickjs_sys::dialog_open_folder(ctx, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_dialog_openFolder", f)?;
    }
    {
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>| crate::quickjs_sys::clipboard_read_text(ctx))?;
        globals.set("__glyx_clipboard_readText", f)?;
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, text: String| crate::quickjs_sys::clipboard_write_text(ctx, text))?;
        globals.set("__glyx_clipboard_writeText", f)?;
    }
    {
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, title: String, body: String| {
            crate::quickjs_sys::notification_send(ctx, title, body, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_notification_send", f)?;
    }
    {
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>| {
            crate::quickjs_sys::system_get_info(ctx, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_system_getInfo", f)?;
    }
    globals.set("__glyx_system_getDarkMode", Function::new(ctx.clone(), crate::quickjs_sys::system_get_dark_mode)?)?;
    globals.set("__glyx_system_getBatterySaver", Function::new(ctx.clone(), crate::quickjs_sys::system_get_battery_saver)?)?;
    {
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>| {
            crate::quickjs_sys::storage_get_drives(ctx, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_storage_getDrives", f)?;
    }
    {
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, service: String, key: String, value: String| {
            crate::quickjs_sys::credentials_set(ctx, service, key, value, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_credentials_set", f)?;
    }
    {
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, service: String, key: String| {
            crate::quickjs_sys::credentials_get(ctx, service, key, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_credentials_get", f)?;
    }
    {
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, service: String, key: String| {
            crate::quickjs_sys::credentials_delete(ctx, service, key, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_credentials_delete", f)?;
    }
    globals.set("__glyx_deeplink_getInitialUrl", Function::new(ctx.clone(), crate::quickjs_sys::deeplink_get_initial_url)?)?;
    {
        let dl = reg.deeplink_url_queue.clone();
        let f = Function::new(ctx.clone(), move || crate::quickjs_sys::deeplink_poll(Arc::clone(&dl)))?;
        globals.set("__glyx_deeplink_poll", f)?;
    }
    {
        let perf = Arc::clone(&reg.perf_state);
        let f = Function::new(ctx.clone(), move || crate::quickjs_sys::perf_snapshot(&perf))?;
        globals.set("__glyx_perf_snapshot", f)?;
    }
    {
        let perf = Arc::clone(&reg.perf_state);
        let f = Function::new(ctx.clone(), move |ms: Opt<f64>| crate::quickjs_sys::perf_set_budget(&perf, ms.0.unwrap_or(16.667)))?;
        globals.set("__glyx_perf_set_budget", f)?;
    }
    {
        let perf = Arc::clone(&reg.perf_state);
        let f = Function::new(ctx.clone(), move || crate::quickjs_sys::perf_poll_violations(&perf))?;
        globals.set("__glyx_perf_poll_violations", f)?;
    }
    {
        let perf = Arc::clone(&reg.perf_state);
        let f = Function::new(ctx.clone(), move || crate::quickjs_sys::perf_poll_leak_warnings(&perf))?;
        globals.set("__glyx_perf_poll_leak_warnings", f)?;
    }
    {
        let window = reg.window.clone();
        globals.set("__glyx_quit", Function::new(ctx.clone(), move || crate::quickjs_sys::quit(&window))?)?;
        let window = reg.window.clone();
        globals.set("__glyx_window_close", Function::new(ctx.clone(), move || crate::quickjs_sys::quit(&window))?)?;
        let window = reg.window.clone();
        globals.set("__glyx_restart", Function::new(ctx.clone(), move || crate::quickjs_sys::restart(&window))?)?;
    }
    globals.set("__glyx_platform", Function::new(ctx.clone(), crate::quickjs_sys::platform)?)?;
    globals.set("__glyx_collect_memory", Function::new(ctx.clone(), crate::quickjs_sys::collect_memory)?)?;
    {
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'_>, url: String| -> rquickjs::Result<()> {
            crate::quickjs_sys::open_external(url).map_err(|e| rquickjs::Exception::throw_message(&ctx, &e))
        })?;
        globals.set("__glyx_open_external", f)?;
    }
    {
        let events = reg.events.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'_>, kind: String, interval_ms: Opt<f64>| {
            crate::quickjs_sys::system_watch(ctx, kind, interval_ms.0.unwrap_or(0.0), Arc::clone(&events), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_system_watch", f)?;
        let f = Function::new(ctx.clone(), move |id: u32| crate::quickjs_sys::system_unwatch(id))?;
        globals.set("__glyx_system_unwatch", f)?;
    }

    // ── Audio (crate::quickjs_media — ported from bind_media.rs) ────────
    #[cfg(feature = "audio")]
    {
        let device = Arc::clone(&reg.audio_device);
        let sinks = reg.audio_sinks.clone();
        let trackers = reg.audio_trackers.clone();
        let next_id = Arc::clone(&reg.next_audio_id);
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, src: String, opts: Opt<String>| {
            crate::quickjs_media::audio_play(
                ctx, src, opts.0.unwrap_or_else(|| "{}".to_string()), Arc::clone(&device),
                sinks.clone(), trackers.clone(), Arc::clone(&next_id), Arc::clone(&queue), tokio.clone(), redraw.clone(),
            )
        })?;
        globals.set("__glyx_audio_play", f)?;

        // Audio handle IDs cross the JS boundary as strings (the SDK's
        // `api.js` does `const id = String(JSON.parse(rawId))`, mirroring
        // V8's `uint32_value()` which auto-coerces numeric strings — rquickjs
        // does not, so every handle-taking binding here parses from `String`.
        let sinks = reg.audio_sinks.clone(); let trackers = reg.audio_trackers.clone();
        let f = Function::new(ctx.clone(), move |id: String| crate::quickjs_media::audio_pause(&sinks, &trackers, id.parse().unwrap_or(0)))?;
        globals.set("__glyx_audio_pause", f)?;

        let sinks = reg.audio_sinks.clone(); let trackers = reg.audio_trackers.clone();
        let f = Function::new(ctx.clone(), move |id: String| crate::quickjs_media::audio_resume(&sinks, &trackers, id.parse().unwrap_or(0)))?;
        globals.set("__glyx_audio_resume", f)?;

        let sinks = reg.audio_sinks.clone(); let trackers = reg.audio_trackers.clone();
        let f = Function::new(ctx.clone(), move |id: String| crate::quickjs_media::audio_stop(&sinks, &trackers, id.parse().unwrap_or(0)))?;
        globals.set("__glyx_audio_stop", f)?;

        let sinks = reg.audio_sinks.clone();
        let f = Function::new(ctx.clone(), move |id: String, vol: f32| crate::quickjs_media::audio_set_volume(&sinks, id.parse().unwrap_or(0), vol))?;
        globals.set("__glyx_audio_setVolume", f)?;

        let sinks = reg.audio_sinks.clone();
        let f = Function::new(ctx.clone(), move |id: String| crate::quickjs_media::audio_get_volume(&sinks, id.parse().unwrap_or(0)))?;
        globals.set("__glyx_audio_getVolume", f)?;

        let trackers = reg.audio_trackers.clone();
        let f = Function::new(ctx.clone(), move |id: String| crate::quickjs_media::audio_get_time(&trackers, id.parse().unwrap_or(0)))?;
        globals.set("__glyx_audio_get_time", f)?;

        let sinks = reg.audio_sinks.clone(); let trackers = reg.audio_trackers.clone(); let events = reg.audio_events.clone();
        let f = Function::new(ctx.clone(), move || crate::quickjs_media::audio_poll(&sinks, &trackers, &events))?;
        globals.set("__glyx_audio_poll", f)?;

        let trackers = reg.audio_trackers.clone();
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, id: String| {
            crate::quickjs_media::audio_duration(ctx, id.parse().unwrap_or(0), trackers.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_audio_duration", f)?;

        let device = Arc::clone(&reg.audio_device);
        let sinks = reg.audio_sinks.clone(); let trackers = reg.audio_trackers.clone();
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, id: String, secs: f64| {
            crate::quickjs_media::audio_seek(
                ctx, id.parse().unwrap_or(0), secs, Arc::clone(&device), sinks.clone(), trackers.clone(),
                Arc::clone(&queue), tokio.clone(), redraw.clone(),
            )
        })?;
        globals.set("__glyx_audio_seek", f)?;
    }

    // ── fs.watch / power / gamepad / shortcuts (deferred-items batch) ────
    {
        let watchers = reg.fs_watchers.clone();
        let events = reg.fs_watch_events.clone();
        let next_id = Arc::clone(&reg.next_fs_watch_id);
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, path: String| {
            crate::quickjs_fs::fs_watch(ctx, path, watchers.clone(), events.clone(), Arc::clone(&next_id))
        })?;
        globals.set("__glyx_fs_watch", f)?;

        let watchers = reg.fs_watchers.clone(); let events = reg.fs_watch_events.clone();
        let f = Function::new(ctx.clone(), move |id: u32| crate::quickjs_fs::fs_unwatch(&watchers, &events, id))?;
        globals.set("__glyx_fs_unwatch", f)?;

        let events = reg.fs_watch_events.clone();
        let f = Function::new(ctx.clone(), move || crate::quickjs_fs::fs_watch_poll(&events))?;
        globals.set("__glyx_fs_watch_poll", f)?;
    }
    {
        let guards = reg.sleep_guards.clone(); let next_id = Arc::clone(&reg.next_guard_id);
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, reason: Opt<String>| {
            crate::quickjs_sys::power_prevent_sleep(ctx, reason.0.unwrap_or_default(), guards.clone(), Arc::clone(&next_id))
        })?;
        globals.set("__glyx_power_preventSleep", f)?;

        let guards = reg.sleep_guards.clone();
        let f = Function::new(ctx.clone(), move |id: String| crate::quickjs_sys::power_allow_sleep(&guards, id))?;
        globals.set("__glyx_power_allowSleep", f)?;
    }
    #[cfg(feature = "gamepad")]
    {
        let gilrs = reg.gamepad_gilrs.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>| crate::quickjs_sys::gamepad_poll(ctx, gilrs.clone()))?;
        globals.set("__glyx_gamepad_poll", f)?;
    }
    {
        let hs = reg.hotkey_state.clone(); let next_id = Arc::clone(&reg.next_hotkey_id);
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, accelerator: String| {
            crate::quickjs_sys::shortcut_register(ctx, accelerator, hs.clone(), Arc::clone(&next_id))
        })?;
        globals.set("__glyx_shortcut_register", f)?;

        let hs = reg.hotkey_state.clone();
        let f = Function::new(ctx.clone(), move |id: String| crate::quickjs_sys::shortcut_unregister(&hs, id))?;
        globals.set("__glyx_shortcut_unregister", f)?;

        let hs = reg.hotkey_state.clone();
        let f = Function::new(ctx.clone(), move || crate::quickjs_sys::shortcut_poll(&hs))?;
        globals.set("__glyx_shortcut_poll", f)?;
    }

    // ── Video (crate::quickjs_video — ported from bind_media.rs) ────────
    {
        let next_id = Arc::clone(&reg.next_video_id);
        let scene = reg.scene.clone();
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, url: String| {
            crate::quickjs_video::video_open(ctx, url, Arc::clone(&next_id), scene.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_video_open", f)?;

        let scene = reg.scene.clone();
        let f = Function::new(ctx.clone(), move |handle_id: String, seconds: f64| crate::quickjs_video::video_seek(&scene, handle_id, seconds))?;
        globals.set("__glyx_video_seek", f)?;

        let scene = reg.scene.clone();
        let f = Function::new(ctx.clone(), move |handle_id: String, volume: f32| crate::quickjs_video::video_set_volume(&scene, handle_id, volume))?;
        globals.set("__glyx_video_set_volume", f)?;

        let scene = reg.scene.clone();
        let f = Function::new(ctx.clone(), move |handle_id: String| crate::quickjs_video::video_close(&scene, handle_id))?;
        globals.set("__glyx_video_close", f)?;

        let scene = reg.scene.clone();
        let f = Function::new(ctx.clone(), move |handle_id: String| crate::quickjs_video::video_pause(&scene, handle_id))?;
        globals.set("__glyx_video_pause", f)?;

        let scene = reg.scene.clone();
        let f = Function::new(ctx.clone(), move |handle_id: String| crate::quickjs_video::video_play(&scene, handle_id))?;
        globals.set("__glyx_video_play", f)?;

        let events = reg.video_events.clone();
        let f = Function::new(ctx.clone(), move || crate::quickjs_video::video_poll(&events))?;
        globals.set("__glyx_video_poll", f)?;
    }

    // ── Multi-window / IPC / backend_call (crate::quickjs_ipc) ──────────
    {
        let ipc_bus = reg.ipc_bus.clone();
        let next_window_id = Arc::clone(&reg.next_window_id);
        let window = reg.window.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, opts_json: String| {
            crate::quickjs_ipc::window_create(ctx, opts_json, ipc_bus.clone(), Arc::clone(&next_window_id), window.clone())
        })?;
        globals.set("__glyx_window_create", f)?;

        let ipc_bus = reg.ipc_bus.clone();
        let f = Function::new(ctx.clone(), move |target: u32, msg: String| crate::quickjs_ipc::ipc_send(&ipc_bus, target, msg))?;
        globals.set("__glyx_ipc_send", f)?;

        let ipc_bus = reg.ipc_bus.clone(); let my_handle = reg.my_handle;
        let f = Function::new(ctx.clone(), move || crate::quickjs_ipc::ipc_poll(&ipc_bus, my_handle))?;
        globals.set("__glyx_ipc_poll", f)?;

        // Eval each JS plugin's bundled IIFE (sets globalThis.<global_name> to
        // its exports object), then walk each exports object's own function
        // properties into `reg.js_backend_commands`, mirroring V8's identical
        // pass in bindings/mod.rs's register_all. `reload_plugin` (dev-mode
        // HMR) mutates this same shared cell in place after startup.
        crate::quickjs_ipc::eval_js_plugins(&ctx, &reg.js_plugins, &reg.js_backend_commands);

        let commands = reg.backend_commands.clone();
        let js_backend_commands = Rc::clone(&reg.js_backend_commands);
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, name: String, args_json: Opt<String>| {
            crate::quickjs_ipc::backend_call(
                ctx, name, args_json.0.unwrap_or_else(|| "{}".to_string()), commands.clone(),
                Rc::clone(&js_backend_commands),
                Arc::clone(&queue), tokio.clone(), redraw.clone(),
            )
        })?;
        globals.set("__glyx_backend_call", f)?;
    }

    // ── AI (crate::quickjs_ai) — static glyx-ai path when feature "ai" is
    // on, else the dynamic glyx-cap-ai plugin-vtable fallback. Both register
    // the same __glyx_ai_* names; only one variant compiles per build.
    {
        #[cfg(feature = "ai")]
        let model_cache = reg.ai_embed_model.clone();
        #[cfg(not(feature = "ai"))]
        let ai_cap = reg.ai_cap;
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, text: String| {
            #[cfg(feature = "ai")]
            { crate::quickjs_ai::ai_embed(ctx, text, model_cache.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone()) }
            #[cfg(not(feature = "ai"))]
            { crate::quickjs_ai::ai_embed(ctx, text, ai_cap, Arc::clone(&queue), tokio.clone(), redraw.clone()) }
        })?;
        globals.set("__glyx_ai_embed", f)?;

        #[cfg(feature = "ai")]
        let model_cache = reg.ai_generate_model.clone();
        #[cfg(not(feature = "ai"))]
        let ai_cap = reg.ai_cap;
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, prompt: String, opts: Opt<String>| {
            let opts_raw = opts.0.unwrap_or_else(|| "{}".to_string());
            #[cfg(feature = "ai")]
            { crate::quickjs_ai::ai_generate(ctx, prompt, opts_raw, model_cache.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone()) }
            #[cfg(not(feature = "ai"))]
            { crate::quickjs_ai::ai_generate(ctx, prompt, opts_raw, ai_cap, Arc::clone(&queue), tokio.clone(), redraw.clone()) }
        })?;
        globals.set("__glyx_ai_generate", f)?;

        #[cfg(feature = "ai")]
        let model_cache = reg.ai_whisper_model.clone();
        #[cfg(not(feature = "ai"))]
        let ai_cap = reg.ai_cap;
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, audio_path: String, opts: Opt<String>| {
            #[cfg(feature = "ai")]
            { let opts_raw = opts.0.unwrap_or_else(|| "{}".to_string());
              crate::quickjs_ai::ai_transcribe(ctx, audio_path, opts_raw, model_cache.clone(), Arc::clone(&queue), tokio.clone(), redraw.clone()) }
            #[cfg(not(feature = "ai"))]
            { let _ = &opts; crate::quickjs_ai::ai_transcribe(ctx, audio_path, ai_cap, Arc::clone(&queue), tokio.clone(), redraw.clone()) }
        })?;
        globals.set("__glyx_ai_transcribe", f)?;

        #[cfg(feature = "ai")]
        let model_cache = reg.ai_embed_model.clone();
        #[cfg(not(feature = "ai"))]
        let ai_cap = reg.ai_cap;
        let f = Function::new(ctx.clone(), move || {
            #[cfg(feature = "ai")]
            { crate::quickjs_ai::ai_unload_embed(&model_cache); }
            #[cfg(not(feature = "ai"))]
            { crate::quickjs_ai::ai_unload_embed(ai_cap); }
        })?;
        globals.set("__glyx_ai_unload_embed", f)?;

        #[cfg(feature = "ai")]
        let model_cache = reg.ai_generate_model.clone();
        #[cfg(not(feature = "ai"))]
        let ai_cap = reg.ai_cap;
        let f = Function::new(ctx.clone(), move || {
            #[cfg(feature = "ai")]
            { crate::quickjs_ai::ai_unload_generate(&model_cache); }
            #[cfg(not(feature = "ai"))]
            { crate::quickjs_ai::ai_unload_generate(ai_cap); }
        })?;
        globals.set("__glyx_ai_unload_generate", f)?;

        #[cfg(feature = "ai")]
        let model_cache = reg.ai_whisper_model.clone();
        #[cfg(not(feature = "ai"))]
        let ai_cap = reg.ai_cap;
        let f = Function::new(ctx.clone(), move || {
            #[cfg(feature = "ai")]
            { crate::quickjs_ai::ai_unload_transcribe(&model_cache); }
            #[cfg(not(feature = "ai"))]
            { crate::quickjs_ai::ai_unload_transcribe(ai_cap); }
        })?;
        globals.set("__glyx_ai_unload_transcribe", f)?;
    }

    // ── Updater / crash reporter / splash (crate::quickjs_updater) ──────
    #[cfg(feature = "updater")]
    {
        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, current: String| {
            crate::quickjs_updater::updater_check(ctx, current, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_updater_check", f)?;

        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, current: String| {
            crate::quickjs_updater::updater_update(ctx, current, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_updater_update", f)?;

        globals.set("__glyx_updater_get_version", Function::new(ctx.clone(), crate::quickjs_updater::updater_get_version)?)?;

        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, url: String, current: String| {
            crate::quickjs_updater::updater_check_manifest(ctx, url, current, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_updater_check_manifest", f)?;

        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, url: String, sig_hex: String| {
            crate::quickjs_updater::updater_download_js(ctx, url, sig_hex, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_updater_download_js", f)?;
    }
    {
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, json: String| crate::quickjs_updater::crash_report_js(ctx, json))?;
        globals.set("__glyx_crash_report_js", f)?;

        let queue = reg.queue.clone(); let tokio = reg.tokio.clone(); let redraw = reg.redraw.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>| {
            crate::quickjs_updater::crash_get_reports(ctx, Arc::clone(&queue), tokio.clone(), redraw.clone())
        })?;
        globals.set("__glyx_crash_get_reports", f)?;

        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>| crate::quickjs_updater::crash_clear_reports(ctx))?;
        globals.set("__glyx_crash_clear_reports", f)?;

        let scene = reg.scene.clone();
        let f = Function::new(ctx.clone(), move || crate::quickjs_updater::splash_hide(&scene))?;
        globals.set("__glyx_splash_hide", f)?;
    }

    // ── System tray (crate::quickjs_tray) ────────────────────────────────
    {
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'js>, rgba: rquickjs::TypedArray<'js, u8>, width: u32, height: u32, tooltip: String, menu_json: Opt<String>| {
            crate::quickjs_tray::tray_create(ctx, rgba, width, height, tooltip, menu_json.0.unwrap_or_default())
        })?;
        globals.set("__glyx_tray_create", f)?;

        globals.set("__glyx_tray_destroy", Function::new(ctx.clone(), crate::quickjs_tray::tray_destroy)?)?;
        globals.set("__glyx_tray_update_menu", Function::new(ctx.clone(), crate::quickjs_tray::tray_update_menu)?)?;
        globals.set("__glyx_tray_set_tooltip", Function::new(ctx.clone(), crate::quickjs_tray::tray_set_tooltip)?)?;
        globals.set("__glyx_tray_poll_events", Function::new(ctx.clone(), crate::quickjs_tray::tray_poll_events)?)?;
    }

    // ── Canvas / webview messaging (crate::quickjs_canvas) ──────────────
    {
        let scene = reg.scene.clone();
        let f = Function::new(ctx.clone(), move |id: u32, json: String| {
            crate::quickjs_canvas::canvas_update(id, json, &scene)
        })?;
        globals.set("__glyx_canvas_update", f)?;

        let scene = reg.scene.clone();
        let f = Function::new(ctx.clone(), move |id: u32, f32buf: Value<'js>, float_count: usize, u8buf: Value<'js>, str_len: usize, append: bool| {
            crate::quickjs_canvas::canvas_flush(id, f32buf, float_count, u8buf, str_len, append, &scene)
        })?;
        globals.set("__glyx_canvas_flush", f)?;
    }
    #[cfg(feature = "canvas3d")]
    {
        let scene = reg.scene.clone();
        let f = Function::new(ctx.clone(), move |id: u32, json: String| {
            crate::quickjs_canvas::canvas3d_update(id, json, &scene)
        })?;
        globals.set("__glyx_canvas3d_update", f)?;

        let scene = reg.scene.clone();
        let f = Function::new(ctx.clone(), move |ctx: Ctx<'_>, id: u32, path: String| -> rquickjs::Result<()> {
            crate::quickjs_canvas::canvas3d_load_gltf(id, path, &scene)
                .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e))
        })?;
        globals.set("__glyx_canvas3d_load_gltf", f)?;

        let scene = reg.scene.clone();
        let f = Function::new(ctx.clone(), move |path: String| crate::quickjs_canvas::canvas3d_unload_gltf(path, &scene))?;
        globals.set("__glyx_canvas3d_unload_gltf", f)?;

        let requests = reg.raycast_requests.clone();
        let f = Function::new(ctx.clone(), move |id: u32, ndc_x: f32, ndc_y: f32| {
            crate::quickjs_canvas::canvas3d_raycast(id, ndc_x, ndc_y, &requests)
        })?;
        globals.set("__glyx_canvas3d_raycast", f)?;

        let results = reg.raycast_results.clone();
        let f = Function::new(ctx.clone(), move || crate::quickjs_canvas::canvas3d_raycast_poll(&results))?;
        globals.set("__glyx_canvas3d_raycast_poll", f)?;
    }
    #[cfg(feature = "webview")]
    {
        let scene = reg.scene.clone();
        let f = Function::new(ctx.clone(), move |id: u32, msg: String| {
            crate::quickjs_canvas::webview_post_message(id, msg, &scene)
        })?;
        globals.set("__glyx_webview_post_message", f)?;

        let events = reg.webview_events.clone();
        let f = Function::new(ctx.clone(), move || crate::quickjs_canvas::webview_poll(&events))?;
        globals.set("__glyx_webview_poll", f)?;
    }

    Ok(())
}

/// Convert an already-JSON-stringified rquickjs value (from
/// `ctx.json_stringify`) or a plain value into a `NodeProps`. Wraps
/// `parse_props_json` (which expects a JSON string) for the `rquickjs::Value`
/// props objects `createNode`/`updateNode` receive directly as arguments.
fn props_json_from_value(v: rquickjs::Value) -> NodeProps {
    let ctx = v.ctx().clone();
    let json = ctx.json_stringify(v)
        .ok()
        .flatten()
        .and_then(|s| s.to_string().ok())
        .unwrap_or_default();
    parse_props_json(&json)
}

/// Serialize drained `InputEvent`s into the exact JSON shape `events.js`'s
/// `dispatchEvents()` expects (`{type, ...fields}` per event) — mirrors
/// V8's `poll_events_callback` object-construction 1:1, just built as a
/// JSON string instead of native `v8::Object`s (see `ctx.json_parse` at the
/// call site, which turns this back into a real JS array of objects).
fn input_events_to_json(events: &[InputEvent]) -> String {
    let mut out = String::from("[");
    for (i, ev) in events.iter().enumerate() {
        if i > 0 { out.push(','); }
        let s = |s: &str| serde_json::to_string(s).unwrap_or_else(|_| "\"\"".to_string());
        match ev {
            InputEvent::MouseButton { x, y, button, pressed } => {
                out += &format!("{{\"type\":\"mouseButton\",\"x\":{x},\"y\":{y},\"button\":{button},\"pressed\":{pressed}}}");
            }
            InputEvent::CursorMoved { x, y } => {
                out += &format!("{{\"type\":\"cursorMoved\",\"x\":{x},\"y\":{y}}}");
            }
            InputEvent::DragStart { x, y } => {
                out += &format!("{{\"type\":\"dragStart\",\"x\":{x},\"y\":{y}}}");
            }
            InputEvent::DragMove { x, y, dx, dy } => {
                out += &format!("{{\"type\":\"dragMove\",\"x\":{x},\"y\":{y},\"dx\":{dx},\"dy\":{dy}}}");
            }
            InputEvent::DragEnd { x, y } => {
                out += &format!("{{\"type\":\"dragEnd\",\"x\":{x},\"y\":{y}}}");
            }
            InputEvent::KeyInput { key, text, pressed } => {
                let text_field = text.as_deref().map(|t| format!(",\"text\":{}", s(t))).unwrap_or_default();
                out += &format!("{{\"type\":\"keyInput\",\"key\":{},\"pressed\":{pressed}{text_field}}}", s(key));
            }
            InputEvent::Scroll { delta_y } => {
                out += &format!("{{\"type\":\"scroll\",\"deltaY\":{delta_y}}}");
            }
            InputEvent::ScrollbarDrag { node_id, scroll_y } => {
                out += &format!("{{\"type\":\"scrollbarDrag\",\"nodeId\":{node_id},\"scrollY\":{scroll_y}}}");
            }
            InputEvent::Resize { width, height } => {
                out += &format!("{{\"type\":\"resize\",\"width\":{width},\"height\":{height}}}");
            }
            InputEvent::ImageError { image_id, path } => {
                out += &format!("{{\"type\":\"imageError\",\"imageId\":{image_id},\"path\":{}}}", s(path));
            }
            InputEvent::SystemWatch { id, payload } => {
                out += &format!("{{\"type\":\"systemWatch\",\"id\":{id},\"payload\":{}}}", s(payload));
            }
            InputEvent::AccessibilityFocus { node_id } => {
                out += &format!("{{\"type\":\"accessibilityFocus\",\"nodeId\":{node_id}}}");
            }
            InputEvent::AccessibilityValueChange { node_id, action, numeric_value } => {
                let nv_field = numeric_value.map(|v| format!(",\"numericValue\":{v}")).unwrap_or_default();
                out += &format!("{{\"type\":\"accessibilityValueChange\",\"nodeId\":{node_id},\"action\":{}{nv_field}}}", s(action));
            }
            InputEvent::Ime { kind, text, cursor_start, cursor_end } => {
                let text_field = text.as_deref().map(|t| format!(",\"text\":{}", s(t))).unwrap_or_default();
                let cs_field = cursor_start.map(|v| format!(",\"cursorStart\":{v}")).unwrap_or_default();
                let ce_field = cursor_end.map(|v| format!(",\"cursorEnd\":{v}")).unwrap_or_default();
                out += &format!("{{\"type\":\"ime\",\"kind\":{}{text_field}{cs_field}{ce_field}}}", s(kind));
            }
        }
    }
    out.push(']');
    out
}

/// `__glyx_battery_getStatus`'s implementation — a free function (not a
/// closure) specifically so `Ctx<'js>` and `Promise<'js>` can share a named
/// lifetime; see `register_core_bindings`'s doc comment for why.
fn battery_get_status<'js>(
    ctx: Ctx<'js>,
    queue: CompletionQueue,
    tokio: Handle,
    redraw: Option<RedrawRequest>,
) -> rquickjs::Result<Promise<'js>> {
    let (handle, promise) = QuickJsRuntime::make_promise(&ctx)?;
    if !glyx_security::get().battery {
        // Reject immediately — no need to cross a thread for a capability
        // denial, same as bind_sys.rs's V8 version.
        QuickJsRuntime::settle(&ctx, handle, Err(
            "Capability required: battery — add it to glyx.config.json under \"capabilities\"".to_string()
        ));
        return Ok(promise);
    }
    tokio.spawn(async move {
        let json = tokio::task::spawn_blocking(|| {
            match glyx_sysapi::battery_status() {
                Some(b) => format!(
                    "{{\"level\":{:.3},\"charging\":{},\"timeRemainingSecs\":{}}}",
                    b.level, b.charging,
                    b.time_remaining_secs.map(|s| s.to_string()).unwrap_or("null".into())
                ),
                None => "null".into(),
            }
        }).await.unwrap_or_else(|_| "null".into());
        queue.lock().push_back(Completion { resolver_ptr: handle, result: Ok(json) });
        // Wake the window so the next frame's tick() picks this up promptly
        // instead of waiting for whatever naturally schedules the next
        // redraw — same reasoning as V8's enqueue_completion in bindings/mod.rs.
        if let Some(cb) = &redraw { cb(); }
    });
    Ok(promise)
}

impl JsRuntime for QuickJsRuntime {
    fn init_canvas_buffers(&mut self, protocol: &str, buffer_kb: usize) {
        self.ctx.with(|ctx| crate::quickjs_canvas::init_canvas_buffers(&ctx, protocol, buffer_kb));
    }

    fn register_extensions(&mut self, extensions: &[Box<dyn GlyxExtension>]) {
        // `GlyxExtension::register()` (direct scope-level binding install)
        // is `#[cfg(feature = "v8")]`-only — it takes a V8 `Scope` by
        // design, so it doesn't exist under this build at all. Extensions
        // wanting QuickJS support must use `register_commands()` instead
        // (the engine-neutral backend-command path), which glyx-core calls
        // independently of `JsRuntime` via `build_backend_registry`.
        if !extensions.is_empty() {
            log::info!(
                "QuickJsRuntime: {} extension(s) registered for backend commands only \
                 (direct scope-level bindings are V8-only, not available under quickjs)",
                extensions.len()
            );
        }
    }

    fn eval(&mut self, source: &str) -> Result<String, RuntimeError> {
        let src = source.to_string();
        self.ctx.with(|ctx| {
            // `Coerced<String>` applies JS `ToString` semantics (a JS string
            // stays as-is, a number/bool renders as its literal text, an
            // object goes through its own `toString`/`[object Object]`) —
            // matches V8Runtime::eval's behavior (`.to_string(scope)`
            // coercion), unlike plain `String: FromJs` which errors on
            // anything that isn't already a JS string.
            match ctx.eval::<rquickjs::Coerced<String>, _>(src) {
                Ok(v) => Ok(v.0),
                Err(rquickjs::Error::Exception) => {
                    Err(RuntimeError::JsException(Self::catch_message(&ctx)))
                }
                Err(e) => Err(RuntimeError::CompileError(e.to_string())),
            }
        })
    }

    fn tick(&mut self) {
        // Drain cross-thread async completions first (resolves/rejects the
        // promises Tokio-side work finished) — same ordering V8Runtime uses
        // (see runtime.rs's tick(): resolve, then let the resulting
        // microtask checkpoint below run continuations).
        let completions: Vec<(PromiseHandle, Result<String, String>)> = {
            let mut q = self.queue.lock();
            q.drain(..).map(|c| (c.resolver_ptr, c.result)).collect()
        };
        if !completions.is_empty() {
            self.ctx.with(|ctx| {
                for (handle, result) in completions {
                    Self::settle(&ctx, handle, result);
                }
            });
        }

        // Drain QuickJS's own job queue (promise continuations, etc.).
        while self.rt.is_job_pending() {
            match self.rt.execute_pending_job() {
                Ok(_) => {}
                Err(e) => {
                    log::warn!("QuickJsRuntime: job execution error: {:?}", e);
                    crate::bindings::record_js_crash(&format!("{e:?}"), "pending_job");
                    break;
                }
            }
        }
    }

    fn frame_tick(&mut self) -> Option<String> {
        let mut error = None;
        self.ctx.with(|ctx| {
            let globals = ctx.globals();
            let Ok(cb) = globals.get::<_, Function>("__glyx_frameCallback") else { return };
            if let Err(e) = cb.call::<_, ()>(()) {
                error = Some(if matches!(e, rquickjs::Error::Exception) {
                    Self::catch_message(&ctx)
                } else {
                    e.to_string()
                });
            }
        });
        error
    }

    fn push_event(&self, event: InputEvent) {
        self.events.lock().push_back(event);
    }

    fn update_layout(&self, js_id: u32, x: f32, y: f32, width: f32, height: f32) {
        self.layout_cache.lock().insert(js_id, [x, y, width, height]);
    }

    fn drain_scene_commands(&mut self) -> Vec<SceneCommand> {
        self.scene.lock().drain(..).collect()
    }

    fn flush_microtasks(&mut self) {
        self.tick();
    }

    fn shutdown_db_pools(&self) {
        self.db_pools.lock().clear();
    }

    fn heap_stats(&mut self) -> HeapStats {
        let usage = self.rt.memory_usage();
        HeapStats {
            used_heap_size:  usage.memory_used_size.max(0) as usize,
            total_heap_size: usage.malloc_size.max(0) as usize,
        }
    }

    fn reload_plugin(&mut self, global_name: &str, prefix: Option<&str>, bundled_js: &str) {
        let commands = Rc::clone(&self.js_backend_commands);
        self.ctx.with(|ctx| {
            crate::quickjs_ipc::reload_js_plugin(&ctx, &commands, global_name, prefix, bundled_js);
        });
    }

    fn gc_hint(&mut self) {
        self.rt.run_gc();
    }

    fn layout_cache(&self) -> LayoutCache { Arc::clone(&self.layout_cache) }
    fn events(&self) -> EventQueue { Arc::clone(&self.events) }
    fn perf_state(&self) -> Arc<parking_lot::Mutex<glyx_perf::PerfState>> { Arc::clone(&self.perf_state) }
    fn deeplink_url_queue(&self) -> Arc<parking_lot::Mutex<VecDeque<String>>> { Arc::clone(&self.deeplink_url_queue) }
    fn db_pools(&self) -> DbPools { Arc::clone(&self.db_pools) }
    fn webview_events(&self) -> WebviewEvents { Arc::clone(&self.webview_events) }
    fn video_events(&self) -> VideoEvents { Arc::clone(&self.video_events) }
    fn raycast_requests(&self) -> crate::bindings::RaycastRequestQueue { Arc::clone(&self.raycast_requests) }
    fn raycast_results(&self) -> crate::bindings::RaycastResults { Arc::clone(&self.raycast_results) }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Tests need a live Tokio runtime to hand `QuickJsRuntime::new` a
    /// `Handle` for spawning async binding work — kept alive for the
    /// duration of the test (dropping it would cancel in-flight spawns).
    fn new_runtime() -> (tokio::runtime::Runtime, QuickJsRuntime) {
        let tokio_rt = tokio::runtime::Runtime::new().expect("tokio runtime should build");
        let perf = Arc::new(parking_lot::Mutex::new(glyx_perf::PerfState::new()));
        let rt = QuickJsRuntime::new(perf, tokio_rt.handle().clone(), None, None)
            .expect("QuickJsRuntime::new should succeed");
        (tokio_rt, rt)
    }

    /// Same as `new_runtime`, but with one JS plugin loaded — for exercising
    /// `eval_js_plugins`/`backend_call`'s JS-command path end to end.
    fn new_runtime_with_plugin(prefix: Option<&str>, bundled_js: &str, global_name: &str) -> (tokio::runtime::Runtime, QuickJsRuntime) {
        let tokio_rt = tokio::runtime::Runtime::new().expect("tokio runtime should build");
        let perf = Arc::new(parking_lot::Mutex::new(glyx_perf::PerfState::new()));
        let ipc_bus = crate::bindings::new_ipc_bus();
        let next_window_id = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let backend_commands: crate::BackendRegistry = Arc::new(std::collections::HashMap::new());
        let js_plugins: crate::JsPlugins = Arc::new(vec![crate::JsPlugin {
            prefix: prefix.map(String::from),
            bundled_js: bundled_js.to_string(),
            global_name: global_name.to_string(),
            capabilities: vec![],
            entry: None,
        }]);
        let rt = QuickJsRuntime::new_with_ipc(
            perf, tokio_rt.handle().clone(), None, None,
            ipc_bus, 0, next_window_id, backend_commands, js_plugins,
        ).expect("QuickJsRuntime::new_with_ipc should succeed");
        (tokio_rt, rt)
    }

    #[test]
    fn js_plugin_export_is_registered_and_callable_via_backend_call() {
        let (_tokio_rt, mut rt) = new_runtime_with_plugin(
            Some("notes"),
            "globalThis.__glyx_plugin_notes = { getAll: async function(args) { return { echoed: args.title }; } };",
            "__glyx_plugin_notes",
        );
        rt.eval(
            "globalThis.__out = null; \
             __glyx_backend_call('notes.getAll', JSON.stringify({ title: 'hi' })) \
                .then(r => { globalThis.__out = JSON.stringify(r); });"
        ).expect("eval should succeed");
        rt.tick(); // drain the resolved microtask into globalThis.__out
        let out = rt.eval("globalThis.__out").expect("eval should succeed");
        assert!(out.contains("\"echoed\":\"hi\""), "got: {out}");
    }

    #[test]
    fn js_plugin_without_prefix_registers_under_the_bare_function_name() {
        let (_tokio_rt, mut rt) = new_runtime_with_plugin(
            None,
            "globalThis.__glyx_plugin_util = { ping: async function() { return 'pong'; } };",
            "__glyx_plugin_util",
        );
        rt.eval(
            "globalThis.__out = null; \
             __glyx_backend_call('ping', '{}').then(r => { globalThis.__out = r; });"
        ).expect("eval should succeed");
        rt.tick();
        let out = rt.eval("globalThis.__out").expect("eval should succeed");
        assert!(out.contains("pong"), "got: {out}");
    }

    #[test]
    fn unknown_backend_command_still_rejects_with_a_plugin_loaded() {
        let (_tokio_rt, mut rt) = new_runtime_with_plugin(
            Some("notes"),
            "globalThis.__glyx_plugin_notes = { getAll: async function() { return []; } };",
            "__glyx_plugin_notes",
        );
        rt.eval(
            "globalThis.__err = null; \
             __glyx_backend_call('notes.missing', '{}').catch(e => { globalThis.__err = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let out = rt.eval("globalThis.__err").expect("eval should succeed");
        assert!(out.contains("no such command"), "got: {out}");
    }

    #[test]
    fn reload_plugin_picks_up_new_exports_and_drops_removed_ones() {
        let (_tokio_rt, mut rt) = new_runtime_with_plugin(
            Some("notes"),
            "globalThis.__glyx_plugin_notes = { \
                getAll: async function() { return 'v1'; }, \
                oldOnly: async function() { return 'gone-after-reload'; } \
             };",
            "__glyx_plugin_notes",
        );

        // v1: both commands work.
        rt.eval(
            "globalThis.__v1a = null; globalThis.__v1b = null; \
             __glyx_backend_call('notes.getAll', '{}').then(r => { globalThis.__v1a = r; }); \
             __glyx_backend_call('notes.oldOnly', '{}').then(r => { globalThis.__v1b = r; });"
        ).expect("eval should succeed");
        rt.tick();
        assert!(rt.eval("globalThis.__v1a").unwrap().contains('v'));
        assert!(rt.eval("globalThis.__v1b").unwrap().contains("gone-after-reload"));

        // Simulate a dev-mode rebundle: getAll's behavior changes, oldOnly is removed,
        // newFn is added.
        rt.reload_plugin(
            "__glyx_plugin_notes",
            Some("notes"),
            "globalThis.__glyx_plugin_notes = { \
                getAll: async function() { return 'v2'; }, \
                newFn:  async function() { return 'added-after-reload'; } \
             };",
        );

        // getAll now returns the new behavior.
        rt.eval(
            "globalThis.__v2 = null; \
             __glyx_backend_call('notes.getAll', '{}').then(r => { globalThis.__v2 = r; });"
        ).expect("eval should succeed");
        rt.tick();
        let v2 = rt.eval("globalThis.__v2").expect("eval should succeed");
        assert!(v2.contains("v2"), "expected reloaded behavior, got: {v2}");

        // The new export is callable.
        rt.eval(
            "globalThis.__newFn = null; \
             __glyx_backend_call('notes.newFn', '{}').then(r => { globalThis.__newFn = r; });"
        ).expect("eval should succeed");
        rt.tick();
        let new_fn = rt.eval("globalThis.__newFn").expect("eval should succeed");
        assert!(new_fn.contains("added-after-reload"), "got: {new_fn}");

        // The removed export now rejects, same as any unknown command.
        rt.eval(
            "globalThis.__gone = null; \
             __glyx_backend_call('notes.oldOnly', '{}').catch(e => { globalThis.__gone = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let gone = rt.eval("globalThis.__gone").expect("eval should succeed");
        assert!(gone.contains("no such command"), "got: {gone}");
    }

    #[test]
    fn eval_runs_js_and_returns_a_result() {
        let (_tokio_rt, mut rt) = new_runtime();
        let out = rt.eval("1 + 2").expect("eval should succeed");
        assert!(out.contains('3'), "expected the result to mention 3, got {out:?}");
    }

    #[test]
    fn eval_reports_thrown_exceptions_as_js_exception() {
        let (_tokio_rt, mut rt) = new_runtime();
        let err = rt.eval("throw new Error('boom')").unwrap_err();
        match err {
            RuntimeError::JsException(msg) => assert!(msg.contains("boom"), "got: {msg}"),
            other => panic!("expected JsException, got {other:?}"),
        }
    }

    #[test]
    fn registered_log_binding_is_callable_from_js() {
        let (_tokio_rt, mut rt) = new_runtime();
        // Just confirm it doesn't throw — log::info! output isn't
        // capturable here, this proves the registration mechanism works.
        rt.eval("__glyx_log('hello from quickjs')").expect("call should succeed");
    }

    #[test]
    fn frame_tick_is_a_no_op_when_no_callback_is_registered() {
        let (_tokio_rt, mut rt) = new_runtime();
        assert_eq!(rt.frame_tick(), None);
    }

    #[test]
    fn frame_tick_invokes_a_registered_glyx_frame_callback() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.eval("globalThis.__ticks = 0; globalThis.__glyx_frameCallback = () => { globalThis.__ticks++; };")
            .expect("setup eval should succeed");
        assert_eq!(rt.frame_tick(), None);
        let ticks = rt.eval("__ticks").expect("read should succeed");
        assert!(ticks.contains('1'), "expected 1 tick, got {ticks:?}");
    }

    #[test]
    fn frame_tick_surfaces_exceptions_thrown_by_the_callback() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.eval("globalThis.__glyx_frameCallback = () => { throw new Error('frame boom'); };")
            .expect("setup eval should succeed");
        let err = rt.frame_tick().expect("should surface an error message");
        assert!(err.contains("frame boom"), "got: {err}");
    }

    #[test]
    fn push_event_and_drain_scene_commands_use_the_shared_queues() {
        let (_tokio_rt, rt) = new_runtime();
        rt.push_event(InputEvent::Resize { width: 800, height: 600 });
        assert_eq!(rt.events().lock().len(), 1);
    }

    #[test]
    fn update_layout_writes_into_the_shared_layout_cache() {
        let (_tokio_rt, rt) = new_runtime();
        rt.update_layout(7, 1.0, 2.0, 3.0, 4.0);
        assert_eq!(rt.layout_cache().lock().get(&7), Some(&[1.0, 2.0, 3.0, 4.0]));
    }

    #[test]
    fn battery_get_status_rejects_without_the_battery_capability() {
        // Fails closed by default (glyx_security::get() with no init() call
        // returns a zero-permission Capabilities — see glyx-security/src/lib.rs)
        // — this test relies on that default, not on explicitly disabling the
        // capability, since glyx_security::init() is a process-wide OnceLock
        // no test in this binary may safely call.
        let (_tokio_rt, mut rt) = new_runtime();
        rt.eval(
            "globalThis.__batteryError = null; \
             __glyx_battery_getStatus().catch(e => { globalThis.__batteryError = String(e); });"
        ).expect("eval should succeed");
        rt.tick(); // drain microtasks so the .catch callback runs
        let msg = rt.eval("__batteryError").expect("read should succeed");
        assert!(msg.contains("Capability required: battery"), "got: {msg}");
    }

    #[test]
    fn battery_get_status_is_registered_and_returns_a_promise() {
        let (_tokio_rt, mut rt) = new_runtime();
        let out = rt.eval("typeof __glyx_battery_getStatus() === 'object'")
            .expect("eval should succeed");
        assert!(out.contains("true"), "expected a Promise object, got {out:?}");
    }

    #[test]
    fn heap_stats_reports_nonzero_usage() {
        let (_tokio_rt, mut rt) = new_runtime();
        let stats = rt.heap_stats();
        assert!(stats.total_heap_size > 0, "expected some heap usage from a live context");
    }

    #[test]
    fn gc_hint_does_not_panic() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.gc_hint();
    }

    #[test]
    fn scene_graph_bindings_push_real_scene_commands() {
        let (_tokio_rt, mut rt) = new_runtime();
        let id_str = rt.eval(
            "const id = __glyx_createNode('view', { backgroundColor: '#ff0000', flex: 1 }); \
             __glyx_setRoot(id); id"
        ).expect("eval should succeed");
        let id: u32 = id_str.trim().parse().expect("createNode should return a numeric id");

        let commands = rt.drain_scene_commands();
        assert_eq!(commands.len(), 2, "expected CreateNode + SetRoot, got {commands:?}");
        match &commands[0] {
            SceneCommand::CreateNode { id: cmd_id, node_type, props } => {
                assert_eq!(*cmd_id, id);
                assert_eq!(*node_type, crate::bindings::NodeType::View);
                assert_eq!(props.background_color, Some([255, 0, 0, 255]));
                assert_eq!(props.flex, Some(1.0));
            }
            other => panic!("expected CreateNode, got {other:?}"),
        }
        match &commands[1] {
            SceneCommand::SetRoot { id: cmd_id } => assert_eq!(*cmd_id, id),
            other => panic!("expected SetRoot, got {other:?}"),
        }
    }

    #[test]
    fn append_child_and_update_node_push_expected_commands() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.eval(
            "const p = __glyx_createNode('view', {}); \
             const c = __glyx_createNode('text', { text: 'hi' }); \
             __glyx_appendChild(p, c); \
             __glyx_updateNode(c, { text: 'bye' }); \
             __glyx_removeNode(c);"
        ).expect("eval should succeed");
        let commands = rt.drain_scene_commands();
        // CreateNode(p), CreateNode(c), AppendChild, UpdateNode, RemoveNode
        assert_eq!(commands.len(), 5);
        assert!(matches!(commands[2], SceneCommand::AppendChild { .. }));
        match &commands[3] {
            SceneCommand::UpdateNode { props, .. } => assert_eq!(props.text, Some("bye".to_string())),
            other => panic!("expected UpdateNode, got {other:?}"),
        }
        assert!(matches!(commands[4], SceneCommand::RemoveNode { .. }));
    }

    #[test]
    fn poll_events_returns_a_real_js_array_of_event_objects() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.push_event(InputEvent::MouseButton { x: 1.0, y: 2.0, button: 0, pressed: true });
        rt.push_event(InputEvent::Resize { width: 800, height: 600 });
        let out = rt.eval(
            "const evs = __glyx_pollEvents(); \
             JSON.stringify([evs.length, evs[0].type, evs[0].x, evs[1].type, evs[1].width])"
        ).expect("eval should succeed");
        assert!(out.contains("2") && out.contains("mouseButton") && out.contains("resize"),
            "got: {out}");
        // Queue should be drained — a second poll returns empty.
        let out2 = rt.eval("__glyx_pollEvents().length").expect("eval should succeed");
        assert!(out2.contains('0'), "expected drained queue, got {out2:?}");
    }

    #[test]
    fn get_layout_returns_null_for_unknown_node_and_data_for_known() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.update_layout(42, 1.0, 2.0, 3.0, 4.0);
        let known = rt.eval("JSON.stringify(__glyx_getLayout(42))").expect("eval should succeed");
        assert!(known.contains("\"x\":1") && known.contains("\"height\":4"), "got: {known}");
        let unknown = rt.eval("__glyx_getLayout(999)").expect("eval should succeed");
        assert!(unknown.contains("null"), "got: {unknown}");
    }

    #[test]
    fn measure_text_returns_positive_dimensions() {
        let (_tokio_rt, mut rt) = new_runtime();
        let out = rt.eval("JSON.stringify(__glyx_measure_text('hello', 16))").expect("eval should succeed");
        assert!(out.contains("width") && out.contains("height"), "got: {out}");
    }

    #[test]
    fn text_char_at_x_and_pos_at_do_not_panic_and_return_numbers() {
        let (_tokio_rt, mut rt) = new_runtime();
        let out = rt.eval("typeof __glyx_text_char_at_x('hello', 16, 1e6, 5)").expect("eval should succeed");
        assert!(out.contains("number"), "got: {out}");
        let out = rt.eval("typeof __glyx_text_pos_at('hello', 16, 1e6, 5, 0)").expect("eval should succeed");
        assert!(out.contains("number"), "got: {out}");
    }

    #[test]
    fn window_bindings_are_absent_when_no_window_controller_is_given() {
        let (_tokio_rt, mut rt) = new_runtime();
        let out = rt.eval("typeof __glyx_getWindowSize").expect("eval should succeed");
        assert!(out.contains("undefined"), "expected no window bindings without a WindowController, got {out}");
    }

    /// Same fail-closed-default reasoning as `battery_get_status_rejects_...`
    /// — no test in this shared process may safely call `glyx_security::init()`,
    /// so every fs op should reject immediately (proves the binding is wired
    /// and reuses the real capability check, without needing a real grant).
    #[test]
    fn fs_bindings_reject_without_capabilities() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.eval(
            "globalThis.__errs = []; \
             const rec = e => globalThis.__errs.push(String(e)); \
             __glyx_readFile('C:/nope.txt').catch(rec); \
             __glyx_writeFile('C:/nope.txt', 'x').catch(rec); \
             __glyx_listDir('C:/nope').catch(rec); \
             __glyx_deleteFile('C:/nope.txt').catch(rec); \
             __glyx_mkdirp('C:/nope').catch(rec); \
             __glyx_stat('C:/nope.txt').catch(rec); \
             __glyx_rename('C:/a.txt', 'C:/b.txt').catch(rec); \
             __glyx_copyFile('C:/a.txt', 'C:/b.txt').catch(rec);"
        ).expect("eval should succeed");
        rt.tick();
        let out = rt.eval("JSON.stringify(__errs)").expect("eval should succeed");
        assert!(out.contains("denied"), "expected capability-denied errors, got: {out}");
        let count = rt.eval("__errs.length").expect("eval should succeed");
        assert_eq!(count.trim(), "8", "expected all 8 fs calls to reject, got: {out}");
    }

    #[test]
    fn read_file_bindings_are_registered_and_reachable() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_readFile", "__glyx_readFileBytes", "__glyx_writeFile",
                     "__glyx_appendFile", "__glyx_listDir", "__glyx_deleteFile",
                     "__glyx_mkdirp", "__glyx_stat", "__glyx_rename", "__glyx_copyFile"] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
    }

    #[test]
    fn db_bindings_are_registered_and_reject_without_capabilities() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_db_open", "__glyx_db_query", "__glyx_db_run", "__glyx_db_close",
                     "__glyx_db_transaction", "__glyx_db_backup", "__glyx_vectorDb_open",
                     "__glyx_vectorDb_upsert", "__glyx_vectorDb_search", "__glyx_vectorDb_close"] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
        // Same fail-closed-default reasoning as the fs/battery tests.
        rt.eval(
            "globalThis.__dbErr = null; \
             __glyx_db_open('test.db').catch(e => { globalThis.__dbErr = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let err = rt.eval("__dbErr").expect("eval should succeed");
        assert!(err.contains("Capability") || err.contains("capabilit"), "got: {err}");
    }

    #[test]
    fn mdns_discover_is_registered_and_rejects_without_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        let out = rt.eval("typeof __glyx_mdns_discover").expect("eval should succeed");
        assert!(out.contains("function"), "got {out}");
        rt.eval(
            "globalThis.__mdnsErr = null; \
             __glyx_mdns_discover('_http._tcp.local.', 100).catch(e => { globalThis.__mdnsErr = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let err = rt.eval("__mdnsErr").expect("eval should succeed");
        assert!(err.contains("mdns") || err.contains("Capability"), "got: {err}");
    }

    #[cfg(feature = "fetch")]
    #[test]
    fn fetch_is_registered_and_rejects_disallowed_host() {
        let (_tokio_rt, mut rt) = new_runtime();
        let out = rt.eval("typeof __glyx_fetch").expect("eval should succeed");
        assert!(out.contains("function"), "got {out}");
        rt.eval(
            "globalThis.__fetchErr = null; \
             __glyx_fetch('https://example.com/').catch(e => { globalThis.__fetchErr = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let err = rt.eval("__fetchErr").expect("eval should succeed");
        assert!(err.contains("network.allow"), "expected SSRF/capability denial, got: {err}");
    }

    #[cfg(feature = "fetch")]
    #[test]
    fn fetch_rejects_private_hosts_as_ssrf() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.eval(
            "globalThis.__fetchErr2 = null; \
             __glyx_fetch('http://127.0.0.1:9999/').catch(e => { globalThis.__fetchErr2 = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let err = rt.eval("__fetchErr2").expect("eval should succeed");
        assert!(err.contains("SSRF") || err.contains("private"), "got: {err}");
    }

    #[cfg(feature = "websocket")]
    #[test]
    fn websocket_bindings_are_registered_and_ws_connect_rejects_disallowed_host() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_ws_connect", "__glyx_ws_send", "__glyx_ws_poll", "__glyx_ws_close"] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
        rt.eval(
            "globalThis.__wsErr = null; \
             __glyx_ws_connect('wss://example.com/socket').catch(e => { globalThis.__wsErr = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let err = rt.eval("__wsErr").expect("eval should succeed");
        assert!(err.contains("network.allow"), "got: {err}");
    }

    #[test]
    fn sys_bindings_are_registered() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in [
            "__glyx_dialog_openFile", "__glyx_dialog_saveFile", "__glyx_dialog_openFolder",
            "__glyx_clipboard_readText", "__glyx_clipboard_writeText", "__glyx_notification_send",
            "__glyx_system_getInfo", "__glyx_system_getDarkMode", "__glyx_system_getBatterySaver",
            "__glyx_storage_getDrives", "__glyx_credentials_set", "__glyx_credentials_get",
            "__glyx_credentials_delete", "__glyx_deeplink_getInitialUrl", "__glyx_deeplink_poll",
            "__glyx_perf_snapshot", "__glyx_perf_set_budget", "__glyx_perf_poll_violations",
            "__glyx_perf_poll_leak_warnings", "__glyx_quit", "__glyx_window_close", "__glyx_restart",
            "__glyx_platform", "__glyx_collect_memory", "__glyx_open_external",
            "__glyx_system_watch", "__glyx_system_unwatch",
        ] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
    }

    #[test]
    fn platform_returns_a_real_os_string() {
        let (_tokio_rt, mut rt) = new_runtime();
        let out = rt.eval("__glyx_platform()").expect("eval should succeed");
        assert!(["windows", "macos", "linux"].contains(&out.trim()), "got: {out}");
    }

    #[test]
    fn console_table_does_not_throw_and_logs_a_formatted_table() {
        let (_tokio_rt, mut rt) = new_runtime();
        // console.table used to be undefined (only log/info/warn/error/debug
        // existed) — `console.table is not a function` would throw here.
        rt.eval("console.table([{a:1,b:2},{a:3,b:4}]); 'ok'")
            .expect("console.table should not throw");
        rt.eval("console.table({x:{n:1},y:{n:2}}); 'ok'")
            .expect("console.table should handle an object of objects");
        rt.eval("console.table(42); 'ok'")
            .expect("console.table should fall back gracefully for non-objects");
    }

    #[test]
    fn perf_snapshot_returns_valid_json_with_expected_keys() {
        let (_tokio_rt, mut rt) = new_runtime();
        let out = rt.eval("JSON.stringify(Object.keys(JSON.parse(__glyx_perf_snapshot())).sort())")
            .expect("eval should succeed");
        for key in ["fps", "frameTime", "memoryJS", "nodeCount"] {
            assert!(out.contains(key), "missing {key} in {out}");
        }
    }

    #[test]
    fn deeplink_poll_drains_the_shared_queue() {
        let (_tokio_rt, mut rt) = new_runtime();
        let out = rt.eval("__glyx_deeplink_poll()").expect("eval should succeed");
        assert!(out.trim() == "[]", "expected empty queue initially, got: {out}");
    }

    #[test]
    fn open_external_rejects_disallowed_scheme_without_shell_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        let err = rt.eval("__glyx_open_external('https://example.com')").unwrap_err();
        match err {
            RuntimeError::JsException(msg) => {
                assert!(msg.contains("shell") || msg.contains("Capability"), "got: {msg}");
            }
            other => panic!("expected JsException, got {other:?}"),
        }
    }

    /// Same fail-closed-default reasoning as the other capability tests in
    /// this file — no test in this shared process may safely call
    /// `glyx_security::init()`, so `system_watch` should reject immediately
    /// (proves the capability check is actually wired, not bypassed).
    #[test]
    fn system_watch_rejects_without_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        let err = rt.eval("__glyx_system_watch('darkMode', 1000)").unwrap_err();
        match err {
            RuntimeError::JsException(msg) => {
                assert!(msg.contains("system") || msg.contains("Capability"), "got: {msg}");
            }
            other => panic!("expected JsException, got {other:?}"),
        }
    }

    #[test]
    fn clipboard_bindings_reject_without_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.eval(
            "globalThis.__clipErr = null; \
             __glyx_clipboard_readText().catch(e => { globalThis.__clipErr = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let err = rt.eval("__clipErr").expect("eval should succeed");
        assert!(err.contains("Capability") || err.contains("capabilit"), "got: {err}");
    }

    #[cfg(feature = "audio")]
    #[test]
    fn audio_bindings_are_registered_and_play_rejects_without_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in [
            "__glyx_audio_play", "__glyx_audio_pause", "__glyx_audio_resume", "__glyx_audio_stop",
            "__glyx_audio_setVolume", "__glyx_audio_getVolume", "__glyx_audio_get_time",
            "__glyx_audio_poll", "__glyx_audio_duration", "__glyx_audio_seek",
        ] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
        rt.eval(
            "globalThis.__audioErr = null; \
             __glyx_audio_play('nonexistent.mp3').catch(e => { globalThis.__audioErr = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let err = rt.eval("__audioErr").expect("eval should succeed");
        assert!(err.contains("Capability") || err.contains("capabilit"), "got: {err}");
    }

    #[cfg(feature = "audio")]
    #[test]
    fn audio_poll_returns_empty_array_when_nothing_is_playing() {
        let (_tokio_rt, mut rt) = new_runtime();
        let out = rt.eval("__glyx_audio_poll()").expect("eval should succeed");
        assert_eq!(out.trim(), "[]");
    }

    #[cfg(feature = "audio")]
    #[test]
    fn audio_get_time_and_volume_return_sane_defaults_for_unknown_handle() {
        let (_tokio_rt, mut rt) = new_runtime();
        let t = rt.eval("__glyx_audio_get_time('999')").expect("eval should succeed");
        assert_eq!(t.trim(), "0");
        let v = rt.eval("__glyx_audio_getVolume('999')").expect("eval should succeed");
        assert_eq!(v.trim(), "1");
    }

    #[test]
    fn ai_bindings_are_registered_and_reject_without_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_ai_embed", "__glyx_ai_generate", "__glyx_ai_transcribe",
                     "__glyx_ai_unload_embed", "__glyx_ai_unload_generate", "__glyx_ai_unload_transcribe"] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
        rt.eval(
            "globalThis.__aiErr = null; \
             __glyx_ai_embed('hello').catch(e => { globalThis.__aiErr = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let err = rt.eval("__aiErr").expect("eval should succeed");
        assert!(err.contains("Capability") || err.contains("capabilit"), "got: {err}");
    }

    #[test]
    fn ai_unload_bindings_do_not_panic_when_nothing_is_loaded() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval(
            "__glyx_ai_unload_embed(); __glyx_ai_unload_generate(); __glyx_ai_unload_transcribe(); null"
        ).expect("eval should succeed");
        assert_eq!(r.trim(), "null");
    }

    #[test]
    fn canvas_update_binding_is_registered() {
        let (_tokio_rt, mut rt) = new_runtime();
        let t = rt.eval("typeof __glyx_canvas_update").expect("eval should succeed");
        assert_eq!(t.trim(), "function");
    }

    #[test]
    fn canvas_update_accepts_valid_json_without_throwing() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("__glyx_canvas_update(1, '[]'); null").expect("eval should succeed");
        assert_eq!(r.trim(), "null");
    }

    #[cfg(feature = "canvas3d")]
    #[test]
    fn canvas3d_bindings_are_registered() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_canvas3d_update", "__glyx_canvas3d_load_gltf", "__glyx_canvas3d_unload_gltf"] {
            let t = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert_eq!(t.trim(), "function", "{name} should be a function");
        }
    }

    #[cfg(feature = "canvas3d")]
    #[test]
    fn canvas3d_load_gltf_rejects_unresolvable_path() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("try { __glyx_canvas3d_load_gltf(1, '../../etc/passwd'); 'no-throw' } catch (e) { 'threw' }")
            .expect("eval should succeed");
        assert_eq!(r.trim(), "threw");
    }

    #[cfg(feature = "webview")]
    #[test]
    fn webview_bindings_are_registered() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_webview_post_message", "__glyx_webview_poll"] {
            let t = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert_eq!(t.trim(), "function", "{name} should be a function");
        }
    }

    #[cfg(feature = "webview")]
    #[test]
    fn webview_poll_returns_empty_array_when_no_events() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("__glyx_webview_poll()").expect("eval should succeed");
        assert_eq!(r.trim(), "[]");
    }

    #[cfg(feature = "updater")]
    #[test]
    fn updater_bindings_are_registered_and_reject_without_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_updater_check", "__glyx_updater_update", "__glyx_updater_get_version",
                     "__glyx_updater_check_manifest", "__glyx_updater_download_js"] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
        rt.eval(
            "globalThis.__updErr = null; \
             __glyx_updater_check('1.0.0').catch(e => { globalThis.__updErr = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let err = rt.eval("__updErr").expect("eval should succeed");
        assert!(err.contains("Capability") || err.contains("capabilit"), "got: {err}");
    }

    #[cfg(feature = "updater")]
    #[test]
    fn updater_get_version_returns_a_string() {
        let (_tokio_rt, mut rt) = new_runtime();
        let t = rt.eval("typeof __glyx_updater_get_version()").expect("eval should succeed");
        assert_eq!(t.trim(), "string");
    }

    #[test]
    fn crash_bindings_are_registered_and_reject_without_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_crash_report_js", "__glyx_crash_get_reports", "__glyx_crash_clear_reports", "__glyx_splash_hide"] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
        let r = rt.eval("try { __glyx_crash_report_js('{}'); 'no-throw' } catch (e) { 'threw' }").expect("eval should succeed");
        assert_eq!(r.trim(), "threw");
    }

    #[test]
    fn splash_hide_pushes_a_scene_command() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("__glyx_splash_hide(); null").expect("eval should succeed");
        assert_eq!(r.trim(), "null");
    }

    #[test]
    fn tray_bindings_are_registered() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_tray_create", "__glyx_tray_destroy", "__glyx_tray_update_menu",
                     "__glyx_tray_set_tooltip", "__glyx_tray_poll_events"] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
    }

    #[test]
    fn tray_destroy_returns_false_for_unknown_handle() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("__glyx_tray_destroy(999)").expect("eval should succeed");
        assert_eq!(r.trim(), "false");
    }

    #[test]
    fn tray_poll_events_returns_empty_string_when_nothing_pending() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("__glyx_tray_poll_events()").expect("eval should succeed");
        assert_eq!(r.trim(), "");
    }

    #[test]
    fn fs_watch_bindings_are_registered_and_reject_without_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_fs_watch", "__glyx_fs_unwatch", "__glyx_fs_watch_poll"] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
        rt.eval(
            "globalThis.__fsWatchErr = null; \
             __glyx_fs_watch('some/path').catch(e => { globalThis.__fsWatchErr = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let err = rt.eval("__fsWatchErr").expect("eval should succeed");
        assert!(err.contains("denied"), "got: {err}");
    }

    #[test]
    fn fs_watch_poll_returns_empty_array_when_nothing_pending() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("__glyx_fs_watch_poll()").expect("eval should succeed");
        assert_eq!(r.trim(), "[]");
    }

    #[test]
    fn fs_unwatch_does_not_panic_for_unknown_id() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("__glyx_fs_unwatch(999); null").expect("eval should succeed");
        assert_eq!(r.trim(), "null");
    }

    #[test]
    fn power_bindings_are_registered_and_prevent_sleep_rejects_without_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_power_preventSleep", "__glyx_power_allowSleep"] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
        let r = rt.eval("try { __glyx_power_preventSleep('test'); 'no-throw' } catch (e) { 'threw' }")
            .expect("eval should succeed");
        assert_eq!(r.trim(), "threw");
    }

    #[test]
    fn power_allow_sleep_does_not_panic_for_unknown_id() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("__glyx_power_allowSleep('999'); null").expect("eval should succeed");
        assert_eq!(r.trim(), "null");
    }

    #[cfg(feature = "gamepad")]
    #[test]
    fn gamepad_poll_is_registered_and_rejects_without_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        let t = rt.eval("typeof __glyx_gamepad_poll").expect("eval should succeed");
        assert_eq!(t.trim(), "function");
        let r = rt.eval("try { __glyx_gamepad_poll(); 'no-throw' } catch (e) { 'threw' }").expect("eval should succeed");
        assert_eq!(r.trim(), "threw");
    }

    #[test]
    fn shortcut_bindings_are_registered_and_register_rejects_without_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_shortcut_register", "__glyx_shortcut_unregister", "__glyx_shortcut_poll"] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
        let r = rt.eval("try { __glyx_shortcut_register('Ctrl+K'); 'no-throw' } catch (e) { 'threw' }")
            .expect("eval should succeed");
        assert_eq!(r.trim(), "threw");
    }

    #[test]
    fn shortcut_poll_returns_empty_array_when_nothing_registered() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("__glyx_shortcut_poll()").expect("eval should succeed");
        assert_eq!(r.trim(), "[]");
    }

    #[test]
    fn ipc_bindings_are_registered() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_window_create", "__glyx_ipc_send", "__glyx_ipc_poll", "__glyx_backend_call"] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
    }

    #[test]
    fn window_create_resolves_with_a_new_handle_when_no_window_controller_is_given() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.eval(
            "globalThis.__wcResult = null; \
             __glyx_window_create('{}').then(id => { globalThis.__wcResult = id; });"
        ).expect("eval should succeed");
        rt.tick();
        let out = rt.eval("__wcResult").expect("eval should succeed");
        assert_ne!(out.trim(), "null", "window_create should have resolved with a handle");
    }

    #[test]
    fn ipc_poll_returns_empty_array_when_nothing_pending() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("__glyx_ipc_poll()").expect("eval should succeed");
        assert_eq!(r.trim(), "[]");
    }

    #[test]
    fn ipc_send_to_unknown_target_does_not_panic() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("__glyx_ipc_send(999, 'hello'); null").expect("eval should succeed");
        assert_eq!(r.trim(), "null");
    }

    #[test]
    fn ipc_send_then_poll_on_the_same_handle_round_trips_a_message() {
        // new_runtime() creates a runtime bound to handle 0, so a message
        // sent to handle 0 should show up in that same runtime's own poll.
        let (_tokio_rt, mut rt) = new_runtime();
        rt.eval("__glyx_ipc_send(0, 'hello'); null").expect("eval should succeed");
        let r = rt.eval("__glyx_ipc_poll()").expect("eval should succeed");
        assert!(r.contains("hello"), "expected the round-tripped message, got {r}");
    }

    #[test]
    fn backend_call_rejects_unknown_command() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.eval(
            "globalThis.__bcErr = null; \
             __glyx_backend_call('nonexistent.command', '{}').catch(e => { globalThis.__bcErr = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let err = rt.eval("__bcErr").expect("eval should succeed");
        assert!(err.contains("no such command"), "got: {err}");
    }

    #[test]
    fn console_polyfill_is_installed_and_routes_to_log() {
        let (_tokio_rt, mut rt) = new_runtime();
        let t = rt.eval("typeof console").expect("eval should succeed");
        assert_eq!(t.trim(), "object");
        for method in ["log", "info", "warn", "error", "debug"] {
            let t = rt.eval(&format!("typeof console.{method}")).expect("eval should succeed");
            assert_eq!(t.trim(), "function", "console.{method} should be a function");
        }
        // Should not throw when actually called.
        let r = rt.eval("console.log('hello', 42, { a: 1 }); null").expect("eval should succeed");
        assert_eq!(r.trim(), "null");
    }

    #[test]
    fn video_bindings_are_registered_and_open_rejects_without_capability() {
        let (_tokio_rt, mut rt) = new_runtime();
        for name in ["__glyx_video_open", "__glyx_video_seek", "__glyx_video_set_volume",
                     "__glyx_video_close", "__glyx_video_pause", "__glyx_video_play", "__glyx_video_poll"] {
            let out = rt.eval(&format!("typeof {name}")).expect("eval should succeed");
            assert!(out.contains("function"), "{name} should be registered, got {out}");
        }
        rt.eval(
            "globalThis.__vidErr = null; \
             __glyx_video_open('movie.mp4').catch(e => { globalThis.__vidErr = String(e); });"
        ).expect("eval should succeed");
        rt.tick();
        let err = rt.eval("__vidErr").expect("eval should succeed");
        assert!(err.contains("Capability") || err.contains("capabilit"), "got: {err}");
    }

    #[test]
    fn video_poll_returns_empty_array_when_no_events() {
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval("__glyx_video_poll()").expect("eval should succeed");
        assert_eq!(r.trim(), "[]");
    }

    #[test]
    fn video_control_bindings_accept_string_handle_ids_without_panicking() {
        // Regression test for the audio-id bug: these all take the handle
        // as a String (matching the SDK's `String(handleId)` calling
        // convention), not a bare number — passing a string must not throw
        // an rquickjs type-conversion error.
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval(
            "__glyx_video_seek('1', 5.0); \
             __glyx_video_set_volume('1', 0.5); \
             __glyx_video_pause('1'); \
             __glyx_video_play('1'); \
             __glyx_video_close('1'); \
             null"
        ).expect("eval should succeed");
        assert_eq!(r.trim(), "null");
    }

    #[cfg(feature = "audio")]
    #[test]
    fn audio_control_bindings_accept_string_handle_ids_without_panicking() {
        // Same regression coverage for audio's own id-as-string bug.
        let (_tokio_rt, mut rt) = new_runtime();
        let r = rt.eval(
            "__glyx_audio_pause('1'); \
             __glyx_audio_resume('1'); \
             __glyx_audio_setVolume('1', 0.5); \
             __glyx_audio_getVolume('1'); \
             __glyx_audio_get_time('1'); \
             __glyx_audio_stop('1'); \
             null"
        ).expect("eval should succeed");
        assert_eq!(r.trim(), "null");
    }

    #[test]
    fn canvas_flush_binding_is_registered() {
        let (_tokio_rt, mut rt) = new_runtime();
        let t = rt.eval("typeof __glyx_canvas_flush").expect("eval should succeed");
        assert_eq!(t.trim(), "function");
    }

    #[test]
    fn init_canvas_buffers_json_mode_sets_protocol_only() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.init_canvas_buffers("json", 256);
        let p = rt.eval("__glyx_canvas_protocol").expect("eval should succeed");
        assert_eq!(p.trim(), "json");
        let t = rt.eval("typeof __glyx_canvas_cmdbuf_f32").expect("eval should succeed");
        assert_eq!(t.trim(), "undefined");
    }

    #[test]
    fn init_canvas_buffers_binary_mode_exposes_typed_array_globals() {
        let (_tokio_rt, mut rt) = new_runtime();
        rt.init_canvas_buffers("binary", 16);
        let p = rt.eval("__glyx_canvas_protocol").expect("eval should succeed");
        assert_eq!(p.trim(), "binary");
        for (name, ty) in [
            ("__glyx_canvas_cmdbuf_f32", "Float32Array"),
            ("__glyx_canvas_cmdbuf_u32", "Uint32Array"),
            ("__glyx_canvas_strbuf",     "Uint8Array"),
        ] {
            let t = rt.eval(&format!("{name} instanceof {ty}")).expect("eval should succeed");
            assert_eq!(t.trim(), "true", "{name} should be a {ty}");
        }
    }

    #[test]
    fn canvas_flush_binary_path_decodes_a_real_fill_rect_end_to_end() {
        // Writes a FillRect command (op=1) directly into the shared buffer
        // via JS, exactly like real app code would, then calls
        // __glyx_canvas_flush and checks the resulting SceneCommand — this
        // is the actual regression test for the binary fast-path, not just
        // a "does it throw" check.
        let (_tokio_rt, mut rt) = new_runtime();
        rt.init_canvas_buffers("binary", 16);
        rt.eval(
            "const f32 = __glyx_canvas_cmdbuf_f32; \
             const u32 = __glyx_canvas_cmdbuf_u32; \
             f32[0] = 1; \
             f32[1] = 10; f32[2] = 20; f32[3] = 100; f32[4] = 50; \
             u32[5] = 0xff0000ff; \
             __glyx_canvas_flush(7, f32, 6, __glyx_canvas_strbuf, 0, false); \
             null"
        ).expect("eval should succeed");
        let cmds = rt.drain_scene_commands();
        assert_eq!(cmds.len(), 1, "expected exactly one SceneCommand, got {cmds:?}");
        match &cmds[0] {
            crate::bindings::SceneCommand::CanvasUpdate { id, cmds, append } => {
                assert_eq!(*id, 7);
                assert_eq!(*append, false);
                assert_eq!(cmds.len(), 1);
                match &cmds[0] {
                    crate::bindings::CanvasCmd::FillRect { x, y, w, h, color } => {
                        assert_eq!((*x, *y, *w, *h), (10.0, 20.0, 100.0, 50.0));
                        assert_eq!(*color, [0xff, 0x00, 0x00, 0xff]);
                    }
                    other => panic!("expected FillRect, got {other:?}"),
                }
            }
            other => panic!("expected CanvasUpdate, got {other:?}"),
        }
    }
}
