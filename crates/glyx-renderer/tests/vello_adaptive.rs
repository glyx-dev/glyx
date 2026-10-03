//! The adaptive Vello scratch buffers must draw exactly what upstream's fixed-size
//! buffers draw, including for a scene that does not fit the small starting size and
//! has to grow on its first frame. Needs a GPU adapter; skips (passes) without one.

use vello::kurbo::{Affine, BezPath, Point, Rect, RoundedRect, Stroke};
use vello::peniko::{Brush, Color, Fill};
use vello::{AaConfig, AaSupport, RenderParams, Renderer, RendererOptions, Scene};

const W: u32 = 1280;
const H: u32 = 800;

struct Gpu {
    device: wgpu::Device,
    queue: wgpu::Queue,
}

fn gpu() -> Option<Gpu> {
    let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
        backends: wgpu::Backends::PRIMARY,
        ..wgpu::InstanceDescriptor::new_without_display_handle()
    });
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        compatible_surface: None,
        force_fallback_adapter: false,
    }))
    .ok()?;
    let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
        label: Some("adaptive-test"),
        required_features: wgpu::Features::empty(),
        required_limits: wgpu::Limits::default(),
        memory_hints: wgpu::MemoryHints::MemoryUsage,
        ..Default::default()
    }))
    .ok()?;
    Some(Gpu { device, queue })
}

fn renderer(g: &Gpu) -> Renderer {
    Renderer::new(
        &g.device,
        RendererOptions {
            use_cpu: false,
            antialiasing_support: AaSupport::area_only(),
            num_init_threads: std::num::NonZeroUsize::new(1),
            pipeline_cache: None,
        },
    )
    .expect("vello renderer")
}

/// Render `scene` and read the pixels back (tightly packed RGBA).
fn render(g: &Gpu, r: &mut Renderer, scene: &Scene) -> Vec<u8> {
    let tex = g.device.create_texture(&wgpu::TextureDescriptor {
        label: Some("target"),
        size: wgpu::Extent3d { width: W, height: H, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC,
        view_formats: &[],
    });
    let view = tex.create_view(&Default::default());
    r.render_to_texture(
        &g.device,
        &g.queue,
        scene,
        &view,
        &RenderParams {
            base_color: Color::from_rgba8(13, 13, 20, 255),
            width: W,
            height: H,
            antialiasing_method: AaConfig::Area,
        },
    )
    .expect("render");

    let padded = (W * 4).div_ceil(wgpu::COPY_BYTES_PER_ROW_ALIGNMENT) * wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;
    let buf = g.device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("readback"),
        size: padded as u64 * H as u64,
        usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
        mapped_at_creation: false,
    });
    let mut enc = g.device.create_command_encoder(&Default::default());
    enc.copy_texture_to_buffer(
        wgpu::TexelCopyTextureInfo { texture: &tex, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
        wgpu::TexelCopyBufferInfo {
            buffer: &buf,
            layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(padded), rows_per_image: Some(H) },
        },
        wgpu::Extent3d { width: W, height: H, depth_or_array_layers: 1 },
    );
    g.queue.submit(Some(enc.finish()));
    let slice = buf.slice(..);
    let (tx, rx) = std::sync::mpsc::channel();
    slice.map_async(wgpu::MapMode::Read, move |r| { let _ = tx.send(r); });
    let _ = g.device.poll(wgpu::PollType::Wait { submission_index: None, timeout: None });
    rx.recv().unwrap().unwrap();
    let data = slice.get_mapped_range();
    let mut out = Vec::with_capacity((W * H * 4) as usize);
    for row in 0..H as usize {
        out.extend_from_slice(&data[row * padded as usize..row * padded as usize + (W * 4) as usize]);
    }
    drop(data);
    buf.unmap();
    out
}

struct Lcg(u64);
impl Lcg {
    fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        ((self.0 >> 33) as f64) / ((1u64 << 31) as f64)
    }
}

/// A window's worth of ordinary UI: panels, text-like bars, a line chart.
fn light_scene() -> Scene {
    let mut s = Scene::new();
    let panel = Brush::Solid(Color::from_rgba8(18, 19, 26, 255));
    s.fill(Fill::NonZero, Affine::IDENTITY, &panel, None, &RoundedRect::new(20.0, 20.0, 1260.0, 780.0, 16.0));
    for i in 0..12u8 {
        let x = 40.0 + i as f64 * 100.0;
        let c = Brush::Solid(Color::from_rgba8(30 + i * 8, 90, 200, 255));
        s.fill(Fill::NonZero, Affine::IDENTITY, &c, None, &RoundedRect::new(x, 60.0, x + 88.0, 120.0, 10.0));
    }
    let mut line = BezPath::new();
    line.move_to(Point::new(40.0, 500.0));
    for i in 1..120 {
        line.line_to(Point::new(40.0 + i as f64 * 10.0, 500.0 + 80.0 * (i as f64 * 0.2).sin()));
    }
    s.stroke(&Stroke::new(2.5), Affine::IDENTITY, &Brush::Solid(Color::from_rgba8(129, 140, 248, 255)), None, &line);
    s
}

