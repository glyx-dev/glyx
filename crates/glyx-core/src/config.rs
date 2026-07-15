/// Config loading and startup utilities for glyx-core.

use std::path::PathBuf;
use std::time::{Duration, Instant};

use glyx_renderer::peniko;
use glyx_runtime::JsPlugin;
use glyx_security::Capabilities;

use crate::{DevModeConfig, WindowConfig, SplashState, StartupMode, RenderMode};
use glyx_gpu::GpuTier;
use glyx_renderer::{BackendKind};

// ── Config JSON structs ───────────────────────────────────────────────────────

/// Splash screen configuration from `glyx.config.json`.
#[derive(serde::Deserialize, Default)]
pub(super) struct SplashCfgJson {
    pub(super) image:       Option<String>,
    pub(super) background:  Option<String>,
    #[serde(rename = "minimumMs", default)]
    pub(super) minimum_ms:  u64,
}

/// A single JS plugin entry from `glyx.config.json`.
#[derive(serde::Deserialize, Default)]
pub(super) struct PluginConfigJson {
    pub(super) entry: String,
    pub(super) name:  Option<String>,
    #[serde(default)]
    pub(super) capabilities: Vec<String>,
}

#[derive(serde::Deserialize, Default)]
pub(super) struct GlyxConfigFile {
    pub(super) version:      Option<String>,
    pub(super) window:       Option<WindowCfgJson>,
    pub(super) capabilities: Option<Capabilities>,
    pub(super) icon:         Option<String>,
    pub(super) splash:       Option<SplashCfgJson>,
    #[serde(default)]
    pub(super) plugins:      Vec<PluginConfigJson>,
    pub(super) canvas:       Option<CanvasCfgJson>,
    /// ICU locale set for `Intl.*` / `.toLocaleString()`. Defaults to `["en"]`
    /// when omitted or empty.
    #[serde(default)]
    pub(super) locales:      Option<Vec<String>>,
}

/// Canvas2D transport settings from `glyx.config.json`.
#[derive(serde::Deserialize, Default)]
pub(super) struct CanvasCfgJson {
    pub(super) protocol:  Option<String>,
    #[serde(rename = "bufferKB")]
    pub(super) buffer_kb: Option<u32>,
}

/// Window settings from `glyx.config.json`.
#[derive(serde::Deserialize)]
pub(super) struct WindowCfgJson {
    pub(super) title:        Option<String>,
    pub(super) width:        Option<u32>,
    pub(super) height:       Option<u32>,
    #[serde(rename = "startupMode")]
    pub(super) startup_mode: Option<String>,
    pub(super) decorations:  Option<bool>,
    pub(super) background:   Option<String>,
    #[serde(rename = "renderMode")]
    pub(super) render_mode:  Option<String>,
    #[serde(rename = "maxJsHeapMb")]
    pub(super) max_js_heap_mb: Option<u32>,
    /// When true, `glyxWindow.create` with a title matching an open window
    /// focuses that window instead of opening a twin.  Per-call
    /// `allowDuplicate: true` or an explicit `key` override this.
    #[serde(rename = "preventDuplicateWindows")]
    pub(super) prevent_duplicate_windows: Option<bool>,
}

// ── Functions ─────────────────────────────────────────────────────────────────

