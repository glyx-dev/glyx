//! GDP Layout explorer (DevTools D6): an element's layout style and computed
//! box as the layout engine (Taffy) sees them, its container and siblings,
//! and a plain-language explanation of why it has its width and height.
//!
//! Taffy doesn't record why it chose a size, so the explanations are worked
//! out from the style and the result (set / percent of parent / grew / shrank
//! / stretched / capped / content). They cover flexbox, which is how Glyx
//! lays out everything.

use serde_json::{json, Map, Value};
use taffy::style::CompactLength;
use taffy::{Layout, Style};

use crate::state::PerWindowState;

// ── Formatting ──────────────────────────────────────────────────────────────

/// `120px`, `50%`, `auto`, `min-content`… for any Taffy length.
pub(crate) fn fmt_len(c: CompactLength) -> String {
    match c.tag() {
        CompactLength::LENGTH_TAG => format!("{}px", round1(c.value())),
        CompactLength::PERCENT_TAG => format!("{}%", round1(c.value() * 100.0)),
        CompactLength::AUTO_TAG => "auto".into(),
        _ => "calc".into(),
    }
}

fn round1(v: f32) -> f32 { (v * 10.0).round() / 10.0 }

/// `SpaceBetween` → `space-between`; `None` → `normal`.
fn kebab(v: Option<String>) -> String {
    let Some(s) = v else { return "normal".into() };
    let mut out = String::new();
    for (i, ch) in s.chars().enumerate() {
        if ch.is_uppercase() { if i > 0 { out.push('-'); } out.extend(ch.to_lowercase()); } else { out.push(ch); }
    }
    out
}

fn dbg<T: std::fmt::Debug>(v: T) -> String { kebab(Some(format!("{v:?}"))) }
fn dbg_opt<T: std::fmt::Debug>(v: Option<T>) -> String { kebab(v.map(|v| format!("{v:?}"))) }

fn rect(r: taffy::Rect<f32>) -> Value {
    json!({ "left": round1(r.left), "right": round1(r.right), "top": round1(r.top), "bottom": round1(r.bottom) })
}

/// The layout style: only what matters for flexbox, in CSS terms.
pub(crate) fn style_json(s: &Style) -> Value {
    let lpa = |r: taffy::Rect<taffy::LengthPercentageAuto>| json!({
        "left": fmt_len(r.left.into_raw()), "right": fmt_len(r.right.into_raw()),
        "top": fmt_len(r.top.into_raw()), "bottom": fmt_len(r.bottom.into_raw()),
    });
    let lp = |r: taffy::Rect<taffy::LengthPercentage>| json!({
        "left": fmt_len(r.left.into_raw()), "right": fmt_len(r.right.into_raw()),
        "top": fmt_len(r.top.into_raw()), "bottom": fmt_len(r.bottom.into_raw()),
    });
    json!({
        "display": dbg(s.display),
        "position": dbg(s.position),
        "flexDirection": dbg(s.flex_direction),
        "flexWrap": dbg(s.flex_wrap),
        "justifyContent": dbg_opt(s.justify_content),
        "alignItems": dbg_opt(s.align_items),
        "alignSelf": dbg_opt(s.align_self),
        "alignContent": dbg_opt(s.align_content),
        "flexGrow": s.flex_grow,
        "flexShrink": s.flex_shrink,
        "flexBasis": fmt_len(s.flex_basis.into_raw()),
        "width": fmt_len(s.size.width.into_raw()),
        "height": fmt_len(s.size.height.into_raw()),
        "minWidth": fmt_len(s.min_size.width.into_raw()),
        "minHeight": fmt_len(s.min_size.height.into_raw()),
        "maxWidth": fmt_len(s.max_size.width.into_raw()),
        "maxHeight": fmt_len(s.max_size.height.into_raw()),
        "gap": { "row": fmt_len(s.gap.height.into_raw()), "column": fmt_len(s.gap.width.into_raw()) },
        "margin": lpa(s.margin),
        "padding": lp(s.padding),
        "border": lp(s.border),
        "overflow": { "x": dbg(s.overflow.x), "y": dbg(s.overflow.y) },
        "aspectRatio": s.aspect_ratio,
    })
}

