/// Dev-mode worker, hot-reload event handling, and overlay drawing for glyx-core.

#[cfg(feature = "dev")]
use std::sync::mpsc::{self, Receiver, TryRecvError};
use std::sync::Arc;
use std::time::{Duration, Instant};

#[cfg(feature = "dev")]
use notify::{RecursiveMode, Watcher};
#[cfg(feature = "dev")]
use std::process::Command;

use glyx_renderer::{peniko, AnyFrame};

use crate::state::{DevBuildEvent, DevModeState, PerWindowState};
use crate::DevModeConfig;
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
    redraw: Arc<dyn Fn() + Send + Sync>,
    config: Option<DevModeConfig>,
) -> Option<Receiver<DevBuildEvent>> {
    use std::path::PathBuf;

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

            let run_bun = |cwd: &std::path::Path| -> std::io::Result<std::process::Output> {
                let bun_args = [
                    "build",
                    app_jsx.to_str().unwrap_or(""),
                    "--outfile",
                    app_js.to_str().unwrap_or(""),
                    "--target",      "browser",
                    "--format",      "iife",
                    "--define",      "process.env.NODE_ENV='production'",
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
                state.layout = glyx_layout::LayoutTree::new();
                state.runtime.layout_cache.lock().clear();
                state.canvas_cmds.clear();
                state.canvas3d_scenes.clear();
                state.canvas3d_dirty.clear();
                let _ = state.runtime.drain_scene_commands();
                match state.runtime.eval(&js) {
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
            Err(TryRecvError::Empty) | Err(TryRecvError::Disconnected) => break,
        }
    }
}

#[cfg(feature = "dev")]
pub(super) fn draw_dev_overlay(state: &mut PerWindowState, frame: &mut AnyFrame) {
    let Some(dev) = state.dev_mode.as_mut() else { return };
    if !dev.overlay_visible { return; }

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

        let start_rss_mb   = dev.startup_rss_bytes      as f64 / (1024.0 * 1024.0);
        let start_v8_mb    = dev.startup_v8_total_bytes  as f64 / (1024.0 * 1024.0);
        let delta_rss_mb   = rss_mb - start_rss_mb;
        let native_mb      = (rss_mb - heap_total_mb).max(0.0);
        let native_start   = (start_rss_mb - start_v8_mb).max(0.0);
        let delta_native_mb = native_mb - native_start;

        let since = dev.last_reload
            .map(|t| now.saturating_duration_since(t).as_secs())
            .unwrap_or(0);
        let phys_w = state.gpu.width();
        let phys_h = state.gpu.height();
        dev.overlay_lines = vec![
            format!("Dev  {}×{}px  budget {:.1}ms  (Ctrl+Shift+D)", phys_w, phys_h, budget),
            format!("FPS {:.0}  last {:.1}ms  avg {:.1}ms  P99 {:.1}ms", fps, last_ms, avg_ms, p99_ms),
            format!("JS {:.2}ms  layout {:.2}ms  GPU {:.2}ms  nodes {}",
                js_ms, lay_ms, gpu_ms, state.js_nodes.len()),
            format!("cache {} frags  img {}/{}  labels {}/256  canvas {}",
                state.scene_cache.len(),
                state.images.len(), state.images_by_path.len(),
                state.label_cache.len(),
                state.canvas_cmds.len()),
            format!("V8 {:.1}/{:.1}MB  RSS {:.1}MB  native {:.1}MB  \u{0394}RSS {:+.1}  \u{0394}nat {:+.1}",
                heap_used_mb, heap_total_mb, rss_mb, native_mb, delta_rss_mb, delta_native_mb),
            format!("wgpu  buf {:.1}MB×{}  avg {:.1}MB  tex {:.1}MB×{}  waste {:.1}MB",
                gpu_buf_mb, gpu_buf_n, avg_buf_mb, gpu_tex_mb, gpu_tex_n, gpu_waste_mb),
            format!("{}  (reload {}s ago)", dev.last_build_message, since),
        ];
        dev.overlay_next_refresh = now + Duration::from_millis(250);
    }

    let sparkline_data: Vec<glyx_perf::PerfFrame> = {
        let perf_g = state.perf.lock();
        let data: Vec<_> = perf_g.ring.iter().copied().collect();
        drop(perf_g);
        data
    };
    let budget = {
        let perf_g = state.perf.lock();
        perf_g.budget_ms
    };

    let overlay_w = 530.0_f64;
    let overlay_h = 195.0_f64;
    frame.fill_rounded_rect(16.0, 16.0, overlay_w, overlay_h, 8.0, peniko::Color::from_rgba8(15, 15, 25, 225));

    let txt_color  = peniko::Color::from_rgba8(220, 220, 235, 255);
    let mem_color  = peniko::Color::from_rgba8(140, 210, 255, 255);
    let lines = &dev.overlay_lines;
    for (i, line) in lines.iter().enumerate() {
        let col = if i == 4 || i == 5 { mem_color } else { txt_color };
        let text = state.text_sys.label(line, 12.0);
        frame.draw_text(&text, 26.0, 34.0 + (i as f64 * 20.0), col);
    }

    let spark_x  = 26.0_f64;
    let spark_y  = 177.0_f64;
    let bar_w    = 2.0_f64;
    let spark_h  = 18.0_f64;
    let samples: Vec<f64> = sparkline_data.iter()
        .rev().take(60).map(|f| f.frame_time_ms).collect::<Vec<_>>()
        .into_iter().rev().collect();
    for (i, &ms) in samples.iter().enumerate() {
        let h   = (ms / (budget * 2.0)).min(1.0) * spark_h;
        let x   = spark_x + i as f64 * bar_w;
        let y   = spark_y + (spark_h - h);
        let col = if ms > budget * 2.0 {
            peniko::Color::from_rgba8(255, 80, 80, 220)
        } else if ms > budget {
            peniko::Color::from_rgba8(255, 180, 50, 220)
        } else {
            peniko::Color::from_rgba8(80, 200, 120, 200)
        };
        frame.fill_rect(x, y, bar_w - 0.5, h, col);
    }
}