/// Read the project config as a JSON string.
pub(super) fn read_config_json() -> Option<String> {
    // 1. Embedded at build time (snapshot / prod runner with appended payload).
    if let Some(embedded) = super::EMBEDDED_CONFIG {
        return Some(embedded.to_string());
    }

    // 2. Pre-resolved by the CLI and passed via env var — avoids the runner
    //    needing to re-run the config script with a hardcoded PM (bun).
    //    glyx-cli resolves glyx.config.ts using the detected package manager
    //    and sets this before spawning the runner.
    if let Ok(json) = std::env::var("GLYX_CONFIG_JSON") {
        let trimmed = json.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }

    // 3. Fallback: execute glyx.config.ts directly (standalone / native projects
    //    where the runner is launched without the CLI, e.g. cargo run).
    //    Uses `bun <file>` — NOT `bun run <file>` which triggers bun's server
    //    detection heuristic on default-exported objects.
    //    Falls back to `npx tsx` for non-bun environments.
    if std::path::Path::new("glyx.config.ts").exists() {
        let attempts: &[&[&str]] = &[
            &["bun", "glyx.config.ts"],
            &["npx", "tsx", "glyx.config.ts"],
        ];
        for args in attempts {
            let result = if cfg!(target_os = "windows") {
                let mut cmd = std::process::Command::new("cmd");
                cmd.arg("/C");
                for a in *args { cmd.arg(a); }
                cmd.output()
            } else {
                let mut cmd = std::process::Command::new(args[0]);
                for a in &args[1..] { cmd.arg(a); }
                cmd.output()
            };
            if let Ok(out) = result {
                if out.status.success() {
                    if let Ok(json) = String::from_utf8(out.stdout) {
                        let trimmed = json.trim().to_string();
                        if !trimmed.is_empty() {
                            return Some(trimmed);
                        }
                    }
                }
            }
        }
    }

    // 4. Plain JSON config (no TypeScript, no bundler needed).
    std::fs::read_to_string("glyx.config.json").ok()
}

/// Bundle a single plugin entry using bun.
pub(super) fn bundle_plugin(entry: &str, safe_name: &str) -> Option<String> {
    let global_name = format!("__glyx_plugin_{safe_name}");
    let tmp_out = std::env::temp_dir().join(format!("glyx_plugin_{safe_name}.js"));

    let run = |args: &[&str]| -> std::io::Result<std::process::Output> {
        #[cfg(target_os = "windows")]
        {
            match std::process::Command::new("bun").args(args).output() {
                Ok(o) => return Ok(o),
                Err(_) => {
                    let mut cmd = vec!["/C", "bun"];
                    cmd.extend_from_slice(args);
                    return std::process::Command::new("cmd").args(&cmd).output();
                }
            }
        }
        #[cfg(not(target_os = "windows"))]
        std::process::Command::new("bun").args(args).output()
    };

    let out_str = tmp_out.to_str()?;
    let bun_args = [
        "build", entry,
        "--outfile", out_str,
        "--target", "browser",
        "--format", "iife",
        "--global-name", &global_name,
    ];

    match run(&bun_args) {
        Ok(o) if o.status.success() => {
            match std::fs::read_to_string(&tmp_out) {
                Ok(js) => {
                    log::info!("[plugins] bundled '{entry}' → {global_name}");
                    let _ = std::fs::remove_file(&tmp_out);
                    Some(js)
                }
                Err(e) => {
                    log::error!("[plugins] could not read bundle for '{entry}': {e}");
                    None
                }
            }
        }
        Ok(o) => {
            let msg = String::from_utf8_lossy(&o.stderr);
            log::error!("[plugins] bun build failed for '{entry}': {msg}");
            None
        }
        Err(e) => {
            log::error!("[plugins] failed to run bun for '{entry}': {e}");
            None
        }
    }
}

/// All valid capability field names from `glyx_security::Capabilities`.
fn is_valid_cap_name(cap: &str) -> bool {
    matches!(cap,
        "fs" | "network" | "env" | "db" | "dialog" | "clipboard" | "notification"
        | "battery" | "usb" | "shell" | "mdns" | "system" | "power" | "storage"
        | "gamepads" | "globalShortcuts" | "credentials" | "audio" | "ai"
        | "camera" | "microphone" | "hid" | "updater" | "video" | "crash" | "deeplink"
        | "tray"
    )
}