pub(crate) fn computed_json(l: &Layout) -> Value {
    json!({
        "x": round1(l.location.x), "y": round1(l.location.y),
        "width": round1(l.size.width), "height": round1(l.size.height),
        "contentWidth": round1(l.content_size.width), "contentHeight": round1(l.content_size.height),
        "padding": rect(l.padding), "border": rect(l.border), "margin": rect(l.margin),
    })
}

// ── Why this size ───────────────────────────────────────────────────────────

#[derive(Clone, Copy, PartialEq, Debug)]
pub(crate) enum Axis { Width, Height }

fn is_row(dir: taffy::FlexDirection) -> bool {
    matches!(dir, taffy::FlexDirection::Row | taffy::FlexDirection::RowReverse)
}

/// The inside of a box: size minus padding and border.
fn content_box(l: &Layout, axis: Axis) -> f32 {
    match axis {
        Axis::Width => l.size.width - l.padding.left - l.padding.right - l.border.left - l.border.right,
        Axis::Height => l.size.height - l.padding.top - l.padding.bottom - l.border.top - l.border.bottom,
    }
}

/// Plain-language reasons for a node's `axis` size, strongest first.
/// `parent` is the containing flex box (style + computed layout), if any;
/// `text` says the node is measured from its text.
pub(crate) fn explain(axis: Axis, style: &Style, layout: &Layout, parent: Option<(&Style, &Layout)>, text: bool) -> Vec<String> {
    let name = if axis == Axis::Width { "width" } else { "height" };
    let pick = |s: taffy::Size<taffy::Dimension>| if axis == Axis::Width { s.width } else { s.height };
    let size = if axis == Axis::Width { layout.size.width } else { layout.size.height };
    let content = if axis == Axis::Width { layout.content_size.width } else { layout.content_size.height };
    let close = |a: f32, b: f32| (a - b).abs() < 0.6;
    let set = pick(style.size).into_raw();
    let min = pick(style.min_size).into_raw();
    let max = pick(style.max_size).into_raw();
    let mut out = Vec::new();

    if style.display == taffy::Display::None {
        return vec!["Hidden (display: none), so it takes no space.".into()];
    }
    if max.tag() == CompactLength::LENGTH_TAG && close(size, max.value()) {
        out.push(format!("Capped by max{} {}.", cap(name), fmt_len(max)));
    }
    if min.tag() == CompactLength::LENGTH_TAG && close(size, min.value()) && !close(min.value(), 0.0) {
        out.push(format!("Held at min{} {}.", cap(name), fmt_len(min)));
    }

    let Some((pstyle, playout)) = parent else {
        out.push(match set.tag() {
            CompactLength::LENGTH_TAG => format!("Set: {name} {}.", fmt_len(set)),
            _ => "The root element: it fills the window.".into(),
        });
        return out;
    };
    let main = is_row(pstyle.flex_direction) == (axis == Axis::Width);
    let parent_inner = content_box(playout, axis);

    match set.tag() {
        CompactLength::LENGTH_TAG => {
            let v = set.value();
            if close(size, v) {
                out.push(format!("Set: {name} {}.", fmt_len(set)));
            } else if main && size < v {
                out.push(format!("Shrunk from its {name} {} (flexShrink {}): its container is too small for everything in it.", fmt_len(set), style.flex_shrink));
            } else if main && size > v {
                out.push(format!("Grew from its {name} {} (flexGrow {}) into free space in its container.", fmt_len(set), style.flex_grow));
            } else {
                out.push(format!("Its {name} {} was overridden by min / max.", fmt_len(set)));
            }
        }
        CompactLength::PERCENT_TAG => {
            out.push(format!("{} of its container's {} ({}px inside padding).", fmt_len(set), name, round1(parent_inner)));
        }
        _ if main => {
            let basis = style.flex_basis.into_raw();
            let from = if basis.tag() == CompactLength::LENGTH_TAG { format!("its flexBasis {}", fmt_len(basis)) }
                else if text { "its text".to_string() } else { "its content".to_string() };
            if style.flex_grow > 0.0 && size > content + 0.6 {
                out.push(format!("Grew (flexGrow {}) from {from} to fill free space in its container.", style.flex_grow));
            } else if style.flex_shrink > 0.0 && size + 0.6 < content {
                out.push(format!("Shrunk (flexShrink {}) below {from}: its container is too small.", style.flex_shrink));
            } else {
                out.push(format!("Sized by {from} (along its container's {} direction).", if is_row(pstyle.flex_direction) { "row" } else { "column" }));
            }
        }
        _ => {
            // Cross axis: stretch unless alignSelf / alignItems say otherwise.
            let align = style.align_self.or(pstyle.align_items);
            let stretch = matches!(align, None | Some(taffy::AlignItems::Stretch));
            if stretch && close(size, parent_inner) {
                out.push(format!("Stretched to its container's {name} ({}px): alignItems is stretch.", round1(parent_inner)));
            } else if text {
                out.push("Sized by its text.".into());
            } else {
                out.push(format!("Sized by its content (alignItems: {}).", dbg_opt(align)));
            }
        }
    }
    out
}

