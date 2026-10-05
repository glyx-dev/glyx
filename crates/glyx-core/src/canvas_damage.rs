//! Partial redraw of a canvas.
//!
//! A canvas that redraws used to damage its whole rectangle, so moving a chart's
//! hover crosshair repainted the entire chart. Here each frame is compared with
//! the previous one, and only the part that actually changed is damaged. The
//! rule that keeps it correct: a region is reported only when every pixel that
//! can differ lies inside it, and anything uncertain reports the whole canvas
//! (`None`) — a wrongly small region would leave stale pixels on screen.

use super::*;

/// What a canvas looked like the last time it was drawn: enough to tell whether
/// the next draw can be limited to a part of it.
pub(crate) struct CanvasDrawn {
    /// The commands drawn (mid-flight values included while it eases).
    pub cmds:  Vec<CanvasCmd>,
    /// Its layout rect `(x, y, w, h)`.
    pub rect:  (f32, f32, f32, f32),
    /// Its props, so a change to its own style (background, opacity…) repaints it all.
    pub props: NodeProps,
}

/// `[l, t, r, b]` in canvas-local pixels.
type Region = [f32; 4];

/// Nothing: the identity of `union`.
const EMPTY: Region = [f32::MAX, f32::MAX, f32::MIN, f32::MIN];

/// Room for anti-aliased edges and round caps.
const PAD: f32 = 3.0;

fn union(a: Region, b: Region) -> Region {
    [a[0].min(b[0]), a[1].min(b[1]), a[2].max(b[2]), a[3].max(b[3])]
}

/// The box around a flat `[x0, y0, x1, y1, …]` point list, grown by `grow`.
fn points_box(points: &[f32], grow: f32) -> Region {
    let mut r = EMPTY;
    for p in points.chunks_exact(2) {
        r = union(r, [p[0] - grow, p[1] - grow, p[0] + grow, p[1] + grow]);
    }
    r
}

/// Generously, everything `cmd` can paint. `None` for a clip command, whose
/// effect isn't a region of its own: it changes how the commands after it are
/// cut, so a draw that changes one is repainted whole.
fn cmd_bounds(cmd: &CanvasCmd) -> Option<Region> {
    use CanvasCmd::*;
    let rect = |l: f32, t: f32, r: f32, b: f32, grow: f32| {
        [l.min(r) - grow - PAD, t.min(b) - grow - PAD, l.max(r) + grow + PAD, t.max(b) + grow + PAD]
    };
    Some(match cmd {
        Clear => EMPTY,
        FillRect { x, y, w, h, .. } => rect(*x, *y, x + w, y + h, 0.0),
        StrokeRect { x, y, w, h, line_width, .. } => rect(*x, *y, x + w, y + h, line_width * 0.5),
        FillCircle { cx, cy, r, .. } => rect(cx - r, cy - r, cx + r, cy + r, 0.0),
        StrokeCircle { cx, cy, r, line_width, .. } => rect(cx - r, cy - r, cx + r, cy + r, line_width * 0.5),
        StrokeLine { x0, y0, x1, y1, line_width, .. } => rect(*x0, *y0, *x1, *y1, line_width * 0.5),
        // The text box is only known to the text engine, so over-estimate: a full em
        // per character (typical text averages about half that) and room above and
        // below for ascenders, descenders and line spacing.
        FillText { text, x, y, font_size, bold, .. } => {
            let em = font_size.max(1.0);
            let width = text.chars().count().max(1) as f32 * em * if *bold { 1.15 } else { 1.0 };
            rect(*x, y - 0.4 * em, x + width, y + 1.8 * em, 0.0)
        }
        FillPath { points, .. } | FillPathGradient { points, .. } => {
            let b = points_box(points, 0.0);
            if b[0] > b[2] { EMPTY } else { [b[0] - PAD, b[1] - PAD, b[2] + PAD, b[3] + PAD] }
        }
        StrokePath { points, line_width, .. } => {
            let b = points_box(points, *line_width);
            if b[0] > b[2] { EMPTY } else { [b[0] - PAD, b[1] - PAD, b[2] + PAD, b[3] + PAD] }
        }
        PushClip { .. } | PopClip => return None,
    })
}

