//! `__glyx_video_*` bindings, ported from `bind_media.rs`'s V8 implementation.
//! Unlike audio, video decode/playback itself lives entirely in glyx-core's
//! scene/render layer (via the `glyx-media` DLL) — these bindings just push
//! `SceneCommand`s and check the `video` capability; no engine-specific
//! decode state to manage here at all.

use std::sync::Arc;
use std::sync::atomic::AtomicU32;
use rquickjs::Ctx;
use tokio::runtime::Handle;

use crate::bindings::{CompletionQueue, RedrawRequest, SceneCommand, SceneQueue};
use crate::quickjs_runtime::QuickJsRuntime;

pub(crate) fn video_open<'js>(
    ctx: Ctx<'js>, url: String, next_id: Arc<AtomicU32>, scene: SceneQueue,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().video {
        return QuickJsRuntime::reject_now(&ctx, "Capability required: video — add it to glyx.config.json under \"capabilities\"".to_string());
    }
    let handle_id = next_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || {
            if glyx_media::get_media().is_none() {
                return Err("GlyxMediaNotAvailable: glyx-media DLL not loaded. \
                    Run `glyx runtime build` to download and cache the media DLL.".to_string());
            }
            scene.lock().push_back(SceneCommand::OpenVideo { handle_id, url });
            Ok(handle_id.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

pub(crate) fn video_seek(scene: &SceneQueue, handle_id: String, seconds: f64) {
    let handle_id = handle_id.parse().unwrap_or(0);
    scene.lock().push_back(SceneCommand::SeekVideo { handle_id, seconds });
}

pub(crate) fn video_set_volume(scene: &SceneQueue, handle_id: String, volume: f32) {
    let handle_id = handle_id.parse().unwrap_or(0);
    scene.lock().push_back(SceneCommand::SetVideoVolume { handle_id, volume });
}

pub(crate) fn video_close(scene: &SceneQueue, handle_id: String) {
    let handle_id = handle_id.parse().unwrap_or(0);
    scene.lock().push_back(SceneCommand::CloseVideo { handle_id });
}

pub(crate) fn video_pause(scene: &SceneQueue, handle_id: String) {
    let handle_id = handle_id.parse().unwrap_or(0);
    scene.lock().push_back(SceneCommand::PauseVideo { handle_id });
}

pub(crate) fn video_play(scene: &SceneQueue, handle_id: String) {
    let handle_id = handle_id.parse().unwrap_or(0);
    scene.lock().push_back(SceneCommand::ResumeVideo { handle_id });
}

pub(crate) fn video_poll(events: &crate::bindings::VideoEvents) -> String {
    let mut events = events.lock();
    if events.is_empty() { "[]".to_string() } else { format!("[{}]", events.drain(..).collect::<Vec<_>>().join(",")) }
}
