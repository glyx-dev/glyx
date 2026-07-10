use super::*;

#[cfg(feature = "updater")]
pub fn updater_check_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().updater {
        rv.set(reject_cap_promise(scope, "updater").into()); return;
    }

    let owner   = v8_arg_to_string(scope, &args, 0);
    let repo    = v8_arg_to_string(scope, &args, 1);
    let current = v8_arg_to_string(scope, &args, 2);

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let releases = self_update::backends::github::ReleaseList::configure()
                .repo_owner(&owner)
                .repo_name(&repo)
                .build().map_err(|e| e.to_string())?
                .fetch().map_err(|e| e.to_string())?;

            let latest = releases.first();
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

/// `__glyx_updater_update(owner, repo, binName, currentVersion) â†’ Promise<JSON>`
///
/// Downloads the latest GitHub release for this binary and replaces the running executable.
/// Returns `{ updated: bool, latestVersion: string }`.
/// The caller should prompt the user to restart.
#[cfg(feature = "updater")]
pub fn updater_update_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().updater {
        rv.set(reject_cap_promise(scope, "updater").into()); return;
    }

    let owner    = v8_arg_to_string(scope, &args, 0);
    let repo     = v8_arg_to_string(scope, &args, 1);
    let bin_name = v8_arg_to_string(scope, &args, 2);
    let current  = v8_arg_to_string(scope, &args, 3);

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let status = self_update::backends::github::Update::configure()
                .repo_owner(&owner)
                .repo_name(&repo)
                .bin_name(&bin_name)
                .show_output(false)
                .no_confirm(true)
                .current_version(&current)
                .build().map_err(|e| e.to_string())?
                .update().map_err(|e| e.to_string())?;

            serde_json::to_string(&serde_json::json!({
                "updated":       status.updated(),
                "latestVersion": status.version(),
            })).map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// Returns the staging path for a pending JS-only update.
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

/// `__glyx_updater_get_version() â†’ string`
///
/// Returns the app version declared in `glyx.config.json` (`version` field),
/// or `"0.0.0"` if not set.
#[cfg(feature = "updater")]
pub fn updater_get_version_callback(
    scope: &mut v8::HandleScope,
    _args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let v = v8::String::new(scope, glyx_security::app_version()).unwrap();
    rv.set(v.into());
}