/// Returns true if the app's capabilities include the named capability.
fn app_has_cap(caps: &glyx_security::Capabilities, cap: &str) -> bool {
    match cap {
        "fs"               => caps.fs.is_some(),
        "network"          => caps.network.is_some(),
        "env"              => caps.env.is_some(),
        "db"               => caps.db,
        "dialog"           => caps.dialog,
        "clipboard"        => caps.clipboard,
        "notification"     => caps.notification,
        "battery"          => caps.battery,
        "usb"              => caps.usb,
        "shell"            => caps.shell,
        "mdns"             => caps.mdns,
        "system"           => caps.system,
        "power"            => caps.power,
        "storage"          => caps.storage,
        "gamepads"         => caps.gamepads,
        "globalShortcuts"  => caps.global_shortcuts,
        "credentials"      => caps.credentials,
        "audio"            => caps.audio,
        "ai"               => caps.ai,
        "camera"           => caps.camera,
        "microphone"       => caps.microphone,
        "hid"              => caps.hid,
        "updater"          => caps.updater,
        "video"            => caps.video,
        "crash"            => caps.crash,
        "deeplink"         => caps.deeplink.is_some(),
        "tray"             => caps.tray,
        _                  => false,
    }
}

/// Map the `renderMode` config string to a `RenderMode`.
pub(super) fn parse_render_mode(s: &str) -> RenderMode {
    match s {
        "cpu"     => RenderMode::Cpu,
        "skia"    => RenderMode::TinySkia,
        "auto"    => RenderMode::Auto,
        _         => RenderMode::Gpu,
    }
}

/// Resolve the configured render mode + detected GPU tier to a concrete backend.
pub(super) fn resolve_backend(mode: RenderMode, tier: GpuTier, force_cpu: bool) -> BackendKind {
    match mode {
        RenderMode::Auto => {
            let tier = if force_cpu { GpuTier::None } else { tier };
            match tier {
                GpuTier::None | GpuTier::Integrated => BackendKind::TinySkia,
                GpuTier::DiscreteIntel | GpuTier::Discrete => BackendKind::Vello { use_cpu: false },
            }
        }
        RenderMode::Cpu      => BackendKind::Vello { use_cpu: true },
        RenderMode::Gpu      => BackendKind::Vello { use_cpu: force_cpu },
        RenderMode::TinySkia => BackendKind::TinySkia,
    }
}

