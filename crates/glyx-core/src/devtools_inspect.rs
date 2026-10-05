//! GDP Inspector + Automation helpers: reading the scene tree, finding
//! nodes, building synthetic input, and screenshots. Kept apart from the
//! request dispatch in `devtools.rs`, and mostly pure so it can be tested
//! without a window.

use std::collections::HashMap;

use glyx_runtime::{NodeProps, NodeType};
use glyx_shell::ShellEvent;
use serde_json::{json, Map, Value};

use crate::state::{JsNode, PerWindowState};

// ── Tree and nodes ──────────────────────────────────────────────────────────

/// The window's on-screen rect for a node (`[x, y, w, h]`, physical px,
/// clipped by scroll containers): what hit-testing and clicks use.
pub(crate) fn rect(s: &PerWindowState, id: u32) -> Option<[f32; 4]> {
    s.runtime.layout_cache().lock().get(&id).copied()
}

/// Nodes attached to the rendered tree, parents before children, in child
/// order. Detached nodes (created but never appended, or removed) are left
/// out: they aren't on screen.
pub(crate) fn attached(nodes: &HashMap<u32, JsNode>, root: Option<u32>) -> Vec<u32> {
    let mut out = Vec::new();
    let mut stack: Vec<u32> = root.into_iter().collect();
    while let Some(id) = stack.pop() {
        let Some(n) = nodes.get(&id) else { continue };
        out.push(id);
        stack.extend(n.children.iter().rev().copied());
    }
    out
}

pub(crate) fn type_name(t: &NodeType) -> &'static str {
    match t {
        NodeType::View => "View",
        NodeType::Text => "Text",
        NodeType::Image => "Image",
        NodeType::Canvas => "Canvas",
        NodeType::Canvas3D => "Canvas3D",
        NodeType::Camera => "Camera",
        NodeType::Video => "Video",
        NodeType::RepaintBoundary => "RepaintBoundary",
        NodeType::WebView => "WebView",
    }
}

fn hex(c: [u8; 4]) -> String {
    format!("#{:02x}{:02x}{:02x}{:02x}", c[0], c[1], c[2], c[3])
}

/// The props worth showing and matching on, camelCase like the JS side.
/// Unset props are left out.
pub(crate) fn props_json(p: &NodeProps) -> Value {
    let mut m = Map::new();
    macro_rules! put {
        ($key:literal, $v:expr) => { if let Some(v) = $v { m.insert($key.into(), json!(v)); } };
    }
    macro_rules! put_dbg {
        ($key:literal, $v:expr) => { if let Some(v) = &$v { m.insert($key.into(), json!(format!("{v:?}"))); } };
    }
    put!("testID", p.test_id.clone());
    put!("text", p.text.clone());
    put!("placeholder", p.placeholder.clone());
    put!("role", p.role.clone());
    put!("ariaLabel", p.aria_label.clone());
    put!("accessibilityHint", p.accessibility_hint.clone());
    put!("checked", p.checked);
    put!("expanded", p.expanded);
    put!("value", p.numeric_value);
    put!("focusable", p.focusable);
    put!("pressable", p.pressable);
    put!("draggable", p.draggable);
    put!("color", p.color.map(hex));
    put!("backgroundColor", p.background_color.map(hex));
    put!("borderColor", p.border_color.map(hex));
    put!("borderWidth", p.border_width);
    put!("borderRadius", p.border_radius);
    put!("fontSize", p.font_size);
    put!("fontWeight", p.font_weight.clone());
    put!("fontStyle", p.font_style.clone());
    put!("lineHeight", p.line_height);
    put!("textAlign", p.text_align.clone());
    put!("numberOfLines", p.number_of_lines);
    put!("flex", p.flex);
    put!("flexDirection", p.flex_direction.clone());
    put!("justifyContent", p.justify_content.clone());
    put!("alignItems", p.align_items.clone());
    put!("overflow", p.overflow.clone());
    put!("zIndex", p.z_index);
    put!("scrollOffsetY", p.scroll_offset_y);
    put!("smoothScroll", p.smooth_scroll);
    put_dbg!("width", p.width);
    put_dbg!("height", p.height);
    put_dbg!("padding", p.padding);
    put_dbg!("gap", p.gap);
    put_dbg!("margin", p.margin);
    Value::Object(m)
}

/// One node without its subtree: identity, what it shows, where it is.
pub(crate) fn node_summary(s: &PerWindowState, id: u32) -> Value {
    let Some(n) = s.js_nodes.get(&id) else { return Value::Null };
    let mut v = json!({
        "nodeId": id,
        "type": type_name(&n.node_type),
        "rect": rect(s, id),
        "childCount": n.children.len(),
    });
    for (k, val) in [("testID", &n.props.test_id), ("text", &n.props.text),
                     ("role", &n.props.role), ("label", &n.props.aria_label)] {
        if let Some(val) = val { v[k] = json!(val); }
    }
    v
}

/// A subtree, `depth` levels deep (`None` = all). Nodes cut off by the depth
/// limit keep their `childCount`, so a client can fetch them on demand.
pub(crate) fn subtree(s: &PerWindowState, id: u32, depth: Option<u32>) -> Value {
    let mut v = node_summary(s, id);
    if depth == Some(0) { return v; }
    if let Some(n) = s.js_nodes.get(&id) {
        v["children"] = Value::Array(n.children.iter()
            .map(|&c| subtree(s, c, depth.map(|d| d - 1))).collect());
    }
    v
}

