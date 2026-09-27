/// Dev-mode worker, hot-reload event handling, and overlay drawing for glyx-core.

#[cfg(feature = "dev")]
use std::sync::mpsc::{self, Receiver, TryRecvError};
#[cfg(feature = "dev")]
use std::sync::Arc;
#[cfg(feature = "dev")]
use std::time::{Duration, Instant};

#[cfg(feature = "dev")]
use notify::{RecursiveMode, Watcher};
#[cfg(feature = "dev")]
use std::process::Command;

#[cfg(feature = "dev")]
use glyx_renderer::{peniko, AnyFrame};

#[cfg(feature = "dev")]
use crate::state::DevBuildEvent;
#[cfg(feature = "dev")]
use crate::state::PerWindowState;
#[cfg(feature = "dev")]
use crate::DevModeConfig;
#[cfg(feature = "dev")]
use crate::scene::apply_scene_commands;

#[cfg(feature = "dev")]
pub(super) fn dev_mode_config_from_env() -> Option<DevModeConfig> {
    use std::path::PathBuf;
    let root = std::env::var("GLYX_DEV_ROOT").ok()
        .map(PathBuf::from)
        .or_else(|| std::env::current_dir().ok())?;
    let entry_jsx = std::env::var("GLYX_DEV_ENTRY").ok().map(PathBuf::from)?;
    let output_js = std::env::var("GLYX_DEV_OUTPUT").ok().map(PathBuf::from)?;
    let watch_paths = std::env::var("GLYX_DEV_WATCH")
        .ok()
        .map(|v| v.split(';').filter(|s| !s.trim().is_empty()).map(PathBuf::from).collect::<Vec<_>>())
        .unwrap_or_default();
    if watch_paths.is_empty() {
        Some(DevModeConfig::from_entry(root, entry_jsx, output_js))
    } else {
        Some(DevModeConfig::new(root, entry_jsx, output_js, watch_paths))
    }
}

