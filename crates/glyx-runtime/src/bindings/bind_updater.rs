use super::*;

// ── Update origin ──────────────────────────────────────────────────────────────
//
// Owner, repo and binary name come from `glyx.config.json`'s `updater` block,
// read once at startup into glyx-security's UpdateOrigin (see
// glyx_security::init_update_origin — same OnceLock pattern as app_version).
// JS cannot override them - callers only trigger check / apply; the trust
// chain is:
//
//   CI signs release binary with UPDATE_SIGNING_KEY (private, never committed)
//   → .sig sidecar uploaded alongside each GitHub Release asset
//   → glyx-verify::UPDATE_PUBKEY (embedded) verifies before applying
//
// Set in glyx.config: updater: { owner, repo, binName }

/// Fail fast at runtime if `glyx.config.json` has no `updater` block.
#[allow(dead_code)]
fn update_origin() -> Result<(String, String, String), String> {
    match glyx_security::update_origin() {
        Some(o) => Ok((o.owner.clone(), o.repo.clone(), o.bin_name.clone())),
        None => Err(
            "Update origin not configured. Set updater.owner, updater.repo, \
             and updater.binName in glyx.config.json.".to_string()
        ),
    }
}

// ── Pending-JS staging path ───────────────────────────────────────────────────

/// `~/.glyx/updates/<exe_stem>/pending.js`
#[cfg(feature = "updater")]
pub fn pending_js_staging_path() -> Option<std::path::PathBuf> {
    let exe  = std::env::current_exe().ok()?;
    let stem = exe.file_stem()?.to_string_lossy().into_owned();
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME")).ok()?;
    Some(std::path::PathBuf::from(home)
        .join(".glyx").join("updates").join(stem).join("pending.js"))
}

/// `.sig` sidecar path alongside the staged pending.js.
#[cfg(feature = "updater")]
fn pending_js_sig_path() -> Option<std::path::PathBuf> {
    pending_js_staging_path().map(|p| {
        let mut sig = p.clone();
        sig.set_extension("js.sig");
        sig
    })
}

// ── updater_check ─────────────────────────────────────────────────────────────

/// `__glyx_updater_check() → Promise<{ hasUpdate, latestVersion, body }>`
///
/// Checks the pinned GitHub repo (compiled in) for a newer release.
/// JS passes only the current version - it cannot choose the source.
#[cfg(feature = "updater")]
pub fn updater_check_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().updater {
        rv.set(reject_cap_promise(scope, "updater").into()); return;
    }

    let current = v8_arg_to_string(scope, &args, 0);

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let (owner, repo, _bin) = update_origin()?;
            let releases = self_update::backends::github::ReleaseList::configure()
                .repo_owner(&owner)
                .repo_name(&repo)
                .build().map_err(|e| e.to_string())?
                .fetch().map_err(|e| e.to_string())?;

            let latest     = releases.first();
            let has_update = latest.map(|r| {
                self_update::version::bump_is_greater(&current, &r.version)
                    .unwrap_or(false)
            }).unwrap_or(false);
            let latest_version = latest.map(|r| r.version.as_str()).unwrap_or(&current).to_string();
            let body = latest.and_then(|r| r.body.as_deref()).unwrap_or("").to_string();

            serde_json::to_string(&serde_json::json!({
                "hasUpdate":     has_update,
                "latestVersion": latest_version,
                "body":          body,
            })).map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── updater_update ────────────────────────────────────────────────────────────