/// Everything known about one node.
pub(crate) fn node_detail(s: &PerWindowState, id: u32) -> Option<Value> {
    let n = s.js_nodes.get(&id)?;
    let layout = n.layout_id.and_then(|l| s.resolved_rect(l))
        .map(|r| json!([r.x, r.y, r.width, r.height]));
    let unclipped = s.runtime.layout_cache().lock().get(&(id | UNCLIPPED_KEY)).copied();
    Some(json!({
        "nodeId": id,
        "type": type_name(&n.node_type),
        "parentId": n.parent,
        "children": n.children.to_vec(),
        "rect": rect(s, id),
        "unclippedRect": unclipped,
        "layoutRect": layout,
        "focused": s.focused_node == Some(id),
        "props": props_json(&n.props),
    }))
}

use crate::layout::{CONTENT_HEIGHT_KEY, UNCLIPPED_KEY};

/// `Inspector.getLayout`: every rect Glyx keeps for a node.
/// `rect` is on-screen and clipped (what clicks use), `unclippedRect` the
/// same before scroll-container clipping, `layoutRect` Taffy's own result,
/// `contentHeight` the scrollable height of a scroll container.
pub(crate) fn layout_detail(s: &PerWindowState, id: u32) -> Option<Value> {
    let n = s.js_nodes.get(&id)?;
    let cache = s.runtime.layout_cache();
    let cache = cache.lock();
    let layout = n.layout_id.and_then(|l| s.resolved_rect(l))
        .map(|r| json!([r.x, r.y, r.width, r.height]));
    Some(json!({
        "nodeId": id,
        "rect": cache.get(&id),
        "unclippedRect": cache.get(&(id | UNCLIPPED_KEY)).or(cache.get(&id)),
        "layoutRect": layout,
        "contentHeight": cache.get(&(id | CONTENT_HEIGHT_KEY)).map(|r| r[3]),
    }))
}

/// Root-first ancestry of a node.
pub(crate) fn path_to(nodes: &HashMap<u32, JsNode>, id: u32) -> Vec<u32> {
    let mut path = vec![id];
    let mut cur = id;
    while let Some(p) = nodes.get(&cur).and_then(|n| n.parent) {
        if path.contains(&p) { break; } // defensive: never loop on a bad parent chain
        path.push(p);
        cur = p;
    }
    path.reverse();
    path
}

// ── Finding nodes ───────────────────────────────────────────────────────────

/// `Automation.findNodes` / `waitFor` query. Every given field must match.
#[derive(Debug, Default, Clone, PartialEq)]
pub(crate) struct Query {
    pub node_id: Option<u32>,
    pub test_id: Option<String>,
    /// Exact text.
    pub text: Option<String>,
    /// Case-insensitive substring of the text.
    pub text_contains: Option<String>,
    pub role: Option<String>,
    pub label: Option<String>,
    pub node_type: Option<String>,
    /// Automatic element ID (or pinned testID); resolved to a node id before
    /// matching, see `devtools::resolve_auto_id`.
    pub auto_id: Option<String>,
}

impl Query {
    pub(crate) fn from_params(p: &Value) -> Self {
        let s = |k: &str| p.get(k).and_then(Value::as_str).map(str::to_string);
        Self {
            node_id: p.get("nodeId").and_then(Value::as_u64).map(|n| n as u32),
            test_id: s("testID"),
            text: s("text"),
            text_contains: s("textContains"),
            role: s("role"),
            label: s("label"),
            node_type: s("type"),
            auto_id: s("id"),
        }
    }

    pub(crate) fn is_empty(&self) -> bool { *self == Self::default() }

    pub(crate) fn matches(&self, id: u32, n: &JsNode) -> bool {
        let eq = |want: &Option<String>, have: &Option<String>| want.as_ref().map_or(true, |w| have.as_deref() == Some(w.as_str()));
        self.node_id.map_or(true, |w| w == id)
            && eq(&self.test_id, &n.props.test_id)
            && eq(&self.text, &n.props.text)
            && eq(&self.role, &n.props.role)
            && eq(&self.label, &n.props.aria_label)
            && self.node_type.as_ref().map_or(true, |t| t.eq_ignore_ascii_case(type_name(&n.node_type)))
            && self.text_contains.as_ref().map_or(true, |w| n.props.text.as_ref()
                .is_some_and(|t| t.to_lowercase().contains(&w.to_lowercase())))
    }
}

/// Attached nodes matching `q`, in tree order.
pub(crate) fn find(s: &PerWindowState, q: &Query) -> Vec<u32> {
    attached(&s.js_nodes, s.js_root).into_iter()
        .filter(|id| s.js_nodes.get(id).is_some_and(|n| q.matches(*id, n)))
        .collect()
}

/// On screen: a non-empty rect overlapping the window.
pub(crate) fn visible(s: &PerWindowState, id: u32) -> bool {
    let size = s.window.inner_size();
    rect(s, id).is_some_and(|[x, y, w, h]| {
        w > 0.0 && h > 0.0 && x < size.width as f32 && y < size.height as f32 && x + w > 0.0 && y + h > 0.0
    })
}

/// `waitFor` conditions.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) enum Condition { Exists, Visible, Gone }

impl Condition {
    pub(crate) fn parse(s: Option<&str>) -> Option<Self> {
        match s.unwrap_or("exists") {
            "exists" => Some(Self::Exists),
            "visible" => Some(Self::Visible),
            "gone" => Some(Self::Gone),
            _ => None,
        }
    }
}

/// `Some(matching ids)` once the condition holds (empty for `Gone`).
pub(crate) fn check(s: &PerWindowState, q: &Query, c: Condition) -> Option<Vec<u32>> {
    let found = find(s, q);
    match c {
        Condition::Exists => (!found.is_empty()).then_some(found),
        Condition::Visible => {
            let v: Vec<u32> = found.into_iter().filter(|&id| visible(s, id)).collect();
            (!v.is_empty()).then_some(v)
        }
        Condition::Gone => found.is_empty().then(Vec::new),
    }
}

