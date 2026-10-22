//! Scrolling by moving what is already on screen, on the CPU renderer.
//!
//! A scroll step used to repaint the whole scroller: every row, clipped to the viewport, although all but a few rows of what it shows are
//! the same pixels a few rows higher or lower. Here the last frame's rows are shifted (`TinySkiaRenderer::begin_frame_scrolled`) and only
//! the rows the scroll exposed, and the scrollbar, are drawn, which makes a scroll step cost about the exposed strip rather than the
//! viewport.
//!
//! That is only right when the scroll is the *only* thing that moved the content and the pixels of the viewport are nothing but the scroller's
//! content over a flat background. So this is deliberately strict, and every doubt means "repaint it all" as before:
//!
//! * exactly one dirty node is a clipping scroller, nothing is animating, and the content moved by a whole number of pixels. The content moves
//!   by the scroll offset the renderer passes on (`render::child_scroll_of`, whole pixels) *plus* what the layout moved it by: a virtualized list
//!   keeps a window of rows laid out from the top, so its rows that stay move in layout the other way. Nodes dirty only for that (same size and
//!   x, one common delta: `PerWindowState::layout_only_dirty`) count as content that moved with the shift;
//! * every other dirty node is inside the scroller and gets its own rectangles repainted (where its pixels went and where it is now); a change
//!   that covers most of the viewport is a repaint;
//! * the scroller has an opaque background, or what lies under it is flat (ancestors without a gradient or image; a border it is flush with and
//!   rounded corners are repaired as thin strips and squares); no radius, border, shadow, gradient, transform or opacity of its own; none of its
//!   ancestors transform, fade or scroll, and a clip around it may cut only its right side (the list as wide as its table);
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

/// The same area as `rects`, as rectangles that do not overlap.
fn disjoint(rects: Vec<(f64, f64, f64, f64)>) -> Vec<(f64, f64, f64, f64)> {
    let mut out: Vec<(f64, f64, f64, f64)> = Vec::new();
    for r in rects {
        let mut pieces = vec![r];
        for e in &out {
            let mut next = Vec::new();
            for p in pieces {
                let (pl, pt, pr, pb) = (p.0, p.1, p.0 + p.2, p.1 + p.3);
                let (el, et, er, eb) = (e.0, e.1, e.0 + e.2, e.1 + e.3);
                if er <= pl || el >= pr || eb <= pt || et >= pb { next.push(p); continue; }
                // What of `p` lies above, below, left of and right of `e`.
                if et > pt { next.push((pl, pt, p.2, et - pt)); }
                if eb < pb { next.push((pl, eb, p.2, pb - eb)); }
                let (mt, mb) = (pt.max(et), pb.min(eb));
                if el > pl { next.push((pl, mt, el - pl, mb - mt)); }
                if er < pr { next.push((er, mt, pr - er, mb - mt)); }
            }
            pieces = next;
        }
        out.extend(pieces);
    }
    out
}

fn enabled() -> bool {
    static ON: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *ON.get_or_init(|| glyx_settings::global().bool("render.scrollBlit"))
}

fn whole(v: f32) -> Option<i32> { ((v - v.round()).abs() < 0.01).then(|| v.round() as i32) }

fn is_clip(p: &NodeProps) -> bool { p.clip.unwrap_or(false) || matches!(p.overflow.as_deref(), Some("hidden" | "scroll")) }

fn opaque(p: &NodeProps) -> bool { p.opacity.map_or(true, |o| o >= 0.999) }