/// Enough flattened lines, tiles and segments to overflow the starting buffers many
/// times over, yet well inside what upstream always allocated (so the fixed-size
/// render is a valid reference).
fn heavy_scene() -> Scene {
    let mut s = light_scene();
    let mut rng = Lcg(42);
    for _ in 0..1400 {
        let (x, y) = (rng.next() * 1100.0 + 40.0, rng.next() * 600.0 + 100.0);
        let (w, h) = (rng.next() * 120.0 + 10.0, rng.next() * 80.0 + 10.0);
        let c = Color::from_rgba8((rng.next() * 255.0) as u8, (rng.next() * 255.0) as u8, (rng.next() * 255.0) as u8, 200);
        s.fill(Fill::NonZero, Affine::IDENTITY, &Brush::Solid(c), None, &RoundedRect::new(x, y, x + w, y + h, 6.0));
    }
    for _ in 0..900 {
        let mut p = BezPath::new();
        let (mut x, mut y) = (rng.next() * 1200.0 + 20.0, rng.next() * 700.0 + 50.0);
        p.move_to(Point::new(x, y));
        for _ in 0..40 {
            x += rng.next() * 60.0 - 30.0;
            y += rng.next() * 60.0 - 30.0;
            p.curve_to(
                Point::new(x + rng.next() * 40.0 - 20.0, y + rng.next() * 40.0 - 20.0),
                Point::new(x + rng.next() * 40.0 - 20.0, y + rng.next() * 40.0 - 20.0),
                Point::new(x, y),
            );
        }
        let c = Color::from_rgba8((rng.next() * 255.0) as u8, (rng.next() * 255.0) as u8, (rng.next() * 255.0) as u8, 255);
        s.stroke(&Stroke::new(1.5), Affine::IDENTITY, &Brush::Solid(c), None, &p);
    }
    s.fill(Fill::NonZero, Affine::IDENTITY, &Brush::Solid(Color::from_rgba8(255, 255, 255, 12)), None, &Rect::new(0.0, 300.0, 1280.0, 340.0));
    s
}

/// (bytes differing by more than `tol`, worst difference)
fn diff(a: &[u8], b: &[u8], tol: i32) -> (usize, i32) {
    assert_eq!(a.len(), b.len());
    let mut over = 0;
    let mut worst = 0;
    for (x, y) in a.iter().zip(b) {
        let d = (*x as i32 - *y as i32).abs();
        worst = worst.max(d);
        if d > tol { over += 1; }
    }
    (over, worst)
}

const MIB: u64 = 1 << 20;

#[test]
fn adaptive_buffers_draw_what_upstream_sized_buffers_draw() {
    let Some(g) = gpu() else { eprintln!("no GPU adapter: skipped"); return; };

    for (name, scene) in [("light", light_scene()), ("heavy", heavy_scene())] {
        // Reference: upstream's fixed sizes.
        let mut fixed = renderer(&g);
        fixed.set_adaptive_buffers(false);
        assert!(!fixed.adaptive_buffers());
        let want = render(&g, &mut fixed, &scene);
        let again = render(&g, &mut fixed, &scene);
        let (ref_noise, _) = diff(&want, &again, 0);

        // Adaptive, from a cold start: the first frame has to grow for the heavy scene.
        let mut ad = renderer(&g);
        assert!(ad.adaptive_buffers());
        let before = ad.bump_buffer_bytes();
        let got = render(&g, &mut ad, &scene);
        let after = ad.bump_buffer_bytes();
        let got2 = render(&g, &mut ad, &scene);

        let (bad, worst) = diff(&want, &got, 1);
        let (bad2, _) = diff(&want, &got2, 1);
        eprintln!(
            "{name}: scratch buffers {} -> {} MiB (upstream {} MiB); {bad} bytes off by >1 (worst {worst}); fixed-vs-fixed noise {ref_noise}",
            before / MIB, after / MIB, fixed.bump_buffer_bytes() / MIB
        );
        assert_eq!(bad, 0, "{name}: the first adaptive frame differs from the fixed-size render");
        assert_eq!(bad2, 0, "{name}: the second adaptive frame differs");
        if name == "light" {
            assert!(after <= 8 * MIB, "a plain window should stay near the floor, got {} MiB", after / MIB);
        } else {
            assert!(after > before, "the heavy scene must have grown the buffers");
            assert!(after <= fixed.bump_buffer_bytes(), "even a heavy scene should not need more than upstream always allocated");
        }
    }
}

/// `n` rectangles of the given size: the same number of paths and path segments
/// whatever the size, but very different amounts of tile work.
fn rects(n: usize, w: f64, h: f64) -> Scene {
    let mut s = Scene::new();
    let mut rng = Lcg(7);
    for _ in 0..n {
        let (x, y) = (rng.next() * (1280.0 - w).max(1.0), rng.next() * (800.0 - h).max(1.0));
        let c = Color::from_rgba8((rng.next() * 255.0) as u8, (rng.next() * 255.0) as u8, (rng.next() * 255.0) as u8, 60);
        s.fill(Fill::NonZero, Affine::IDENTITY, &Brush::Solid(c), None, &Rect::new(x, y, x + w, y + h));
    }
    s
}