/// Parse a glyx config JSON string, apply window overrides, and return capabilities + plugins.
pub(super) fn apply_config_json(json: &str, cfg: &mut WindowConfig) -> (Capabilities, Vec<JsPlugin>) {
    let file: Option<GlyxConfigFile> = serde_json::from_str::<GlyxConfigFile>(json)
        .map_err(|e| { log::error!("glyx config parse error: {e}"); e })
        .ok();

    if let Some(w) = file.as_ref().and_then(|f| f.window.as_ref()) {
        if let Some(t) = &w.title { cfg.title = t.clone(); }
        if let Some(d) = w.decorations { cfg.decorations = d; }
        if let Some(bg) = w.background.as_deref().and_then(parse_hex_color) {
            cfg.background_color = bg;
        }

        cfg.startup_mode = match w.startup_mode.as_deref() {
            Some("fullscreen") => StartupMode::Fullscreen,
            Some("maximized")  => StartupMode::Maximized,
            None if w.width.is_none() && w.height.is_none() => StartupMode::Maximized,
            _ => {
                if let Some(wd) = w.width  { cfg.width  = wd; }
                if let Some(ht) = w.height { cfg.height = ht; }
                StartupMode::Windowed
            }
        };

        if let Some(rm) = w.render_mode.as_deref() {
            cfg.render_mode = parse_render_mode(rm);
        }

        if let Some(mb) = w.max_js_heap_mb {
            cfg.max_js_heap_mb = Some(mb.clamp(16, 512));
        }

        if let Some(on) = w.prevent_duplicate_windows {
            glyx_runtime::set_prevent_duplicate_windows(on);
        }

        // ICU locale set for Intl.* / toLocaleString(). Keep the default (en)
        // unless the app explicitly lists one or more non-empty locales.
        if let Some(l) = file.as_ref().and_then(|f| f.locales.as_ref()) {
            if !l.is_empty() && l.iter().any(|s| !s.is_empty()) {
                cfg.locales = l.iter().filter(|s| !s.is_empty()).cloned().collect();
            }
        }
    }

    if let Some(c) = file.as_ref().and_then(|f| f.canvas.as_ref()) {
        cfg.canvas_protocol = match c.protocol.as_deref() {
            Some("json") => "json".into(),
            _            => "binary".into(),
        };
        cfg.canvas_buffer_kb = c.buffer_kb.map(|kb| kb.clamp(16, 4096));
    }

    if let Some(icon_path) = file.as_ref().and_then(|f| f.icon.as_ref()) {
        cfg.icon_rgba = load_icon_png(icon_path);
    } else {
        cfg.icon_rgba = load_icon_from_bytes(DEFAULT_ICON_BYTES);
    }

    let app_caps = file.as_ref().and_then(|f| f.capabilities.as_ref());

    let plugins = file.as_ref().map(|f| {
        f.plugins.iter().enumerate().filter_map(|(i, p)| {
            if p.entry.is_empty() { return None; }
            let safe = p.name.as_deref()
                .map(|n| n.replace(|c: char| !c.is_alphanumeric() && c != '_', "_"))
                .unwrap_or_else(|| format!("plugin{i}"));
            let global_name = format!("__glyx_plugin_{safe}");

            // Validate declared capability names and check against app capabilities.
            let declared_caps = &p.capabilities;
            for cap in declared_caps {
                if !is_valid_cap_name(cap) {
                    log::error!(
                        "[plugins] plugin '{}' declares unknown capability '{}'. \
                         Valid names: fs, network, env, db, dialog, clipboard, notification, \
                         battery, usb, shell, mdns, system, power, storage, gamepads, \
                         globalShortcuts, credentials, audio, ai, camera, microphone, \
                         hid, updater, video, crash, deeplink",
                        safe, cap
                    );
                    return None;
                }
                if let Some(caps) = app_caps {
                    if !app_has_cap(caps, cap) {
                        log::error!(
                            "[plugins] plugin '{}' declares capability '{}' \
                             but the app does not enable it in glyx.config.json. \
                             Add it to 'capabilities' or remove it from the plugin declaration.",
                            safe, cap
                        );
                        return None;
                    }
                }
            }
            if !declared_caps.is_empty() {
                log::info!("[plugins] '{}' granted capabilities: {}", safe, declared_caps.join(", "));
            }

            // Hard-fail if bun bundling fails — a missing plugin is a startup error.
            let bundled_js = match bundle_plugin(&p.entry, &safe) {
                Some(js) => js,
                None => {
                    log::error!(
                        "[plugins] FATAL: failed to bundle plugin '{}' from '{}'. \
                         Ensure bun is on PATH and the entry file exists.",
                        safe, p.entry
                    );
                    return None;
                }
            };

            Some(JsPlugin {
                prefix: p.name.clone(),
                bundled_js,
                global_name,
                capabilities: declared_caps.clone(),
                entry: Some(p.entry.clone()),
            })
        }).collect::<Vec<_>>()
    }).unwrap_or_default();

    let version = file.as_ref()
        .and_then(|f| f.version.as_ref())
        .cloned()
        .unwrap_or_else(|| "0.0.0".to_string());
    glyx_security::init_version(version);

    let caps = file.and_then(|f| f.capabilities).unwrap_or_default();
    (caps, plugins)
}

/// Decode a PNG at `path` to raw RGBA bytes for use as a winit window icon.
pub(super) fn load_icon_png(path: &str) -> Option<(Vec<u8>, u32, u32)> {
    match image::open(path) {
        Ok(img) => {
            let rgba = img.into_rgba8();
            let (w, h) = rgba.dimensions();
            log::info!("[icon] loaded {path} ({w}×{h})");
            Some((rgba.into_raw(), w, h))
        }
        Err(e) => {
            log::warn!("[icon] failed to load '{path}': {e}");
            None
        }
    }
}