#[cfg(feature = "dev")]
pub(super) fn draw_error_overlay(state: &mut PerWindowState, frame: &mut AnyFrame) {
    let Some(dev) = state.dev_mode.as_ref() else { return };
    let Some(ref err) = dev.last_js_error.clone() else { return };

    let win_w = state.gpu.width()  as f64;
    let win_h = state.gpu.height() as f64;

    let panel_h = 210.0_f64;
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

    let title_lbl = state.text_sys.label(
        "⚠ JavaScript Error  —  fix source and save to dismiss", 11.0);
    frame.draw_text(&title_lbl, 16.0, panel_y + 10.0, title_col);

    frame.fill_rect(0.0, panel_y + 25.0, win_w, 1.0,
        peniko::Color::from_rgba8(90, 20, 20, 140));

    let max_ch = (win_w as usize).saturating_sub(56) / 7;
    let trunc = |s: &str| -> String {
        if s.len() > max_ch {
            let end = s.char_indices().nth(max_ch).map(|(i, _)| i).unwrap_or(s.len());
            format!("{}…", &s[..end])
        } else {
            s.to_owned()
        }
    };

    let all_lines: Vec<&str> = err.lines().collect();
    let first_frame_idx = all_lines
        .iter()
        .position(|l| l.trim_start().starts_with("at "))
        .unwrap_or(all_lines.len());
    let msg_lines   = &all_lines[..first_frame_idx];
    let frame_lines = &all_lines[first_frame_idx..];

    let mut y = panel_y + 32.0;
    let mut drawn_msg = 0usize;
    for line in msg_lines.iter().take(3) {
        let t = line.trim();
        if t.is_empty() { continue; }
        if drawn_msg >= 2 { break; }
        let lbl = state.text_sys.label(&trunc(t), 12.0);
        frame.draw_text(&lbl, 16.0, y, msg_col);
        y += 19.0;
        drawn_msg += 1;
    }
    y += 5.0;

    let max_frames = 7usize;
    let mut drawn_frames = 0usize;
    for line in frame_lines.iter() {
        let t = line.trim();
        if t.is_empty() || !t.starts_with("at ") { continue; }
        if drawn_frames >= max_frames || y > panel_y + panel_h - 22.0 { break; }

        let is_user = t.contains(".jsx") || t.contains(".tsx")
                   || (t.contains(".ts") && !t.contains("node_modules"))
                   || (t.contains(".js")
                       && !t.contains("node_modules")
                       && !t.contains("polyfills")
                       && !t.contains("chunk-"));
        let col = if is_user { source_col } else { frame_col };

        let lbl = state.text_sys.label(&trunc(t), 10.5);
        frame.draw_text(&lbl, 26.0, y, col);
        y += 17.0;
        drawn_frames += 1;
    }

    let total_frames = frame_lines.iter()
        .filter(|l| l.trim_start().starts_with("at ")).count();
    if total_frames > max_frames {
        let more_lbl = state.text_sys.label(
            &format!("  … {} more frames  (glyx dev --inspect for full trace)",
                     total_frames - max_frames),
            10.0,
        );
        frame.draw_text(&more_lbl, 26.0, y, dim_col);
    }

    let hint_lbl = state.text_sys.label(
        "Save any file to rebuild  ·  glyx dev --inspect for Chrome DevTools", 10.0);
    frame.draw_text(&hint_lbl, 16.0, panel_y + panel_h - 14.0, dim_col);
}
