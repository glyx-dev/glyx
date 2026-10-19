//! Scrolling by moving what is already on screen, on the CPU renderer.
//!
//! A scroll step used to repaint the whole scroller: every row, clipped to the viewport, although all but a few rows of what it shows are
//! the same pixels a few rows higher or lower. Here the last frame's rows are shifted (`TinySkiaRenderer::begin_frame_scrolled`) and only
//! the rows the scroll exposed, and the scrollbar, are drawn, which makes a scroll step cost about the exposed strip rather than the
//! viewport.
//!
//! That is only right when the scroll is the *only* thing that changed and the pixels of the viewport are nothing but the scroller's own
//! background and its content. So this is deliberately strict, and every doubt means "repaint it all" as before:
//!
//! * the scroller is the only node marked dirty (a scroll marks just the scroller; a content change marks its own node), nothing is
//!   animating, and it scrolled by a whole number of pixels since the last frame (scroll offsets are whole pixels: `render::child_scroll_of`);
//! * it has an opaque background of its own, no border, radius, shadow, gradient, transform or opacity, none of its ancestors transform,
//!   fade, scroll, or clip with a rounded corner, and its rectangle is whole pixels inside the window;
//! * nothing outside it that draws anything overlaps it (a sibling on top, a popup), and nothing inside it is drawn by the OS
//!   (3D, camera, video, web view);
//! * no text cursor is blinking.
//!
//! `GLYX_SCROLL_BLIT=0` turns it off.

use crate::state::PerWindowState;
use glyx_runtime::bindings::{NodeType, NodeProps};

/// A scroll step done by moving the last frame.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ScrollBlit {
    /// The scroller's viewport `[x, y, w, h]`: whole pixels, inside the window.
    pub region: [i32; 4],
    /// Rows the content moved up (negative: down).
    pub dy: i32,
    /// What has to be drawn: the rows the scroll exposed and the scrollbars.
    pub damage: Vec<(f64, f64, f64, f64)>,
}

/// The vertical scrollbar of the scroller, for `damage_strips`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct VBar {
    /// The track's and thumb's width.
    pub width: f64,
    /// The thumb as it was drawn last frame, and as it will be now: `(x, y, w, h)`; `None` when the content fits and there is none.
    pub old_thumb: Option<(f64, f64, f64, f64)>,
    pub new_thumb: Option<(f64, f64, f64, f64)>,
}

/// The rectangles to draw after the rows of `region` moved by `dy`.
///
/// The exposed rows at one end. Then the scrollbar: its translucent track is the same along its whole height, so it moves with the content
/// without any error and the column is *not* redrawn (redrawing a column the height of the viewport redraws everything that touches the
/// right edge). What does not survive the move is: the thumb, which is somewhere else now (drawn at its new place), the ghost of the old
/// thumb that moved with the content (the old rectangle shifted by `dy`), and the rounded ends of the track, which belong to the top and
/// bottom of the viewport (a thumb-width of rows at each). A horizontal scrollbar's track sits on the bottom rows, which the content just moved
/// under, so its row is redrawn whole.
pub(crate) fn damage_strips(region: [i32; 4], dy: i32, vbar: Option<VBar>, hbar: Option<f64>) -> Vec<(f64, f64, f64, f64)> {
    let [x, y, w, h] = region.map(f64::from);
    let d = f64::from(dy.abs());
    let mut out = vec![if dy > 0 { (x, y + h - d, w, d) } else { (x, y, w, d) }];
    // Everything below stays inside the viewport and a pixel wider than what it covers (anti-aliased edges).
    let mut push = |r: (f64, f64, f64, f64)| {
        let (l, t, rr, b) = ((r.0 - 1.0).max(x), (r.1 - 1.0).max(y), (r.0 + r.2 + 1.0).min(x + w), (r.1 + r.3 + 1.0).min(y + h));
        if rr > l && b > t { out.push((l, t, rr - l, b - t)); }
    };
    if let Some(bar) = vbar {
        let col = x + w - bar.width;
        if let Some(t) = bar.new_thumb { push(t); }
        if let Some(t) = bar.old_thumb { push((t.0, t.1 - f64::from(dy), t.2, t.3)); }
        if bar.new_thumb.is_some() || bar.old_thumb.is_some() {
            push((col, y, bar.width, bar.width));
            push((col, y + h - bar.width, bar.width, bar.width));
            // The caps the last frame had were moved with everything else.
            push((col, y - f64::from(dy), bar.width, bar.width));
            push((col, y + h - bar.width - f64::from(dy), bar.width, bar.width));
        }
    }
    const MARGIN: f64 = 4.0;
    if let Some(bw) = hbar { push((x, y + h - (bw + MARGIN), w, bw + MARGIN)); }
    out
}

