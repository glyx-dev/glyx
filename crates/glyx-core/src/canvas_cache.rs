//! A pixel cache for canvases that sit still while their neighbours change.
//!
//! The CPU renderer repaints only the part of the window that changed, but it repaints *everything* that touches that part,
//! and a canvas is repainted by running its whole command list again: turning shapes into geometry, shadows into translucent
//! copies, rotated text into glyph outlines, then rasterizing just the bit inside the damage. A chart under a gliding
//! tooltip, or a drawing next to a button that animates, paid that every frame for pixels that had not changed.
//!
//! So a canvas that is repainted twice with the same commands is drawn once into a bitmap, and later repaints blit the
//! bitmap instead. A change to the canvas (`CanvasUpdate`) drops its bitmap.
//!
//! Memory is the cost: 4 bytes a pixel for each cached canvas. So the cache is limited to a byte budget (least recently used
//! out first; 16 MB unless `canvasCacheMb` in `glyx.config` or `GLYX_CANVAS_CACHE_MB` says otherwise, 0 = off), and a
//! canvas is only cached when drawing it from the bitmap gives the same pixels as drawing it directly: whole-pixel
//! position, fully opaque node, source-over only (no blend modes or eraser, which depend on what is beneath) and no images
//! (they can finish loading without the commands changing).

use glyx_runtime::bindings::CanvasCmd;

/// Default budget in bytes.
pub const DEFAULT_BUDGET_BYTES: usize = 16 * 1024 * 1024;
/// A canvas must be repainted unchanged this many times before it is worth a bitmap (drawing the bitmap costs one more paint).
const REPAINTS_BEFORE_CACHING: u8 = 2;

struct Entry {
    /// Where the bitmap was drawn for: whole pixels `[x, y, w, h]`.
    rect: [i32; 4],
    /// Repaints seen with this entry's commands.
    repaints: u8,
    /// This canvas can never be cached while its commands stay as they are.
    uncacheable: bool,
    /// Premultiplied RGBA8, `w * h * 4` bytes.
    pixels: Option<Vec<u8>>,
    last_used: u64,
}

/// What to do with a canvas that is about to be painted.
pub(crate) enum Plan<'a> {
    /// Paint it as usual.
    Paint,
    /// Paint it as usual, and also keep the result: it has been repainted often enough unchanged.
    PaintAndCache,
    /// Blit these pixels instead.
    Blit(&'a [u8]),
}

pub(crate) struct CanvasPixelCache {
    entries: std::collections::HashMap<u32, Entry>,
    bytes: usize,
    budget: usize,
    tick: u64,
    pub hits: u64,
}

impl CanvasPixelCache {
    pub fn new(budget: usize) -> Self {
        Self { entries: std::collections::HashMap::new(), bytes: 0, budget, tick: 0, hits: 0 }
    }

    /// `GLYX_CANVAS_CACHE_MB` (env) over `canvasCacheMb` (config) over the default; 0 turns the cache off.
    pub fn budget_from(env: Option<&str>, configured: Option<u32>) -> usize {
        let mb = env.and_then(|s| s.trim().parse::<u32>().ok()).or(configured);
        mb.map_or(DEFAULT_BUDGET_BYTES, |m| (m.min(256) as usize) * 1024 * 1024)
    }

    #[cfg(test)]
    pub fn bytes(&self) -> usize { self.bytes }
    #[cfg(test)]
    pub fn budget(&self) -> usize { self.budget }
    #[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools and tests
    pub fn count(&self) -> usize { self.entries.values().filter(|e| e.pixels.is_some()).count() }

    /// For DevTools (`Performance.getCanvasCache`): what is cached, against the budget, and how often it paid off.
    #[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools only
    pub fn stats_json(&self) -> serde_json::Value {
        serde_json::json!({ "bitmaps": self.count(), "bytes": self.bytes, "budgetBytes": self.budget, "blits": self.hits })
    }

    /// The canvas's commands changed (or it is gone): forget what was learnt about it.
    pub fn invalidate(&mut self, id: u32) {
        if let Some(e) = self.entries.remove(&id) {
            self.bytes -= e.pixels.map_or(0, |p| p.len());
        }
    }

    /// The renderer is releasing memory (a trim): drop every bitmap.
    pub fn clear(&mut self) {
        self.entries.clear();
        self.bytes = 0;
    }

