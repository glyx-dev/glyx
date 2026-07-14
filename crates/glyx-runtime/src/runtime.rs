//! `V8Runtime` -- the V8-based implementation of `JsRuntime`.

use std::sync::Arc;
use tokio::runtime::Handle;

use crate::{
    bindings::{
        new_completion_queue, new_event_queue, new_layout_cache, new_scene_queue,
        new_ipc_bus, new_db_pools, new_video_events, register_all, reload_plugin_in_scope,
        CompletionQueue, DbPools, EventQueue, InputEvent, IpcBus, LayoutCache, SceneCommand,
        SceneQueue, VideoEvents, WindowController, StatePtrUsize,
    },
    runtime_trait::JsRuntime,
    BackendRegistry, RuntimeError, GlyxExtension, Scope,
};

#[cfg(feature = "dev")]
use crate::inspector::GlyxInspector;

use std::collections::VecDeque;

// ── N1: Deny dynamic import() in release ─────────────────────────────────────

/// V8 callback that rejects all dynamic `import()` calls.
///
/// Installed in release builds only.  Debug builds leave the callback unset so
/// hot-reload and snapshot tooling can still use `import()` during development.
///
/// The callback is called whenever JS evaluates `import(specifier)`.  Returning
/// `None` (a null MaybeLocal) signals to V8 that the import could not be
/// resolved, which causes it to reject the dynamic import with an error.
// v8 150: the host-import callback is now a `FnOnce(&mut PinScope, Data, Value,
// String, FixedArray) -> Option<Local<Promise>>`.  The second parameter is the
// host-defined options (a `Data`) rather than the `Context`.
#[cfg(not(debug_assertions))]
fn deny_dynamic_import(
    _scope:             &mut v8::PinScope,
    _host_defined_opts: v8::Local<v8::Data>,
    _resource_name:     v8::Local<v8::Value>,
    _specifier:         v8::Local<v8::String>,
    _import_attributes: v8::Local<v8::FixedArray>,
) -> Option<v8::Local<v8::Promise>> {
    None
}

/// Install the dynamic-import denial callback on a freshly created isolate.
/// No-op in debug builds so tooling and hot-reload continue to work.
fn install_import_guard(isolate: &mut v8::OwnedIsolate) {
    #[cfg(not(debug_assertions))]
    isolate.set_host_import_module_dynamically_callback(deny_dynamic_import);
    #[cfg(debug_assertions)]
    let _ = isolate;
}

// eval / new Function denial is handled solely by the V8 flag
// `--disallow-code-generation-from-strings` set in lib.rs.
// v8 150 does not expose a per-context set_allow_code_generation_from_strings API.

/// V8 isolate params shared by fresh and snapshot-restore paths.
///
/// `max_heap_mb` is computed by glyx-core from the JS bundle size (auto) or
/// from the `maxJsHeapMb` key in glyx.config.json (explicit).
///
/// Heap limits:
///   initial = 2 MB  -- V8 starts small; grows on demand.
///   maximum = max_heap_mb -- prevents V8 speculatively reserving the OS-default ~1.5 GB.
fn glyx_create_params(snapshot: Option<Vec<u8>>, max_heap_mb: usize) -> v8::CreateParams {
    const MB: usize = 1024 * 1024;
    let params = v8::CreateParams::default()
        .heap_limits(2 * MB, max_heap_mb * MB);
    if let Some(blob) = snapshot {
        params.snapshot_blob(blob.into())
    } else {
        params
    }
}