/// `__glyx_updater_update(currentVersion) → Promise<{ updated, latestVersion }>`
///
/// Downloads the latest release binary + its `.sig` sidecar from the pinned
/// GitHub repo, verifies the Ed25519 signature against the embedded
/// `UPDATE_PUBKEY`, then replaces the running executable on success.
///
/// Rejects if no `.sig` asset is present or verification fails - a tampered
/// or unsigned binary is never applied.
#[cfg(feature = "updater")]
pub fn updater_update_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().updater {
        rv.set(reject_cap_promise(scope, "updater").into()); return;
    }

    let current = v8_arg_to_string(scope, &args, 0);

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let (owner, repo, bin_name) = update_origin()?;

            // 1. Fetch release list and find the latest upgrade.
            let releases = self_update::backends::github::ReleaseList::configure()
                .repo_owner(&owner)
                .repo_name(&repo)
                .build().map_err(|e| e.to_string())?
                .fetch().map_err(|e| e.to_string())?;

            let latest = match releases.first() {
                Some(r) => r,
                None    => return Err("no releases found".to_string()),
            };

            let has_update = self_update::version::bump_is_greater(&current, &latest.version)
                .unwrap_or(false);
            if !has_update {
                return serde_json::to_string(&serde_json::json!({
                    "updated": false, "latestVersion": latest.version,
                })).map_err(|e| e.to_string());
            }

            // 2. Find the binary asset and its .sig sidecar.
            let target_asset = format!("{bin_name}-{}", std::env::consts::OS);
            let bin_asset = latest.assets.iter()
                .find(|a| a.name.contains(&target_asset))
                .ok_or_else(|| format!("no asset matching '{target_asset}' in release"))?;
            let sig_asset_name = format!("{}.sig", bin_asset.name);
            let sig_asset = latest.assets.iter()
                .find(|a| a.name == sig_asset_name)
                .ok_or_else(|| format!("no .sig sidecar '{sig_asset_name}' - unsigned release rejected"))?;

            // 3. Download binary + sig to temp files.
            let tmp_dir  = std::env::temp_dir();
            let tmp_bin  = tmp_dir.join(format!("glyx_update_{}.bin", std::process::id()));
            let tmp_sig  = tmp_dir.join(format!("glyx_update_{}.sig", std::process::id()));

            {
                let mut f = std::fs::File::create(&tmp_bin)
                    .map_err(|e| format!("create tmp bin: {e}"))?;
                self_update::Download::from_url(&bin_asset.download_url)
                    .show_progress(false)
                    .download_to(&mut f)
                    .map_err(|e| format!("download failed: {e}"))?;
            }
            {
                let mut f = std::fs::File::create(&tmp_sig)
                    .map_err(|e| format!("create tmp sig: {e}"))?;
                self_update::Download::from_url(&sig_asset.download_url)
                    .show_progress(false)
                    .download_to(&mut f)
                    .map_err(|e| format!("sig download failed: {e}"))?;
            }

            // 4. Verify signature before touching the running exe.
            let verify_result = glyx_verify::verify_signed_file(
                &tmp_bin, &tmp_sig, &glyx_verify::UPDATE_PUBKEY,
            );
            // Clean up temp sig regardless.
            let _ = std::fs::remove_file(&tmp_sig);

            if let Err(e) = verify_result {
                let _ = std::fs::remove_file(&tmp_bin);
                return Err(format!("signature verification failed - update rejected: {e}"));
            }
            log::info!("[updater] signature verified for {}", bin_asset.name);

            // 5. Replace the running executable.
            let current_exe = std::env::current_exe()
                .map_err(|e| format!("could not locate current exe: {e}"))?;
            self_update::Move::from_source(&tmp_bin)
                .replace_using_temp(&tmp_dir.join("_glyx_replace_tmp"))
                .to_dest(&current_exe)
                .map_err(|e| format!("exe replace failed: {e}"))?;

            serde_json::to_string(&serde_json::json!({
                "updated": true, "latestVersion": latest.version,
            })).map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── updater_get_version ───────────────────────────────────────────────────────

/// `__glyx_updater_get_version() → string`
#[cfg(feature = "updater")]
pub fn updater_get_version_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    _args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let v = v8::String::new(scope, glyx_security::app_version()).unwrap();
    rv.set(v.into());
}

// ── updater_check_manifest ────────────────────────────────────────────────────

/// `__glyx_updater_check_manifest(url, currentVersion) → Promise<manifest_json | "null">`
///
/// Fetches a JSON manifest and checks if an update is available for this
/// platform.  The manifest must include `js_sig` (hex Ed25519) for JS-only
/// updates - without it `updater_download_js` will reject.
#[cfg(feature = "updater")]
pub fn updater_check_manifest_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().updater {
        rv.set(reject_cap_promise(scope, "updater").into()); return;
    }

    let url     = v8_arg_to_string(scope, &args, 0);
    let current = v8_arg_to_string(scope, &args, 1);

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
            if !resp.status().is_success() {
                return Err(format!("manifest fetch failed: HTTP {}", resp.status()));
            }
            let mut manifest: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

            let latest = manifest["version"].as_str().unwrap_or("0.0.0");
            let has_update = self_update::version::bump_is_greater(&current, latest)
                .unwrap_or(false);
            if !has_update { return Ok("null".to_string()); }

            let current_os = std::env::consts::OS;
            if let Some(platforms) = manifest["platforms"].as_array() {
                let supported = platforms.iter()
                    .any(|p| p.as_str().map(|s| s == current_os).unwrap_or(false));
                if !supported { return Ok("null".to_string()); }
            }

            if let Some(obj) = manifest.as_object_mut() {
                obj.insert("_platform".to_string(), serde_json::Value::String(current_os.to_string()));
            }

            serde_json::to_string(&manifest).map_err(|e| e.to_string())
        }.await;
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── updater_download_js ───────────────────────────────────────────────────────

