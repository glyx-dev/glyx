//! `__glyx_shell_run` — scoped shell execution (Tier 1), ported from
//! `bind_shell.rs`'s V8 implementation. Same shape as the other quickjs_*
//! modules: this is just the rquickjs argument-marshalling wrapper around
//! `bindings::shell_run_core`'s shared (engine-neutral) spawn/capability
//! logic.

use rquickjs::Ctx;
use rquickjs::prelude::Opt;
use tokio::runtime::Handle;

use crate::bindings::{shell_run_core, CompletionQueue, RedrawRequest};
use crate::quickjs_runtime::QuickJsRuntime;

pub(crate) fn shell_run<'js>(
    ctx: Ctx<'js>, bin: String, args_json: Opt<String>,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        let argv: Vec<String> = args_json.0
            .and_then(|j| serde_json::from_str::<Vec<String>>(&j).ok())
            .unwrap_or_default();
        let out = shell_run_core(&bin, argv).await?;
        serde_json::to_string(&serde_json::json!({
            "stdout": out.stdout, "stderr": out.stderr, "exitCode": out.exit_code,
        })).map_err(|e| e.to_string())
    })
}