#[cfg(feature = "dev")]
pub(super) fn start_dev_mode_worker(
    redraw:  Arc<dyn Fn() + Send + Sync>,
    config:  Option<DevModeConfig>,
    plugins: glyx_runtime::JsPlugins,
) -> Option<Receiver<DevBuildEvent>> {
    let config = config.or_else(dev_mode_config_from_env)?;
    let cwd = if config.project_root.is_absolute() {
        config.project_root.clone()
    } else {
        std::env::current_dir().ok()?.join(config.project_root)
    };
    let app_jsx = if config.entry_jsx.is_absolute() {
        config.entry_jsx.clone()
    } else {
        cwd.join(config.entry_jsx)
    };
    let app_js = if config.output_js.is_absolute() {
        config.output_js.clone()
    } else {
        cwd.join(config.output_js)
    };
    if !app_jsx.exists() || app_js.as_os_str().is_empty() {
        return None;
    }

    let (out_tx, out_rx) = mpsc::channel::<DevBuildEvent>();
    let (watch_tx, watch_rx) = mpsc::channel::<()>();

    {
        let watch_tx = watch_tx.clone();
        std::thread::spawn(move || {
            use std::io::BufRead;
            for line in std::io::stdin().lock().lines().flatten() {
                if line.trim().eq_ignore_ascii_case("r") {
                    log::info!("[HMR] full reload triggered (R)");
                    let _ = watch_tx.send(());
                }
            }
        });
    }

    // Clone before the main watcher thread takes ownership.
    let out_tx_for_plugins = out_tx.clone();
    let redraw_for_plugins = Arc::clone(&redraw);

    std::thread::spawn(move || {
        let out_tx_watch = out_tx.clone();
        let app_js_for_filter = app_js.clone();
        let mut watcher = match notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            match res {
                Ok(event) => {
                    let is_output_file = event.paths.iter().any(|p| p == &app_js_for_filter);
                    if is_output_file {
                        return;
                    }
                    log::debug!("[HMR] file changed: {:?}", event.paths);
                    let _ = watch_tx.send(());
                }
                Err(e) => {
                    let _ = out_tx_watch.send(DevBuildEvent::BuildErr(e.to_string()));
                }
            }
        }) {
            Ok(w) => w,
            Err(e) => {
                let _ = out_tx.send(DevBuildEvent::BuildErr(e.to_string()));
                return;
            }
        };

        let watch_paths = if config.watch_paths.is_empty() {
            app_jsx.parent().map(|p| vec![p.to_path_buf()]).unwrap_or_default()
        } else {
            config.watch_paths.clone()
        };
        for p in &watch_paths {
            let wp = if p.is_absolute() { p.clone() } else { cwd.join(p) };
            if wp.exists() {
                log::info!("[HMR] watching {:?}", wp);
                let _ = watcher.watch(&wp, RecursiveMode::Recursive);
            } else {
                log::warn!("[HMR] watch path does not exist: {:?}", wp);
            }
        }
        log::info!("[HMR] ready — edit {:?} to hot-reload  (press R + Enter to force reload)", app_jsx);

        while watch_rx.recv().is_ok() {
            while watch_rx.recv_timeout(Duration::from_millis(180)).is_ok() {}
            log::info!("[HMR] change detected — rebuilding… (cwd={:?})", cwd);

            // Same React build `glyx dev` made: development with DevTools on.
            let node_env = if std::env::var_os("GLYX_DEVTOOLS_PORT").is_some() {
                "process.env.NODE_ENV='development'"
            } else {
                "process.env.NODE_ENV='production'"
            };
            let run_bun = |cwd: &std::path::Path| -> std::io::Result<std::process::Output> {
                let bun_args = [
                    "build",
                    app_jsx.to_str().unwrap_or(""),
                    "--outfile",
                    app_js.to_str().unwrap_or(""),
                    "--target",      "browser",
                    "--format",      "iife",
                    "--define",      node_env,
                    "--sourcemap=inline",
                ];
                #[cfg(target_os = "windows")]
                {
                    match Command::new("bun").args(&bun_args).current_dir(cwd).output() {
                        Ok(o) => return Ok(o),
                        Err(_) => {
                            let mut cmd_args = vec!["/C", "bun"];
                            cmd_args.extend_from_slice(&bun_args);
                            return Command::new("cmd").args(&cmd_args).current_dir(cwd).output();
                        }
                    }
                }
                #[cfg(not(target_os = "windows"))]
                Command::new("bun").args(&bun_args).current_dir(cwd).output()
            };

            match run_bun(&cwd) {
                Ok(out) if out.status.success() => {
                    match std::fs::read_to_string(&app_js) {
                        Ok(js) => {
                            log::info!("[HMR] build ok — reloading app");
                            let _ = out_tx.send(DevBuildEvent::BuildOk(js));
                        }
                        Err(e) => {
                            log::warn!("[HMR] build succeeded but could not read output: {e}");
                            let _ = out_tx.send(DevBuildEvent::BuildErr(e.to_string()));
                        }
                    }
                }
                Ok(out) => {
                    let mut msg = String::new();
                    if !out.stderr.is_empty() {
                        msg.push_str(&String::from_utf8_lossy(&out.stderr));
                    }
                    if !out.stdout.is_empty() {
                        if !msg.is_empty() { msg.push('\n'); }
                        msg.push_str(&String::from_utf8_lossy(&out.stdout));
                    }
                    if msg.is_empty() {
                        msg = format!("bun build failed (exit {:?})", out.status.code());
                    }
                    log::warn!("[HMR] build error: {msg}");
                    let _ = out_tx.send(DevBuildEvent::BuildErr(msg));
                }
                Err(e) => {
                    log::warn!("[HMR] failed to run bun: {e}  (is bun installed and in PATH?)");
                    let _ = out_tx.send(DevBuildEvent::BuildErr(e.to_string()));
                }
            }
            redraw();
        }
    });

    // ── Plugin file watchers ──────────────────────────────────────────────────
    //
    // For each plugin with a known source entry, watch the file and rebundle on change.
    for plugin in plugins.iter() {
        let entry = match &plugin.entry {
            Some(e) if !e.is_empty() => e.clone(),
            _ => continue,
        };
        let global_name  = plugin.global_name.clone();
        let prefix       = plugin.prefix.clone();
        let safe_name    = global_name.strip_prefix("__glyx_plugin_")
            .unwrap_or(&global_name).to_string();
        let entry_path   = std::path::Path::new(&entry);
        let abs_entry    = if entry_path.is_absolute() {
            entry_path.to_path_buf()
        } else {
            std::env::current_dir().unwrap_or_default().join(entry_path)
        };

        let out_tx2 = out_tx_for_plugins.clone();
        let redraw2 = Arc::clone(&redraw_for_plugins);

        std::thread::spawn(move || {
            let (change_tx, change_rx) = mpsc::channel::<()>();
            let change_tx2 = change_tx.clone();

            let mut watcher = match notify::recommended_watcher(
                move |res: notify::Result<notify::Event>| {
                    if res.is_ok() { let _ = change_tx2.send(()); }
                }
            ) {
                Ok(w)  => w,
                Err(e) => {
                    log::warn!("[plugin HMR] watcher error for '{}': {e}", safe_name);
                    return;
                }
            };

            let watch_path = if abs_entry.is_file() {
                abs_entry.parent().unwrap_or(&abs_entry).to_path_buf()
            } else {
                abs_entry.clone()
            };

            if let Err(e) = watcher.watch(&watch_path, RecursiveMode::NonRecursive) {
                log::warn!("[plugin HMR] could not watch '{}': {e}", safe_name);
                return;
            }
            log::info!("[plugin HMR] watching '{}'", abs_entry.display());

            while change_rx.recv().is_ok() {
                // Debounce — ignore rapid successive saves.
                while change_rx.recv_timeout(Duration::from_millis(180)).is_ok() {}
                log::info!("[plugin HMR] '{}' changed — rebundling", safe_name);

                let run_bun = || -> std::io::Result<std::process::Output> {
                    let entry_str = abs_entry.to_str().unwrap_or("");
                    let tmp = std::env::temp_dir().join(format!("glyx_plugin_{safe_name}.js"));
                    let tmp_str = tmp.to_str().unwrap_or("");
                    // Same fix as `config::bundle_plugin` — `--global-name` isn't a
                    // real `bun build` flag; bundle as CJS and wrap it ourselves
                    // (see `config::wrap_cjs_as_global`) instead.
                    let bun_args = [
                        "build", entry_str, "--outfile", tmp_str,
                        "--target", "browser", "--format", "cjs",
                    ];
                    #[cfg(target_os = "windows")]
                    {
                        match Command::new("bun").args(&bun_args).output() {
                            Ok(o) => return Ok(o),
                            Err(_) => {
                                let mut cmd = vec!["/C", "bun"];
                                cmd.extend_from_slice(&bun_args);
                                return Command::new("cmd").args(&cmd).output();
                            }
                        }
                    }
                    #[cfg(not(target_os = "windows"))]
                    Command::new("bun").args(&bun_args).output()
                };

                match run_bun() {
                    Ok(out) if out.status.success() => {
                        let tmp = std::env::temp_dir().join(format!("glyx_plugin_{safe_name}.js"));
                        match std::fs::read_to_string(&tmp) {
                            Ok(cjs) => {
                                let _ = std::fs::remove_file(&tmp);
                                let _ = out_tx2.send(DevBuildEvent::PluginReload {
                                    global_name: global_name.clone(),
                                    prefix:      prefix.clone(),
                                    bundled_js:  crate::config::wrap_cjs_as_global(&cjs, &global_name),
                                });
                                redraw2();
                            }
                            Err(e) => log::warn!("[plugin HMR] could not read bundle: {e}"),
                        }
                    }
                    Ok(out) => {
                        let msg = String::from_utf8_lossy(&out.stderr);
                        log::warn!("[plugin HMR] build error for '{}': {msg}", safe_name);
                    }
                    Err(e) => {
                        log::warn!("[plugin HMR] bun failed for '{}': {e}", safe_name);
                    }
                }
            }
        });
    }

    Some(out_rx)
}