/// The part of a canvas that can look different between two draws, in canvas
/// pixels; `None` when it can't be bounded (a clip changed, or the lists are too
/// long to compare cheaply) and the whole canvas must repaint. Identical draws
/// give an empty region.
pub(crate) fn changed_region(old: &[CanvasCmd], new: &[CanvasCmd]) -> Option<Region> {
    if old == new { return Some(EMPTY); }
    let mut acc = EMPTY;
    let mut add = |c: &CanvasCmd| -> bool {
        match cmd_bounds(c) { Some(b) => { acc = union(acc, b); true } None => false }
    };

    if old.len() == new.len() {
        // Same commands in the same places except the ones that differ: any pixel
        // that changed is covered by the old or the new version of one of those.
        for (a, b) in old.iter().zip(new) {
            if a != b && !(add(a) && add(b)) { return None; }
        }
    } else {
        // A command was added or removed. Keep the longest run of identical
        // commands (in order); whatever isn't in it changed. A pixel outside the
        // changed commands' bounds is painted only by commands that are the same
        // and in the same relative order, so it comes out the same.
        let (n, m) = (old.len(), new.len());
        if n * m > 40_000 { return None; }
        let w = m + 1;
        let mut lcs = vec![0u16; (n + 1) * w];
        for i in (0..n).rev() {
            for j in (0..m).rev() {
                lcs[i * w + j] = if old[i] == new[j] { lcs[(i + 1) * w + j + 1] + 1 }
                                 else { lcs[(i + 1) * w + j].max(lcs[i * w + j + 1]) };
            }
        }
        let (mut i, mut j) = (0, 0);
        while i < n || j < m {
            if i < n && j < m && old[i] == new[j] && lcs[i * w + j] == lcs[(i + 1) * w + j + 1] + 1 {
                i += 1; j += 1;
            } else if j >= m || (i < n && lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) {
                if !add(&old[i]) { return None; }
                i += 1;
            } else {
                if !add(&new[j]) { return None; }
                j += 1;
            }
        }
    }
    Some(acc)
}

/// Where on screen a canvas's partial redraw lands, or `None` when it must
/// damage its whole node as before. `rect` is the node's layout rect, `bounds`
/// what `visual_bounds` says it draws over (equal to the rect unless it has a
/// transform or shadow), `prev` where it was last frame, `scrolled` whether a
/// scrolled ancestor moves it, and `local` the changed region in canvas pixels.
pub(crate) fn partial_rect(
    rect:     (f64, f64, f64, f64),
    bounds:   (f64, f64, f64, f64),
    prev:     Option<(f64, f64, f64, f64)>,
    scrolled: bool,
    local:    [f64; 4],
) -> Option<(f64, f64, f64, f64)> {
    let (x, y, w, h) = rect;
    let plain = bounds == (x, y, x + w, y + h);
    if scrolled || !plain || prev != Some(rect) { return None; }
    // Never reach outside the canvas: it is clipped to its own rect anyway.
    let (l, t) = (local[0].max(0.0), local[1].max(0.0));
    let (r, b) = (local[2].min(w), local[3].min(h));
    // Nothing changed: a minimal region, not "no region" (which means "everything").
    if r <= l || b <= t { return Some((x, y, 1.0, 1.0)); }
    Some((x + l, y + t, r - l, b - t))
}

/// `GLYX_FULL_CANVAS_DAMAGE=1` turns partial canvas redraw off, so every
/// redrawn canvas damages its whole rect as it used to. A switch for ruling it
/// out when something on a canvas looks stale, and for comparing the two.
fn partial_redraw_off() -> bool {
    static OFF: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *OFF.get_or_init(|| std::env::var_os("GLYX_FULL_CANVAS_DAMAGE").is_some())
}