/// Whether a node (other than the scroller, its content or its ancestors) puts anything on screen where it is.
fn paints(n: &crate::state::JsNode) -> bool {
    if n.props.hidden == Some(true) { return false; }
    !matches!(n.node_type, NodeType::View)
        || n.props.background_color.map_or(false, |c| c[3] > 0)
        || n.props.has_border()
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
    // The scroller is the one dirty node that is a clipping scroller; the others must turn out to be inside it (see below).
    let mut scrollers = s.dirty_nodes.iter().copied().filter(|i| {
        s.js_nodes.get(i).map_or(false, |n| matches!(n.node_type, NodeType::View) && is_clip(&n.props) && n.props.scroll_offset_y.is_some())
    });
    let Some(id) = scrollers.next() else { return why("no scroller among the dirty nodes") };
    if scrollers.next().is_some() { return why("more than one scroller is dirty"); }
    // Nothing else moves by itself.
    if !s.transitions.is_empty() || !s.canvas_tweens.is_empty() || s.animations.values().any(|a| !a.settled) {
        return why(&format!("something is animating (transitions {}, canvas tweens {}, animations {})", s.transitions.len(), s.canvas_tweens.len(), s.animations.values().filter(|a| !a.settled).count()));
    }

    let node = s.js_nodes.get(&id)?;
    let p = &node.props;
    if !matches!(node.node_type, NodeType::View) || !is_clip(p) || p.hidden == Some(true) { return why("the dirty node is not a clipping view"); }
    let Some(own_y) = p.scroll_offset_y else { return why("the dirty node is not a scroller") };
    if node.transform.is_some() || node.box_shadow.is_some() || node.gradient.is_some() || !opaque(p) { return why("the scroller has a transform, shadow, gradient or opacity"); }
    let own_opaque = p.background_color.map_or(false, |c| c[3] == 255);
    if p.effective_border_radii().iter().any(|r| *r > 0.0) || p.has_border() { return why("the scroller has a radius or border"); }

    // Its place: whole pixels, entirely in the window.
    let rl = s.resolved_rect(node.layout_id?)?;
    // Its visible width: a list as wide as its table is cut off at the right by the pane around it (the renderer puts its scrollbar on that
    // edge: `visible_w` in `render.rs`). Any other cut is beyond this.
    let mut vis_right = rl.x + rl.width;
    let mut up = node.parent;
    while let Some(pid) = up {
        let a = s.js_nodes.get(&pid)?;
        if is_clip(&a.props) {
            if let Some(r) = a.layout_id.and_then(|l| s.resolved_rect(l)) { vis_right = vis_right.min(r.x + r.width); }
        }
        up = a.parent;
    }
    let (Some(x), Some(y), Some(w), Some(h)) = (whole(rl.x), whole(rl.y), whole(vis_right - rl.x), whole(rl.height)) else { return why("the scroller's visible rectangle is not whole pixels") };
    let (win_w, win_h) = (s.gpu.width() as i32, s.gpu.height() as i32);
    if w < 8 || h < 8 || x < 0 || y < 0 || x + w > win_w || y + h > win_h { return why("the scroller is not wholly inside the window"); }

    // What is around it: no ancestor that moves, fades, scrolls, or clips it with a rounded corner.
    let mut ancestors = std::collections::HashSet::new();
    let mut rounded: Vec<((f64, f64, f64, f64), f64)> = Vec::new();
    let mut edge_rows = 0.0_f64;
    let mut cur = node.parent;
    while let Some(pid) = cur {
        let a = s.js_nodes.get(&pid)?;
        if a.transform.is_some() || !opaque(&a.props) { return why("an ancestor transforms or fades"); }
        if a.props.scroll_offset_y.unwrap_or(0.0) != 0.0 || a.props.scroll_offset_x.unwrap_or(0.0) != 0.0 { return why("an ancestor is scrolled"); }
        if a.props.effective_border_radii().iter().any(|r| *r > 0.0) {
            // Its rounded corners cut the viewport where it is flush with them: those few pixels are not the same after a shift (see below).
            // Per-corner radii are conservatively not blit; extending the corner repair to four radii is out of scope.
            let radii = a.props.effective_border_radii().map(f64::from);
            if !crate::border::radii_are_uniform(radii) { return why("a rounded ancestor has per-corner radii"); }
            let Some(r) = a.layout_id.and_then(|l| s.resolved_rect(l)) else { return why("a rounded ancestor has no layout") };
            rounded.push(((f64::from(r.x), f64::from(r.y), f64::from(r.width), f64::from(r.height)), radii[0]));
        }
        if is_clip(&a.props) {
            // A clip may cut the scroller's right side (the visible width above) but not its top, left or bottom.
            let inside = a.layout_id.and_then(|l| s.resolved_rect(l)).map_or(false, |r| {
                r.x <= rl.x + 0.5 && r.y <= rl.y + 0.5 && r.y + r.height >= rl.y + rl.height - 0.5
            });
            if !inside { return why("an ancestor's clip cuts the scroller short"); }
        }
        // What shows through a scroller without an opaque background of its own is its ancestors' painting, which a shift would move: fine
        // for a flat colour, not for a gradient, a border or rounded corner the viewport reaches, or a shadow under a see-through box.
        if !own_opaque {
            let ar = a.layout_id.and_then(|l| s.resolved_rect(l));
            let inset = ar.map_or(0.0, |r| f64::from((rl.x - r.x).min(rl.y - r.y).min(r.x + r.width - vis_right).min(r.y + r.height - rl.y - rl.height)));
            let bw = a.props.effective_border_widths().iter().copied().fold(0.0_f64, |m, w| m.max(f64::from(w)));
            let a_opaque = a.props.background_color.map_or(false, |c| c[3] == 255);
            // A border the viewport is flush with shows through it: a column down each side is the same after a shift, but the rows along its
            // top and bottom are not (see below).
            if inset < bw { edge_rows = edge_rows.max(bw - inset.max(0.0)); }
            if a.gradient.is_some() || matches!(a.node_type, NodeType::Image) || (a.box_shadow.is_some() && !a_opaque) {
                return why(&format!("the scroller has no opaque background and an ancestor's painting is not the same all down the viewport (gradient {}, image {}, inset {inset} border {bw}, shadow {})", a.gradient.is_some(), matches!(a.node_type, NodeType::Image), a.box_shadow.is_some()));
            }
        }
        ancestors.insert(pid);
        cur = a.parent;
    }

    // How far it scrolled: what the renderer would pass on now, against what it passed on in the frame just before this one.
    let Some(&(ox, oy, serial)) = s.scroll_drawn.get(&id) else { return why("no record of how the scroller was last drawn") };
    if serial != s.frame_serial { return why("the record of the scroller is not from the last frame"); }
    let rect = (f64::from(rl.x), f64::from(rl.y), f64::from(rl.width), f64::from(rl.height));
    let vis_w = f64::from(w);
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
    // Its content: nothing the OS draws; and who is inside, to tell the rest from the foreign.
    let mut inside = std::collections::HashSet::new();
    let mut stack: Vec<u32> = node.children.iter().copied().collect();
    while let Some(nid) = stack.pop() {
        let Some(n) = s.js_nodes.get(&nid) else { continue };
        if matches!(n.node_type, NodeType::Canvas3D | NodeType::Camera | NodeType::Video | NodeType::WebView) { return why("the OS draws something inside the scroller"); }
        inside.insert(nid);
        stack.extend(n.children.iter().copied());
    }

    if nx != ox { return why("the horizontal scroll changed"); }
    // How far the content moved on screen. The scroll the renderer passes on is one part; the other is a layout that moves content itself: a
    // virtualized list keeps only a window of rows, laid out from the top of the list, so when the window advances the rows that stay are
    // *laid out* higher by what it advanced while the scroll offset is lower by the same, and the screen sees the sum. Rows that moved that way
    // with nothing else changed (`layout_only_dirty`, same size and x) all have the same layout delta `lay`; any other mix is not a shift.
    let mut lay: Option<f64> = None;
    for &d in &s.layout_only_dirty {
        let Some(dn) = s.js_nodes.get(&d) else { continue };
        if d == id || !inside.contains(&d) || !paints(dn) { continue; }
        let (Some(prev), Some(r)) = (s.prev_resolved.get(&d), dn.layout_id.and_then(|l| s.resolved_rect(l))) else { continue };
        if prev.x != r.x || prev.width != r.width || prev.height != r.height { return why("a node moved sideways or changed size"); }
        let delta = f64::from(r.y - prev.y);
        match lay { None => lay = Some(delta), Some(v) if (v - delta).abs() < 0.01 => {}, _ => return why("nodes moved in layout by different amounts") }
    }
    let lay = lay.unwrap_or(0.0);
    let dy = (ny - oy) - lay;
    if dy == 0.0 || dy.abs() >= f64::from(h) { return why("no scroll step to move (none, or past the viewport)"); }
    if (dy - dy.round()).abs() > 0.01 { return why("the content moved by a fraction of a pixel"); }
    let dy = dy.round() as i32;

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
            // A scroller that is not scrolled leaves what it holds where its layout puts it; a scrolled one could show it anywhere inside.
            if a.props.scroll_offset_y.unwrap_or(0.0) != 0.0 || a.props.scroll_offset_x.unwrap_or(0.0) != 0.0 {
                bound = a.layout_id.and_then(|l| s.resolved_rect(l)).map(|r| (f64::from(r.x), f64::from(r.y), f64::from(r.width), f64::from(r.height)));
            }
            up = a.parent;
        }
        // (No layout: not drawn at all.)
        if let Some(b) = bound { if hits(b) { return why(&format!("another node draws over the viewport (node {nid}, {:?}, bound {b:?}, parent {:?})", n.node_type, n.parent)); } }
    }

    // The other dirty nodes: new rows, a row whose content changed, rows that moved or went. Each must be inside the scroller, and what it
    // needs repainted is its old and its new rectangle. In the shifted frame the old pixels sit where the node's layout rectangle puts them
    // *now* (it was drawn at layout - old scroll, and moved by -dy: layout - new scroll), so both rectangles are layout rectangles minus
    // the scroll the children get. Nodes that draw nothing of their own (spacers, plain wrappers) need nothing: what they hold is dirty on
    // its own account.
    let mut extra: Vec<(f64, f64, f64, f64)> = Vec::new();
    let no_overrides = std::collections::HashMap::new();
    let rect_of = |i: u32| -> Option<(f64, f64, f64, f64)> {
        let r = s.resolved_rect(s.js_nodes.get(&i)?.layout_id?)?;
        Some((f64::from(r.x), f64::from(r.y), f64::from(r.width), f64::from(r.height)))
    };
    // Where a node is drawn now (its layout rectangle less the scroll the children get), and where the pixels it was drawn with are after the
    // shift: where it was drawn (layout less the old scroll), moved up by `dy`.
    let shifted = |l: f64, t: f64, r: f64, b: f64| (l - nx - 4.0, t - ny - 4.0, r - l + 8.0, b - t + 8.0);
    let ghost = |l: f64, t: f64, r: f64, b: f64| (l - ox - 4.0, t - oy - f64::from(dy) - 4.0, r - l + 8.0, b - t + 8.0);
    for &d in &s.dirty_nodes {
        if d == id { continue; }
        let Some(dn) = s.js_nodes.get(&d) else {
            // Gone this frame. Where it was drawn last: its own rectangle if it was inside the scroller, which is shifted, or if it
            // was somewhere else, which is not; the damage covers both readings.
            if let Some(&(l, t, r, b)) = s.prev_visual.get(&d) {
                extra.push(ghost(l, t, r, b));
                extra.push((l - 4.0, t - 4.0, r - l + 8.0, b - t + 8.0));
            }
            continue;
        };
        if !inside.contains(&d) { return why("a dirty node is outside the scroller"); }
        // Anything between it and the scroller that moves or scrolls its drawing by itself is beyond this.
        let mut up = dn.parent;
        while let Some(pid) = up {
            if pid == id { break; }
            let Some(a) = s.js_nodes.get(&pid) else { break };
            if a.transform.is_some() || a.props.scroll_offset_y.is_some() || a.props.scroll_offset_x.is_some() { return why("a dirty node is in a transformed or scrolled wrapper"); }
            up = a.parent;
        }
        if dn.transform.is_some() { return why("a dirty node has a transform"); }
        if !paints(dn) { continue; }
        // Moved with the content, nothing else: its pixels are right where the shift put them.
        if s.layout_only_dirty.contains(&d) { continue; }
        match crate::scene::visual_bounds(&s.js_nodes, &rect_of, &no_overrides, d) {
            Some((l, t, r, b)) => extra.push(shifted(l, t, r, b)),
            None => return why("a dirty node has no layout yet"),
        }
        match (s.prev_visual.get(&d), s.prev_resolved.get(&d)) {
            (Some(&(l, t, r, b)), _) => extra.push(ghost(l, t, r, b)),
            (None, Some(p)) => extra.push(ghost(f64::from(p.x), f64::from(p.y), f64::from(p.x + p.width), f64::from(p.y + p.height))),
            _ => {}
        }
    }
    // What is left of the cascade set (descendants a scroll marked for scene caches, which the CPU renderer does not use) must be inside too.
    if !s.descendant_cascade_nodes.iter().all(|c| *c == id || inside.contains(c) || !s.js_nodes.contains_key(c)) { return why("a node outside the scroller is in the descendant cascade"); }

    let show_bar = p.show_scrollbar.unwrap_or(true);
    let bar_w = f64::from(p.scrollbar_width.unwrap_or(8.0));
    // The thumb before and after, as the renderer places it (`render::compute_scrollbar_thumb` with the content height it uses).
    let content_h = max_bottom - rect.1;
    let thumb = |scroll: f64| crate::render::compute_scrollbar_thumb(rect.0, rect.1, vis_w, rect.3, scroll, content_h, bar_w);
    let vbar = (show_bar && max_bottom.is_finite()).then(|| VBar { width: bar_w, old_thumb: thumb(oy), new_thumb: thumb(ny) });
    let mut damage = damage_strips([x, y, w, h], dy, vbar, (show_bar && own_x.is_some()).then_some(bar_w));
    // The changed nodes' rectangles, cut to the viewport. When they cover most of it (a jump that replaced every row) a plain repaint is cheaper.
    let (vx1, vy1) = (viewport.0 + viewport.2, viewport.1 + viewport.3);
    let mut changed_area = 0.0;
    for (ex, ey, ew, eh) in extra {
        let (l, t, r, b) = (ex.max(viewport.0), ey.max(viewport.1), (ex + ew).min(vx1), (ey + eh).min(vy1));
        if r > l && b > t { damage.push((l, t, r - l, b - t)); changed_area += (r - l) * (b - t); }
    }
    if changed_area > 0.5 * viewport.2 * viewport.3 { return why(&format!("most of the viewport changed besides the scroll ({} of {} px, {} dirty nodes, e.g. {:?})", changed_area as i64, (viewport.2 * viewport.3) as i64, s.dirty_nodes.len(), s.dirty_nodes.iter().take(5).map(|d| (*d, s.js_nodes.get(d).map(|n| format!("{:?}", n.node_type)), s.prev_resolved.get(d).map(|p| (p.x, p.y)), s.js_nodes.get(d).and_then(|n| n.layout_id).and_then(|l| s.resolved_rect(l)).map(|r| (r.x, r.y)))).collect::<Vec<_>>())); }
    // The rows along the viewport's top and bottom that an ancestor's border shows through, where they were and where the shift put them.
    if edge_rows > 0.0 {
        let e = edge_rows.ceil() + 1.0;
        for (t0, b0) in [(viewport.1, viewport.1 + e), (vy1 - e, vy1)] {
            damage.push((viewport.0, t0, viewport.2, b0 - t0));
            let (t2, b2) = ((t0 - f64::from(dy)).max(viewport.1), (b0 - f64::from(dy)).min(vy1));
            if b2 > t2 { damage.push((viewport.0, t2, viewport.2, b2 - t2)); }
        }
    }
    // The corners of rounded clips around the scroller: a square of the radius at each corner that touches the viewport, where the content
    // was, and where the shift moved it to.
    for ((ax, ay, aw, ah), r) in rounded {
        for (cx, cy) in [(ax, ay), (ax + aw - r, ay), (ax, ay + ah - r), (ax + aw - r, ay + ah - r)] {
            let (l, t, rr, b) = (cx.max(viewport.0), cy.max(viewport.1), (cx + r).min(vx1), (cy + r).min(vy1));
            if rr <= l || b <= t { continue; }
            damage.push((l, t, rr - l, b - t));
            let (t2, b2) = ((t - f64::from(dy)).max(viewport.1), (b - f64::from(dy)).min(vy1));
            if b2 > t2 { damage.push((l, t2, rr - l, b2 - t2)); }
        }
    }
    // Most of the changed nodes' rectangles lie inside the exposed rows (the rows that came into view are new): drop what another rectangle
    // already covers, or merging the rest would grow into one box around everything.
    let covered = |a: &(f64, f64, f64, f64), b: &(f64, f64, f64, f64)| a.0 >= b.0 - 0.01 && a.1 >= b.1 - 0.01 && a.0 + a.2 <= b.0 + b.2 + 0.01 && a.1 + a.3 <= b.1 + b.3 + 0.01;
    let all = damage.clone();
    let mut damage: Vec<_> = damage.into_iter().enumerate().filter(|(i, a)| !all.iter().enumerate().any(|(j, b)| j != *i && covered(a, b) && (!covered(b, a) || j < *i))).map(|(_, a)| a).collect();
    damage.dedup();
    if std::env::var_os("GLYX_SCROLL_BLIT_TRACE").is_some() { eprintln!("[scroll-blit] before merging: {} rects, layout-only {}, lay {lay}: {:?}", damage.len(), s.layout_only_dirty.len(), damage.iter().take(14).collect::<Vec<_>>()); }
    // `coalesce` joins rectangles that overlap into the box around them, so a scrollbar column crossing the exposed rows would drag them into
    // one box the size of the viewport. Cut them into pieces that do not overlap first, and it only joins what is really close.
    let damage = crate::damage_rects::coalesce(disjoint(damage));
    if std::env::var_os("GLYX_SCROLL_BLIT_TRACE").is_some() { eprintln!("[scroll-blit] used: dy {dy}, {} dirty nodes, damage {:?}", s.dirty_nodes.len(), damage); }
    Some(ScrollBlit { region: [x, y, w, h], dy, damage })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overlapping_rectangles_are_cut_into_pieces_that_cover_the_same_area_once() {
        let rects = vec![(0.0, 0.0, 100.0, 20.0), (90.0, 0.0, 10.0, 100.0), (0.0, 50.0, 100.0, 2.0), (5.0, 5.0, 10.0, 10.0)];
        let out = disjoint(rects.clone());
        let area = |rs: &[(f64, f64, f64, f64)]| rs.iter().map(|r| r.2 * r.3).sum::<f64>();
        // 100x20 + (10 wide column below the first rect: 80 rows, minus the 2-row strip crossing it) + the strip's 90 left of the column.
        assert_eq!(area(&out), 100.0 * 20.0 + 10.0 * 80.0 + 90.0 * 2.0);
        for (i, a) in out.iter().enumerate() {
            for b in &out[i + 1..] {
                assert!(a.0 + a.2 <= b.0 || b.0 + b.2 <= a.0 || a.1 + a.3 <= b.1 || b.1 + b.3 <= a.1, "{a:?} overlaps {b:?}");
            }
        }
    }

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
        assert!(paints(&view(NodeProps { border_left_width: Some(1.0), ..Default::default() })));
        assert!(!paints(&view(NodeProps { border_left_width: Some(0.0), ..Default::default() })));
        assert!(!paints(&view(NodeProps { background_color: Some([1, 2, 3, 255]), hidden: Some(true), ..Default::default() })));
        assert!(paints(&JsNode::new(NodeType::Text, NodeProps::default())));
        assert!(paints(&JsNode::new(NodeType::Image, NodeProps::default())));
    }
}