#[cfg(feature = "dev")]
pub(super) fn handle_dev_build_events(state: &mut PerWindowState) {
    if state.dev_mode.is_none() { return; }
    loop {
        let event = state.dev_mode.as_mut().unwrap().rx.try_recv();
        match event {
            Ok(DevBuildEvent::BuildOk(js)) => {
                state.js_nodes.clear();
                state.js_root = None;
                state.images.clear();
                state.images_by_path.clear();
                state.image_cache_hits = 0;
                state.image_cache_misses = 0;
                state.label_cache.clear();
                state.resolved.clear();
                state.resolved_by_id.clear();
                state.z_order.clear();
                state.z_order_dirty.clear();
                state.layout = glyx_layout::LayoutTree::new();
                state.runtime.layout_cache().lock().clear();
                state.canvas_cmds.clear();
                #[cfg(feature = "canvas3d")]
                state.canvas3d_scenes.clear();
                #[cfg(feature = "canvas3d")]
                state.canvas3d_dirty.clear();
                let _ = state.runtime.drain_scene_commands();
                match state.runtime.eval(&crate::devtools::prepare_bundle(&js)) {
                    Ok(_) => {
                        state.runtime.flush_microtasks();
                        let reload_cmds = state.runtime.drain_scene_commands();
                        log::info!("[HMR] eval ok — {} scene commands", reload_cmds.len());
                        apply_scene_commands(state, reload_cmds);
                        state.layout_dirty = true;
                        if let Some(dev) = state.dev_mode.as_mut() {
                            dev.last_reload = Some(Instant::now());
                            dev.last_build_message = "reload ok".to_string();
                            dev.last_js_error = None;
                        }
                    }
                    Err(e) => {
                        log::warn!("[HMR] eval error: {e}");
                        if let Some(dev) = state.dev_mode.as_mut() {
                            dev.last_build_message = format!("reload error: {}", e);
                            dev.last_js_error = Some(format!("Eval error: {}", e));
                        }
                    }
                }
            }
            Ok(DevBuildEvent::BuildErr(msg)) => {
                if let Some(dev) = state.dev_mode.as_mut() {
                    dev.last_build_message = format!("build error: {}", msg);
                }
            }
            Ok(DevBuildEvent::PluginReload { global_name, prefix, bundled_js }) => {
                log::info!("[plugin HMR] reloading plugin '{}'", global_name);
                state.runtime.reload_plugin(&global_name, prefix.as_deref(), &bundled_js);
                if let Some(dev) = state.dev_mode.as_mut() {
                    dev.last_build_message = format!("plugin '{}' reloaded", global_name);
                }
            }
            Err(TryRecvError::Empty) | Err(TryRecvError::Disconnected) => break,
        }
    }
}