/// `__glyx_updater_download_js(url, js_sig_hex) → Promise<void>`
///
/// Downloads a JS bundle, verifies its Ed25519 signature (hex-encoded, over
/// the raw bundle bytes) against the embedded `UPDATE_PUBKEY`, then stages
/// it as `pending.js` + `pending.js.sig`.
///
/// Both files are written atomically: if verification fails, neither file is
/// written and the existing staged update (if any) is untouched.
///
/// The `""` shortcut that previously skipped verification has been removed.
/// A valid `js_sig_hex` is always required.
#[cfg(feature = "updater")]
pub fn updater_download_js_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().updater {
        rv.set(reject_cap_promise(scope, "updater").into()); return;
    }

    let url        = v8_arg_to_string(scope, &args, 0);
    let sig_hex    = v8_arg_to_string(scope, &args, 1);

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            // Decode the hex signature before downloading anything.
            if sig_hex.is_empty() {
                return Err("js_sig_hex is required - unsigned JS updates are not allowed".to_string());
            }
            let sig_bytes = hex::decode(&sig_hex)
                .map_err(|e| format!("invalid js_sig_hex: {e}"))?;

            let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
            if !resp.status().is_success() {
                return Err(format!("JS bundle fetch failed: HTTP {}", resp.status()));
            }
            let bytes = resp.bytes().await.map_err(|e| e.to_string())?;

            // Verify signature BEFORE writing anything to disk.
            glyx_verify::verify_ed25519(&glyx_verify::UPDATE_PUBKEY, &bytes, &sig_bytes)
                .map_err(|e| format!("JS bundle signature invalid - update rejected: {e}"))?;

            let js = String::from_utf8(bytes.to_vec())
                .map_err(|e| format!("JS bundle is not valid UTF-8: {e}"))?;

            let staging = pending_js_staging_path()
                .ok_or_else(|| "could not determine staging path".to_string())?;
            let sig_path = pending_js_sig_path()
                .ok_or_else(|| "could not determine sig staging path".to_string())?;

            if let Some(parent) = staging.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            // Write JS first, then sig - runner checks for sig presence.
            std::fs::write(&staging, js.as_bytes()).map_err(|e| e.to_string())?;
            std::fs::write(&sig_path, &sig_bytes).map_err(|e| e.to_string())?;

            log::info!("[updater] JS update staged and verified at {}", staging.display());
            Ok("{}".to_string())
        }.await;
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── Crash reporter / other bindings ──────────────────────────────────────────

/// Returns the path where crash reports are written.
pub fn crash_reports_dir() -> std::path::PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    home.join(".glyx").join("crashes")
}

pub fn crash_report_js_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    if !glyx_security::get().crash {
        throw_cap_error(scope, "crash"); return;
    }
    let json = args.get(0).to_rust_string_lossy(scope);
    let dir  = crash_reports_dir();
    let _    = std::fs::create_dir_all(&dir);
    let ts   = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let path = dir.join(format!("js_{}.json", ts));
    let _    = std::fs::write(path, json.as_bytes());
}

pub fn crash_get_reports_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().crash {
        rv.set(reject_cap_promise(scope, "crash").into()); return;
    }

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let dir = crash_reports_dir();
            let _ = std::fs::create_dir_all(&dir);
            let mut reports = Vec::new();
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|e| e.to_str()) == Some("json") {
                        let file = path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string();
                        let content = std::fs::read_to_string(&path).unwrap_or_default();
                        reports.push(serde_json::json!({ "file": file, "content": content }));
                    }
                }
            }
            serde_json::to_string(&reports).map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

pub fn crash_clear_reports_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    _args: v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    if !glyx_security::get().crash {
        throw_cap_error(scope, "crash"); return;
    }
    let dir = crash_reports_dir();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                let _ = std::fs::remove_file(path);
            }
        }
    }
}

pub fn splash_hide_callback(
    _scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    state.scene.lock().push_back(SceneCommand::HideSplash);
}

pub fn backend_call_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let name      = v8_arg_to_string(scope, &args, 0);
    let args_json = v8_arg_to_string(scope, &args, 1);

    if let Some(global_fn) = state.js_backend_commands.get(&name) {
        let fn_local = v8::Local::new(scope, global_fn);
        let args_str = v8::String::new(scope, &args_json).unwrap_or_else(|| {
            v8::String::new(scope, "{}").unwrap()
        });
        let parsed_args = v8::json::parse(scope, args_str)
            .unwrap_or_else(|| v8::undefined(scope).into());
        let ctx = scope.get_current_context();
        let global = ctx.global(scope);
        let result = fn_local.call(scope, global.into(), &[parsed_args]);
        if let Some(ret) = result { rv.set(ret); }
        return;
    }

    // Checked here (not just once at plugin-load time) so a command
    // registered via `add_gated` enforces its required capabilities on
    // every call, the same way JS plugins are capability-gated.
    let dispatch = match state.backend_commands.get(&name) {
        Some(cmd) => match crate::command_capabilities_ok(cmd, glyx_security::get()) {
            Ok(())   => Ok(cmd.handler.clone()),
            Err(e)   => Err(format!("backend.{name}: {e}")),
        },
        None => Err(format!("backend.{name}: no such command registered")),
    };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    match dispatch {
        Ok(handler) => {
            state.tokio.spawn(async move {
                let result = handler(args_json).await;
                queue_clone.lock().push_back(Completion { resolver_ptr: resolver, result });
                if let Some(r) = redraw { r(); }
            });
        }
        Err(msg) => {
            queue_clone.lock().push_back(Completion { resolver_ptr: resolver, result: Err(msg) });
            if let Some(r) = redraw { r(); }
        }
    }
}
