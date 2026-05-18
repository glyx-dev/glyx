//! `VeloxRuntime` — the public API for the V8-based JS engine.

use std::sync::Arc;
use tokio::runtime::Handle;

use crate::{
    bindings::{
        new_completion_queue, new_event_queue, new_layout_cache, new_scene_queue,
        new_ipc_bus, new_db_pools, register_all,
        CompletionQueue, DbPools, EventQueue, InputEvent, IpcBus, LayoutCache, SceneCommand,
        SceneQueue, WindowController,
    },
    RuntimeError,
};

#[cfg(feature = "dev")]
use crate::inspector::VeloxInspector;

use std::collections::VecDeque;

/// V8 isolate params shared by fresh and snapshot-restore paths.
///
/// Heap limits:
///   initial = 2 MB  — V8 starts small; it will grow on demand up to the max.
///   maximum = 256 MB — hard cap; prevents V8 from speculatively reserving
///                       the OS-default ~1.5 GB on 64-bit.
///
/// For a React notes app the live heap is typically 20-50 MB, so 256 MB gives
/// plenty of headroom while keeping the process working-set well below Electron.
fn velox_create_params(snapshot: Option<Vec<u8>>) -> v8::CreateParams {
    const MB: usize = 1024 * 1024;
    let params = v8::CreateParams::default()
        .heap_limits(2 * MB, 256 * MB);
    if let Some(blob) = snapshot {
        params.snapshot_blob(blob)
    } else {
        params
    }
}

pub struct VeloxRuntime {
    // ⚠ DROP ORDER MATTERS: inspector holds V8 references; it must be
    //   dropped before `isolate`. Rust drops fields in declaration order.
    /// CDP inspector — present only in dev mode when VELOX_INSPECT_PORT is set.
    #[cfg(feature = "dev")]
    pub inspector: Option<VeloxInspector>,
    isolate:      v8::OwnedIsolate,
    context:      v8::Global<v8::Context>,
    queue:        CompletionQueue,
    scene:        SceneQueue,
    pub events:   EventQueue,
    pub layout_cache: LayoutCache,
    /// Shared perf ring-buffer — velox-core writes frames; JS bindings read via snapshot.
    pub perf_state: Arc<std::sync::Mutex<velox_perf::PerfState>>,
    /// Forwarded deep-link URL queue.
    /// velox-core's single-instance listener pushes URLs here; `__velox_deeplink_poll` drains them.
    pub deeplink_url_queue: Arc<std::sync::Mutex<VecDeque<String>>>,
    /// Shared SQLite pool map. Cleared on window close for graceful shutdown.
    pub db_pools: DbPools,
}

pub struct HeapStats {
    pub used_heap_size: usize,
    pub total_heap_size: usize,
}

impl VeloxRuntime {
    /// Create a new VeloxRuntime with a fresh isolate.
    ///
    /// Uses a private IPC bus and handle 0 — suitable for single-window apps
    /// and for the snapshot tool.  For multi-window use `new_with_ipc`.
    pub fn new(tokio_handle: Handle, window: Option<WindowController>) -> Self {
        let ipc_bus        = new_ipc_bus();
        let next_window_id = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let perf_state     = Arc::new(std::sync::Mutex::new(velox_perf::PerfState::new()));
        Self::new_with_ipc(tokio_handle, window, ipc_bus, 0, next_window_id, perf_state)
    }