fn cap(s: &str) -> String {
    let mut c = s.chars();
    c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default()
}

// ── The request ─────────────────────────────────────────────────────────────

/// The first non-empty text at or below `id` (a few levels down).
fn text_inside(s: &PerWindowState, id: u32, depth: u32) -> Option<String> {
    let n = s.js_nodes.get(&id)?;
    if let Some(t) = n.props.text.as_ref().filter(|t| !t.trim().is_empty()) { return Some(t.clone()); }
    if depth >= 4 { return None; }
    n.children.iter().find_map(|&c| text_inside(s, c, depth + 1))
}

/// `Inspector.getLayoutDetails`: style, computed box, container, children
/// and the width / height explanations. `None` when the node has no layout.
pub(crate) fn layout_details(s: &PerWindowState, id: u32) -> Option<Value> {
    let n = s.js_nodes.get(&id)?;
    let lid = n.layout_id?;
    let style = s.layout.get_style(lid).ok()?;
    let layout = s.layout.computed(lid).ok()?;
    let text = s.layout.is_text(lid);

    let parent = n.parent.and_then(|p| {
        let pn = s.js_nodes.get(&p)?;
        let plid = pn.layout_id?;
        Some((p, s.layout.get_style(plid).ok()?, s.layout.computed(plid).ok()?))
    });

    let children: Vec<Value> = n.children.iter().filter_map(|&c| {
        let cn = s.js_nodes.get(&c)?;
        let clid = cn.layout_id?;
        let cs = s.layout.get_style(clid).ok()?;
        let cl = s.layout.computed(clid).ok()?;
        Some(json!({
            "nodeId": c,
            "type": crate::devtools_inspect::type_name(&cn.node_type),
            // Its own text, or the first text inside it (a key's label).
            "text": text_inside(s, c, 0),
            "flexGrow": cs.flex_grow, "flexShrink": cs.flex_shrink, "flexBasis": fmt_len(cs.flex_basis.into_raw()),
            "width": fmt_len(cs.size.width.into_raw()), "height": fmt_len(cs.size.height.into_raw()),
            "alignSelf": dbg_opt(cs.align_self),
            "computed": computed_json(&cl),
        }))
    }).collect();

    let pref = parent.as_ref().map(|(_, ps, pl)| (ps, pl));
    let mut out = Map::new();
    out.insert("nodeId".into(), json!(id));
    out.insert("style".into(), style_json(&style));
    out.insert("computed".into(), computed_json(&layout));
    out.insert("measuredText".into(), json!(text));
    out.insert("explain".into(), json!({
        "width": explain(Axis::Width, &style, &layout, pref, text),
        "height": explain(Axis::Height, &style, &layout, pref, text),
    }));
    if let Some((pid, ps, pl)) = &parent {
        out.insert("container".into(), json!({
            "nodeId": pid,
            "flexDirection": dbg(ps.flex_direction), "flexWrap": dbg(ps.flex_wrap),
            "justifyContent": dbg_opt(ps.justify_content), "alignItems": dbg_opt(ps.align_items),
            "gap": { "row": fmt_len(ps.gap.height.into_raw()), "column": fmt_len(ps.gap.width.into_raw()) },
            "innerWidth": round1(content_box(pl, Axis::Width)), "innerHeight": round1(content_box(pl, Axis::Height)),
            "computed": computed_json(pl),
        }));
    }
    out.insert("children".into(), Value::Array(children));
    Some(Value::Object(out))
}