pub struct V8Runtime {
    // ⚠ DROP ORDER MATTERS: inspector holds V8 references; it must be
    //   dropped before `isolate`. Rust drops fields in declaration order.
    /// CDP inspector -- present only in dev mode when GLYX_INSPECT_PORT is set.
    #[cfg(feature = "dev")]
    pub inspector: Option<GlyxInspector>,
    isolate:      v8::OwnedIsolate,
    context:      v8::Global<v8::Context>,
    queue:        CompletionQueue,
    scene:        SceneQueue,
    pub events:   EventQueue,
    pub layout_cache: LayoutCache,
    /// Shared perf ring-buffer -- glyx-core writes frames; JS bindings read via snapshot.
    pub perf_state: Arc<parking_lot::Mutex<glyx_perf::PerfState>>,
    /// Forwarded deep-link URL queue.
    /// glyx-core's single-instance listener pushes URLs here; `__glyx_deeplink_poll` drains them.
    pub deeplink_url_queue: Arc<parking_lot::Mutex<VecDeque<String>>>,
    /// Shared SQLite pool map. Cleared on window close for graceful shutdown.
    pub db_pools: DbPools,
    /// Video events pushed by decode threads and forwarded to JS via `__glyx_video_poll`.
    pub video_events: VideoEvents,
    /// Opaque pointer to the heap-allocated `AsyncState` created in `register_all`.
    /// Used by `reload_plugin` to update `js_backend_commands` after a dev-mode rebundle.
    state_ptr: StatePtrUsize,
}

pub struct HeapStats {
    pub used_heap_size: usize,
    pub total_heap_size: usize,
}

impl V8Runtime {
    /// Create a new V8Runtime with a fresh isolate.
    ///
    /// Uses a private IPC bus and handle 0 -- suitable for single-window apps
    /// and for the snapshot tool.  For multi-window use `new_with_ipc`.
    pub fn new(tokio_handle: Handle, window: Option<WindowController>) -> Self {
        let ipc_bus        = new_ipc_bus();
        let next_window_id = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let perf_state     = Arc::new(parking_lot::Mutex::new(glyx_perf::PerfState::new()));
        Self::new_with_ipc(tokio_handle, window, ipc_bus, 0, next_window_id, perf_state,
            std::sync::Arc::new(std::collections::HashMap::new()),
            std::sync::Arc::new(vec![]),
            256)
    }