// ── Synthetic input ─────────────────────────────────────────────────────────

pub(crate) fn center([x, y, w, h]: [f32; 4]) -> (f64, f64) {
    ((x + w / 2.0) as f64, (y + h / 2.0) as f64)
}

/// Move there, press, release: what a real click delivers.
pub(crate) fn click_events(window: u32, x: f64, y: f64, button: u8) -> Vec<ShellEvent> {
    vec![
        ShellEvent::CursorMoved { window_handle: window, x, y },
        ShellEvent::MouseInput { window_handle: window, button, pressed: true },
        ShellEvent::MouseInput { window_handle: window, button, pressed: false },
    ]
}

/// The physical key name winit would report for a character on a US layout,
/// or `"Unidentified"`. Text input reads the `text`; the key name matters for
/// shortcuts and named keys.
pub(crate) fn key_code_for(c: char) -> String {
    match c {
        'a'..='z' | 'A'..='Z' => format!("Key{}", c.to_ascii_uppercase()),
        '0'..='9' => format!("Digit{c}"),
        ' ' => "Space".into(),
        '\n' => "Enter".into(),
        '\t' => "Tab".into(),
        _ => "Unidentified".into(),
    }
}

/// Typing `text`: a press (carrying the character) and a release per char.
/// `\n` is an Enter press, `\t` a Tab press, both without text, as real keys.
pub(crate) fn type_events(window: u32, text: &str) -> Vec<ShellEvent> {
    let mut out = Vec::new();
    for c in text.chars() {
        let key = key_code_for(c);
        let t = (!matches!(c, '\n' | '\t')).then(|| c.to_string());
        out.push(ShellEvent::KeyInput { window_handle: window, key: key.clone(), text: t, pressed: true });
        out.push(ShellEvent::KeyInput { window_handle: window, key, text: None, pressed: false });
    }
    out
}

/// A named key (`"Enter"`, `"Backspace"`, `"ArrowLeft"`, `"KeyA"`...) with
/// optional modifiers (`"Control"`, `"Shift"`, `"Alt"`, `"Super"`), pressed
/// and released in the usual order.
pub(crate) fn press_events(window: u32, key: &str, modifiers: &[String]) -> Vec<ShellEvent> {
    let mods: Vec<String> = modifiers.iter().map(|m| match m.as_str() {
        "Control" | "Ctrl" => "ControlLeft".to_string(),
        "Shift" => "ShiftLeft".into(),
        "Alt" => "AltLeft".into(),
        "Super" | "Meta" | "Cmd" => "SuperLeft".into(),
        other => other.into(),
    }).collect();
    let k = |key: &str, pressed: bool| ShellEvent::KeyInput { window_handle: window, key: key.into(), text: None, pressed };
    let mut out: Vec<ShellEvent> = mods.iter().map(|m| k(m, true)).collect();
    out.push(k(key, true));
    out.push(k(key, false));
    out.extend(mods.iter().rev().map(|m| k(m, false)));
    out
}

// ── Screenshots ─────────────────────────────────────────────────────────────

/// PNG of a 0RGB frame, optionally cropped to `crop` (`[x, y, w, h]`,
/// clamped to the frame).
pub(crate) fn png(width: u32, height: u32, pixels: &[u32], crop: Option<[f32; 4]>) -> Result<(u32, u32, Vec<u8>), String> {
    let (x0, y0, w, h) = match crop {
        None => (0, 0, width, height),
        Some([x, y, cw, ch]) => {
            let x0 = (x.max(0.0).floor() as u32).min(width);
            let y0 = (y.max(0.0).floor() as u32).min(height);
            let x1 = ((x + cw).ceil().max(0.0) as u32).min(width);
            let y1 = ((y + ch).ceil().max(0.0) as u32).min(height);
            (x0, y0, x1.saturating_sub(x0), y1.saturating_sub(y0))
        }
    };
    if w == 0 || h == 0 { return Err("nothing to capture: the area is empty or off-screen".into()); }
    let mut rgba = Vec::with_capacity((w * h * 4) as usize);
    for row in y0..y0 + h {
        let start = (row * width + x0) as usize;
        for &p in &pixels[start..start + w as usize] {
            rgba.extend_from_slice(&[(p >> 16) as u8, (p >> 8) as u8, p as u8, 255]);
        }
    }
    let mut out = Vec::new();
    image::codecs::png::PngEncoder::new(&mut out)
        .write_image(&rgba, w, h, image::ExtendedColorType::Rgba8)
        .map_err(|e| e.to_string())?;
    Ok((w, h, out))
}

use image::ImageEncoder as _;

// ── Component names ─────────────────────────────────────────────────────────

/// Node id → `"Component@file:line"` (line only in dev JSX builds).
pub(crate) type Names = HashMap<u32, String>;

/// JS that asks the host config for these nodes' component names. It keeps
/// them only when devtools is on (`globalThis.__glyx_devtools`), else `{}`.
pub(crate) fn names_script(ids: &[u32]) -> String {
    let list: Vec<String> = ids.iter().map(u32::to_string).collect();
    format!("(typeof __glyx_devNodeNames === 'function') ? __glyx_devNodeNames([{}]) : {{}}", list.join(","))
}

pub(crate) fn parse_names(v: &Value) -> Names {
    v.as_object().map(|m| m.iter()
        .filter_map(|(k, v)| Some((k.parse().ok()?, v.as_str()?.to_string())))
        .collect()).unwrap_or_default()
}