#[cfg(feature = "dev")]
pub(super) fn draw_dev_overlay(state: &mut PerWindowState, frame: &mut AnyFrame) {
    let Some(dev) = state.dev_mode.as_mut() else { return };
    if !dev.overlay_visible { return; }

    let verbose = dev.overlay_verbose;
    let now = Instant::now();

    if now >= dev.overlay_next_refresh || dev.overlay_lines.is_empty() {
        let perf_g = state.perf.lock();
        let fps    = perf_g.fps();
        let avg_ms = perf_g.avg_frame_time();
        let p99_ms = perf_g.p99_frame_time();
        let js_ms  = perf_g.avg_js_time();
        let lay_ms = perf_g.avg_layout_time();
        let gpu_ms = perf_g.avg_gpu_time();
        let last_f = perf_g.last_frame();
        let last_ms = last_f.frame_time_ms;
        let heap_used_mb  = last_f.heap_used_bytes  as f64 / (1024.0 * 1024.0);
        let heap_total_mb = last_f.heap_total_bytes  as f64 / (1024.0 * 1024.0);
        let rss_mb        = last_f.process_rss_bytes as f64 / (1024.0 * 1024.0);
        let gpu_buf_mb    = last_f.gpu_buffer_bytes    as f64 / (1024.0 * 1024.0);
        let gpu_tex_mb    = last_f.gpu_texture_bytes   as f64 / (1024.0 * 1024.0);
        let gpu_resv_mb   = last_f.gpu_reserved_bytes  as f64 / (1024.0 * 1024.0);
        let gpu_buf_n     = last_f.gpu_buffer_count;
        let gpu_tex_n     = last_f.gpu_texture_count;
        let avg_buf_mb    = if gpu_buf_n > 0 { gpu_buf_mb / gpu_buf_n as f64 } else { 0.0 };
        let gpu_waste_mb  = (gpu_resv_mb - gpu_buf_mb - gpu_tex_mb).max(0.0);
        let budget = perf_g.budget_ms;
        drop(perf_g);

        let start_rss_mb    = dev.startup_rss_bytes     as f64 / (1024.0 * 1024.0);
        let start_v8_mb     = dev.startup_v8_total_bytes as f64 / (1024.0 * 1024.0);
        let delta_rss_mb    = rss_mb - start_rss_mb;
        let native_mb       = (rss_mb - heap_total_mb).max(0.0);
        let native_start    = (start_rss_mb - start_v8_mb).max(0.0);
        let delta_native_mb = native_mb - native_start;
        let since = dev.last_reload
            .map(|t| now.saturating_duration_since(t).as_secs())
            .unwrap_or(0);
        let phys_w = state.gpu.width();
        let phys_h = state.gpu.height();

        dev.overlay_lines = vec![
            // line 0 — always shown (compact header)
            format!("{}×{}  {:.0}fps  {:.1}ms  RSS {:.0}MB  (Ctrl+Shift+D)",
                phys_w, phys_h, fps, last_ms, rss_mb),
            // line 1 — always shown
            format!("JS {:.2}ms  layout {:.2}ms  GPU {:.2}ms  nodes {}  P99 {:.1}ms",
                js_ms, lay_ms, gpu_ms, state.js_nodes.len(), p99_ms),
            // line 2 — always shown (build status)
            format!("{}  ({}s ago)", dev.last_build_message, since),
            // line 3+ — verbose only
            format!("avg {:.1}ms  budget {:.1}ms  V8 {:.1}/{:.1}MB",
                avg_ms, budget, heap_used_mb, heap_total_mb),
            format!("native {:.1}MB  \u{0394}RSS {:+.1}  \u{0394}nat {:+.1}",
                native_mb, delta_rss_mb, delta_native_mb),
            format!("wgpu  buf {:.1}MB×{}  avg {:.1}MB  tex {:.1}MB×{}  waste {:.1}MB",
                gpu_buf_mb, gpu_buf_n, avg_buf_mb, gpu_tex_mb, gpu_tex_n, gpu_waste_mb),
            format!("cache {} frags  img {}/{}  labels {}/256  canvas {}",
                state.scene_cache.len(),
                state.images.len(), state.images_by_path.len(),
                state.label_cache.len(),
                state.canvas_cmds.len()),
        ];
        dev.overlay_next_refresh = now + Duration::from_millis(250);
    }

    let (sparkline_data, budget) = {
        let perf_g = state.perf.lock();
        let data: Vec<_> = perf_g.ring.iter().copied().collect();
        let b = perf_g.budget_ms;
        drop(perf_g);
        (data, b)
    };

    let n_lines   = if verbose { 7 } else { 3 };
    let bar_count = if verbose { 60 } else { 20 };
    let bar_w     = if verbose { 2.0_f64 } else { 3.5_f64 };
    let spark_h   = 14.0_f64;
    let line_h    = 19.0_f64;
    let pad_top   = 10.0_f64;
    let pad_x     = 10.0_f64;

    let overlay_h = pad_top + n_lines as f64 * line_h + 6.0 + spark_h + 8.0;
    let overlay_w = if verbose { 530.0_f64 } else { 420.0_f64 };

    frame.fill_rounded_rect(16.0, 16.0, overlay_w, overlay_h, 7.0,
        peniko::Color::from_rgba8(12, 12, 20, 230));

    let txt_color = peniko::Color::from_rgba8(210, 210, 228, 255);
    let dim_color = peniko::Color::from_rgba8(130, 130, 160, 200);
    let mem_color = peniko::Color::from_rgba8(140, 210, 255, 255);

    let lines = &dev.overlay_lines;
    for i in 0..n_lines {
        let col = if verbose && (i == 4 || i == 5) { mem_color } else if i >= 3 { dim_color } else { txt_color };
        let text = state.text_sys.label(&lines[i], 11.5);
        frame.draw_text(&text, 16.0 + pad_x, 16.0 + pad_top + i as f64 * line_h, col);
    }

    // Sparkline strip
    let spark_x = 16.0 + pad_x;
    let spark_y = 16.0 + pad_top + n_lines as f64 * line_h + 4.0;
    let samples: Vec<f64> = sparkline_data.iter()
        .rev().take(bar_count).map(|f| f.frame_time_ms).collect::<Vec<_>>()
        .into_iter().rev().collect();
    for (i, &ms) in samples.iter().enumerate() {
        let h   = (ms / (budget * 2.0)).min(1.0) * spark_h;
        let x   = spark_x + i as f64 * bar_w;
        let y   = spark_y + (spark_h - h);
        let col = if ms > budget * 2.0 {
            peniko::Color::from_rgba8(255, 80,  80,  220)
        } else if ms > budget {
            peniko::Color::from_rgba8(255, 180, 50,  220)
        } else {
            peniko::Color::from_rgba8(80,  200, 120, 200)
        };
        frame.fill_rect(x, y, (bar_w - 0.5).max(1.0), h, col);
    }
}