/// For every canvas redrawn this frame: the changed region (canvas pixels, as
/// `[l, t, r, b]`) when only part of it needs repainting. A canvas missing from
/// the result is damaged whole. Also records what each canvas now shows, for
/// the next frame's comparison.
///
/// A region is only trusted when nothing but the commands changed: the canvas
/// must be where it was, with the same props, visible, and not mid-transition.
pub(crate) fn plan(
    s:         &mut PerWindowState,
    drawing:   &std::collections::HashMap<u32, Vec<CanvasCmd>>,
    overrides: &std::collections::HashMap<u32, crate::motion::Overrides>,
) -> std::collections::HashMap<u32, [f64; 4]> {
    let mut out = std::collections::HashMap::new();
    let ids: Vec<u32> = s.dirty_nodes.iter().copied()
        .filter(|id| s.js_nodes.get(id).map_or(false, |n| n.node_type == NodeType::Canvas))
        .collect();
    for id in ids {
        let Some(node) = s.js_nodes.get(&id) else { continue };
        let Some(cur) = drawing.get(&id).or_else(|| s.canvas_cmds.get(&id)) else {
            s.canvas_drawn.remove(&id);
            continue;
        };
        let rect = node.layout_id
            .and_then(|lid| s.resolved_by_id.get(&lid))
            .map(|rl| (rl.x, rl.y, rl.width, rl.height));
        let hidden = node.props.hidden.unwrap_or(false);
        let Some(rect) = rect.filter(|_| !hidden) else {
            s.canvas_drawn.remove(&id);
            continue;
        };
        if !overrides.contains_key(&id) && !partial_redraw_off() {
            if let Some(prev) = s.canvas_drawn.get(&id) {
                if prev.rect == rect && prev.props == node.props {
                    if let Some(r) = changed_region(&prev.cmds, cur) {
                        out.insert(id, [r[0] as f64, r[1] as f64, r[2] as f64, r[3] as f64]);
                    }
                }
            }
        }
        let drawn = CanvasDrawn { cmds: cur.clone(), rect, props: node.props.clone() };
        s.canvas_drawn.insert(id, drawn);
    }
    s.canvas_drawn.retain(|id, _| s.js_nodes.contains_key(id));
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use glyx_renderer::{AnyFrame, TinySkiaRenderer};

    fn rect(x: f32, y: f32, w: f32, h: f32, c: [u8; 4]) -> CanvasCmd { CanvasCmd::FillRect { x, y, w, h, color: c } }
    fn line(x0: f32, y0: f32, x1: f32, y1: f32) -> CanvasCmd {
        CanvasCmd::StrokeLine { x0, y0, x1, y1, color: [255, 255, 255, 255], line_width: 1.0 }
    }
    fn inside(r: Region, x: f32, y: f32) -> bool { x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3] }

    #[test]
    fn identical_draws_have_an_empty_region() {
        let a = vec![rect(0.0, 0.0, 10.0, 10.0, [1; 4]), line(0.0, 5.0, 50.0, 5.0)];
        let r = changed_region(&a, &a.clone()).unwrap();
        assert!(r[0] > r[2], "empty: nothing to repaint");
    }

    #[test]
    fn a_moved_command_damages_where_it_was_and_where_it_is() {
        let old = vec![rect(0.0, 0.0, 500.0, 300.0, [9; 4]), line(40.0, 0.0, 40.0, 100.0)];
        let new = vec![rect(0.0, 0.0, 500.0, 300.0, [9; 4]), line(90.0, 0.0, 90.0, 100.0)];
        let r = changed_region(&old, &new).unwrap();
        assert!(inside(r, 40.0, 50.0) && inside(r, 90.0, 50.0), "both positions");
        assert!(!inside(r, 300.0, 50.0) && !inside(r, 40.0, 200.0), "and nothing like the whole canvas: {r:?}");
    }

    #[test]
    fn an_added_or_removed_command_damages_only_itself() {
        let bg = rect(0.0, 0.0, 500.0, 300.0, [9; 4]);
        let old = vec![bg.clone(), line(10.0, 10.0, 60.0, 10.0)];
        let new = vec![bg.clone(), line(10.0, 10.0, 60.0, 10.0), line(200.0, 40.0, 200.0, 90.0)];
        let r = changed_region(&old, &new).unwrap();
        assert!(inside(r, 200.0, 60.0));
        assert!(!inside(r, 10.0, 10.0), "the unchanged line is left alone: {r:?}");
        let back = changed_region(&new, &old).unwrap();
        assert!(inside(back, 200.0, 60.0) && !inside(back, 10.0, 10.0));
    }

    #[test]
    fn a_changed_clip_cannot_be_bounded() {
        let a = vec![CanvasCmd::PushClip { x: 0.0, y: 0.0, w: 50.0, h: 50.0 }, line(0.0, 0.0, 40.0, 40.0), CanvasCmd::PopClip];
        let mut b = a.clone();
        b[0] = CanvasCmd::PushClip { x: 0.0, y: 0.0, w: 80.0, h: 50.0 };
        assert!(changed_region(&a, &b).is_none());
        // Same clip, something inside it moved: fine.
        let mut c = a.clone();
        c[1] = line(0.0, 0.0, 30.0, 30.0);
        assert!(changed_region(&a, &c).is_some());
    }

    #[test]
    fn very_long_lists_of_different_lengths_are_not_compared() {
        let many = |n: usize| (0..n).map(|i| line(i as f32, 0.0, i as f32, 9.0)).collect::<Vec<_>>();
        assert!(changed_region(&many(300), &many(301)).is_none());
        assert!(changed_region(&many(300), &many(300)).is_some());
    }

    #[test]
    fn the_partial_region_is_used_only_when_nothing_else_about_the_node_changed() {
        let rect = (20.0, 30.0, 400.0, 200.0);
        let plain = (20.0, 30.0, 420.0, 230.0);
        let local = [50.0, 10.0, 70.0, 190.0];
        // Where it was, no transform, not scrolled: the changed strip, in screen space.
        assert_eq!(partial_rect(rect, plain, Some(rect), false, local), Some((70.0, 40.0, 20.0, 180.0)));
        // Moved or resized since last frame: the whole node.
        assert_eq!(partial_rect(rect, plain, Some((20.0, 31.0, 400.0, 200.0)), false, local), None);
        assert_eq!(partial_rect(rect, plain, None, false, local), None);
        // Inside a scrolled ancestor: the whole node.
        assert_eq!(partial_rect(rect, plain, Some(rect), true, local), None);
        // A transform or shadow means it draws somewhere else than its rect: the whole node.
        assert_eq!(partial_rect(rect, (10.0, 30.0, 420.0, 230.0), Some(rect), false, local), None);
        // A region reaching outside the canvas is cut to it.
        assert_eq!(partial_rect(rect, plain, Some(rect), false, [-30.0, -30.0, 900.0, 900.0]), Some((20.0, 30.0, 400.0, 200.0)));
        // Nothing changed: a minimal region, never "none" (that would mean the whole frame).
        assert_eq!(partial_rect(rect, plain, Some(rect), false, EMPTY.map(f64::from)), Some((20.0, 30.0, 1.0, 1.0)));
    }

    // ── The test that matters: no pixel outside the region ever changes ───────────

    const OX: f64 = 20.0;
    const OY: f64 = 10.0;
    const CW: u32 = 360;
    const CH: u32 = 240;
    const WIN_W: u32 = 400;
    const WIN_H: u32 = 270;
    /// Every random command stays at least this far inside the canvas, so none ever crosses its
    /// clip edge. Crossing builds a clip mask, and the masked pipeline rounds blended pixels
    /// differently (by a few levels) from the unmasked one: two draws of the *same* command
    /// would then differ, which says nothing about whether the region is right.
    const MARGIN: f32 = 40.0;

    /// Draws a command list the way the Canvas node does: clipped to the canvas
    /// rect, text through the text system, clips pushed and popped.
    fn render(cmds: &[CanvasCmd], ts: &mut glyx_text::TextSystem) -> Vec<u8> {
        let mut r = TinySkiaRenderer::new_cpu_only(WIN_W, WIN_H);
        let mut frame = AnyFrame::TinySkia(r.begin_frame());
        frame.fill_rect(0.0, 0.0, WIN_W as f64, WIN_H as f64, crate::rgba_to_vello([13, 14, 22, 255]));
        frame.push_layer(OX, OY, CW as f64, CH as f64);
        let mut depth = 0;
        for cmd in cmds {
            match cmd {
                CanvasCmd::FillText { text, x, y, font_size, color, bold } => {
                    let layout = if *bold { ts.styled_label(text, *font_size, f32::MAX, true, false, None) } else { ts.label(text, *font_size) };
                    frame.draw_text(&layout, OX + *x as f64, OY + *y as f64, crate::rgba_to_vello(*color));
                }
                CanvasCmd::PushClip { x, y, w, h } => { frame.push_layer(OX + *x as f64, OY + *y as f64, *w as f64, *h as f64); depth += 1; }
                CanvasCmd::PopClip => { if depth > 0 { frame.pop_layer(); depth -= 1; } }
                _ => crate::render::draw_canvas_cmd(&mut frame, cmd, OX, OY, 1.0),
            }
        }
        for _ in 0..depth { frame.pop_layer(); }
        frame.pop_layer();
        let AnyFrame::TinySkia(f) = frame else { unreachable!() };
        let mut out = Vec::new();
        r.finish_frame_soft(f, |px, _, _, _| out = px.to_vec());
        out
    }

    /// A small deterministic generator, so a failure reproduces.
    struct Rng(u64);
    impl Rng {
        fn next(&mut self) -> u32 { self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); (self.0 >> 33) as u32 }
        fn f(&mut self, lo: f32, hi: f32) -> f32 { lo + (self.next() % 10_000) as f32 / 10_000.0 * (hi - lo) }
        fn pick(&mut self, n: usize) -> usize { self.next() as usize % n }
        fn color(&mut self) -> [u8; 4] { [self.next() as u8, self.next() as u8, self.next() as u8, 90 + (self.next() % 166) as u8] }
    }

    fn random_cmd(r: &mut Rng) -> CanvasCmd {
        let (lo_x, hi_x) = (MARGIN, CW as f32 - MARGIN);
        let (lo_y, hi_y) = (MARGIN, CH as f32 - MARGIN);
        let words = ["12:03", "Total", "1.2k", "Jan", "WWWW", "x"];
        match r.pick(8) {
            0 => CanvasCmd::FillRect { x: r.f(lo_x, hi_x - 70.0), y: r.f(lo_y, hi_y - 50.0), w: r.f(2.0, 70.0), h: r.f(2.0, 50.0), color: r.color() },
            1 => CanvasCmd::StrokeRect { x: r.f(lo_x, hi_x - 70.0), y: r.f(lo_y, hi_y - 50.0), w: r.f(4.0, 70.0), h: r.f(4.0, 50.0), color: r.color(), line_width: r.f(1.0, 5.0) },
            2 => CanvasCmd::FillCircle { cx: r.f(lo_x + 25.0, hi_x - 25.0), cy: r.f(lo_y + 25.0, hi_y - 25.0), r: r.f(2.0, 25.0), color: r.color() },
            3 => CanvasCmd::StrokeCircle { cx: r.f(lo_x + 25.0, hi_x - 25.0), cy: r.f(lo_y + 25.0, hi_y - 25.0), r: r.f(3.0, 25.0), color: r.color(), line_width: r.f(1.0, 6.0) },
            4 => CanvasCmd::StrokeLine { x0: r.f(lo_x, hi_x), y0: r.f(lo_y, hi_y), x1: r.f(lo_x, hi_x), y1: r.f(lo_y, hi_y), color: r.color(), line_width: r.f(1.0, 6.0) },
            // Sizes a quarter pixel apart or more: the glyph cache shares one bitmap between sizes
            // closer than that, so two near-equal sizes would make an unchanged text render
            // slightly differently depending on which was drawn first. That is the renderer's own
            // business, not the damage region's.
            5 => CanvasCmd::FillText { text: words[r.pick(words.len())].into(), x: r.f(lo_x, hi_x - 90.0), y: r.f(lo_y, hi_y - 40.0), font_size: [10.0, 13.0, 16.0, 20.0][r.pick(4)], color: r.color(), bold: r.pick(2) == 0 },
            6 => {
                let n = 3 + r.pick(5);
                let points = (0..n).flat_map(|_| [r.f(lo_x, hi_x), r.f(lo_y, hi_y)]).collect();
                CanvasCmd::FillPath { points, color: r.color() }
            }
            _ => {
                let n = 3 + r.pick(6);
                let points = (0..n).flat_map(|_| [r.f(lo_x, hi_x), r.f(lo_y, hi_y)]).collect();
                CanvasCmd::StrokePath { points, color: r.color(), line_width: r.f(1.0, 6.0), closed: r.pick(2) == 0 }
            }
        }
    }

    fn mutate(cmds: &mut Vec<CanvasCmd>, r: &mut Rng) {
        match r.pick(6) {
            0 if !cmds.is_empty() => { let i = r.pick(cmds.len()); cmds[i] = random_cmd(r); }                 // replace one
            1 if !cmds.is_empty() => { let i = r.pick(cmds.len()); cmds.remove(i); }                          // remove one
            2 => { let i = r.pick(cmds.len() + 1); let c = random_cmd(r); cmds.insert(i, c); }               // add one
            3 if cmds.len() > 1 => { let (i, j) = (r.pick(cmds.len()), r.pick(cmds.len())); cmds.swap(i, j); } // reorder
            4 if !cmds.is_empty() => {                                                                          // recolour
                let i = r.pick(cmds.len());
                let c = r.color();
                match &mut cmds[i] {
                    CanvasCmd::FillRect { color, .. } | CanvasCmd::StrokeRect { color, .. } | CanvasCmd::FillCircle { color, .. }
                    | CanvasCmd::StrokeCircle { color, .. } | CanvasCmd::StrokeLine { color, .. } | CanvasCmd::FillText { color, .. }
                    | CanvasCmd::FillPath { color, .. } | CanvasCmd::StrokePath { color, .. } => *color = c,
                    _ => {}
                }
            }
            _ if !cmds.is_empty() => {                                                                          // nudge a position
                let i = r.pick(cmds.len());
                let (dx, dy) = (r.f(-12.0, 12.0), r.f(-12.0, 12.0));
                match &mut cmds[i] {
                    CanvasCmd::FillRect { x, y, .. } | CanvasCmd::StrokeRect { x, y, .. } | CanvasCmd::FillText { x, y, .. } => { *x += dx; *y += dy; }
                    CanvasCmd::FillCircle { cx, cy, .. } | CanvasCmd::StrokeCircle { cx, cy, .. } => { *cx += dx; *cy += dy; }
                    CanvasCmd::StrokeLine { x0, y0, x1, y1, .. } => { *x0 += dx; *y0 += dy; *x1 += dx; *y1 += dy; }
                    CanvasCmd::FillPath { points, .. } | CanvasCmd::StrokePath { points, .. } => for p in points.chunks_exact_mut(2) { p[0] += dx; p[1] += dy; },
                    _ => {}
                }
            }
            _ => {}
        }
    }

    /// Renders random edits and checks that nothing outside the reported region changed.
    fn check_regions(seed: u64, trials: usize) {
        let mut ts = glyx_text::TextSystem::new();
        let mut rng = Rng(seed);
        let (mut bounded, mut area_sum) = (0u32, 0f64);
        for trial in 0..trials {
            let mut old: Vec<CanvasCmd> = (0..6 + rng.pick(10)).map(|_| random_cmd(&mut rng)).collect();
            if trial % 7 == 0 { old.insert(rng.pick(old.len() + 1), CanvasCmd::PushClip { x: 10.0, y: 10.0, w: CW as f32 - 20.0, h: CH as f32 - 20.0 }); old.push(CanvasCmd::PopClip); }
            let mut new = old.clone();
            for _ in 0..1 + rng.pick(3) { mutate(&mut new, &mut rng); }

            let Some(region) = changed_region(&old, &new) else { continue };  // whole canvas: always safe
            bounded += 1;
            let (a, b) = (render(&old, &mut ts), render(&new, &mut ts));
            let (l, t) = (OX as f32 + region[0], OY as f32 + region[1]);
            let (r, bt) = (OX as f32 + region[2], OY as f32 + region[3]);
            if region[0] <= region[2] { area_sum += ((region[2].min(CW as f32) - region[0].max(0.0)).max(0.0) * (region[3].min(CH as f32) - region[1].max(0.0)).max(0.0)) as f64 / (CW * CH) as f64; }
            for y in 0..WIN_H {
                for x in 0..WIN_W {
                    let i = ((y * WIN_W + x) * 4) as usize;
                    if a[i..i + 4] != b[i..i + 4] {
                        let (fx, fy) = (x as f32 + 0.5, y as f32 + 0.5);
                        assert!(fx >= l && fx <= r && fy >= t && fy <= bt,
                            "trial {trial}: pixel ({x},{y}) changed but lies outside the region {region:?}\nold: {old:?}\nnew: {new:?}");
                    }
                }
            }
        }
        assert!(bounded as usize > trials / 2, "only {bounded} of {trials} trials were bounded: the check is not exercising much");
        let mean = area_sum / bounded as f64;
        assert!(mean < 0.6, "the regions cover {:.0}% of the canvas on average: this would not save much", mean * 100.0);
    }

    #[test]
    fn no_pixel_outside_the_changed_region_ever_differs() {
        check_regions(0x5EED_CAFE, 250);
    }

    /// A longer run over many seeds; run on demand: `cargo test -p glyx-core stress -- --ignored`.
    #[test]
    #[ignore = "slow stress run"]
    fn stress_no_pixel_outside_the_changed_region() {
        for seed in 1..=24u64 { check_regions(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15), 400); }
    }
}