/// Every `nodeId` in a response, for one names lookup per request.
pub(crate) fn node_ids(v: &Value, out: &mut Vec<u32>) {
    match v {
        Value::Object(m) => {
            if let Some(id) = m.get("nodeId").and_then(Value::as_u64) { out.push(id as u32); }
            for child in m.values() { node_ids(child, out); }
        }
        Value::Array(a) => for child in a { node_ids(child, out); },
        _ => {}
    }
}

/// Add `"component"` next to every `nodeId` that has a name.
pub(crate) fn annotate(v: &mut Value, names: &Names) {
    match v {
        Value::Object(m) => {
            let name = m.get("nodeId").and_then(Value::as_u64).and_then(|id| names.get(&(id as u32))).cloned();
            if let Some(name) = name { m.insert("component".into(), json!(name)); }
            for child in m.values_mut() { annotate(child, names); }
        }
        Value::Array(a) => for child in a { annotate(child, names); },
        _ => {}
    }
}

// ── Automatic element IDs ───────────────────────────────────────────────────

/// Node id → (element ID, pinned by an explicit testID).
pub(crate) type AutoIds = HashMap<u32, (String, bool)>;

/// JS for the element IDs of `ids` (all nodes when `None`), from the host
/// config's devtools-only generator; `{}` when it isn't available.
pub(crate) fn ids_script(ids: Option<&[u32]>, cache: bool) -> String {
    let list = match ids {
        Some(ids) => format!("[{}]", ids.iter().map(u32::to_string).collect::<Vec<_>>().join(",")),
        None => "null".into(),
    };
    format!("(typeof __glyx_devNodeIds === 'function') ? __glyx_devNodeIds({list}, {cache}) : {{}}")
}

pub(crate) fn parse_ids(v: &Value) -> AutoIds {
    v.as_object().map(|m| m.iter().filter_map(|(k, v)| {
        let id = v.get("id")?.as_str()?.to_string();
        let pinned = v.get("pinned").and_then(Value::as_bool).unwrap_or(false);
        Some((k.parse().ok()?, (id, pinned)))
    }).collect()).unwrap_or_default()
}

/// Add `"id"` (and `"pinned": true` for testIDs) next to every `nodeId`.
pub(crate) fn annotate_ids(v: &mut Value, ids: &AutoIds) {
    match v {
        Value::Object(m) => {
            let found = m.get("nodeId").and_then(Value::as_u64).and_then(|n| ids.get(&(n as u32))).cloned();
            if let Some((id, pinned)) = found {
                m.insert("id".into(), json!(id));
                if pinned { m.insert("pinned".into(), json!(true)); }
            }
            for child in m.values_mut() { annotate_ids(child, ids); }
        }
        Value::Array(a) => for child in a { annotate_ids(child, ids); },
        _ => {}
    }
}

// ── Editing props ───────────────────────────────────────────────────────────

fn length(v: &Value) -> Result<Option<glyx_runtime::LengthValue>, String> {
    use glyx_runtime::LengthValue;
    match v {
        Value::Null => Ok(None),
        Value::Number(n) => Ok(Some(LengthValue::Px(n.as_f64().unwrap_or(0.0) as f32))),
        Value::String(s) if s.trim().ends_with('%') => s.trim().trim_end_matches('%').trim().parse::<f32>()
            .map(|n| Some(LengthValue::Percent(n / 100.0))).map_err(|_| format!("bad length {s:?}")),
        _ => Err("expected a number (px), \"50%\" or null".into()),
    }
}

fn color(v: &Value) -> Result<Option<[u8; 4]>, String> {
    match v {
        Value::Null => Ok(None),
        Value::String(s) => glyx_runtime::bindings::parse_hex_color(s).map(Some)
            .ok_or_else(|| format!("bad colour {s:?}: use #rgb, #rrggbb or #rrggbbaa")),
        _ => Err("expected a hex colour string or null".into()),
    }
}

fn num(v: &Value) -> Result<Option<f32>, String> {
    match v {
        Value::Null => Ok(None),
        Value::Number(n) => Ok(n.as_f64().map(|n| n as f32)),
        _ => Err("expected a number or null".into()),
    }
}

fn text(v: &Value) -> Result<Option<String>, String> {
    match v {
        Value::Null => Ok(None),
        Value::String(s) => Ok(Some(s.clone())),
        _ => Err("expected a string or null".into()),
    }
}

/// A keyword from `allowed` (or null to unset).
fn one_of(v: &Value, allowed: &[&str]) -> Result<Option<String>, String> {
    match text(v)? {
        Some(s) if !allowed.contains(&s.as_str()) => Err(format!("{s:?} isn't one of: {}", allowed.join(", "))),
        other => Ok(other),
    }
}

/// Props `Inspector.setNodeProp` can change, camelCase like JSX.
pub(crate) const EDITABLE_PROPS: &[&str] = &[
    "text", "testID", "backgroundColor", "color", "borderColor", "borderWidth", "borderRadius",
    "opacity", "fontSize", "fontWeight", "width", "height", "padding", "margin", "gap", "flex", "zIndex",
    "flexDirection", "justifyContent", "alignItems",
];

/// Set one prop (null unsets it). The node keeps it until React next
/// updates that node, like editing a style in browser devtools.
pub(crate) fn set_prop(p: &mut NodeProps, name: &str, v: &Value) -> Result<(), String> {
    match name {
        "text" => p.text = text(v)?,
        "testID" => p.test_id = text(v)?,
        "fontWeight" => p.font_weight = text(v)?,
        "flexDirection" => p.flex_direction = one_of(v, &["row", "column", "row-reverse", "column-reverse"])?,
        "justifyContent" => p.justify_content = one_of(v, &["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"])?,
        "alignItems" => p.align_items = one_of(v, &["flex-start", "flex-end", "center", "stretch", "baseline"])?,
        "backgroundColor" => p.background_color = color(v)?,
        "color" => p.color = color(v)?,
        "borderColor" => p.border_color = color(v)?,
        "borderWidth" => p.border_width = num(v)?,
        "borderRadius" => p.border_radius = num(v)?,
        "opacity" => p.opacity = num(v)?,
        "fontSize" => p.font_size = num(v)?,
        "flex" => p.flex = num(v)?,
        "zIndex" => p.z_index = num(v)?.map(|n| n as i32),
        "width" => p.width = length(v)?,
        "height" => p.height = length(v)?,
        "padding" => p.padding = length(v)?,
        "margin" => p.margin = length(v)?,
        "gap" => p.gap = length(v)?,
        other => return Err(format!("{other:?} can't be set; editable props: {}", EDITABLE_PROPS.join(", "))),
    }
    Ok(())
}