/// Decode PNG bytes to RGBA for a winit window icon.
pub(super) fn load_icon_from_bytes(bytes: &[u8]) -> Option<(Vec<u8>, u32, u32)> {
    use image::ImageReader;
    use std::io::Cursor;
    match ImageReader::new(Cursor::new(bytes)).with_guessed_format() {
        Ok(reader) => match reader.decode() {
            Ok(img) => {
                let rgba = img.into_rgba8();
                let (w, h) = rgba.dimensions();
                Some((rgba.into_raw(), w, h))
            }
            Err(_) => None,
        },
        Err(_) => None,
    }
}

/// Default Glyx icon embedded in all builds.
pub(super) static DEFAULT_ICON_BYTES: &[u8] = include_bytes!("../../../glyx.png");

/// Return the platform-specific directory for Glyx crash dumps.
pub(super) fn crash_reports_dir() -> std::path::PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    home.join(".glyx").join("crashes")
}

/// Install a Rust panic hook that writes a JSON crash dump to `~/.glyx/crashes/`.
pub(super) fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let dir = crash_reports_dir();
        let _ = std::fs::create_dir_all(&dir);
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let message: &str = info.payload()
            .downcast_ref::<&str>()
            .copied()
            .or_else(|| info.payload().downcast_ref::<String>().map(|s| s.as_str()))
            .unwrap_or("unknown panic");
        let file = info.location().map(|l| l.file()).unwrap_or("unknown");
        let line = info.location().map(|l| l.line()).unwrap_or(0);
        let json = format!(
            "{{\"type\":\"rust_panic\",\"timestamp\":{},\"message\":{},\"file\":{},\"line\":{}}}",
            ts,
            serde_json::to_string(message).unwrap_or_else(|_| "\"\"".to_string()),
            serde_json::to_string(file).unwrap_or_else(|_| "\"\"".to_string()),
            line,
        );
        let path = dir.join(format!("rust_{}.json", ts));
        let _ = std::fs::write(&path, json.as_bytes());
        log::error!("[crash] Rust panic: {message} at {file}:{line}");
    }));
}

/// Parse a `"#rrggbb"` or `"#rrggbbaa"` hex color string to RGBA bytes.
pub(super) fn parse_hex_color(s: &str) -> Option<[u8; 4]> {
    let s = s.trim_start_matches('#');
    let parse = |h: &str| u8::from_str_radix(h, 16).ok();
    match s.len() {
        6 => Some([parse(&s[0..2])?, parse(&s[2..4])?, parse(&s[4..6])?, 255]),
        8 => Some([parse(&s[0..2])?, parse(&s[2..4])?, parse(&s[4..6])?, parse(&s[6..8])?]),
        _ => None,
    }
}

/// Build a `SplashState` from the `"splash"` section of `glyx.config.json`.
pub(super) fn load_splash_state() -> Option<SplashState> {
    let json = read_config_json()?;
    let file: GlyxConfigFile = serde_json::from_str(&json).ok()?;
    let cfg = file.splash?;
    let now = Instant::now();
    let min_ms = cfg.minimum_ms;
    let min_until    = now + Duration::from_millis(min_ms);
    let auto_hide_at = now + Duration::from_millis(min_ms.max(30_000));

    let background = cfg.background.as_deref()
        .and_then(parse_hex_color)
        .unwrap_or([0, 0, 0, 255]);

    let img = cfg.image.as_ref().and_then(|path| {
        match image::open(path) {
            Ok(img) => {
                let rgba = img.into_rgba8();
                let (w, h) = rgba.dimensions();
                Some(peniko::ImageData {
                    data: peniko::Blob::from(rgba.into_raw()),
                    format: peniko::ImageFormat::Rgba8,
                    alpha_type: peniko::ImageAlphaType::Alpha,
                    width: w, height: h,
                })
            }
            Err(e) => { log::warn!("[splash] failed to load '{path}': {e}"); None }
        }
    });

    Some(SplashState { image: img, background, min_until, auto_hide_at, hidden: false })
}