#[cfg(test)]
mod tests {
    use super::*;
    use taffy::prelude::*;

    /// A 300 × 100 row with: a fixed 100px child, a flexGrow 1 child,
    /// a 20% child, and (cross axis) a child with an explicit height.
    fn tree() -> (TaffyTree<()>, NodeId, [NodeId; 4]) {
        let mut t: TaffyTree<()> = TaffyTree::new();
        let fixed = t.new_leaf(Style { size: Size { width: length(100.0_f32), height: auto() }, flex_shrink: 0.0, ..Default::default() }).unwrap();
        let grow = t.new_leaf(Style { flex_grow: 1.0, ..Default::default() }).unwrap();
        let pct = t.new_leaf(Style { size: Size { width: percent(0.2_f32), height: length(30.0_f32) }, flex_shrink: 0.0, ..Default::default() }).unwrap();
        let capped = t.new_leaf(Style { flex_grow: 1.0, max_size: Size { width: length(40.0_f32), height: auto() }, ..Default::default() }).unwrap();
        let root = t.new_with_children(Style {
            size: Size { width: length(300.0_f32), height: length(100.0_f32) },
            padding: Rect { left: length(10.0_f32), right: length(10.0_f32), top: length(0.0_f32), bottom: length(0.0_f32) },
            ..Default::default()
        }, &[fixed, grow, pct, capped]).unwrap();
        t.compute_layout(root, Size::MAX_CONTENT).unwrap();
        (t, root, [fixed, grow, pct, capped])
    }

    fn why(t: &TaffyTree<()>, root: NodeId, n: NodeId, axis: Axis) -> String {
        explain(axis, t.style(n).unwrap(), t.layout(n).unwrap(), Some((t.style(root).unwrap(), t.layout(root).unwrap())), false).join(" ")
    }

    #[test]
    fn explains_set_grown_percent_capped_and_stretched_sizes() {
        let (t, root, [fixed, grow, pct, capped]) = tree();
        assert!(why(&t, root, fixed, Axis::Width).starts_with("Set: width 100px"), "{}", why(&t, root, fixed, Axis::Width));
        assert!(why(&t, root, grow, Axis::Width).starts_with("Grew (flexGrow 1)"), "{}", why(&t, root, grow, Axis::Width));
        assert!(why(&t, root, pct, Axis::Width).starts_with("20% of its container's width (280px inside padding)"), "{}", why(&t, root, pct, Axis::Width));
        assert!(why(&t, root, capped, Axis::Width).starts_with("Capped by maxWidth 40px"), "{}", why(&t, root, capped, Axis::Width));
        // Cross axis: auto height stretches; explicit height is "set".
        assert!(why(&t, root, grow, Axis::Height).starts_with("Stretched to its container's height (100px)"), "{}", why(&t, root, grow, Axis::Height));
        assert!(why(&t, root, pct, Axis::Height).starts_with("Set: height 30px"));
    }

    #[test]
    fn root_hidden_and_formatting() {
        let (t, root, _) = tree();
        assert_eq!(explain(Axis::Width, t.style(root).unwrap(), t.layout(root).unwrap(), None, false), vec!["Set: width 300px."]);
        let hidden = Style { display: Display::None, ..Default::default() };
        assert!(explain(Axis::Width, &hidden, t.layout(root).unwrap(), None, false)[0].contains("display: none"));
        assert_eq!(fmt_len(Dimension::length(12.5_f32).into_raw()), "12.5px");
        assert_eq!(fmt_len(Dimension::percent(0.5_f32).into_raw()), "50%");
        assert_eq!(fmt_len(Dimension::auto().into_raw()), "auto");
        assert_eq!(kebab(Some("SpaceBetween".into())), "space-between");
        assert_eq!(kebab(None), "normal");
        let s = style_json(t.style(root).unwrap());
        assert_eq!((s["width"].as_str(), s["padding"]["left"].as_str()), (Some("300px"), Some("10px")));
    }
}