// ── Accessibility tree ──────────────────────────────────────────────────────

/// What assistive tech sees: the tree `a11y.rs` builds for the OS adapter,
/// serialized instead of pushed. Needs the `a11y` feature.
#[cfg(feature = "a11y")]
pub(crate) fn a11y_tree(s: &mut PerWindowState) -> Option<Value> {
    let update = crate::a11y::build_tree(s)?;
    let nodes: HashMap<u64, &accesskit::Node> = update.nodes.iter().map(|(id, n)| (id.0, n)).collect();
    let root = update.tree.as_ref().map(|t| t.root.0).or_else(|| s.js_root.map(u64::from))?;
    fn walk(id: u64, nodes: &HashMap<u64, &accesskit::Node>, depth: usize) -> Value {
        let Some(n) = nodes.get(&id) else { return json!({ "nodeId": id }) };
        let mut v = json!({ "nodeId": id, "role": format!("{:?}", n.role()) });
        if let Some(x) = n.label() { v["label"] = json!(x); }
        if let Some(x) = n.value() { v["value"] = json!(x); }
        if let Some(x) = n.description() { v["description"] = json!(x); }
        if let Some(x) = n.placeholder() { v["placeholder"] = json!(x); }
        if let Some(x) = n.toggled() { v["toggled"] = json!(format!("{x:?}")); }
        if let Some(x) = n.numeric_value() { v["numericValue"] = json!(x); }
        if n.is_disabled() { v["disabled"] = json!(true); }
        if let Some(b) = n.bounds() { v["bounds"] = json!([b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0]); }
        if depth < 256 && !n.children().is_empty() {
            v["children"] = Value::Array(n.children().iter().map(|c| walk(c.0, nodes, depth + 1)).collect());
        }
        v
    }
    Some(json!({ "focus": update.focus.0, "root": walk(root, &nodes, 0) }))
}

// ── Accessibility audit ─────────────────────────────────────────────────────

/// One problem `Inspector.auditAccessibility` found.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Issue {
    pub node: u32,
    /// `pressable-name`, `image-name`, `contrast`, `focusable-role`.
    pub rule: &'static str,
    /// `error` (blocks people) or `warning`.
    pub severity: &'static str,
    pub message: String,
    /// The element's text, shortened (so a list of findings says which one).
    pub text: Option<String>,
}

impl Issue {
    pub(crate) fn json(&self) -> Value {
        let mut v = json!({ "nodeId": self.node, "rule": self.rule, "severity": self.severity, "message": self.message });
        if let Some(t) = &self.text { v["text"] = json!(t); }
        v
    }
}

/// Up to 40 characters of `t`, on one line.
fn snippet(t: &str) -> String {
    let one: String = t.split_whitespace().collect::<Vec<_>>().join(" ");
    if one.chars().count() > 40 { format!("{}…", one.chars().take(39).collect::<String>()) } else { one }
}

