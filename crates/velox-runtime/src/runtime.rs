//! `VeloxRuntime` — the public API for the V8-based JS engine.

use std::sync::Arc;
use tokio::runtime::Handle;

use crate::{
    bindings::{
        new_completion_queue, new_event_queue, new_layout_cache, new_scene_queue, register_all,
        CompletionQueue, EventQueue, InputEvent, LayoutCache, SceneCommand, SceneQueue,
        WindowController,
    },
    RuntimeError,
};

pub struct VeloxRuntime {
    isolate:      v8::OwnedIsolate,
    context:      v8::Global<v8::Context>,
    queue:        CompletionQueue,
    scene:        SceneQueue,
    pub events:   EventQueue,
    pub layout_cache: LayoutCache,
}

pub struct HeapStats {
    pub used_heap_size: usize,
    pub total_heap_size: usize,
}

impl VeloxRuntime {
    pub fn new(tokio_handle: Handle, window: Option<WindowController>) -> Self {
        let mut isolate = v8::Isolate::new(v8::CreateParams::default());

        let events       = new_event_queue();
        let layout_cache = new_layout_cache();

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
            );

            (v8::Global::new(scope, ctx), queue, scene)
        };

        Self { isolate, context, queue, scene, events, layout_cache }
    }

    // ── Script execution ──────────────────────────────────────────────────────

    pub fn eval(&mut self, source: &str) -> Result<String, RuntimeError> {
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
    pub fn frame_tick(&mut self) {
        let scope = &mut v8::HandleScope::new(&mut self.isolate);
        let ctx   = v8::Local::new(scope, &self.context);
        let scope = &mut v8::ContextScope::new(scope, ctx);
        let global = ctx.global(scope);

        let key = v8::String::new(scope, "__velox_frameCallback").unwrap();
        let val = match global.get(scope, key.into()) {
            Some(v) => v,
            None    => return,
        };
        if !val.is_function() {
            return;
        }
        let func = v8::Local::<v8::Function>::try_from(val).unwrap();
        let recv = global.into();
        let mut try_catch = v8::TryCatch::new(scope);
        if func.call(&mut try_catch, recv, &[]).is_some() {
            try_catch.perform_microtask_checkpoint();
        } else if let Some(exc) = try_catch.exception() {
            let msg = exc
                .to_string(&mut try_catch)
                .map(|s| s.to_rust_string_lossy(&mut try_catch))
                .unwrap_or_else(|| "Unknown".into());
            log::error!("[JS] frameCallback error: {}", msg);
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

    pub fn heap_stats(&mut self) -> HeapStats {
        let mut stats = v8::HeapStatistics::default();
        self.isolate.get_heap_statistics(&mut stats);
        HeapStats {
            used_heap_size: stats.used_heap_size(),
            total_heap_size: stats.total_heap_size(),
        }
    }
}
