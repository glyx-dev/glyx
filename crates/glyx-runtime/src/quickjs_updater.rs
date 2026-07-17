//! `__glyx_updater_*`/`__glyx_crash_*`/`__glyx_splash_hide` bindings, ported
//! from `bind_updater.rs`'s V8 implementation. `__glyx_backend_call` (also
//! defined in that file) is NOT ported here — it depends on the
//! extension/backend-command registry (`js_backend_commands`/`backend_commands`
//! on V8's `AsyncState`), which `QuickJsRuntime` doesn't have an equivalent
//! for yet (same structural gap as the missing IPC/multi-window/plugin
//! support noted elsewhere — `QuickJsRuntime::new()` has no
//! `register_extensions` counterpart to `V8Runtime::new_with_ipc`).

use rquickjs::Ctx;
use tokio::runtime::Handle;

use crate::bindings::{CompletionQueue, RedrawRequest, SceneCommand, SceneQueue};
use crate::quickjs_runtime::QuickJsRuntime;

fn cap_denied<'js>(ctx: &Ctx<'js>, cap: &str) -> rquickjs::Result<rquickjs::Promise<'js>> {
    QuickJsRuntime::reject_now(ctx, format!("Capability required: {cap} — add it to glyx.config.json under \"capabilities\""))
}

#[cfg(feature = "updater")]
#[allow(dead_code)]
const UPDATE_OWNER:    Option<&str> = option_env!("GLYX_UPDATE_OWNER");
#[cfg(feature = "updater")]
#[allow(dead_code)]
const UPDATE_REPO:     Option<&str> = option_env!("GLYX_UPDATE_REPO");
#[cfg(feature = "updater")]
#[allow(dead_code)]
const UPDATE_BIN_NAME: Option<&str> = option_env!("GLYX_UPDATE_BIN_NAME");

#[cfg(feature = "updater")]
fn update_origin() -> Result<(&'static str, &'static str, &'static str), String> {
    match (UPDATE_OWNER, UPDATE_REPO, UPDATE_BIN_NAME) {
        (Some(o), Some(r), Some(b)) => Ok((o, r, b)),
        _ => Err("Update origin not configured. Set updater.owner, updater.repo, \
             and updater.binName in glyx.config and rebuild.".to_string()),
    }
}

#[cfg(feature = "updater")]
fn pending_js_staging_path() -> Option<std::path::PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let stem = exe.file_stem()?.to_string_lossy().into_owned();
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).ok()?;
    Some(std::path::PathBuf::from(home).join(".glyx").join("updates").join(stem).join("pending.js"))
}

#[cfg(feature = "updater")]
fn pending_js_sig_path() -> Option<std::path::PathBuf> {
    pending_js_staging_path().map(|p| { let mut sig = p.clone(); sig.set_extension("js.sig"); sig })
}

#[cfg(feature = "updater")]
pub(crate) fn updater_check<'js>(
    ctx: Ctx<'js>, current: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().updater { return cap_denied(&ctx, "updater"); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || -> Result<String, String> {
            let (owner, repo, _bin) = update_origin()?;
            let releases = self_update::backends::github::ReleaseList::configure()
                .repo_owner(owner).repo_name(repo)
                .build().map_err(|e| e.to_string())?
                .fetch().map_err(|e| e.to_string())?;
            let latest = releases.first();
            let has_update = latest.map(|r| self_update::version::bump_is_greater(&current, &r.version).unwrap_or(false)).unwrap_or(false);
            let latest_version = latest.map(|r| r.version.as_str()).unwrap_or(&current).to_string();
            let body = latest.and_then(|r| r.body.as_deref()).unwrap_or("").to_string();
            serde_json::to_string(&serde_json::json!({ "hasUpdate": has_update, "latestVersion": latest_version, "body": body }))
                .map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

#[cfg(feature = "updater")]
pub(crate) fn updater_update<'js>(
    ctx: Ctx<'js>, current: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().updater { return cap_denied(&ctx, "updater"); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || -> Result<String, String> {
            let (owner, repo, bin_name) = update_origin()?;
            let releases = self_update::backends::github::ReleaseList::configure()
                .repo_owner(owner).repo_name(repo)
                .build().map_err(|e| e.to_string())?
                .fetch().map_err(|e| e.to_string())?;
            let latest = releases.first().ok_or_else(|| "no releases found".to_string())?;
            let has_update = self_update::version::bump_is_greater(&current, &latest.version).unwrap_or(false);
            if !has_update {
                return serde_json::to_string(&serde_json::json!({ "updated": false, "latestVersion": latest.version }))
                    .map_err(|e| e.to_string());
            }
            let target_asset = format!("{bin_name}-{}", std::env::consts::OS);
            let bin_asset = latest.assets.iter().find(|a| a.name.contains(&target_asset))
                .ok_or_else(|| format!("no asset matching '{target_asset}' in release"))?;
            let sig_asset_name = format!("{}.sig", bin_asset.name);
            let sig_asset = latest.assets.iter().find(|a| a.name == sig_asset_name)
                .ok_or_else(|| format!("no .sig sidecar '{sig_asset_name}' - unsigned release rejected"))?;

            let tmp_dir = std::env::temp_dir();
            let tmp_bin = tmp_dir.join(format!("glyx_update_{}.bin", std::process::id()));
            let tmp_sig = tmp_dir.join(format!("glyx_update_{}.sig", std::process::id()));
            {
                let mut f = std::fs::File::create(&tmp_bin).map_err(|e| format!("create tmp bin: {e}"))?;
                self_update::Download::from_url(&bin_asset.download_url).show_progress(false).download_to(&mut f)
                    .map_err(|e| format!("download failed: {e}"))?;
            }
            {
                let mut f = std::fs::File::create(&tmp_sig).map_err(|e| format!("create tmp sig: {e}"))?;
                self_update::Download::from_url(&sig_asset.download_url).show_progress(false).download_to(&mut f)
                    .map_err(|e| format!("sig download failed: {e}"))?;
            }

            let verify_result = glyx_verify::verify_signed_file(&tmp_bin, &tmp_sig, &glyx_verify::UPDATE_PUBKEY);
            let _ = std::fs::remove_file(&tmp_sig);
            if let Err(e) = verify_result {
                let _ = std::fs::remove_file(&tmp_bin);
                return Err(format!("signature verification failed - update rejected: {e}"));
            }
            log::info!("[updater] signature verified for {}", bin_asset.name);

            let current_exe = std::env::current_exe().map_err(|e| format!("could not locate current exe: {e}"))?;
            self_update::Move::from_source(&tmp_bin)
                .replace_using_temp(&tmp_dir.join("_glyx_replace_tmp"))
                .to_dest(&current_exe).map_err(|e| format!("exe replace failed: {e}"))?;

            serde_json::to_string(&serde_json::json!({ "updated": true, "latestVersion": latest.version }))
                .map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