/// `[x, y, w, h]` cut to the window on whole pixels; `None` when nothing is
/// left or a value isn't finite. Overlay rects come from layout / damage and
/// can extend past the window (scrolling, animations); tiny-skia's
/// anti-aliased thin-rect path asserts on some such inputs, so overlays only
/// ever draw clamped, whole-pixel rects.
#[cfg(feature = "dev")]
fn clamp_to_window([x, y, w, h]: [f64; 4], win_w: f64, win_h: f64) -> Option<[f64; 4]> {
    if ![x, y, w, h].iter().all(|v| v.is_finite()) { return None; }
    let x0 = x.max(0.0).floor();
    let y0 = y.max(0.0).floor();
    let x1 = (x + w).min(win_w).ceil();
    let y1 = (y + h).min(win_h).ceil();
    (x1 - x0 >= 1.0 && y1 - y0 >= 1.0).then_some([x0, y0, x1 - x0, y1 - y0])
}

/// A `t`-pixel outline inside `[x, y, w, h]` (whole pixels; thin rects
/// collapse to a fill).
#[cfg(feature = "dev")]
fn outline(frame: &mut AnyFrame, x: f64, y: f64, w: f64, h: f64, t: f64, color: peniko::Color) {
    if w <= t * 2.0 || h <= t * 2.0 {
        frame.fill_rect(x, y, w, h, color);
        return;
    }
    frame.fill_rect(x, y, w, t, color);
    frame.fill_rect(x, y + h - t, w, t, color);
    frame.fill_rect(x, y + t, t, h - t * 2.0, color);
    frame.fill_rect(x + w - t, y + t, t, h - t * 2.0, color);
}