fn enabled() -> bool {
    static ON: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *ON.get_or_init(|| std::env::var("GLYX_SCROLL_BLIT").as_deref() != Ok("0"))
}

fn whole(v: f32) -> Option<i32> { ((v - v.round()).abs() < 0.01).then(|| v.round() as i32) }

fn is_clip(p: &NodeProps) -> bool { p.clip.unwrap_or(false) || matches!(p.overflow.as_deref(), Some("hidden" | "scroll")) }

fn opaque(p: &NodeProps) -> bool { p.opacity.map_or(true, |o| o >= 0.999) }

/// Whether a node (other than the scroller, its content or its ancestors) puts anything on screen where it is.
fn paints(n: &crate::state::JsNode) -> bool {
    if n.props.hidden == Some(true) { return false; }
    !matches!(n.node_type, NodeType::View)
        || n.props.background_color.map_or(false, |c| c[3] > 0)
        || n.props.border_width.unwrap_or(0.0) > 0.0
        || n.box_shadow.is_some()
        || n.gradient.is_some()
}

/// `GLYX_SCROLL_BLIT_TRACE=1`: say why a frame was not done as a scroll blit (once per change of reason), to find what keeps it off.
fn why(reason: &str) -> Option<ScrollBlit> {
    static ON: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    static LAST: std::sync::Mutex<String> = std::sync::Mutex::new(String::new());
    if *ON.get_or_init(|| std::env::var_os("GLYX_SCROLL_BLIT_TRACE").is_some()) {
        if let Ok(mut last) = LAST.lock() {
            if *last != reason { *last = reason.to_string(); eprintln!("[scroll-blit] not used: {reason}"); }
        }
    }
    None
}