#[test]
fn a_steady_scene_draws_in_one_pass_almost_every_frame() {
    let Some(g) = gpu() else { eprintln!("no GPU adapter: skipped"); return; };
    let mut r = renderer(&g);
    let scene = light_scene();
    let want = {
        let mut fixed = renderer(&g);
        fixed.set_adaptive_buffers(false);
        render(&g, &mut fixed, &scene)
    };
    for frame in 0..30 {
        let got = render(&g, &mut r, &scene);
        assert_eq!(diff(&want, &got, 1).0, 0, "frame {frame} differs from the fixed-size render");
    }
    let st = r.adaptive_stats();
    eprintln!("steady: {st:?}");
    assert!(st.waited_frames <= 2, "only the first frame (and at most one more) should wait: {st:?}");
    assert!(st.pipelined_frames >= 27, "{st:?}");
    assert_eq!(st.late_overflows, 0, "{st:?}");
}

#[test]
fn a_jump_in_the_number_of_paths_is_caught_before_drawing() {
    let Some(g) = gpu() else { eprintln!("no GPU adapter: skipped"); return; };
    let mut r = renderer(&g);
    for _ in 0..8 { render(&g, &mut r, &light_scene()); }
    let before = r.adaptive_stats();
    let heavy = heavy_scene();
    let got = render(&g, &mut r, &heavy);
    let after = r.adaptive_stats();

    let mut fixed = renderer(&g);
    fixed.set_adaptive_buffers(false);
    let want = render(&g, &mut fixed, &heavy);
    assert_eq!(diff(&want, &got, 1).0, 0, "the frame where the scene got heavy must not show missing content");
    assert!(after.waited_frames > before.waited_frames, "that frame should have waited for its counters: {before:?} -> {after:?}");
    assert!(after.retries > before.retries, "and re-run its coarse pass larger: {before:?} -> {after:?}");
}

#[test]
fn a_scene_that_only_covers_more_area_is_caught_before_drawing() {
    // Path and segment counts do not change, only how much area the shapes cover. The
    // scene's tile estimate sees it, so the frame waits for its counters and re-runs its
    // coarse pass larger, and no frame is drawn with content missing.
    let Some(g) = gpu() else { eprintln!("no GPU adapter: skipped"); return; };
    let small = rects(800, 6.0, 6.0);
    let large = rects(800, 600.0, 400.0);
    let mut fixed = renderer(&g);
    fixed.set_adaptive_buffers(false);
    let want = render(&g, &mut fixed, &large);

    let mut r = renderer(&g);
    for _ in 0..8 { render(&g, &mut r, &small); }
    let before = r.adaptive_stats();
    let mut wrong = 0;
    for _ in 0..4 {
        if diff(&want, &render(&g, &mut r, &large), 1).0 != 0 { wrong += 1; }
    }
    let st = r.adaptive_stats();
    eprintln!("more area: {wrong} wrong frame(s); {st:?}; buffers {} MiB", r.bump_buffer_bytes() / MIB);
    assert_eq!(wrong, 0, "a frame was drawn with content missing: {st:?}");
    assert_eq!(st.late_overflows, 0, "nothing should have been found out a frame late: {st:?}");
    assert!(st.waited_frames > before.waited_frames && st.retries > before.retries, "the jump should have waited and re-run: {before:?} -> {st:?}");
}

#[test]
fn a_card_scaling_up_gradually_never_draws_a_bad_frame() {
    // The animation case: the same shapes at growing size, a step at a time.
    let Some(g) = gpu() else { eprintln!("no GPU adapter: skipped"); return; };
    let mut r = renderer(&g);
    let mut fixed = renderer(&g);
    fixed.set_adaptive_buffers(false);
    let mut wrong = 0;
    for step in 0..24 {
        let side = 12.0 * 1.18f64.powi(step); // +18% per frame, 12 px up to ~600 px
        let scene = rects(700, side.min(600.0), (side * 0.66).min(400.0));
        let want = render(&g, &mut fixed, &scene);
        let before = r.adaptive_stats();
        let bad = diff(&want, &render(&g, &mut r, &scene), 1).0 != 0;
        if bad { wrong += 1; }
        let after = r.adaptive_stats();
        eprintln!("  step {step:2} side {:6.1} tiles~{:8} {} waited+{} piped+{} retries+{} late+{} buffers {} MiB",
            side.min(600.0), scene.tile_estimate(), if bad { "WRONG" } else { "ok   " },
            after.waited_frames - before.waited_frames, after.pipelined_frames - before.pipelined_frames,
            after.retries - before.retries, after.late_overflows - before.late_overflows, r.bump_buffer_bytes() / MIB);
    }
    let st = r.adaptive_stats();
    eprintln!("scaling: {wrong} wrong frame(s); {st:?}");
    assert_eq!(wrong, 0, "{st:?}");
    assert_eq!(st.late_overflows, 0, "{st:?}");
}