/// WCAG relative luminance of an sRGB colour.
fn luminance([r, g, b, _]: [u8; 4]) -> f64 {
    let ch = |c: u8| {
        let c = c as f64 / 255.0;
        if c <= 0.03928 { c / 12.92 } else { ((c + 0.055) / 1.055).powf(2.4) }
    };
    0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

/// `fg` (possibly translucent) drawn over the opaque `bg`.
fn blend(fg: [u8; 4], bg: [u8; 4]) -> [u8; 4] {
    let a = fg[3] as f64 / 255.0;
    let mix = |f: u8, b: u8| (f as f64 * a + b as f64 * (1.0 - a)).round() as u8;
    [mix(fg[0], bg[0]), mix(fg[1], bg[1]), mix(fg[2], bg[2]), 255]
}

/// WCAG contrast ratio of text colour `fg` on background `bg` (1–21).
pub(crate) fn contrast_ratio(fg: [u8; 4], bg: [u8; 4]) -> f64 {
    let (a, b) = (luminance(blend(fg, bg)), luminance(bg));
    let (hi, lo) = if a > b { (a, b) } else { (b, a) };
    (hi + 0.05) / (lo + 0.05)
}

/// Has visible text somewhere in its subtree (a name for screen readers).
fn has_text(nodes: &HashMap<u32, JsNode>, id: u32, depth: u32) -> bool {
    let Some(n) = nodes.get(&id) else { return false };
    if n.props.text.as_deref().is_some_and(|t| !t.trim().is_empty()) { return true; }
    depth < 16 && n.children.iter().any(|&c| has_text(nodes, c, depth + 1))
}

/// What's behind the text at `id`, as drawn: the nearest opaque background
/// above it with every translucent background in between blended on top.
/// `None` when nothing opaque is found (the window's colour isn't known here).
fn background(nodes: &HashMap<u32, JsNode>, id: u32) -> Option<[u8; 4]> {
    let mut layers = Vec::new(); // translucent backgrounds, nearest first
    let mut cur = Some(id);
    for _ in 0..64 {
        let n = nodes.get(&cur?)?;
        if let Some(bg) = n.props.background_color {
            let bg = with_opacity(bg, subtree_opacity(nodes, n.parent).min(1.0) * n.props.opacity.map_or(1.0, |o| o as f64));
            if bg[3] == 255 {
                return Some(layers.iter().rev().fold(bg, |under, &layer| blend(layer, under)));
            }
            if bg[3] > 0 { layers.push(bg); }
        }
        cur = n.parent;
    }
    None
}

/// Product of `opacity` from `id` up to the root.
fn subtree_opacity(nodes: &HashMap<u32, JsNode>, id: Option<u32>) -> f64 {
    let (mut o, mut cur) = (1.0, id);
    for _ in 0..64 {
        let Some(n) = cur.and_then(|c| nodes.get(&c)) else { break };
        o *= n.props.opacity.map_or(1.0, |v| (v as f64).clamp(0.0, 1.0));
        cur = n.parent;
    }
    o
}

fn with_opacity(c: [u8; 4], o: f64) -> [u8; 4] {
    [c[0], c[1], c[2], (c[3] as f64 * o.clamp(0.0, 1.0)).round() as u8]
}

/// Problems a screen-reader or low-vision user would hit, from the element
/// props alone (so it works without the `a11y` feature).
pub(crate) fn audit(nodes: &HashMap<u32, JsNode>, root: Option<u32>) -> Vec<Issue> {
    let mut out = Vec::new();
    let named = |n: &JsNode| n.props.aria_label.as_deref().is_some_and(|l| !l.trim().is_empty());
    let hidden_role = |n: &JsNode| matches!(n.props.role.as_deref(), Some("none" | "presentation"));
    for id in attached(nodes, root) {
        let n = &nodes[&id];
        if hidden_role(n) { continue; }
        if n.props.pressable == Some(true) && !named(n) && !has_text(nodes, id, 0) {
            out.push(Issue { node: id, rule: "pressable-name", severity: "error",
                message: "Pressable with no text or ariaLabel: screen readers announce it as an unnamed button.".into(), text: None });
        }
        if matches!(n.node_type, NodeType::Image) && !named(n) {
            out.push(Issue { node: id, rule: "image-name", severity: "warning",
                message: "Image with no ariaLabel (use role=\"presentation\" if it's decorative).".into(), text: None });
        }
        if let (NodeType::Text, Some(fg), true) = (&n.node_type, n.props.color, n.props.text.as_deref().is_some_and(|t| !t.trim().is_empty())) {
            // Faded text (its own or an ancestor's opacity) is drawn lighter.
            let fg = with_opacity(fg, subtree_opacity(nodes, Some(id)));
            if let Some(bg) = background(nodes, id) {
                let ratio = contrast_ratio(fg, bg);
                let size = n.props.font_size.unwrap_or(14.0);
                let bold = n.props.font_weight.as_deref().is_some_and(|w| w == "bold" || w.parse::<u32>().is_ok_and(|v| v >= 700));
                let large = size >= 24.0 || (bold && size >= 18.66);
                let need = if large { 3.0 } else { 4.5 };
                if ratio < need {
                    out.push(Issue { node: id, rule: "contrast", severity: if ratio < 3.0 { "error" } else { "warning" },
                        message: format!("Text contrast {ratio:.2}:1 against its background; needs {need}:1 for {} text.",
                            if large { "large" } else { "normal" }),
                        text: n.props.text.as_deref().map(snippet) });
                }
            }
        }
        if n.props.focusable == Some(true) && n.props.role.is_none() && n.props.pressable != Some(true) {
            out.push(Issue { node: id, rule: "focusable-role", severity: "warning",
                message: "Focusable with no role: screen readers can't say what it is.".into(), text: None });
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(t: NodeType, props: NodeProps, children: &[u32], parent: Option<u32>) -> JsNode {
        let mut n = JsNode::new(t, props);
        n.children = children.iter().copied().collect();
        n.parent = parent;
        n
    }

    fn tree() -> HashMap<u32, JsNode> {
        let mut m = HashMap::new();
        m.insert(1, node(NodeType::View, NodeProps::default(), &[2, 3], None));
        m.insert(2, node(NodeType::Text, NodeProps { text: Some("Save file".into()), ..Default::default() }, &[], Some(1)));
        m.insert(3, node(NodeType::View, NodeProps { test_id: Some("ok".into()), role: Some("button".into()), ..Default::default() }, &[4], Some(1)));
        m.insert(4, node(NodeType::Text, NodeProps { text: Some("OK".into()), ..Default::default() }, &[], Some(3)));
        m.insert(9, node(NodeType::Text, NodeProps { text: Some("detached".into()), ..Default::default() }, &[], None));
        m
    }

    #[test]
    fn contrast_sees_translucent_layers_and_opacity() {
        let p = |f: &dyn Fn(&mut NodeProps)| { let mut x = NodeProps::default(); f(&mut x); x };
        let mut m = HashMap::new();
        // Black page, a 50% white card on it, grey text on the card.
        m.insert(1, node(NodeType::View, p(&|x| x.background_color = Some([0, 0, 0, 255])), &[2], None));
        m.insert(2, node(NodeType::View, p(&|x| x.background_color = Some([255, 255, 255, 128])), &[3], Some(1)));
        m.insert(3, node(NodeType::Text, p(&|x| { x.text = Some("t".into()); x.color = Some([128, 128, 128, 255]); }), &[], Some(2)));
        assert_eq!(background(&m, 3), Some([128, 128, 128, 255]), "the card lightens what's behind the text");
        let issues = audit(&m, Some(1));
        assert!(issues.iter().any(|i| i.rule == "contrast" && i.severity == "error"), "grey on grey fails");
        // The card at half opacity: the text fades with it too.
        m.get_mut(&2).unwrap().props.opacity = Some(0.5);
        assert!(subtree_opacity(&m, Some(3)) < 0.51);
    }

    #[test]
    fn attached_nodes_come_in_tree_order_without_detached_ones() {
        assert_eq!(attached(&tree(), Some(1)), vec![1, 2, 3, 4]);
        assert!(attached(&tree(), None).is_empty());
    }

    #[test]
    fn queries_match_every_given_field() {
        let t = tree();
        let q = |p: Value| Query::from_params(&p);
        let hits = |q: &Query| attached(&t, Some(1)).into_iter().filter(|id| q.matches(*id, &t[id])).collect::<Vec<_>>();
        assert_eq!(hits(&q(json!({ "testID": "ok" }))), vec![3]);
        assert_eq!(hits(&q(json!({ "text": "OK" }))), vec![4]);
        assert_eq!(hits(&q(json!({ "textContains": "save" }))), vec![2]);
        assert_eq!(hits(&q(json!({ "type": "text" }))), vec![2, 4]);
        assert_eq!(hits(&q(json!({ "role": "button", "testID": "nope" }))), Vec::<u32>::new());
        assert_eq!(hits(&q(json!({ "nodeId": 4 }))), vec![4]);
        assert!(q(json!({})).is_empty());
        // Detached nodes are never found, even when they match.
        assert_eq!(hits(&q(json!({ "text": "detached" }))), Vec::<u32>::new());
    }

    #[test]
    fn paths_run_from_the_root() {
        assert_eq!(path_to(&tree(), 4), vec![1, 3, 4]);
        assert_eq!(path_to(&tree(), 1), vec![1]);
    }

    #[test]
    fn a_click_is_move_press_release_at_the_point() {
        let ev = click_events(2, 10.0, 20.0, 0);
        assert!(matches!(ev[0], ShellEvent::CursorMoved { window_handle: 2, x, y } if x == 10.0 && y == 20.0));
        assert!(matches!(ev[1], ShellEvent::MouseInput { button: 0, pressed: true, .. }));
        assert!(matches!(ev[2], ShellEvent::MouseInput { button: 0, pressed: false, .. }));
        assert_eq!(center([10.0, 20.0, 100.0, 40.0]), (60.0, 40.0));
    }

    #[test]
    fn typing_sends_a_press_with_text_and_a_release_per_character() {
        let ev = type_events(1, "aB 1\n");
        assert_eq!(ev.len(), 10);
        let presses: Vec<(String, Option<String>)> = ev.iter().filter_map(|e| match e {
            ShellEvent::KeyInput { key, text, pressed: true, .. } => Some((key.clone(), text.clone())),
            _ => None,
        }).collect();
        assert_eq!(presses, vec![
            ("KeyA".into(), Some("a".into())), ("KeyB".into(), Some("B".into())),
            ("Space".into(), Some(" ".into())), ("Digit1".into(), Some("1".into())),
            ("Enter".into(), None),
        ]);
        assert_eq!(key_code_for('é'), "Unidentified");
    }

    #[test]
    fn a_shortcut_wraps_the_key_in_its_modifiers() {
        let names: Vec<(String, bool)> = press_events(1, "KeyS", &["Control".into(), "Shift".into()]).into_iter()
            .map(|e| match e { ShellEvent::KeyInput { key, pressed, .. } => (key, pressed), _ => unreachable!() })
            .collect();
        assert_eq!(names, vec![
            ("ControlLeft".into(), true), ("ShiftLeft".into(), true), ("KeyS".into(), true),
            ("KeyS".into(), false), ("ShiftLeft".into(), false), ("ControlLeft".into(), false),
        ]);
    }

    #[test]
    fn screenshots_encode_and_crop_to_the_frame() {
        // 4x2 frame: left half red, right half blue.
        let px = [0xff0000u32, 0xff0000, 0x0000ff, 0x0000ff, 0xff0000, 0xff0000, 0x0000ff, 0x0000ff];
        let (w, h, bytes) = png(4, 2, &px, None).unwrap();
        assert_eq!((w, h), (4, 2));
        let img = image::load_from_memory(&bytes).unwrap().to_rgba8();
        assert_eq!(img.get_pixel(0, 0).0, [255, 0, 0, 255]);
        assert_eq!(img.get_pixel(3, 1).0, [0, 0, 255, 255]);

        let (w, h, bytes) = png(4, 2, &px, Some([2.0, 0.0, 10.0, 10.0])).unwrap();
        assert_eq!((w, h), (2, 2), "clamped to the frame");
        assert_eq!(image::load_from_memory(&bytes).unwrap().to_rgba8().get_pixel(0, 0).0, [0, 0, 255, 255]);

        assert!(png(4, 2, &px, Some([50.0, 50.0, 5.0, 5.0])).is_err());
    }

    #[test]
    fn set_prop_parses_each_kind_and_rejects_bad_values() {
        let mut p = NodeProps::default();
        set_prop(&mut p, "backgroundColor", &json!("#ff0000")).unwrap();
        set_prop(&mut p, "width", &json!("50%")).unwrap();
        set_prop(&mut p, "height", &json!(40)).unwrap();
        set_prop(&mut p, "text", &json!("hi")).unwrap();
        set_prop(&mut p, "zIndex", &json!(3)).unwrap();
        assert_eq!(p.background_color, Some([255, 0, 0, 255]));
        assert_eq!(p.width, Some(glyx_runtime::LengthValue::Percent(0.5)));
        assert_eq!(p.height, Some(glyx_runtime::LengthValue::Px(40.0)));
        assert_eq!((p.text.as_deref(), p.z_index), (Some("hi"), Some(3)));
        set_prop(&mut p, "text", &Value::Null).unwrap();
        assert_eq!(p.text, None, "null unsets");
        assert!(set_prop(&mut p, "color", &json!("red")).is_err());
        assert!(set_prop(&mut p, "fontSize", &json!("big")).is_err());
        assert!(set_prop(&mut p, "onPress", &json!(1)).unwrap_err().contains("editable props"));
        set_prop(&mut p, "flexDirection", &json!("column")).unwrap();
        assert_eq!(p.flex_direction.as_deref(), Some("column"));
        assert!(set_prop(&mut p, "justifyContent", &json!("middle")).unwrap_err().contains("isn't one of"));
    }

    #[test]
    fn element_ids_are_added_and_pins_flagged() {
        let ids = parse_ids(&json!({
            "1": { "id": "App#0 › Btn#0 › Pressable#0" },
            "2": { "id": "save", "pinned": true },
            "x": { "id": "ignored" },
            "3": { "nope": 1 },
        }));
        assert_eq!(ids.len(), 2);
        let mut v = json!({ "nodes": [{ "nodeId": 1 }, { "nodeId": 2 }, { "nodeId": 3 }] });
        annotate_ids(&mut v, &ids);
        assert_eq!(v["nodes"][0]["id"], "App#0 › Btn#0 › Pressable#0");
        assert!(v["nodes"][0].get("pinned").is_none());
        assert_eq!(v["nodes"][1]["pinned"], true);
        assert!(v["nodes"][2].get("id").is_none());
        assert!(ids_script(None, true).contains("__glyx_devNodeIds(null, true)"));
        assert!(ids_script(Some(&[4, 5]), false).contains("__glyx_devNodeIds([4,5], false)"));
        assert!(Query::from_params(&json!({ "id": "save" })).auto_id.is_some());
        assert!(!Query::from_params(&json!({ "id": "save" })).is_empty());
    }

    #[test]
    fn names_are_added_next_to_every_node_id() {
        let mut v = json!({ "nodeId": 1, "children": [{ "nodeId": 2 }, { "nodeId": 3 }], "node": { "nodeId": 2 } });
        let mut ids = Vec::new();
        node_ids(&v, &mut ids);
        ids.sort();
        ids.dedup();
        assert_eq!(ids, vec![1, 2, 3]);
        let names = parse_names(&json!({ "2": "Btn@app.jsx:104", "x": "ignored" }));
        annotate(&mut v, &names);
        assert_eq!(v["children"][0]["component"], "Btn@app.jsx:104");
        assert_eq!(v["node"]["component"], "Btn@app.jsx:104");
        assert!(v.get("component").is_none());
        assert!(names_script(&[1, 2]).contains("__glyx_devNodeNames([1,2])"));
    }

    #[test]
    fn contrast_matches_wcag_reference_values() {
        let black = [0, 0, 0, 255];
        let white = [255, 255, 255, 255];
        assert!((contrast_ratio(black, white) - 21.0).abs() < 0.01);
        assert!((contrast_ratio(white, white) - 1.0).abs() < 0.01);
        // #777 on white ≈ 4.48:1, just under AA.
        assert!((contrast_ratio([0x77, 0x77, 0x77, 255], white) - 4.48).abs() < 0.02);
        // 50%-transparent black on white is a mid grey.
        let half = contrast_ratio([0, 0, 0, 128], white);
        assert!(half > 3.0 && half < 5.0, "{half}");
    }

    #[test]
    fn the_audit_flags_unnamed_controls_images_and_low_contrast() {
        let p = |f: fn(&mut NodeProps)| { let mut x = NodeProps::default(); f(&mut x); x };
        let mut m = HashMap::new();
        m.insert(1, node(NodeType::View, p(|x| x.background_color = Some([255, 255, 255, 255])), &[2, 3, 5, 6, 7, 8], None));
        m.insert(2, node(NodeType::View, p(|x| x.pressable = Some(true)), &[], Some(1)));                        // unnamed
        m.insert(3, node(NodeType::View, p(|x| x.pressable = Some(true)), &[4], Some(1)));                       // named by text
        m.insert(4, node(NodeType::Text, p(|x| { x.text = Some("OK".into()); x.color = Some([0, 0, 0, 255]); }), &[], Some(3)));
        m.insert(5, node(NodeType::Image, NodeProps::default(), &[], Some(1)));                                   // unnamed image
        m.insert(6, node(NodeType::Text, p(|x| { x.text = Some("faint".into()); x.color = Some([0xbb, 0xbb, 0xbb, 255]); }), &[], Some(1)));
        m.insert(7, node(NodeType::Text, p(|x| { x.text = Some("big".into()); x.color = Some([0x88, 0x88, 0x88, 255]); x.font_size = Some(28.0); }), &[], Some(1)));
        m.insert(8, node(NodeType::View, p(|x| { x.pressable = Some(true); x.aria_label = Some("Close".into()); }), &[], Some(1)));
        let issues = audit(&m, Some(1));
        let found: Vec<(u32, &str)> = issues.iter().map(|i| (i.node, i.rule)).collect();
        assert_eq!(found, vec![(2, "pressable-name"), (5, "image-name"), (6, "contrast")], "{issues:#?}");
        assert_eq!(issues[2].severity, "error", "#bbb on white is under 3:1");
        assert!(issues[2].message.contains(":1"));
    }

    #[test]
    fn props_are_camel_case_and_unset_ones_are_left_out() {
        let v = props_json(&NodeProps {
            test_id: Some("t".into()), background_color: Some([255, 0, 16, 255]), font_size: Some(14.0),
            ..Default::default()
        });
        assert_eq!(v, json!({ "testID": "t", "backgroundColor": "#ff0010ff", "fontSize": 14.0 }));
    }
}
