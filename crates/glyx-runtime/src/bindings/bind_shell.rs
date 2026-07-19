//! `__glyx_shell_run` — scoped shell execution (Tier 1: explicit binary
//! allowlist). See `bindings/mod.rs`'s `shell_run_core` for the shared
//! (engine-neutral) spawn/capability logic — this file is just the V8
//! argument-marshalling wrapper around it, mirroring `bind_net.rs`'s
//! `fetch_callback` shape exactly.

use super::*;

/// `__glyx_shell_run(bin, argsJson) -> Promise<{stdout, stderr, exitCode}>`
///
/// Requires `shell.allow` capability in `glyx.config.json`:
/// ```json
/// { "capabilities": { "shell": { "allow": ["git", "ffmpeg"] } } }
/// ```
/// `bin` must exact-match an allowlist entry. Args are passed as a real
/// argv array (never through a shell interpreter) — see `shell_run_core`'s
/// docs for why that's the actual injection defense, not a filter on top.
#[cfg(feature = "shell")]
pub fn shell_run_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let bin       = v8_arg_to_string(scope, &args, 0);
    let args_json = v8_arg_to_string(scope, &args, 1);

    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let argv: Vec<String> = serde_json::from_str(&args_json).unwrap_or_default();
            let out = shell_run_core(&bin, argv).await?;
            serde_json::to_string(&serde_json::json!({
                "stdout": out.stdout, "stderr": out.stderr, "exitCode": out.exit_code,
            })).map_err(|e| e.to_string())
        }
        .await;

        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}