/// The blit to do for this frame, if it is a pure scroll of one scroller. See the module doc for when that is.
pub(crate) fn detect(s: &PerWindowState, cursor_blinking: bool) -> Option<ScrollBlit> {
    if !enabled() { return None; }
    if cursor_blinking || s.cursor_was_active { return why("a text cursor is active"); }
    // Only the scroller is dirty (a scroll marks just it, and its descendants in the cascade set, which is for scene caches).
    if s.dirty_nodes.len() != 1 { return why("not exactly one dirty node"); }
    let id = *s.dirty_nodes.iter().next()?;
    if !s.descendant_cascade_nodes.iter().all(|&c| c == id) { return why("another node is in the descendant cascade"); }
    // Nothing else moves by itself.
    if !s.transitions.is_empty() || !s.canvas_tweens.is_empty() || s.animations.values().any(|a| !a.settled) { return why("something is animating"); }

    let node = s.js_nodes.get(&id)?;
    let p = &node.props;
    if !matches!(node.node_type, NodeType::View) || !is_clip(p) || p.hidden == Some(true) { return why("the dirty node is not a clipping view"); }
    let Some(own_y) = p.scroll_offset_y else { return why("the dirty node is not a scroller") };
    if node.transform.is_some() || node.box_shadow.is_some() || node.gradient.is_some() || !opaque(p) { return why("the scroller has a transform, shadow, gradient or opacity"); }
    if !p.background_color.map_or(false, |c| c[3] == 255) { return why("the scroller has no opaque background"); }
    if p.border_radius.unwrap_or(0.0) > 0.0 || p.border_width.unwrap_or(0.0) > 0.0 { return why("the scroller has a radius or border"); }

    // Its place: whole pixels, entirely in the window.
    let rl = s.resolved_rect(node.layout_id?)?;
    let (Some(x), Some(y), Some(w), Some(h)) = (whole(rl.x), whole(rl.y), whole(rl.width), whole(rl.height)) else { return why("the scroller's rectangle is not whole pixels") };
    let (win_w, win_h) = (s.gpu.width() as i32, s.gpu.height() as i32);
    if w < 8 || h < 8 || x < 0 || y < 0 || x + w > win_w || y + h > win_h { return why("the scroller is not wholly inside the window"); }

    // What is around it: no ancestor that moves, fades, scrolls, or clips it with a rounded corner.
    let mut ancestors = std::collections::HashSet::new();
    let mut cur = node.parent;
    while let Some(pid) = cur {
        let a = s.js_nodes.get(&pid)?;
        if a.transform.is_some() || !opaque(&a.props) { return why("an ancestor transforms or fades"); }
        if a.props.scroll_offset_y.unwrap_or(0.0) != 0.0 || a.props.scroll_offset_x.unwrap_or(0.0) != 0.0 { return why("an ancestor is scrolled"); }
        if is_clip(&a.props) && a.props.border_radius.unwrap_or(0.0) > 0.0 { return why("an ancestor clips with a rounded corner"); }
        if is_clip(&a.props) {
            // A clip that cuts the scroller short moves its scrollbar to the clip's edge, and the rows past the clip are not its own.
            let inside = a.layout_id.and_then(|l| s.resolved_rect(l)).map_or(false, |r| {
                r.x <= rl.x + 0.5 && r.y <= rl.y + 0.5 && r.x + r.width >= rl.x + rl.width - 0.5 && r.y + r.height >= rl.y + rl.height - 0.5
            });
            if !inside { return why("an ancestor's clip cuts the scroller short"); }
        }
        ancestors.insert(pid);
        cur = a.parent;
    }

    // How far it scrolled: what the renderer would pass on now, against what it passed on in the frame just before this one.
    let Some(&(ox, oy, serial)) = s.scroll_drawn.get(&id) else { return why("no record of how the scroller was last drawn") };
    if serial != s.frame_serial { return why("the record of the scroller is not from the last frame"); }
    let rect = (f64::from(rl.x), f64::from(rl.y), f64::from(rl.width), f64::from(rl.height));
    let (mut max_bottom, mut max_right) = (f64::NEG_INFINITY, f64::NEG_INFINITY);
    for &cid in &node.children {
        if let Some(c) = s.js_nodes.get(&cid).and_then(|c| c.layout_id).and_then(|l| s.resolved_rect(l)) {
            max_bottom = max_bottom.max(f64::from(c.y + c.height));
            max_right = max_right.max(f64::from(c.x + c.width));
        }
    }
    let pad = match p.padding { Some(glyx_runtime::bindings::LengthValue::Px(px)) => f64::from(px), _ => 0.0 };
    let own_x = p.scroll_offset_x;
    let (nx, ny) = crate::render::child_scroll_of(
        0.0, 0.0, own_x, Some(own_y), true, max_bottom, if own_x.is_some() { max_right } else { f64::NEG_INFINITY }, pad, rect,
    );
    if nx != ox { return why("the horizontal scroll changed"); }
    let dy = ny - oy;
    if dy == 0.0 || dy.abs() >= f64::from(h) { return why("no scroll step to move (none, or past the viewport)"); }
    let dy = dy as i32;

    // Its content: nothing the OS draws; and who is inside, to tell the rest from the foreign.
    let mut inside = std::collections::HashSet::new();
    let mut stack: Vec<u32> = node.children.iter().copied().collect();
    while let Some(nid) = stack.pop() {
        let Some(n) = s.js_nodes.get(&nid) else { continue };
        if matches!(n.node_type, NodeType::Canvas3D | NodeType::Camera | NodeType::Video | NodeType::WebView) { return why("the OS draws something inside the scroller"); }
        inside.insert(nid);
        stack.extend(n.children.iter().copied());
    }

    // Anything else that draws over the viewport would be moved with it.
    let viewport = (f64::from(x), f64::from(y), f64::from(w), f64::from(h));
    let hits = |r: (f64, f64, f64, f64)| r.0 < viewport.0 + viewport.2 && r.0 + r.2 > viewport.0 && r.1 < viewport.1 + viewport.3 && r.1 + r.3 > viewport.1;
    for (&nid, n) in &s.js_nodes {
        if nid == id || inside.contains(&nid) || ancestors.contains(&nid) || !paints(n) { continue; }
        // Where it is drawn: its own place, or, inside another scroller, that scroller's (which clips it).
        let mut bound = n.layout_id.and_then(|l| s.resolved_rect(l)).map(|r| (f64::from(r.x), f64::from(r.y), f64::from(r.width), f64::from(r.height)));
        let mut up = n.parent;
        while let Some(pid) = up {
            let Some(a) = s.js_nodes.get(&pid) else { break };
            if a.props.scroll_offset_y.is_some() || a.props.scroll_offset_x.is_some() {
                bound = a.layout_id.and_then(|l| s.resolved_rect(l)).map(|r| (f64::from(r.x), f64::from(r.y), f64::from(r.width), f64::from(r.height)));
            }
            up = a.parent;
        }
        match bound { Some(b) if !hits(b) => {} _ => return why("another node draws over the viewport") }
    }

    let show_bar = p.show_scrollbar.unwrap_or(true);
    let bar_w = f64::from(p.scrollbar_width.unwrap_or(8.0));
    // The thumb before and after, as the renderer places it (`render::compute_scrollbar_thumb` with the content height it uses).
    let content_h = max_bottom - rect.1;
    let thumb = |scroll: f64| crate::render::compute_scrollbar_thumb(rect.0, rect.1, rect.2, rect.3, scroll, content_h, bar_w);
    let vbar = (show_bar && max_bottom.is_finite()).then(|| VBar { width: bar_w, old_thumb: thumb(oy), new_thumb: thumb(ny) });
    let damage = damage_strips([x, y, w, h], dy, vbar, (show_bar && own_x.is_some()).then_some(bar_w));
    Some(ScrollBlit { region: [x, y, w, h], dy, damage })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_exposed_rows_are_the_end_the_content_moved_away_from() {
        // Content up by 10 (scrolling down): the new rows are at the bottom.
        assert_eq!(damage_strips([5, 20, 200, 100], 10, None, None), vec![(5.0, 110.0, 200.0, 10.0)]);
        // Content down by 7 (scrolling up): the new rows are at the top.
        assert_eq!(damage_strips([5, 20, 200, 100], -7, None, None), vec![(5.0, 20.0, 200.0, 7.0)]);
    }

    #[test]
    fn a_scrollbar_costs_small_rectangles_not_its_whole_column() {
        let bar = VBar { width: 8.0, old_thumb: Some((292.0, 40.0, 8.0, 50.0)), new_thumb: Some((292.0, 52.0, 8.0, 50.0)) };
        let d = damage_strips([0, 0, 300, 200], 24, Some(bar), None);
        // The exposed rows, the new thumb, the old thumb's ghost (moved up by 24 with the content), the two ends of the track, and where
        // the last frame's ends moved to.
        assert_eq!(d.len(), 6, "{d:?}");
        assert!(d.iter().skip(1).all(|r| r.3 <= 52.0 && r.2 <= 10.0), "none of them is the height of the viewport: {d:?}");
        assert!(d.contains(&(291.0, 51.0, 9.0, 52.0)), "the new thumb, a pixel around (cut at the viewport's edge): {d:?}");
        assert!(d.contains(&(291.0, 15.0, 9.0, 52.0)), "the ghost: the old thumb at rows 40..90 is now at 16..66: {d:?}");
        // With no thumb (the content fits) there is no scrollbar to repair.
        assert_eq!(damage_strips([0, 0, 300, 200], 24, Some(VBar { width: 8.0, old_thumb: None, new_thumb: None }), None).len(), 1);
        // A horizontal scrollbar's row is redrawn whole.
        assert!(damage_strips([0, 0, 300, 200], 24, None, Some(8.0)).contains(&(0.0, 187.0, 300.0, 13.0)));
    }

    /// The whole thing against a full render: a list with the scrollbar the renderer draws (a translucent track the height of the viewport and
    /// a thumb), scrolled by the blit with the damage `damage_strips` names, must match the same offset drawn whole.
    #[test]
    fn a_blit_with_a_scrollbar_matches_a_full_render() {
        use glyx_renderer::{peniko::Color, AnyFrame, TinySkiaRenderer};
        let (win_w, win_h) = (120u32, 100u32);
        let (x, y, w, h) = (8i32, 10i32, 100i32, 80i32);
        let content_h = 400.0;
        let bar_w = 8.0;
        let draw = |frame: &mut AnyFrame, scroll: i32| {
            frame.push_layer(f64::from(x), f64::from(y), f64::from(w), f64::from(h));
            frame.fill_rect(f64::from(x), f64::from(y), f64::from(w), f64::from(h), Color::from_rgba8(30, 32, 44, 255));
            for i in 0..30i32 {
                let ry = f64::from(y + i * 14 - scroll);
                let shade = (50 + i * 6) as u8;
                frame.fill_rect(f64::from(x) + 4.0, ry, 70.0, 11.0, Color::from_rgba8(shade, 140, 255 - shade, 255));
                frame.fill_circle(f64::from(x) + 82.0, ry + 5.5, 3.5, Color::from_rgba8(240, 200, shade, 255));
            }
            // What `draw_scrollbar` does.
            if let Some((tx, ty, tw, th)) = crate::render::compute_scrollbar_thumb(f64::from(x), f64::from(y), f64::from(w), f64::from(h), f64::from(scroll), content_h, bar_w) {
                let bar = Color::from_rgba8(140, 140, 170, 153);
                frame.fill_rounded_rect(tx, f64::from(y), tw, f64::from(h), bar_w * 0.5, bar.multiply_alpha(0.3));
                frame.fill_rounded_rect(tx, ty, tw, th, bar_w * 0.5, bar);
            }
            frame.pop_layer();
        };
        let pixels = |r: &mut TinySkiaRenderer, f: AnyFrame| -> Vec<u8> {
            let AnyFrame::TinySkia(f) = f else { unreachable!() };
            let mut out = Vec::new();
            r.finish_frame_soft(f, |px, _, _, _| out = px.to_vec());
            out
        };
        for (from, to) in [(0, 20), (20, 41), (150, 123), (300, 320), (40, 0)] {
            let dy = to - from;
            let mut r = TinySkiaRenderer::new_cpu_only(win_w, win_h);
            let mut f = AnyFrame::TinySkia(r.begin_frame());
            draw(&mut f, from);
            let _ = pixels(&mut r, f);

            let thumb = |s: i32| crate::render::compute_scrollbar_thumb(f64::from(x), f64::from(y), f64::from(w), f64::from(h), f64::from(s), content_h, bar_w);
            let damage = damage_strips([x, y, w, h], dy, Some(VBar { width: bar_w, old_thumb: thumb(from), new_thumb: thumb(to) }), None);
            let mut f = AnyFrame::TinySkia(r.begin_frame_scrolled(&damage, [x, y, w, h], dy));
            draw(&mut f, to);
            let scrolled = pixels(&mut r, f);

            let mut whole_r = TinySkiaRenderer::new_cpu_only(win_w, win_h);
            let mut f = AnyFrame::TinySkia(whole_r.begin_frame());
            draw(&mut f, to);
            let whole = pixels(&mut whole_r, f);

            let worst = scrolled.iter().zip(&whole).map(|(a, b)| (*a as i32 - *b as i32).abs()).max().unwrap_or(0);
            let differing = scrolled.iter().zip(&whole).filter(|(a, b)| a != b).count();
            assert!(worst <= 3 && differing <= 120, "scroll {from} -> {to}: worst channel difference {worst}, {differing} differing bytes");
        }
    }

    #[test]
    fn the_scroll_passed_to_children_is_clamped_to_the_content_and_whole_pixels() {
        use crate::render::child_scroll_of;
        let none = f64::NEG_INFINITY;
        // A box at y = 10, 200 high, with content down to y = 510: it can scroll 300.
        let at = |own: f32, inherited: f64| child_scroll_of(0.0, inherited, None, Some(own), true, 510.0, none, 0.0, (0.0, 10.0, 100.0, 200.0)).1;
        assert_eq!(at(123.6, 0.0), 124.0, "whole pixels");
        assert_eq!(at(999.0, 0.0), 300.0, "no further than the content");
        assert_eq!(at(-30.0, 0.0), 0.0, "not before the top");
        assert_eq!(at(12.4, 40.0), 52.0, "what the scrollers around it pass down is added");
        // Padding makes room below the last child.
        assert_eq!(child_scroll_of(0.0, 0.0, None, Some(999.0), true, 510.0, none, 16.0, (0.0, 10.0, 100.0, 200.0)).1, 316.0);
        // No own x offset: x is just what is inherited.
        assert_eq!(child_scroll_of(7.0, 0.0, None, Some(1.0), true, 510.0, none, 0.0, (0.0, 10.0, 100.0, 200.0)).0, 7.0);
        // A node that does not clip passes its offset on unclamped.
        assert_eq!(child_scroll_of(0.0, 0.0, None, Some(1000.0), false, 510.0, none, 0.0, (0.0, 10.0, 100.0, 200.0)).1, 1000.0);
    }

    #[test]
    fn whole_pixels_only() {
        assert_eq!(whole(12.0), Some(12));
        assert_eq!(whole(12.004), Some(12));
        assert_eq!(whole(12.5), None);
    }

    #[test]
    fn only_a_node_that_draws_something_counts_as_painting_over_the_viewport() {
        use crate::state::JsNode;
        use glyx_runtime::bindings::NodeProps;
        let view = |p: NodeProps| JsNode::new(NodeType::View, p);
        assert!(!paints(&view(NodeProps::default())), "a bare layout box draws nothing");
        assert!(paints(&view(NodeProps { background_color: Some([1, 2, 3, 255]), ..Default::default() })));
        assert!(!paints(&view(NodeProps { background_color: Some([1, 2, 3, 0]), ..Default::default() })), "a transparent fill");
        assert!(paints(&view(NodeProps { border_width: Some(1.0), ..Default::default() })));
        assert!(!paints(&view(NodeProps { background_color: Some([1, 2, 3, 255]), hidden: Some(true), ..Default::default() })));
        assert!(paints(&JsNode::new(NodeType::Text, NodeProps::default())));
        assert!(paints(&JsNode::new(NodeType::Image, NodeProps::default())));
    }
}