/// Paint flashing: each redrawn area fades out over `FLASH_MS`. Keeps
/// requesting frames until the last flash is gone.
#[cfg(feature = "dev")]
fn draw_paint_flashes(state: &mut PerWindowState, frame: &mut AnyFrame) {
    const FLASH_MS: f64 = 400.0;
    if state.flashes.is_empty() { return; }
    let now = std::time::Instant::now();
    state.flashes.retain(|(_, at)| now.duration_since(*at).as_secs_f64() * 1000.0 < FLASH_MS);
    let (win_w, win_h) = (state.gpu.width() as f64, state.gpu.height() as f64);
    for (rect, at) in &state.flashes {
        let Some([x, y, w, h]) = clamp_to_window(*rect, win_w, win_h) else { continue };
        let fade = 1.0 - now.duration_since(*at).as_secs_f64() * 1000.0 / FLASH_MS;
        let a = |base: f64| (base * fade).clamp(0.0, 255.0) as u8;
        frame.fill_rect(x, y, w, h, peniko::Color::from_rgba8(245, 158, 11, a(55.0)));
        outline(frame, x, y, w, h, 2.0, peniko::Color::from_rgba8(245, 158, 11, a(220.0)));
    }
    if !state.flashes.is_empty() { (state.request_redraw)(); }
}

/// Devtools `Inspector.highlightNode`: a translucent fill, a 2 px outline
/// and a `Type #id  w×h` tag, like browser devtools' element highlight.
#[cfg(feature = "dev")]
pub(super) fn draw_devtools_highlight(state: &mut PerWindowState, frame: &mut AnyFrame) {
    draw_paint_flashes(state, frame);
    let Some(id) = state.devtools_highlight else { return };
    let Some(r) = state.runtime.layout_cache().lock().get(&id).copied() else { return };
    let (win_w, win_h) = (state.gpu.width() as f64, state.gpu.height() as f64);
    let Some([x, y, w, h]) = clamp_to_window([r[0] as f64, r[1] as f64, r[2] as f64, r[3] as f64], win_w, win_h) else { return };
    frame.fill_rect(x, y, w, h, peniko::Color::from_rgba8(76, 154, 255, 60));
    outline(frame, x, y, w, h, 2.0, peniko::Color::from_rgba8(76, 154, 255, 230));

    let kind = state.js_nodes.get(&id)
        .map(|n| crate::devtools_inspect::type_name(&n.node_type)).unwrap_or("Node");
    let tag = format!("{kind} #{id}  {}×{}", w.round(), h.round());
    let lbl = state.text_sys.label(&tag, 10.0);
    // Above the node, or inside its top edge when there's no room above.
    let tag_w = tag.chars().count() as f64 * 6.0 + 10.0;
    let ty = if y >= 18.0 { y - 18.0 } else { y + 2.0 };
    frame.fill_rect(x, ty, tag_w, 16.0, peniko::Color::from_rgba8(20, 40, 70, 235));
    frame.draw_text(&lbl, x + 5.0, ty + 2.0, peniko::Color::from_rgba8(230, 240, 255, 255));
}