/// `__glyx_updater_check_manifest(url, currentVersion) â†’ Promise<manifest_json | "null">`
///
/// Fetches a JSON manifest from `url`, then:
/// 1. Compares `manifest.version` against `currentVersion` â€” returns `"null"` if up to date.
/// 2. Checks `manifest.platforms` (optional string array) â€” returns `"null"` if the current
///    OS is not listed.
/// 3. Injects `"_platform"` into the returned object so JS can pick platform-specific asset
///    URLs (e.g. `manifest[manifest._platform].runner_url`).
///
/// Platform values match Rust's `std::env::consts::OS`: `"windows"`, `"macos"`, `"linux"`.
///
/// Manifest shape:
/// ```json
/// {
///   "version":     "2.1.0",
///   "update_type": "js_only",              // "js_only" | "runner" | "full"
///   "platforms":   ["windows", "macos"],   // omit = applies to all platforms
///   "notes":       "Bug fixes",
///   "js_url":      "https://cdn.example.com/2.1.0/app.js",
///   "js_sha256":   "abc123...",
///   "windows": {
///     "runner_url":    "https://cdn.example.com/2.1.0/myapp-windows.zip",
///     "runner_sha256": "def..."
///   },
///   "macos": {
///     "runner_url":    "https://cdn.example.com/2.1.0/myapp-macos.tar.gz",
///     "runner_sha256": "ghi..."
///   }
/// }
/// ```
#[cfg(feature = "updater")]
pub fn updater_check_manifest_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
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

            // Version check.
            let latest = manifest["version"].as_str().unwrap_or("0.0.0");
            let has_update = self_update::version::bump_is_greater(&current, latest)
                .unwrap_or(false);
            if !has_update {
                return Ok("null".to_string());
            }

            // Platform filter: if manifest specifies platforms, skip if ours isn't listed.
            let current_os = std::env::consts::OS; // "windows" | "macos" | "linux" | ...
            if let Some(platforms) = manifest["platforms"].as_array() {
                let supported = platforms.iter()
                    .any(|p| p.as_str().map(|s| s == current_os).unwrap_or(false));
                if !supported {
                    return Ok("null".to_string());
                }
            }

            // Inject current platform so JS can resolve platform-specific asset URLs.
            if let Some(obj) = manifest.as_object_mut() {
                obj.insert("_platform".to_string(), serde_json::Value::String(current_os.to_string()));
            }

            serde_json::to_string(&manifest).map_err(|e| e.to_string())
        }.await;
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_updater_download_js(url, sha256) â†’ Promise<void>`
///
/// Downloads a JS bundle from `url`, verifies its SHA-256 hex digest against
/// `sha256` (pass `""` to skip verification), and writes it to the staging
/// location `~/.glyx/updates/<exe_stem>/pending.js`.
///
/// On the next restart, `glyx-runner` automatically loads this file instead of
/// the bundled JS from the binary trailer, completing the JS-only update.
#[cfg(feature = "updater")]
pub fn updater_download_js_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().updater {
        rv.set(reject_cap_promise(scope, "updater").into()); return;
    }

    let url    = v8_arg_to_string(scope, &args, 0);
    let sha256 = v8_arg_to_string(scope, &args, 1);

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            use sha2::{Sha256, Digest};

            let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
            if !resp.status().is_success() {
                return Err(format!("JS bundle fetch failed: HTTP {}", resp.status()));
            }
            let bytes = resp.bytes().await.map_err(|e| e.to_string())?;

            // Verify SHA-256 if a digest was supplied.
            if !sha256.is_empty() {
                let mut hasher = Sha256::new();
                hasher.update(&bytes);
                let computed = format!("{:x}", hasher.finalize());
                if computed != sha256.to_lowercase() {
                    return Err(format!(
                        "SHA-256 mismatch: expected {sha256}, got {computed}"
                    ));
                }
            }

            let js = String::from_utf8(bytes.to_vec())
                .map_err(|e| format!("JS bundle is not valid UTF-8: {e}"))?;

            let staging = pending_js_staging_path()
                .ok_or_else(|| "could not determine staging path".to_string())?;

            if let Some(parent) = staging.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            std::fs::write(&staging, &js).map_err(|e| e.to_string())?;

            log::info!("[updater] JS update staged at {}", staging.display());
            Ok("{}".to_string())
        }.await;
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// â”€â”€ Video player bindings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// `__glyx_video_open(url) â†’ Promise<handleId: string>`
///
/// Opens a video file or URL for playback. glyx-core spawns a decode thread via
/// the glyx-media DLL. Gracefully degrades: if the DLL is unavailable the promise
/// rejects with `"GlyxMediaNotAvailable"`.
/// Requires `video: true` in glyx.config.json.
pub fn crash_reports_dir() -> std::path::PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    home.join(".glyx").join("crashes")
}

// â”€â”€ Crash reporter bindings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// `__glyx_crash_report_js(json)` â€” sync void.
///
/// Writes a JS-side crash report (from `onerror` / `unhandledrejection`) to disk.
/// Capability-gated: requires `crash: true` in glyx.config.json.
pub fn crash_report_js_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
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

/// `__glyx_crash_get_reports() â†’ Promise<JSON>`
///
/// Returns an array of crash reports: `[{ file, content }]`.
/// Reads all `*.json` files from the crash directory.
pub fn crash_get_reports_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
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

/// `__glyx_crash_clear_reports()` â€” sync void.
///
/// Deletes all crash dump files from the crash directory.
pub fn crash_clear_reports_callback(
    scope: &mut v8::HandleScope,
    _args: v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
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

// â”€â”€ Splash screen binding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// `__glyx_splash_hide()` â€” sync void.
///
/// Signals glyx-core to hide the splash screen overlay (if one is configured).
/// The splash is hidden immediately unless `minimumMs` has not yet elapsed,
/// in which case it is hidden as soon as the minimum display time expires.
pub fn splash_hide_callback(
    _scope: &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    state.scene.lock().push_back(SceneCommand::HideSplash);
}

// â”€â”€ Backend command dispatch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// JS: `await __glyx_backend_call(name, argsJson)` â†’ Promise<resultJson>
//
// Looks up `name` in the BackendRegistry and dispatches to the registered async
// handler.  Returns a rejected Promise (not a thrown error) for unknown commands
// so the JS caller can handle the rejection with a normal `.catch()`.

pub fn backend_call_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let name      = v8_arg_to_string(scope, &args, 0);
    let args_json = v8_arg_to_string(scope, &args, 1);

    // â”€â”€ JS plugin commands â€” called synchronously in V8, return their own Promise â”€â”€
    if let Some(global_fn) = state.js_backend_commands.get(&name) {
        let fn_local = v8::Local::new(scope, global_fn);
        // Parse the JSON args string into a JS value so the plugin receives an object.
        let args_str = v8::String::new(scope, &args_json).unwrap_or_else(|| {
            v8::String::new(scope, "{}").unwrap()
        });
        let parsed_args = v8::json::parse(scope, args_str)
            .unwrap_or_else(|| v8::undefined(scope).into());
        let ctx = scope.get_current_context();
        let global = ctx.global(scope);
        let result = fn_local.call(scope, global.into(), &[parsed_args]);
        if let Some(ret) = result {
            rv.set(ret);
        }
        return;
    }

    // â”€â”€ Rust async commands â€” dispatched via Tokio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let handler = state.backend_commands.get(&name).cloned();

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    if let Some(handler) = handler {
        state.tokio.spawn(async move {
            let result = handler(args_json).await;
            queue_clone.lock().push_back(Completion { resolver_ptr: resolver, result });
            if let Some(r) = redraw { r(); }
        });
    } else {
        // Unknown command â€” reject immediately.
        let msg = format!("backend.{name}: no such command registered");
        queue_clone.lock().push_back(Completion {
            resolver_ptr: resolver,
            result: Err(msg),
        });
        if let Some(r) = redraw { r(); }
    }
}