#[cfg(feature = "updater")]
pub(crate) fn updater_get_version() -> String {
    glyx_security::app_version().to_string()
}

#[cfg(feature = "updater")]
pub(crate) fn updater_check_manifest<'js>(
    ctx: Ctx<'js>, url: String, current: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().updater { return cap_denied(&ctx, "updater"); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() { return Err(format!("manifest fetch failed: HTTP {}", resp.status())); }
        let mut manifest: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let latest = manifest["version"].as_str().unwrap_or("0.0.0");
        let has_update = self_update::version::bump_is_greater(&current, latest).unwrap_or(false);
        if !has_update { return Ok("null".to_string()); }
        let current_os = std::env::consts::OS;
        if let Some(platforms) = manifest["platforms"].as_array() {
            let supported = platforms.iter().any(|p| p.as_str().map(|s| s == current_os).unwrap_or(false));
            if !supported { return Ok("null".to_string()); }
        }
        if let Some(obj) = manifest.as_object_mut() {
            obj.insert("_platform".to_string(), serde_json::Value::String(current_os.to_string()));
        }
        serde_json::to_string(&manifest).map_err(|e| e.to_string())
    })
}

#[cfg(feature = "updater")]
pub(crate) fn updater_download_js<'js>(
    ctx: Ctx<'js>, url: String, sig_hex: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().updater { return cap_denied(&ctx, "updater"); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        if sig_hex.is_empty() { return Err("js_sig_hex is required - unsigned JS updates are not allowed".to_string()); }
        let sig_bytes = hex::decode(&sig_hex).map_err(|e| format!("invalid js_sig_hex: {e}"))?;
        let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() { return Err(format!("JS bundle fetch failed: HTTP {}", resp.status())); }
        let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
        glyx_verify::verify_ed25519(&glyx_verify::UPDATE_PUBKEY, &bytes, &sig_bytes)
            .map_err(|e| format!("JS bundle signature invalid - update rejected: {e}"))?;
        let js = String::from_utf8(bytes.to_vec()).map_err(|e| format!("JS bundle is not valid UTF-8: {e}"))?;
        let staging = pending_js_staging_path().ok_or_else(|| "could not determine staging path".to_string())?;
        let sig_path = pending_js_sig_path().ok_or_else(|| "could not determine sig staging path".to_string())?;
        if let Some(parent) = staging.parent() { std::fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
        std::fs::write(&staging, js.as_bytes()).map_err(|e| e.to_string())?;
        std::fs::write(&sig_path, &sig_bytes).map_err(|e| e.to_string())?;
        log::info!("[updater] JS update staged and verified at {}", staging.display());
        Ok("{}".to_string())
    })
}

fn crash_reports_dir() -> std::path::PathBuf {
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME"))
        .map(std::path::PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
    home.join(".glyx").join("crashes")
}

pub(crate) fn crash_report_js(ctx: Ctx<'_>, json: String) -> rquickjs::Result<()> {
    if !glyx_security::get().crash {
        return Err(rquickjs::Exception::throw_message(&ctx, "Capability required: crash"));
    }
    let dir = crash_reports_dir();
    let _ = std::fs::create_dir_all(&dir);
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis();
    let path = dir.join(format!("js_{ts}.json"));
    let _ = std::fs::write(path, json.as_bytes());
    Ok(())
}

pub(crate) fn crash_get_reports<'js>(
    ctx: Ctx<'js>, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().crash { return cap_denied(&ctx, "crash"); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || -> Result<String, String> {
            let dir = crash_reports_dir();
            let _ = std::fs::create_dir_all(&dir);
            let mut reports = Vec::new();
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|e| e.to_str()) == Some("json") {
                        let file = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                        let content = std::fs::read_to_string(&path).unwrap_or_default();
                        reports.push(serde_json::json!({ "file": file, "content": content }));
                    }
                }
            }
            serde_json::to_string(&reports).map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

pub(crate) fn crash_clear_reports(ctx: Ctx<'_>) -> rquickjs::Result<()> {
    if !glyx_security::get().crash {
        return Err(rquickjs::Exception::throw_message(&ctx, "Capability required: crash"));
    }
    let dir = crash_reports_dir();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") { let _ = std::fs::remove_file(path); }
        }
    }
    Ok(())
}

pub(crate) fn splash_hide(scene: &SceneQueue) {
    scene.lock().push_back(SceneCommand::HideSplash);
}