#[cfg(feature = "dev")]
pub(super) fn draw_error_overlay(state: &mut PerWindowState, frame: &mut AnyFrame) {
    let Some(dev) = state.dev_mode.as_ref() else { return };
    let Some(ref err) = dev.last_js_error.clone() else { return };

    let win_w = state.gpu.width()  as f64;
    let win_h = state.gpu.height() as f64;

    // Conservative average glyph width (px) — 7 undercounts for some content
    // (bold-ish rendering, wider default metrics). 6 leaves more margin, the
    // safe direction to be wrong.
    let max_ch = ((win_w as usize).saturating_sub(40) / 6).max(12);
    let frame_ch = ((win_w as usize).saturating_sub(50) / 6).max(12);

    let all_lines: Vec<&str> = err.lines().collect();
    let first_frame_idx = all_lines
        .iter()
        .position(|l| l.trim_start().starts_with("at "))
        .unwrap_or(all_lines.len());
    let frame_lines: Vec<&str> = all_lines[first_frame_idx..].iter()
        .map(|l| l.trim()).filter(|t| t.starts_with("at ")).collect();

    // The message wraps instead of being cut to one line, so a narrow window
    // still shows all of it (up to MAX_MSG lines).
    const MAX_MSG: usize = 8;
    let mut msg = wrap_lines(&all_lines[..first_frame_idx].join("\n"), max_ch);
    if msg.len() > MAX_MSG {
        msg.truncate(MAX_MSG);
        if let Some(last) = msg.last_mut() { last.push('…'); }
    }

    // Size the panel to its content, up to 60% of the window; stack frames
    // give way first, then message lines.
    const HEAD: f64 = 32.0;
    const MSG_H: f64 = 20.0;
    const FRAME_H: f64 = 18.0;
    const FOOT: f64 = 24.0;
    let max_panel = (win_h * 0.6).max(120.0).min(win_h);
    let total_frames = frame_lines.len();
    let height = |m: usize, f: usize| HEAD + m as f64 * MSG_H + 5.0 + f as f64 * FRAME_H + FOOT
        + if total_frames > f && f > 0 { FRAME_H } else { 0.0 };
    let mut n_frames = total_frames.min(7);
    while n_frames > 0 && height(msg.len(), n_frames) > max_panel { n_frames -= 1; }
    while msg.len() > 1 && height(msg.len(), n_frames) > max_panel {
        msg.pop();
        if let Some(last) = msg.last_mut() { last.push('…'); }
    }
    let panel_h = height(msg.len(), n_frames).min(max_panel);
    let panel_y = win_h - panel_h;

    frame.fill_rounded_rect(0.0, panel_y, win_w, panel_h, 0.0,
        peniko::Color::from_rgba8(26, 4, 4, 252));
    frame.fill_rect(0.0, panel_y, win_w, 3.0,
        peniko::Color::from_rgba8(220, 50, 50, 255));

    let title_col  = peniko::Color::from_rgba8(255, 100, 100, 210);
    let msg_col    = peniko::Color::from_rgba8(255, 130, 130, 255);
    let source_col = peniko::Color::from_rgba8(255, 200, 100, 255);
    let frame_col  = peniko::Color::from_rgba8(180, 140, 140, 200);
    let dim_col    = peniko::Color::from_rgba8(130, 90,  90,  180);

    let title = pick_fitting(&[
        "⚠ JavaScript Error  —  fix source and save to dismiss",
        "⚠ JavaScript Error — save to dismiss",
        "⚠ JavaScript Error",
    ], max_ch);
    let title_lbl = state.text_sys.label(title, 11.0);
    frame.draw_text(&title_lbl, 16.0, panel_y + 10.0, title_col);

    frame.fill_rect(0.0, panel_y + 25.0, win_w, 1.0,
        peniko::Color::from_rgba8(90, 20, 20, 140));

    let mut y = panel_y + HEAD;
    for line in &msg {
        let lbl = state.text_sys.label(line, 12.0);
        frame.draw_text(&lbl, 16.0, y, msg_col);
        y += MSG_H;
    }
    y += 5.0;

    for t in frame_lines.iter().take(n_frames) {
        let is_user = t.contains(".jsx") || t.contains(".tsx")
                   || (t.contains(".ts") && !t.contains("node_modules"))
                   || (t.contains(".js")
                       && !t.contains("node_modules")
                       && !t.contains("polyfills")
                       && !t.contains("chunk-"));
        let col = if is_user { source_col } else { frame_col };
        let lbl = state.text_sys.label(&truncate_chars(t, frame_ch), 10.5);
        frame.draw_text(&lbl, 26.0, y, col);
        y += FRAME_H;
    }
    if total_frames > n_frames && n_frames > 0 {
        let more_lbl = state.text_sys.label(&format!("… {} more frames", total_frames - n_frames), 10.0);
        frame.draw_text(&more_lbl, 26.0, y, dim_col);
    }

    // The full text is always in the terminal and on the clipboard (Ctrl+C);
    // the footer says so in as many words as fit.
    let hint = pick_fitting(&[
        "Ctrl+C copies the full error (also in the terminal)  ·  save any file to rebuild",
        "Ctrl+C copies the full error  ·  also in the terminal",
        "Ctrl+C: copy full error",
    ], (win_w as usize).saturating_sub(32) / 5);
    let hint_lbl = state.text_sys.label(hint, 10.0);
    frame.draw_text(&hint_lbl, 16.0, panel_y + panel_h - 16.0, dim_col);
}