    /// Decides how to paint canvas `id`, whose node is at `rect` (whole pixels), the next time it is painted. `cmds` is only
    /// looked at once, when the bitmap is about to be made.
    pub fn plan(&mut self, id: u32, rect: [i32; 4], cmds: &[CanvasCmd]) -> Plan<'_> {
        let max_one = self.budget / 2;
        let bytes_needed = (rect[2].max(0) as usize) * (rect[3].max(0) as usize) * 4;
        if self.budget == 0 || bytes_needed == 0 || bytes_needed > max_one {
            return Plan::Paint;
        }
        self.tick += 1;
        let tick = self.tick;
        let e = self.entries.entry(id).or_insert(Entry { rect, repaints: 0, uncacheable: false, pixels: None, last_used: tick });
        if e.rect != rect {
            // Moved or resized: what was cached is for somewhere else.
            self.bytes -= e.pixels.take().map_or(0, |p| p.len());
            *e = Entry { rect, repaints: 0, uncacheable: false, pixels: None, last_used: tick };
        }
        e.last_used = tick;
        if e.uncacheable { return Plan::Paint; }
        if e.pixels.is_some() {
            self.hits += 1;
            // Re-borrow immutably for the return.
            return Plan::Blit(self.entries.get(&id).and_then(|e| e.pixels.as_deref()).expect("checked just above"));
        }
        e.repaints = e.repaints.saturating_add(1);
        if e.repaints <= REPAINTS_BEFORE_CACHING { return Plan::Paint; }
        if !cacheable(cmds) {
            e.uncacheable = true;
            return Plan::Paint;
        }
        Plan::PaintAndCache
    }

    /// Keeps the bitmap made for `id` (after `Plan::PaintAndCache`), evicting the least recently used to stay in budget.
    pub fn store(&mut self, id: u32, pixels: Vec<u8>) {
        if pixels.len() > self.budget / 2 { return; }
        while self.bytes + pixels.len() > self.budget {
            let victim = self.entries.iter()
                .filter(|(&k, e)| k != id && e.pixels.is_some())
                .min_by_key(|(_, e)| e.last_used)
                .map(|(&k, _)| k);
            let Some(v) = victim else { return };
            if let Some(old) = self.entries.get_mut(&v) {
                self.bytes -= old.pixels.take().map_or(0, |p| p.len());
                old.repaints = 0;
            }
        }
        if let Some(e) = self.entries.get_mut(&id) {
            self.bytes += pixels.len();
            e.pixels = Some(pixels);
        }
    }
}