/// Calculate a sensible V8 max-heap cap from the JS bundle size.
///
/// Dev mode gets a higher floor (32 MB) to absorb HMR double-eval churn.
/// Prod floor is 24 MB — enough headroom for the React + framework baseline
/// without squeezing small bundles into OOM territory.
pub(super) fn calc_heap_mb(bundle_bytes: usize, is_dev: bool) -> usize {
    const MB: usize = 1024 * 1024;
    let base = ((bundle_bytes * 12) / MB).max(24).min(256);
    if is_dev { base.max(32) } else { base }
}

/// Load the Glyx config from the current working directory.
pub(super) fn load_glyx_config(cfg: &mut WindowConfig) -> (Capabilities, Vec<JsPlugin>) {
    let json = match read_config_json() {
        Some(j) => j,
        None => {
            log::warn!(
                "glyx-security: no glyx.config.ts / glyx.config.json found or no capabilities declared \
                 — all capabilities default to OFF"
            );
            return (Capabilities::default(), vec![]);
        }
    };

    let (caps, plugins) = apply_config_json(&json, cfg);

    if caps.can_read_fs() || caps.db || caps.network.is_some() {
        log::info!(
            "glyx-security: capabilities loaded (fs_read={}, db={}, network_hosts={})",
            caps.can_read_fs(),
            caps.db,
            caps.network.as_ref().map(|n| n.allow.len()).unwrap_or(0),
        );
    } else {
        log::warn!(
            "glyx-security: no glyx.config.ts / glyx.config.json found or no capabilities declared \
             — all capabilities default to OFF"
        );
    }

    (caps, plugins)
}

/// Read `dev.output` from glyx.config.json and return its file contents.
pub(super) fn read_output_js() -> Option<String> {
    #[derive(serde::Deserialize)]
    struct Cfg { dev: Option<DevSection> }
    #[derive(serde::Deserialize)]
    struct DevSection { output: Option<String> }

    let cfg: Cfg = serde_json::from_str(&read_config_json()?).ok()?;
    let output = cfg.dev?.output.unwrap_or_else(|| "js/dist/app.js".to_string());
    match std::fs::read_to_string(&output) {
        Ok(js) => { log::info!("Loaded JS from {}", output); Some(js) }
        Err(e) => { log::warn!("Could not read JS from {}: {}", output, e); None }
    }
}

/// Build a DevModeConfig from glyx.config.json's `dev` section.
pub(super) fn build_dev_mode_config() -> Option<DevModeConfig> {
    #[derive(serde::Deserialize)]
    struct Cfg { dev: Option<DevSection> }
    #[derive(serde::Deserialize)]
    struct DevSection {
        entry:  Option<String>,
        output: Option<String>,
        watch:  Option<Vec<String>>,
    }

    let src = read_config_json()?;
    let cfg: Cfg = serde_json::from_str(&src).ok()?;
    let dev = cfg.dev?;
    let entry  = dev.entry?;
    let output = dev.output.unwrap_or_else(|| "dist/app.js".to_string());
    let watch  = dev.watch.unwrap_or_else(|| vec!["src".into()]);

    Some(DevModeConfig {
        project_root: PathBuf::from("."),
        entry_jsx:    PathBuf::from(&entry),
        output_js:    PathBuf::from(&output),
        watch_paths:  watch.iter().map(PathBuf::from).collect(),
    })
}

pub(super) fn embedded_snapshot_blob() -> Option<Vec<u8>> {
    super::EMBEDDED_SNAPSHOT.map(|blob| blob.to_vec())
}

/// Return the app JS embedded at build time via `GLYX_APP_JS` env var, if present.
pub(super) fn embedded_app_js() -> Option<String> {
    super::EMBEDDED_APP_JS.map(|s| s.to_string())
}