/// The first option that fits in `max_ch` characters, else the last one.
#[cfg(feature = "dev")]
fn pick_fitting<'a>(options: &[&'a str], max_ch: usize) -> &'a str {
    options.iter().copied().find(|o| o.chars().count() <= max_ch)
        .unwrap_or(options[options.len() - 1])
}

#[cfg(feature = "dev")]
fn truncate_chars(s: &str, max_ch: usize) -> String {
    if s.chars().count() <= max_ch { return s.to_owned(); }
    let mut out: String = s.chars().take(max_ch.saturating_sub(1)).collect();
    out.push('…');
    out
}

/// Word-wrap `text` to lines of at most `max_ch` characters, keeping its own
/// line breaks and splitting words longer than a line.
#[cfg(feature = "dev")]
fn wrap_lines(text: &str, max_ch: usize) -> Vec<String> {
    let max_ch = max_ch.max(1);
    let mut out = Vec::new();
    for para in text.lines() {
        let mut line = String::new();
        let mut len = 0usize;
        for word in para.split_whitespace() {
            let mut word: Vec<char> = word.chars().collect();
            while word.len() > max_ch {
                if len > 0 { out.push(std::mem::take(&mut line)); len = 0; }
                out.push(word.drain(..max_ch).collect());
            }
            let wl = word.len();
            if wl == 0 { continue; }
            if len > 0 && len + 1 + wl > max_ch {
                out.push(std::mem::take(&mut line));
                len = 0;
            }
            if len > 0 { line.push(' '); len += 1; }
            line.extend(word);
            len += wl;
        }
        if len > 0 { out.push(line); }
    }
    out
}

#[cfg(all(test, feature = "dev"))]
mod overlay_tests {
    use super::*;

    #[test]
    fn overlay_rects_are_clamped_to_the_window_on_whole_pixels() {
        assert_eq!(clamp_to_window([10.4, 20.6, 30.2, 5.0], 100.0, 100.0), Some([10.0, 20.0, 31.0, 6.0]));
        assert_eq!(clamp_to_window([-50.0, -50.0, 80.0, 80.0], 100.0, 100.0), Some([0.0, 0.0, 30.0, 30.0]));
        assert_eq!(clamp_to_window([90.0, 90.0, 500.0, 500.0], 100.0, 100.0), Some([90.0, 90.0, 10.0, 10.0]));
        assert_eq!(clamp_to_window([200.0, 0.0, 10.0, 10.0], 100.0, 100.0), None, "off-screen");
        assert_eq!(clamp_to_window([0.0, 0.0, f64::NAN, 1.0], 100.0, 100.0), None);
        assert_eq!(clamp_to_window([5.0, 5.0, 0.2, 0.2], 100.0, 100.0), Some([5.0, 5.0, 1.0, 1.0]));
    }

    #[test]
    fn long_messages_wrap_at_word_boundaries() {
        assert_eq!(wrap_lines("Error converting from js null into type f64", 16),
            vec!["Error converting", "from js null", "into type f64"]);
    }

    #[test]
    fn words_longer_than_a_line_are_split_and_line_breaks_kept() {
        assert_eq!(wrap_lines("abcdefghij\nok", 4), vec!["abcd", "efgh", "ij", "ok"]);
        assert!(wrap_lines("", 10).is_empty());
    }

    #[test]
    fn the_longest_fitting_option_is_chosen() {
        assert_eq!(pick_fitting(&["long option", "short"], 6), "short");
        assert_eq!(pick_fitting(&["long option", "short"], 3), "short");
        assert_eq!(pick_fitting(&["long option", "short"], 40), "long option");
        assert_eq!(truncate_chars("abcdef", 4), "abc…");
    }
}