    /// Create a new VeloxRuntime and join it to the shared IPC bus.
    ///
    /// `my_handle` is this window's identifier in the bus.
    /// `next_window_id` is a shared counter for assigning secondary-window IDs.
    pub fn new_with_ipc(
        tokio_handle:   Handle,
        window:         Option<WindowController>,
        ipc_bus:        IpcBus,
        my_handle:      u32,
        next_window_id: Arc<std::sync::atomic::AtomicU32>,
        perf_state:     Arc<std::sync::Mutex<velox_perf::PerfState>>,
    ) -> Self {
        // Register this window's inbox in the shared bus.
        ipc_bus.lock().unwrap()
            .entry(my_handle)
            .or_insert_with(|| Arc::new(std::sync::Mutex::new(std::collections::VecDeque::new())));

        let mut isolate = v8::Isolate::new(velox_create_params(None));

        let events             = new_event_queue();
        let layout_cache       = new_layout_cache();
        let deeplink_url_queue = Arc::new(std::sync::Mutex::new(VecDeque::new()));
        let db_pools           = new_db_pools();
        let cdp_log_tx         = Arc::new(std::sync::Mutex::new(None::<tokio::sync::mpsc::UnboundedSender<String>>));

        // Clone handle before moving into register_all; keep one for inspector.
        #[cfg(feature = "dev")]
        let inspect_handle = tokio_handle.clone();

        let (context, queue, scene) = {
            let scope  = &mut v8::HandleScope::new(&mut isolate);
            let queue  = new_completion_queue();
            let scene  = new_scene_queue();
            let ctx    = v8::Context::new(scope);
            let scope  = &mut v8::ContextScope::new(scope, ctx);
            let global = ctx.global(scope);

            register_all(
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
                Arc::clone(&cdp_log_tx),
            );

            (v8::Global::new(scope, ctx), queue, scene)
        };

        // Attach CDP inspector if VELOX_INSPECT_PORT is set (dev feature only).
        #[cfg(feature = "dev")]
        let inspector = std::env::var("VELOX_INSPECT_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .map(|port| VeloxInspector::new(&mut isolate, &context, port, &inspect_handle, Arc::clone(&cdp_log_tx)));

        Self {
            #[cfg(feature = "dev")]
            inspector,
            isolate, context, queue, scene, events, layout_cache,
            perf_state, deeplink_url_queue, db_pools,
        }
    }

    /// Create a new VeloxRuntime from a snapshot blob (pre-executed JS heap).
    ///
    /// The snapshot is restored and its stub bindings are overridden with real Rust implementations.
    /// Uses a private IPC bus — for multi-window use `new_from_snapshot_with_ipc`.
    pub fn new_from_snapshot(
        snapshot_blob: &[u8],
        tokio_handle:  Handle,
        window:        Option<WindowController>,
    ) -> Result<Self, RuntimeError> {
        let ipc_bus        = new_ipc_bus();
        let next_window_id = Arc::new(std::sync::atomic::AtomicU32::new(1));
        let perf_state     = Arc::new(std::sync::Mutex::new(velox_perf::PerfState::new()));
        Self::new_from_snapshot_with_ipc(snapshot_blob, tokio_handle, window, ipc_bus, 0, next_window_id, perf_state)
    }

    /// Restore from snapshot and join the shared IPC bus.
    pub fn new_from_snapshot_with_ipc(
        snapshot_blob:  &[u8],
        tokio_handle:   Handle,
        window:         Option<WindowController>,
        ipc_bus:        IpcBus,
        my_handle:      u32,
        next_window_id: Arc<std::sync::atomic::AtomicU32>,
        perf_state:     Arc<std::sync::Mutex<velox_perf::PerfState>>,
    ) -> Result<Self, RuntimeError> {
        // Register this window's inbox in the bus.
        ipc_bus.lock().unwrap()
            .entry(my_handle)
            .or_insert_with(|| Arc::new(std::sync::Mutex::new(std::collections::VecDeque::new())));

        let mut isolate = v8::Isolate::new(velox_create_params(Some(snapshot_blob.to_vec())));

        let events             = new_event_queue();
        let layout_cache       = new_layout_cache();
        let deeplink_url_queue = Arc::new(std::sync::Mutex::new(VecDeque::new()));
        let db_pools           = new_db_pools();
        let cdp_log_tx         = Arc::new(std::sync::Mutex::new(None::<tokio::sync::mpsc::UnboundedSender<String>>));

        // Clone handle before moving into register_all; keep one for inspector.
        #[cfg(feature = "dev")]
        let inspect_handle = tokio_handle.clone();

        let (context, queue, scene) = {
            let scope  = &mut v8::HandleScope::new(&mut isolate);
            let queue  = new_completion_queue();
            let scene  = new_scene_queue();

            // Snapshot contains a default context; use it
            let ctx    = v8::Context::new(scope);
            let scope  = &mut v8::ContextScope::new(scope, ctx);
            let global = ctx.global(scope);

            // Re-register all binding implementations (stubs are already in snapshot)
            register_all(
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
                Arc::clone(&cdp_log_tx),
            );

            (v8::Global::new(scope, ctx), queue, scene)
        };

        #[cfg(feature = "dev")]
        let inspector = std::env::var("VELOX_INSPECT_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .map(|port| VeloxInspector::new(&mut isolate, &context, port, &inspect_handle, Arc::clone(&cdp_log_tx)));

        Ok(Self {
            #[cfg(feature = "dev")]
            inspector,
            isolate, context, queue, scene, events, layout_cache,
            perf_state, deeplink_url_queue, db_pools,
        })
    }

    // ── Extensions ────────────────────────────────────────────────────────────

    /// Call each extension's `register()` so it can add its own __myapp_* bindings.
    pub fn register_extensions(&mut self, extensions: &[Box<dyn crate::VeloxExtension>]) {
        if extensions.is_empty() { return; }
        let scope = &mut v8::HandleScope::new(&mut self.isolate);
        let ctx   = v8::Local::new(scope, &self.context);
        let scope = &mut v8::ContextScope::new(scope, ctx);
        let global = ctx.global(scope);
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
            let scope = &mut v8::HandleScope::new(&mut self.isolate);
            let ctx   = v8::Local::new(scope, &self.context);
            let scope = &mut v8::ContextScope::new(scope, ctx);

            let code = v8::String::new(scope, source)
                .ok_or_else(|| RuntimeError::JsException("Failed to create source string".into()))?;

            let mut try_catch = v8::TryCatch::new(scope);

            let script = v8::Script::compile(&mut try_catch, code, None)
                .ok_or_else(|| {
                    let exc = try_catch.exception().unwrap();
                    let msg = exc
                        .to_string(&mut try_catch)
                        .map(|s| s.to_rust_string_lossy(&mut try_catch))
                        .unwrap_or_else(|| "Compile error".into());
                    RuntimeError::CompileError(msg)
                })?;

            match script.run(&mut try_catch) {
                Some(val) => {
                    let s = val
                        .to_string(&mut try_catch)
                        .map(|s| s.to_rust_string_lossy(&mut try_catch))
                        .unwrap_or_default();
                    Ok(s)
                }
                None => {
                    let exc = try_catch.exception().unwrap();
                    let msg = exc
                        .to_string(&mut try_catch)
                        .map(|s| s.to_rust_string_lossy(&mut try_catch))
                        .unwrap_or_else(|| "Unknown JS exception".into());
                    Err(RuntimeError::JsException(msg))
                }
            }
        };
        // Release parse-time garbage (AST nodes, bytecode, temp strings) only
        // on success — on error the isolate state is unchanged.
        if result.is_ok() {
            self.isolate.low_memory_notification();
        }
        result
    }

    // ── Async tick ────────────────────────────────────────────────────────────

    /// Drain the completion queue and resolve any pending JS Promises.
    /// Must be called from the V8 thread (same thread that created the isolate).
    pub fn tick(&mut self) {
        let completions: Vec<(usize, Result<String, String>)> = {
            let mut q = self.queue.lock().unwrap();
            q.drain(..).map(|c| (c.resolver_ptr, c.result)).collect()
        };

        if completions.is_empty() {
            return;
        }

        let scope = &mut v8::HandleScope::new(&mut self.isolate);
        let ctx   = v8::Local::new(scope, &self.context);
        let scope = &mut v8::ContextScope::new(scope, ctx);

        for (resolver_ptr, result) in completions {
            let resolver_global = unsafe {
                *Box::from_raw(resolver_ptr as *mut v8::Global<v8::PromiseResolver>)
            };
            let resolver = v8::Local::new(scope, &resolver_global);

            match result {
                Ok(content) => {
                    let s = v8::String::new(scope, &content)
                        .unwrap_or_else(|| v8::String::empty(scope));
                    resolver.resolve(scope, s.into());
                }
                Err(err) => {
                    let msg = v8::String::new(scope, &err)
                        .unwrap_or_else(|| v8::String::empty(scope));
                    let exc = v8::Exception::error(scope, msg);
                    resolver.reject(scope, exc);
                }
            }

            scope.perform_microtask_checkpoint();
        }
    }

    // ── Frame tick ────────────────────────────────────────────────────────────

    /// Call the JS `__velox_frameCallback()` function if it has been registered.
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

        let scope = &mut v8::HandleScope::new(&mut self.isolate);
        let ctx   = v8::Local::new(scope, &self.context);
        let scope = &mut v8::ContextScope::new(scope, ctx);
        let global = ctx.global(scope);

        let key = v8::String::new(scope, "__velox_frameCallback").unwrap();
        let val = match global.get(scope, key.into()) {
            Some(v) => v,
            None    => return None,
        };
        if !val.is_function() {
            return None;
        }
        let func = v8::Local::<v8::Function>::try_from(val).unwrap();
        let recv = global.into();
        let mut try_catch = v8::TryCatch::new(scope);
        if func.call(&mut try_catch, recv, &[]).is_some() {
            try_catch.perform_microtask_checkpoint();
            None
        } else if let Some(exc) = try_catch.exception() {
            // Extract both the exception message and the stack trace if available.
            let msg = exc
                .to_string(&mut try_catch)
                .map(|s| s.to_rust_string_lossy(&mut try_catch))
                .unwrap_or_else(|| "Unknown JS exception".into());
            let stack = try_catch.stack_trace()
                .and_then(|st| st.to_string(&mut try_catch))
                .map(|s| s.to_rust_string_lossy(&mut try_catch))
                .unwrap_or_default();
            let full = if stack.is_empty() { msg } else { format!("{}\n{}", msg, stack) };
            log::error!("[JS] frameCallback error: {}", full);
            Some(full)
        } else {
            None
        }
    }