/// Whether drawing `cmds` from a bitmap gives the same pixels as drawing them in place. Anything that depends on what is
/// beneath the canvas (a blend mode other than source-over, which includes the eraser) or on something outside the commands (an
/// image that may still be loading) says no.
pub(crate) fn cacheable(cmds: &[CanvasCmd]) -> bool {
    use glyx_renderer::BlendKind;
    cmds.iter().all(|c| match c {
        CanvasCmd::Blend { mode } => BlendKind::from_u8(*mode) == BlendKind::SourceOver,
        CanvasCmd::DrawImage { .. } => false,
        _ => true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use glyx_runtime::bindings::{blend_mode, CanvasCmd};

    fn rect_cmd() -> CanvasCmd { CanvasCmd::FillRect { x: 0.0, y: 0.0, w: 4.0, h: 4.0, color: [255, 0, 0, 255] } }
    const R: [i32; 4] = [10, 20, 30, 40];

    #[test]
    fn a_canvas_is_cached_after_it_is_repainted_unchanged() {
        let mut c = CanvasPixelCache::new(1 << 20);
        let cmds = vec![rect_cmd()];
        assert!(matches!(c.plan(1, R, &cmds), Plan::Paint));
        assert!(matches!(c.plan(1, R, &cmds), Plan::Paint));
        assert!(matches!(c.plan(1, R, &cmds), Plan::PaintAndCache));
        c.store(1, vec![7u8; 30 * 40 * 4]);
        assert_eq!(c.bytes(), 30 * 40 * 4);
        match c.plan(1, R, &cmds) { Plan::Blit(p) => assert_eq!(p[0], 7), _ => panic!("expected a blit") }
        assert_eq!(c.hits, 1);
    }

    #[test]
    fn a_change_or_a_move_starts_over_and_frees_the_bitmap() {
        let mut c = CanvasPixelCache::new(1 << 20);
        let cmds = vec![rect_cmd()];
        for _ in 0..3 { let _ = c.plan(1, R, &cmds); }
        c.store(1, vec![0u8; 30 * 40 * 4]);
        c.invalidate(1);
        assert_eq!(c.bytes(), 0);
        assert!(matches!(c.plan(1, R, &cmds), Plan::Paint));
        for _ in 0..2 { let _ = c.plan(1, R, &cmds); }
        c.store(1, vec![0u8; 30 * 40 * 4]);
        assert!(matches!(c.plan(1, [11, 20, 30, 40], &cmds), Plan::Paint), "a moved canvas is not served the old bitmap");
        assert_eq!(c.bytes(), 0);
    }

    #[test]
    fn blend_modes_and_images_are_never_cached() {
        let mut c = CanvasPixelCache::new(1 << 20);
        let eraser = vec![rect_cmd(), CanvasCmd::Blend { mode: blend_mode::DESTINATION_OUT }, rect_cmd()];
        for _ in 0..3 { assert!(matches!(c.plan(1, R, &eraser), Plan::Paint)); }
        let img = vec![CanvasCmd::DrawImage { image: 1, src: [0.0; 4], dst: [0.0, 0.0, 4.0, 4.0] }];
        for _ in 0..3 { assert!(matches!(c.plan(2, R, &img), Plan::Paint)); }
        assert!(cacheable(&[rect_cmd(), CanvasCmd::Blend { mode: blend_mode::SOURCE_OVER }]));
    }

    #[test]
    fn the_budget_holds_and_the_least_recently_used_goes_first() {
        let one = 30 * 40 * 4;
        let mut c = CanvasPixelCache::new(one * 2 + 100); // room for two, not three
        let cmds = vec![rect_cmd()];
        for id in 1..=3u32 {
            for _ in 0..3 { let _ = c.plan(id, R, &cmds); }
            c.store(id, vec![id as u8; one]);
        }
        assert!(c.bytes() <= c.budget());
        assert_eq!(c.count(), 2);
        assert!(matches!(c.plan(1, R, &cmds), Plan::Paint), "the first, least recently used, was evicted");
        assert!(matches!(c.plan(3, R, &cmds), Plan::Blit(_)));
    }

    #[test]
    fn off_and_too_big_canvases_are_left_alone() {
        let cmds = vec![rect_cmd()];
        let mut off = CanvasPixelCache::new(0);
        for _ in 0..4 { assert!(matches!(off.plan(1, R, &cmds), Plan::Paint)); }
        let mut small = CanvasPixelCache::new(1000);
        for _ in 0..4 { assert!(matches!(small.plan(1, R, &cmds), Plan::Paint)); }
        assert_eq!(CanvasPixelCache::budget_from(Some("4"), Some(32)), 4 << 20);
        assert_eq!(CanvasPixelCache::budget_from(None, Some(32)), 32 << 20);
        assert_eq!(CanvasPixelCache::budget_from(None, None), DEFAULT_BUDGET_BYTES);
        assert_eq!(CanvasPixelCache::budget_from(Some("0"), Some(32)), 0);
    }

    /// The point of the cache: blitting the bitmap gives the pixels drawing the commands would, including under a partial
    /// repaint (a damage rectangle that cuts through the canvas).
    #[test]
    fn a_blitted_canvas_matches_one_drawn_in_place() {
        use glyx_renderer::{AnyFrame, TinySkiaRenderer};
        let cmds = vec![
            CanvasCmd::FillRect { x: 4.0, y: 4.0, w: 60.0, h: 30.0, color: [40, 120, 220, 255] },
            CanvasCmd::FillCircle { cx: 40.0, cy: 30.0, r: 14.0, color: [240, 80, 80, 200] },
            CanvasCmd::StrokeLine { x0: 2.0, y0: 50.0, x1: 70.0, y1: 8.0, color: [255, 255, 255, 255], line_width: 3.0 },
            CanvasCmd::Shadow { color: [0, 0, 0, 160], blur: 4.0, dx: 2.0, dy: 2.0 },
            CanvasCmd::FillCircle { cx: 20.0, cy: 20.0, r: 8.0, color: [250, 220, 60, 255] },
        ];
        let (cw, ch, ox, oy) = (80u32, 60u32, 12i32, 9i32);
        let mut text_sys = glyx_text::TextSystem::new();
        let mut labels = crate::label_cache::LabelCache::new(None);
        let images = std::collections::HashMap::new();
        let damage = [(30.0, 20.0, 40.0, 30.0)]; // cuts through the canvas

        let paint = |blit: Option<&[u8]>, text_sys: &mut glyx_text::TextSystem, labels: &mut crate::label_cache::LabelCache| {
            let mut r = TinySkiaRenderer::new_cpu_only(100, 80);
            let seed = r.begin_frame();
            r.finish_frame_soft(seed, |_, _, _, _| {});
            let mut frame = AnyFrame::TinySkia(r.begin_frame_damaged(Some(&damage)));
            match blit {
                Some(px) => { assert!(frame.draw_premul_pixels(px, cw, ch, ox, oy)); }
                None => crate::canvas_paint::Painter::new(&mut frame, text_sys, labels, &images, (ox as f64, oy as f64), 1.0).paint_all(&cmds),
            }
            let AnyFrame::TinySkia(f) = frame else { unreachable!() };
            let mut out = Vec::new();
            r.finish_frame_soft(f, |px, _, _, _| out = px.to_vec());
            out
        };
        let direct = paint(None, &mut text_sys, &mut labels);
        let bitmap = crate::canvas_export::render_premul(&cmds, &images, &mut text_sys, &mut labels, cw, ch, glyx_renderer::kurbo::Affine::IDENTITY, None);
        let blitted = paint(Some(&bitmap), &mut text_sys, &mut labels);
        assert_eq!(direct.len(), blitted.len());
        let worst = direct.iter().zip(&blitted).map(|(a, b)| (*a as i32 - *b as i32).abs()).max().unwrap();
        // Translucent shapes composited into the bitmap first and onto the window second round twice instead of once.
        assert!(worst <= 2, "the cached canvas differs from the drawn one by {worst}");
        assert!(direct.iter().any(|&b| b != 0), "something was drawn inside the damage");
    }
}