    /// Create a new GlyxRuntime and join it to the shared IPC bus.
    ///
    /// `my_handle` is this window's identifier in the bus.
    /// `next_window_id` is a shared counter for assigning secondary-window IDs.
    /// `backend_commands` is the registry of named async Rust commands callable
    ///   from JS via `backend.<name>(args)`.
    pub fn new_with_ipc(
        tokio_handle:   Handle,
        window:         Option<WindowController>,
        ipc_bus:        IpcBus,
        my_handle:      u32,
        next_window_id: Arc<std::sync::atomic::AtomicU32>,
        perf_state:     Arc<parking_lot::Mutex<glyx_perf::PerfState>>,
        backend_commands: BackendRegistry,
        js_plugins:     crate::JsPlugins,
        max_heap_mb:    usize,
    ) -> Self {
        // Register this window's inbox in the shared bus.
        ipc_bus.lock()
            .entry(my_handle)
            .or_insert_with(|| Arc::new(parking_lot::Mutex::new(std::collections::VecDeque::new())));

        let mut isolate = v8::Isolate::new(glyx_create_params(None, max_heap_mb));
        install_import_guard(&mut isolate);

        let events             = new_event_queue();
        let layout_cache       = new_layout_cache();
        let deeplink_url_queue = Arc::new(parking_lot::Mutex::new(VecDeque::new()));
        let db_pools           = new_db_pools();
        let video_events       = new_video_events();
        let cdp_log_tx         = Arc::new(parking_lot::Mutex::new(None::<tokio::sync::mpsc::UnboundedSender<String>>));

        // Clone handle before moving into register_all; keep one for inspector.
        #[cfg(feature = "dev")]
        let inspect_handle = tokio_handle.clone();

        let (context, queue, scene, state_ptr) = {
            v8::scope!(let scope, &mut isolate);
            let queue  = new_completion_queue();
            let scene  = new_scene_queue();
            let ctx    = v8::Context::new(&scope, Default::default());
            let ctx_global = v8::Global::new(&scope, ctx);
            let global = ctx.global(&scope);
            let context_local = v8::Local::new(&scope, &ctx_global);
            let scope = &mut v8::ContextScope::new(scope, context_local);

            let state_ptr = register_all(
                scope, global,
                Arc::clone(&queue),
                tokio_handle,
                Arc::clone(&scene),
                Arc::clone(&events),
                Arc::clone(&layout_cache),
                window,
                ipc_bus,
                my_handle,
                next_window_id,
                Arc::clone(&perf_state),
                Arc::clone(&deeplink_url_queue),
                Arc::clone(&db_pools),
                Arc::clone(&video_events),
                Arc::clone(&cdp_log_tx),
                backend_commands,
                js_plugins,
            );

            (ctx_global, queue, scene, state_ptr)
        };

        // Attach CDP inspector if GLYX_INSPECT_PORT is set (dev feature only).
        #[cfg(feature = "dev")]
        let inspector = std::env::var("GLYX_INSPECT_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .map(|port| GlyxInspector::new(&mut isolate, &context, port, &inspect_handle, Arc::clone(&cdp_log_tx)));

        Self {
            #[cfg(feature = "dev")]
            inspector,
            isolate, context, queue, scene, events, layout_cache,
            perf_state, deeplink_url_queue, db_pools, video_events, state_ptr,
        }
    }

    /// Create a new GlyxRuntime from a snapshot blob (pre-executed JS heap).
    ///
    /// The snapshot is restored and its stub bindings are overridden with real Rust implementations.
    /// Uses a private IPC bus -- for multi-window use `new_from_snapshot_with_ipc`.
    pub fn new_from_snapshot(
        snapshot_blob: &[u8],
        tokio_handle:  Handle,
        window:        Option<WindowController>,
    ) -> Result<Self, RuntimeError> {
        let ipc_bus        = new_ipc_bus();
        let next_window_id = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let perf_state     = Arc::new(parking_lot::Mutex::new(glyx_perf::PerfState::new()));
        Self::new_from_snapshot_with_ipc(snapshot_blob, tokio_handle, window, ipc_bus, 0, next_window_id, perf_state,
            std::sync::Arc::new(std::collections::HashMap::new()),
            std::sync::Arc::new(vec![]),
            256)
    }

    /// Restore from snapshot and join the shared IPC bus.
    pub fn new_from_snapshot_with_ipc(
        snapshot_blob:  &[u8],
        tokio_handle:   Handle,
        window:         Option<WindowController>,
        ipc_bus:        IpcBus,
        my_handle:      u32,
        next_window_id: Arc<std::sync::atomic::AtomicU32>,
        perf_state:     Arc<parking_lot::Mutex<glyx_perf::PerfState>>,
        backend_commands: BackendRegistry,
        js_plugins:     crate::JsPlugins,
        max_heap_mb:    usize,
    ) -> Result<Self, RuntimeError> {
        // Register this window's inbox in the bus.
        ipc_bus.lock()
            .entry(my_handle)
            .or_insert_with(|| Arc::new(parking_lot::Mutex::new(std::collections::VecDeque::new())));

        let mut isolate = v8::Isolate::new(glyx_create_params(Some(snapshot_blob.to_vec()), max_heap_mb));
        install_import_guard(&mut isolate);

        let events             = new_event_queue();
        let layout_cache       = new_layout_cache();
        let deeplink_url_queue = Arc::new(parking_lot::Mutex::new(VecDeque::new()));
        let db_pools           = new_db_pools();
        let video_events       = new_video_events();
        let cdp_log_tx         = Arc::new(parking_lot::Mutex::new(None::<tokio::sync::mpsc::UnboundedSender<String>>));

        // Clone handle before moving into register_all; keep one for inspector.
        #[cfg(feature = "dev")]
        let inspect_handle = tokio_handle.clone();

        let (context, queue, scene, state_ptr) = {
            v8::scope!(let scope, &mut isolate);
            let queue  = new_completion_queue();
            let scene  = new_scene_queue();

            // Snapshot contains a default context; use it
            let ctx    = v8::Context::new(&scope, Default::default());
            let ctx_global = v8::Global::new(&scope, ctx);
            let global = ctx.global(&scope);
            let context_local = v8::Local::new(&scope, &ctx_global);
            let scope = &mut v8::ContextScope::new(scope, context_local);

            // Re-register all binding implementations (stubs are already in snapshot)
            let state_ptr = register_all(
                scope, global,
                Arc::clone(&queue),
                tokio_handle,
                Arc::clone(&scene),
                Arc::clone(&events),
                Arc::clone(&layout_cache),
                window,
                ipc_bus,
                my_handle,
                next_window_id,
                Arc::clone(&perf_state),
                Arc::clone(&deeplink_url_queue),
                Arc::clone(&db_pools),
                Arc::clone(&video_events),
                Arc::clone(&cdp_log_tx),
                backend_commands,
                js_plugins,
            );

            (ctx_global, queue, scene, state_ptr)
        };

        #[cfg(feature = "dev")]
        let inspector = std::env::var("GLYX_INSPECT_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .map(|port| GlyxInspector::new(&mut isolate, &context, port, &inspect_handle, Arc::clone(&cdp_log_tx)));

        Ok(Self {
            #[cfg(feature = "dev")]
            inspector,
            isolate, context, queue, scene, events, layout_cache,
            perf_state, deeplink_url_queue, db_pools, video_events, state_ptr,
        })
    }

    // ── Plugin hot-reload (dev mode) ──────────────────────────────────────────

    /// Re-eval a plugin IIFE and refresh its exported commands in `js_backend_commands`.
    /// Called by glyx-core's dev-mode event handler on file-change rebuild.
    pub fn reload_plugin(&mut self, global_name: &str, prefix: Option<&str>, bundled_js: &str) {
        v8::scope_with_context!(let scope, &mut self.isolate, &self.context);
        reload_plugin_in_scope(scope, self.state_ptr, global_name, prefix, bundled_js);
    }

    // ── Extensions ────────────────────────────────────────────────────────────

    /// Call each extension's `register()` so it can add its own __myapp_* bindings.
    pub fn register_extensions(&mut self, extensions: &[Box<dyn crate::GlyxExtension>]) {
        if extensions.is_empty() { return; }
        v8::scope_with_context!(let scope, &mut self.isolate, &self.context);
        let ctx    = v8::Local::new(&scope, &self.context);
        let global = ctx.global(&scope);
        for ext in extensions {
            log::debug!("Registering extension: {}", ext.name());
            ext.register(scope, global);
        }
    }

    // ── Script execution ──────────────────────────────────────────────────────

    pub fn eval(&mut self, source: &str) -> Result<String, RuntimeError> {
        // All V8 handle-scope work is in a nested block so every borrow of
        // `self.isolate` is released before `low_memory_notification()` runs.
        let result = {
            v8::scope_with_context!(let scope, &mut self.isolate, &self.context);

            let code = v8::String::new(&scope, source)
                .ok_or_else(|| RuntimeError::JsException("Failed to create source string".into()))?;

            v8::tc_scope!(let try_catch, scope);

            // Set a script origin so V8 labels stack frames as "app.js" instead
            // of "vm".  With --source-map=inline in bun and --enable_source_maps
            // in V8 (dev builds), positions are automatically translated back to
            // the original .jsx/.tsx source file and line.
            let resource_name: v8::Local<v8::Value> =
                v8::String::new(try_catch, "app.js").unwrap().into();
            let source_map_url: v8::Local<v8::Value> =
                v8::String::new(try_catch, "").unwrap().into();
            let origin = v8::ScriptOrigin::new(
                try_catch,
                resource_name,
                0, 0,
                false, -1,
                Some(source_map_url),
                false, false, false,
                None,
            );

            let script = v8::Script::compile(try_catch, code, Some(&origin))
                .ok_or_else(|| {
                    let exc = try_catch.exception().unwrap();
                    let msg = exc
                        .to_string(try_catch)
                        .map(|s| s.to_rust_string_lossy(try_catch.as_ref()))
                        .unwrap_or_else(|| "Compile error".into());
                    RuntimeError::CompileError(msg)
                })?;

            match script.run(try_catch) {
                Some(val) => {
                    let s = val
                        .to_string(try_catch)
                        .map(|s| s.to_rust_string_lossy(try_catch.as_ref()))
                        .unwrap_or_default();
                    Ok(s)
                }
                None => {
                    let exc = try_catch.exception().unwrap();
                    // Prefer Error.stack -- it includes message + all frames.
                    // Fall back to exc.to_string() for non-Error throws.
                    let msg = {
                        let key = v8::String::new(try_catch, "stack").unwrap();
                        exc.to_object(try_catch)
                            .and_then(|o| o.get(try_catch, key.into()))
                            .and_then(|v| v.to_string(try_catch))
                            .map(|s| s.to_rust_string_lossy(try_catch.as_ref()))
                            .filter(|s| !s.is_empty())
                            .unwrap_or_else(|| {
                                exc.to_string(try_catch)
                                    .map(|s| s.to_rust_string_lossy(try_catch.as_ref()))
                                    .unwrap_or_else(|| "Unknown JS exception".into())
                            })
                    };
                    Err(RuntimeError::JsException(msg))
                }
            }
        };
        // Release parse-time garbage (AST nodes, bytecode, temp strings).
        // Notify on both success and error -- V8 trims what it can regardless.
        self.isolate.low_memory_notification();
        result
    }

    // ── Canvas2D binary protocol ────────────────────────────────────────────────

    /// Set up the Canvas2D binary command buffer and expose typed-array globals.
    ///
    /// Called once per window after construction. Allocates one Rust-owned
    /// backing store (external backing stores are NOT moved by V8 GC, so the
    /// pointer is stable) and exposes three views over it as globals:
    ///   * `__glyx_canvas_cmdbuf_f32` -- Float32Array (geometry args)
    ///   * `__glyx_canvas_cmdbuf_u32` -- Uint32Array  (packed RGBA, aliases f32)
    ///   * `__glyx_canvas_strbuf`     -- Uint8Array   (UTF-8 text for fillText)
    /// plus `__glyx_canvas_protocol` = `"binary"` | `"json"`.
    ///
    /// JS feature-detects these globals; if `protocol != "binary"` or buffer
    /// setup fails, only `__glyx_canvas_protocol = "json"` is set and JS uses
    /// the JSON `__glyx_canvas_update` path.
    pub fn init_canvas_buffers(&mut self, protocol: &str, buffer_kb: usize) {
        v8::scope_with_context!(let scope, &mut self.isolate, &self.context);
        let ctx    = v8::Local::new(&scope, &self.context);
        let global = ctx.global(&scope);

        // Helper: set globalThis[key] = "value" (string).
        fn set_str(scope: &mut Scope, global: v8::Local<v8::Object>, key: &str, val: &str) {
            if let (Some(k), Some(v)) = (v8::String::new(scope, key), v8::String::new(scope, val)) {
                global.set(scope, k.into(), v.into());
            }
        }
        // Helper: set globalThis[key] = value (any V8 value).
        fn set_val(scope: &mut Scope, global: v8::Local<v8::Object>, key: &str, val: v8::Local<v8::Value>) {
            if let Some(k) = v8::String::new(scope, key) {
                global.set(scope, k.into(), val);
            }
        }

        if protocol != "binary" {
            set_str(scope, global, "__glyx_canvas_protocol", "json");
            log::info!("canvas: JSON protocol (configured)");
            return;
        }

        // Command region (whole f32 slots) + string region (~quarter, min 16 KiB).
        let cmd_bytes = (buffer_kb.max(16) * 1024) & !3;
        let str_bytes = (cmd_bytes / 4).max(16 * 1024);
        let total     = cmd_bytes + str_bytes;
        let f32_len   = cmd_bytes / 4;

        let store = vec![0u8; total].into_boxed_slice();
        let bs    = v8::ArrayBuffer::new_backing_store_from_boxed_slice(store).make_shared();
        let ab    = v8::ArrayBuffer::with_backing_store(&scope, &bs);

        let (Some(f32v), Some(u32v), Some(u8v)) = (
            v8::Float32Array::new(&scope, ab, 0, f32_len),
            v8::Uint32Array::new(&scope, ab, 0, f32_len),
            v8::Uint8Array::new(&scope, ab, cmd_bytes, str_bytes),
        ) else {
            set_str(scope, global, "__glyx_canvas_protocol", "json");
            log::warn!("canvas: typed-array setup failed → JSON fallback");
            return;
        };

        set_val(scope, global, "__glyx_canvas_cmdbuf_f32", f32v.into());
        set_val(scope, global, "__glyx_canvas_cmdbuf_u32", u32v.into());
        set_val(scope, global, "__glyx_canvas_strbuf",     u8v.into());
        set_str(scope, global, "__glyx_canvas_protocol",   "binary");
        log::info!("canvas: binary protocol ready ({} KiB cmd + {} KiB str)",
                   cmd_bytes / 1024, str_bytes / 1024);
    }

    // ── Async tick ────────────────────────────────────────────────────────────

    /// Drain the completion queue and resolve any pending JS Promises.
    /// Must be called from the V8 thread (same thread that created the isolate).
    pub fn tick(&mut self) {
        let completions: Vec<(usize, Result<String, String>)> = {
            let mut q = self.queue.lock();
            q.drain(..).map(|c| (c.resolver_ptr, c.result)).collect()
        };

        if completions.is_empty() {
            return;
        }

        v8::scope_with_context!(let scope, &mut self.isolate, &self.context);

        for (resolver_ptr, result) in completions {
            let resolver_global = unsafe {
                *Box::from_raw(resolver_ptr as *mut v8::Global<v8::PromiseResolver>)
            };
            let resolver = v8::Local::new(&scope, &resolver_global);

            match result {
                Ok(content) => {
                    let s = v8::String::new(&scope, &content)
                        .unwrap_or_else(|| v8::String::empty(&scope));
                    resolver.resolve(&scope, s.into());
                }
                Err(err) => {
                    let msg = v8::String::new(&scope, &err)
                        .unwrap_or_else(|| v8::String::empty(&scope));
                    let exc = v8::Exception::error(&scope, msg);
                    resolver.reject(&scope, exc);
                }
            }

            scope.perform_microtask_checkpoint();
        }
    }

    // ── Frame tick ────────────────────────────────────────────────────────────

    /// Call the JS `__glyx_frameCallback()` function if it has been registered.
    ///
    /// This lets the JS event dispatcher run hit-testing and fire React
    /// state-update callbacks once per frame, before scene commands are drained.
    ///
    /// Returns `Some(error_message)` if a JS exception was thrown, `None` on success.
    pub fn frame_tick(&mut self) -> Option<String> {
        // Pump pending CDP messages before running JS, so DevTools commands
        // (e.g. Runtime.evaluate) execute at a predictable point each frame.
        #[cfg(feature = "dev")]
        if let Some(mut insp) = self.inspector.take() {
            insp.pump_messages(&mut self.isolate, &self.context);
            self.inspector = Some(insp);
        }

        v8::scope_with_context!(let scope, &mut self.isolate, &self.context);
        let ctx    = v8::Local::new(&scope, &self.context);
        let global = ctx.global(&scope);

        let key = v8::String::new(&scope, "__glyx_frameCallback").unwrap();
        let val = match global.get(&scope, key.into()) {
            Some(v) => v,
            None    => return None,
        };
        if !val.is_function() {
            return None;
        }
        let func = v8::Local::<v8::Function>::try_from(val).unwrap();
        let recv = global.into();
        v8::tc_scope!(let try_catch, scope);
        if func.call(try_catch, recv, &[]).is_some() {
            try_catch.perform_microtask_checkpoint();
            None
        } else if let Some(exc) = try_catch.exception() {
            // Extract both the exception message and the stack trace if available.
            let msg = exc
                .to_string(try_catch)
                .map(|s| s.to_rust_string_lossy(try_catch.as_ref()))
                .unwrap_or_else(|| "Unknown JS exception".into());
            let stack = try_catch.stack_trace()
                .and_then(|st| st.to_string(try_catch))
                .map(|s| s.to_rust_string_lossy(try_catch.as_ref()))
                .unwrap_or_default();
            let full = if stack.is_empty() { msg } else { format!("{}\n{}", msg, stack) };
            log::error!("[JS] frameCallback error: {}", full);
            Some(full)
        } else {
            None
        }
    }

    // ── Input events ──────────────────────────────────────────────────────────

    /// Push an input event so JS can poll it via `__glyx_pollEvents()`.
    pub fn push_event(&self, event: InputEvent) {
        self.events.lock().push_back(event);
    }

    // ── Layout cache ──────────────────────────────────────────────────────────

    /// Update the resolved layout for a node so JS can query it via
    /// `__glyx_getLayout(id)` for hit-testing.
    pub fn update_layout(&self, js_id: u32, x: f32, y: f32, width: f32, height: f32) {
        self.layout_cache.lock().insert(js_id, [x, y, width, height]);
    }

    // ── Scene commands ────────────────────────────────────────────────────────

    pub fn drain_scene_commands(&mut self) -> Vec<SceneCommand> {
        let mut q = self.scene.lock();
        q.drain(..).collect()
    }

    /// Flush V8's microtask queue (Promise continuations, queueMicrotask callbacks).
    /// Call this after `eval()` to ensure any React work scheduled via microtasks
    /// (e.g. initial render deferred via Promise.resolve().then()) is committed
    /// and its scene commands are in the queue before `drain_scene_commands()`.
    pub fn flush_microtasks(&mut self) {
        v8::scope_with_context!(let scope, &mut self.isolate, &self.context);
        scope.perform_microtask_checkpoint();
    }

    /// Trigger a V8 major GC to reclaim old-generation objects.
    ///
    /// Call periodically (e.g. every 5 seconds) during high-frequency animation
    /// loops.  React re-renders at 30-60 fps promote short-lived objects into V8's
    /// old generation faster than the automatic minor-GC can drain them, causing
    /// the V8 heap to grow ~46 KB/s.  `low_memory_notification()` forces a full
    /// collection that reclaims them.  The call typically takes <2 ms for the
    /// heap sizes Glyx uses and is invisible to the user.
    pub fn gc_hint(&mut self) {
        self.isolate.low_memory_notification();
    }

    /// Close all open SQLite pools -- called by glyx-core when the window is closing.
    ///
    /// Clearing the map drops the `SqlitePool` values, which triggers SQLx's
    /// graceful pool shutdown (waits for in-flight queries, then closes connections).
    pub fn shutdown_db_pools(&self) {
        self.db_pools.lock().clear();
    }

    pub fn heap_stats(&mut self) -> HeapStats {
        let stats = self.isolate.get_heap_statistics();
        HeapStats {
            used_heap_size: stats.used_heap_size(),
            total_heap_size: stats.total_heap_size(),
        }
    }
}

// ── JsRuntime impl ────────────────────────────────────────────────────────────

impl JsRuntime for V8Runtime {
    fn register_extensions(&mut self, extensions: &[Box<dyn GlyxExtension>]) {
        self.register_extensions(extensions);
    }

    fn eval(&mut self, source: &str) -> Result<String, RuntimeError> {
        self.eval(source)
    }

    fn tick(&mut self) {
        self.tick();
    }

    fn frame_tick(&mut self) -> Option<String> {
        self.frame_tick()
    }

    fn push_event(&self, event: InputEvent) {
        self.push_event(event);
    }

    fn update_layout(&self, js_id: u32, x: f32, y: f32, width: f32, height: f32) {
        self.update_layout(js_id, x, y, width, height);
    }

    fn drain_scene_commands(&mut self) -> Vec<SceneCommand> {
        self.drain_scene_commands()
    }

    fn flush_microtasks(&mut self) {
        self.flush_microtasks();
    }

    fn shutdown_db_pools(&self) {
        self.shutdown_db_pools();
    }

    fn heap_stats(&mut self) -> HeapStats {
        self.heap_stats()
    }

    fn layout_cache(&self) -> LayoutCache {
        Arc::clone(&self.layout_cache)
    }

    fn events(&self) -> EventQueue {
        Arc::clone(&self.events)
    }

    fn perf_state(&self) -> Arc<parking_lot::Mutex<glyx_perf::PerfState>> {
        Arc::clone(&self.perf_state)
    }

    fn deeplink_url_queue(&self) -> Arc<parking_lot::Mutex<std::collections::VecDeque<String>>> {
        Arc::clone(&self.deeplink_url_queue)
    }

    fn db_pools(&self) -> DbPools {
        Arc::clone(&self.db_pools)
    }
}