    // ── Input events ──────────────────────────────────────────────────────────

    /// Push an input event so JS can poll it via `__velox_pollEvents()`.
    pub fn push_event(&self, event: InputEvent) {
        self.events.lock().unwrap().push_back(event);
    }

    // ── Layout cache ──────────────────────────────────────────────────────────

    /// Update the resolved layout for a node so JS can query it via
    /// `__velox_getLayout(id)` for hit-testing.
    pub fn update_layout(&self, js_id: u32, x: f32, y: f32, width: f32, height: f32) {
        self.layout_cache.lock().unwrap().insert(js_id, [x, y, width, height]);
    }

    // ── Scene commands ────────────────────────────────────────────────────────

    pub fn drain_scene_commands(&mut self) -> Vec<SceneCommand> {
        let mut q = self.scene.lock().unwrap();
        q.drain(..).collect()
    }

    /// Close all open SQLite pools — called by velox-core when the window is closing.
    ///
    /// Clearing the map drops the `SqlitePool` values, which triggers SQLx's
    /// graceful pool shutdown (waits for in-flight queries, then closes connections).
    pub fn shutdown_db_pools(&self) {
        self.db_pools.lock().unwrap().clear();
    }

    pub fn heap_stats(&mut self) -> HeapStats {
        let mut stats = v8::HeapStatistics::default();
        self.isolate.get_heap_statistics(&mut stats);
        HeapStats {
            used_heap_size: stats.used_heap_size(),
            total_heap_size: stats.total_heap_size(),
        }
    }
}
