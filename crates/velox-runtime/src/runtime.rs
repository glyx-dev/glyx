//! `VeloxRuntime` — the public API for the V8-based JS engine.

use std::sync::Arc;
use tokio::runtime::Handle;

use crate::{
    bindings::{new_completion_queue, new_scene_queue, register_all, CompletionQueue, SceneCommand, SceneQueue},
    RuntimeError,
};

pub struct VeloxRuntime {
    isolate: v8::OwnedIsolate,
    context: v8::Global<v8::Context>,
    queue:   CompletionQueue,
    scene:   SceneQueue,
}

impl VeloxRuntime {
    pub fn new(tokio_handle: Handle) -> Self {
        let mut isolate = v8::Isolate::new(v8::CreateParams::default());

        let (context, queue, scene) = {
            let scope  = &mut v8::HandleScope::new(&mut isolate);
            let queue  = new_completion_queue();
            let scene  = new_scene_queue();
            let ctx    = v8::Context::new(scope);
            let scope  = &mut v8::ContextScope::new(scope, ctx);
            let global = ctx.global(scope);

            register_all(scope, global, Arc::clone(&queue), tokio_handle, Arc::clone(&scene));

            (v8::Global::new(scope, ctx), queue, scene)
        };

        Self { isolate, context, queue, scene }
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
        // Drain the queue while holding the lock as briefly as possible.
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
            // Safety: pointer was created in read_file_callback on this same
            // thread. Tokio only stored the usize; we are the only ones who
            // reconstruct the Global, and we do so exactly once here.
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

            // Run microtasks so .then() handlers fire immediately.
            scope.perform_microtask_checkpoint();
        }
    }

    pub fn eval_async_blocking(&mut self, source: &str) -> Result<String, RuntimeError> {
        let wrapped = format!(
            r#"(async () => {{ {} }})().then(r => __velox_log('ASYNC_RESULT:' + r));"#,
            source
        );
        self.eval(&wrapped)?;

        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        loop {
            self.tick();
            if self.queue.lock().unwrap().is_empty() {
                break;
            }
            if std::time::Instant::now() > deadline {
                return Err(RuntimeError::JsException("Async operation timed out".into()));
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        Ok("(async result logged above)".into())
    }

    pub fn drain_scene_commands(&mut self) -> Vec<SceneCommand> {
        let mut q = self.scene.lock().unwrap();
        q.drain(..).collect()
    }
}
