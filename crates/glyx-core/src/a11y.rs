//! Accessibility tree sync — walks the glyx scene graph into an
//! `accesskit::TreeUpdate` pushed to the OS AT (screen reader, etc.) via
//! `accesskit_winit`. Gated behind the `a11y` Cargo feature (`glyx-core`'s
//! workspace Cargo.toml pins `accesskit = "0.24"` and `accesskit_winit =
//! "0.33"` — these two crates must be upgraded together, since
//! `accesskit_winit` re-exports `accesskit` types across its public API; a
//! version skew between them is a compile error, not a runtime surprise.
//! 0.24 is also the version Parley 0.10's own `accesskit` feature targets,
//! which is what text-run/text-selection support builds on).
//!
//! Since 0.23 AccessKit addresses nodes as (tree, node): glyx publishes one
//! tree per window, always `TreeId::ROOT` (see `build_tree` and glyx-shell's
//! `ActionRequested` filter).
//!
//! Known scope limits: `Action::Focus`/`Click`/`Increment`/`Decrement`/
//! `SetValue` (numeric only)/`Expand`/`Collapse` are wired; text-selection
//! actions are not. `ScrollIntoView` as an AT-requested action isn't wired
//! here either, but the equivalent behavior now happens automatically
//! whenever `Action::Focus` moves focus (see `layout::scroll_reveal_target`,
//! called from `lib.rs`'s `AccessibilityAction` handler) — no separate
//! `ActionRequested::ScrollIntoView` case was needed. Role coverage is
//! View/Text/Pressable/TextInput/CheckBox/RadioButton/Switch/Slider/ComboBox
//! — see `infer_role` below for the full list.

use super::*;
use accesskit::{Action, Node as AxNode, NodeId as AxId, Rect as AxRect, Role, Toggled, Tree, TreeId, TreeUpdate};

/// Map a glyx node to an accesskit role. Explicit `role` prop wins; otherwise
/// infer a reasonable default from `NodeType` + a few well-known prop
/// combinations (pressable → Button, show_cursor → TextInput).
fn infer_role(node: &JsNode) -> Role {
    if let Some(r) = node.props.role.as_deref() {
        return match r {
            "button"        => Role::Button,
            "textbox"       => Role::TextInput,
            "checkbox"      => Role::CheckBox,
            "radio"         => Role::RadioButton,
            "switch"        => Role::Switch,
            "link"          => Role::Link,
            "image"         => Role::Image,
            "heading"       => Role::Heading,
            "list"          => Role::List,
            "listitem"      => Role::ListItem,
            "combobox"      => Role::ComboBox,
            "slider"        => Role::Slider,
            // accesskit has no separate `Role::Presentation` (still true in 0.24) — its own
            // doc comment on `GenericContainer` says this variant IS the
            // ARIA `none`/`presentation` equivalent (nodes get filtered from
            // the platform tree). This mapping was already correct.
            "none" | "presentation" => Role::GenericContainer,
            _               => Role::Unknown,
        };
    }
    match node.node_type {
        NodeType::Text => Role::Label,
        NodeType::Image => Role::Image,
        _ if node.props.show_cursor.is_some() => Role::TextInput,
        _ if node.props.pressable == Some(true) => Role::Button,
        _ => Role::GenericContainer,
    }
}

/// Does this node accept keyboard focus? Explicit `role` implies it for the
/// interactive roles; otherwise inferred the same way as `infer_role`.
fn is_focusable(node: &JsNode) -> bool {
    matches!(
        infer_role(node),
        Role::Button | Role::TextInput | Role::CheckBox | Role::RadioButton
            | Role::Switch | Role::Link | Role::ComboBox | Role::Slider
    )
}

/// BFS from `root` over `nodes`' `children` lists, returning visitation
/// order plus the reachable-id set. Pulled out of `build_tree` as a pure
/// function so it's unit-testable without a full `PerWindowState` — see
/// the `tests` module below for the orphan-exclusion regression case.
fn bfs_reachable(
    nodes: &std::collections::HashMap<u32, JsNode>,
    root: u32,
) -> (Vec<u32>, std::collections::HashSet<u32>) {
    let mut order: Vec<u32> = Vec::new();
    let mut seen: std::collections::HashSet<u32> = std::collections::HashSet::new();
    let mut queue: std::collections::VecDeque<u32> = std::collections::VecDeque::new();
    queue.push_back(root);
    seen.insert(root);
    while let Some(id) = queue.pop_front() {
        order.push(id);
        if let Some(node) = nodes.get(&id) {
            for &child in node.children.iter() {
                if nodes.contains_key(&child) && seen.insert(child) {
                    queue.push_back(child);
                }
            }
        }
    }
    (order, seen)
}

/// Resolve the `TreeUpdate.focus` field: must be reachable (in `seen`), not
/// just present somewhere in the node map — accesskit requires `focus` to
/// resolve to a node that's actually part of this update's tree, so an
/// unreachable/stale `focused_node` (e.g. a node mid-removal) falls back to
/// root rather than producing an invalid update.
fn resolve_focus(focused: Option<u32>, seen: &std::collections::HashSet<u32>, root: u32) -> u32 {
    focused.filter(|id| seen.contains(id)).unwrap_or(root)
}

/// AccessKit ids for text-run nodes start here — far above any scene node id
/// (node ids are a small `u32` counter, emitted as `AxId(id as u64)`), so run
/// ids can never collide with node ids.
pub(super) const RUN_ID_BASE: u64 = 1 << 40;

/// If `id` is a text FIELD — a text-input-role container (TextInput's outer
/// view) whose direct child is the editor Text node (`showCursor` set) —
/// return that Text child. The field node is what receives focus, so it's
/// where a screen reader must find the text and selection; the inner Text
/// node is folded into it rather than emitted as a second text box.
fn editor_text_child(nodes: &std::collections::HashMap<u32, JsNode>, id: u32) -> Option<u32> {
    let node = nodes.get(&id)?;
    if matches!(node.node_type, NodeType::Text) || infer_role(node) != Role::TextInput {
        return None;
    }
    node.children.iter().copied().find(|c| {
        nodes.get(c).is_some_and(|n| matches!(n.node_type, NodeType::Text) && n.props.show_cursor.is_some())
    })
}

/// The field's selection, from its editor Text node's props: `cursorPosition`
/// is the moving end (focus); `selectionStart`/`selectionEnd` are the ordered
/// range, so the anchor is whichever end the focus isn't at. `None` when
/// there's no caret (the field isn't focused). Offsets clamp to `char_count`.
fn field_selection(props: &NodeProps, char_count: usize) -> Option<glyx_text::TextSelection> {
    use glyx_text::{TextPosition, TextSelection};
    let focus = (props.cursor_position? as usize).min(char_count);
    let anchor = match (props.selection_start, props.selection_end) {
        (Some(s), Some(e)) if s < e => {
            let (s, e) = ((s as usize).min(char_count), (e as usize).min(char_count));
            if focus == s { e } else { s }
        }
        _ => focus,
    };
    Some(TextSelection::new(TextPosition::new(anchor), TextPosition::new(focus)))
}

/// Everything needed to lay out a field's text exactly as rendered.
struct FieldText {
    /// The field's VALUE — empty while the placeholder is being shown.
    text:        String,
    placeholder: Option<String>,
    style:       glyx_text::TextStyle,
    bx:          glyx_text::TextBox,
    /// Screen position of the editor Text node's box (same space as the rest
    /// of the tree's bounds).
    box_origin:  (f64, f64),
    selection:   Option<glyx_text::TextSelection>,
}

fn field_text(
    nodes:    &std::collections::HashMap<u32, JsNode>,
    resolved: &std::collections::HashMap<NodeId, glyx_layout::ResolvedLayout>,
    text_id:  u32,
) -> Option<FieldText> {
    let t = nodes.get(&text_id)?;
    let rl = resolved.get(&t.layout_id?)?;
    let placeholder = t.props.placeholder.clone();
    let text = if placeholder.is_some() { String::new() } else { t.props.text.clone().unwrap_or_default() };
    let selection = field_selection(&t.props, text.chars().count());
    Some(FieldText {
        style: glyx_runtime::text_props::text_style(&t.props),
        bx:    glyx_runtime::text_props::text_box(&t.props, rl.width, rl.height),
        box_origin: (rl.x as f64, rl.y as f64),
        text, placeholder, selection,
    })
}

/// Build a full `TreeUpdate` from the current scene graph. Called once per
/// rendered frame (see the `RedrawRequested` handler in `lib.rs`) — cheap to
/// call unconditionally since `accesskit_winit::Adapter::update_if_active`
/// no-ops internally when no assistive technology is actually attached.
pub(super) fn build_tree(state: &mut PerWindowState) -> Option<TreeUpdate> {
    let root_id = state.js_root?;
    if !state.js_nodes.contains_key(&root_id) {
        return None;
    }

    // accesskit requires every emitted node to be either the root or a
    // reachable child of another emitted node; a bare iteration over
    // `js_nodes` can include a transient orphan (a node that exists in the
    // map but isn't currently linked from anywhere — observed in practice
    // around Select/DatePicker popover open/close churn) which violates
    // that invariant and panics deep inside `accesskit_consumer` rather
    // than failing gracefully. Filtering to BFS-reachable nodes only makes
    // that class of bug structurally impossible.
    let (order, seen) = bfs_reachable(&state.js_nodes, root_id);

    // Text fields: field node id → its editor Text child. Those children are
    // folded into the field (see `editor_text_child`), so they're skipped
    // below and removed from their parent's child list.
    let fields: std::collections::HashMap<u32, u32> = order.iter()
        .filter_map(|&id| editor_text_child(&state.js_nodes, id).map(|t| (id, t)))
        .collect();
    let absorbed: std::collections::HashSet<u32> = fields.values().copied().collect();

    // Focus must name a node that's actually in this update — accesskit
    // PANICS otherwise ("Focused ID #n is not in the node list"). A folded
    // editor Text node isn't emitted, so focus sitting on one (however it got
    // there) is redirected to its field, and folded ids don't count as present.
    let focused = state.focused_node.map(|f| {
        fields.iter().find(|&(_, &t)| t == f).map(|(&field, _)| field).unwrap_or(f)
    });
    let emitted: std::collections::HashSet<u32> = seen.difference(&absorbed).copied().collect();

    // Collected into a TreeUpdate as we go: text-run nodes are pushed into it
    // by `TextAccess::build_runs` alongside the scene nodes.
    let mut update = TreeUpdate {
        nodes:   Vec::with_capacity(order.len()),
        tree:    Some(Tree::new(AxId(root_id as u64))),
        // AccessKit 0.24+ supports multiple trees per window; glyx publishes
        // exactly one, the root tree (matches glyx-shell's action filter).
        tree_id: TreeId::ROOT,
        focus:   AxId(resolve_focus(focused, &emitted, root_id) as u64),
    };
    log::debug!("[a11y] focused_node={:?} -> focus={:?} fields={:?}", state.focused_node, update.focus, fields);
    let mut next_run_id = state.a11y_next_run_id;

    for id in order {
        if absorbed.contains(&id) { continue; }
        let Some(node) = state.js_nodes.get(&id) else { continue };
        let role = infer_role(node);
        let mut ax = AxNode::new(role);

        let label = node.props.aria_label.clone()
            .or_else(|| if matches!(node.node_type, NodeType::Text) { node.props.text.clone() } else { None });
        if let Some(l) = label {
            ax.set_label(l);
        }
        // Supplementary description beyond the label — e.g. a delete button
        // labeled "Delete" whose `accessibilityHint` explains the
        // consequence ("Deletes this note permanently").
        if let Some(hint) = node.props.accessibility_hint.clone() {
            ax.set_description(hint);
        }

        let children: Vec<AxId> = node.children.iter()
            .filter(|&&c| seen.contains(&c) && !absorbed.contains(&c))
            .map(|&c| AxId(c as u64))
            .collect();
        if !children.is_empty() {
            ax.set_children(children);
        }

        if let Some(layout_id) = node.layout_id {
            if let Some(rl) = state.resolved_by_id.get(&layout_id) {
                ax.set_bounds(AxRect {
                    x0: rl.x as f64,
                    y0: rl.y as f64,
                    x1: (rl.x + rl.width) as f64,
                    y1: (rl.y + rl.height) as f64,
                });
            }
        }

        if is_focusable(node) {
            ax.add_action(Action::Focus);
        }
        if matches!(role, Role::Button | Role::Link | Role::CheckBox | Role::RadioButton | Role::Switch) {
            ax.add_action(Action::Click);
        }
        if matches!(role, Role::CheckBox | Role::RadioButton | Role::Switch) {
            if let Some(checked) = node.props.checked {
                ax.set_toggled(if checked { Toggled::True } else { Toggled::False });
            }
        }
        if role == Role::Slider {
            if let Some(v) = node.props.numeric_value { ax.set_numeric_value(v); }
            if let Some(v) = node.props.numeric_min   { ax.set_min_numeric_value(v); }
            if let Some(v) = node.props.numeric_max   { ax.set_max_numeric_value(v); }
            // Without advertising these, AT clients won't offer the
            // increment/decrement/set-value gestures at all — a slider with
            // only Focus/Click is visible but not operable.
            ax.add_action(Action::Increment);
            ax.add_action(Action::Decrement);
            ax.add_action(Action::SetValue);
        }
        // Disclosure-style controls (accordion headers, tree items,
        // comboboxes) — `expanded` being set at all (regardless of value)
        // is what advertises the state AND the Expand/Collapse gestures;
        // a control that never sets it doesn't support them.
        if let Some(expanded) = node.props.expanded {
            ax.set_expanded(expanded);
            ax.add_action(if expanded { Action::Collapse } else { Action::Expand });
        }

        // Text field: expose its text as AccessKit text runs (built by Parley
        // from the SAME layout the renderer drew), plus its selection, so a
        // screen reader can read by character/word/line and move/extend the
        // selection itself (`SetTextSelection`, handled in lib.rs).
        if let Some(ft) = fields.get(&id).and_then(|&t| field_text(&state.js_nodes, &state.resolved_by_id, t)) {
            if !ft.bx.single_line {
                ax.set_role(Role::MultilineTextInput);
            }
            if let Some(p) = &ft.placeholder {
                ax.set_placeholder(p.clone());
            }
            ax.add_action(Action::SetTextSelection);

            // Reuse the renderer's already-shaped layout (label_cache) —
            // shaping only on a miss (e.g. the empty value behind a shown
            // placeholder, which the renderer never shaped).
            let wrap = ft.bx.wrap_width();
            let key = LabelKey::new(&ft.text, ft.style.font_size, wrap, ft.style.bold, ft.style.italic, ft.style.line_height);
            let shaped;
            let layout = match state.label_cache.peek(&key) {
                Some(cached) => &cached.layout,
                None => { shaped = state.text_sys.shape_in_box(&ft.text, &ft.style, &ft.bx); &shaped }
            };
            let (dx, dy) = ft.bx.origin(layout.width(), layout.height());
            let access = state.a11y_text.entry(id).or_default();
            access.build_runs(
                &ft.text, layout, &mut update, &mut ax,
                || { next_run_id += 1; AxId(next_run_id) },
                (ft.box_origin.0 + dx as f64, ft.box_origin.1 + dy as f64),
            );
            if let Some(sel) = ft.selection {
                let ak = access.to_access_selection(&ft.text, layout, sel);
                log::debug!("[a11y] field {id}: selection {:?} -> {:?}", (sel.anchor.offset, sel.focus.offset), ak);
                if let Some(ak) = ak {
                    ax.set_text_selection(ak);
                }
            }
        }

        update.nodes.push((AxId(id as u64), ax));
    }

    state.a11y_next_run_id = next_run_id;
    // Fields that no longer exist: drop their run bookkeeping.
    state.a11y_text.retain(|id, _| fields.contains_key(id));

    if update.nodes.is_empty() {
        return None;
    }

    // Diagnostic (RUST_LOG=debug, or RUST_LOG=glyx_core::a11y=debug to scope
    // it) — dumps every non-generic-container node's id/role/label/bounds.
    // This is what found the popover-focus-race bug (see memory), kept
    // permanently since it's free unless someone opts into debug logging.
    log::debug!("[a11y] tree: {} nodes reachable from root {}", update.nodes.len(), root_id);
    for (nid, n) in &update.nodes {
        if !matches!(n.role(), Role::GenericContainer | Role::TextRun) {
            log::debug!(
                "[a11y]   id={} role={:?} label={:?} bounds={:?}",
                nid.0, n.role(), n.label(), n.bounds(),
            );
        }
    }

    Some(update)
}

/// Map a screen reader's `SetTextSelection` request on text field `field_id`
/// back to character offsets `(anchor, focus)`, against the field's current
/// layout. `None` if `field_id` isn't a field this window has exposed runs
/// for, or the selection names run nodes it doesn't own.
pub(super) fn selection_from_access(
    state:    &mut PerWindowState,
    field_id: u32,
    sel:      &accesskit::TextSelection,
) -> Option<(u32, u32)> {
    let text_id = editor_text_child(&state.js_nodes, field_id)?;
    let ft = field_text(&state.js_nodes, &state.resolved_by_id, text_id)?;
    let access = state.a11y_text.get(&field_id)?;
    // Fresh shaping from the same inputs as the tree build — identical layout,
    // so the run paths `access` remembers still line up.
    let layout = state.text_sys.shape_in_box(&ft.text, &ft.style, &ft.bx);
    let s = access.from_access_selection(&ft.text, &layout, sel)?;
    Some((s.anchor.offset as u32, s.focus.offset as u32))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn node(node_type: NodeType, children: &[u32]) -> JsNode {
        let mut n = JsNode::new(node_type, NodeProps::default());
        n.children = children.iter().copied().collect();
        n
    }

    fn node_with_role(role: &str) -> JsNode {
        let mut n = node(NodeType::View, &[]);
        n.props.role = Some(role.to_string());
        n
    }

    #[test]
    fn infer_role_explicit_prop_wins_over_inference() {
        let mut n = node(NodeType::Text, &[]); // would infer Label from NodeType
        n.props.role = Some("button".to_string());
        assert_eq!(infer_role(&n), Role::Button);
    }

    #[test]
    fn infer_role_covers_every_explicit_role_string() {
        let cases = [
            ("button", Role::Button), ("textbox", Role::TextInput),
            ("checkbox", Role::CheckBox), ("radio", Role::RadioButton),
            ("switch", Role::Switch), ("link", Role::Link),
            ("image", Role::Image), ("heading", Role::Heading),
            ("list", Role::List), ("listitem", Role::ListItem),
            ("combobox", Role::ComboBox), ("slider", Role::Slider),
            ("none", Role::GenericContainer), ("presentation", Role::GenericContainer),
            ("bogus", Role::Unknown),
        ];
        for (role_str, expected) in cases {
            assert_eq!(infer_role(&node_with_role(role_str)), expected, "role={role_str}");
        }
    }

    #[test]
    fn infer_role_falls_back_to_node_type_and_props_without_explicit_role() {
        assert_eq!(infer_role(&node(NodeType::Text, &[])), Role::Label);
        assert_eq!(infer_role(&node(NodeType::Image, &[])), Role::Image);

        let mut text_input = node(NodeType::View, &[]);
        text_input.props.show_cursor = Some(true);
        assert_eq!(infer_role(&text_input), Role::TextInput);

        let mut pressable = node(NodeType::View, &[]);
        pressable.props.pressable = Some(true);
        assert_eq!(infer_role(&pressable), Role::Button);

        assert_eq!(infer_role(&node(NodeType::View, &[])), Role::GenericContainer);
    }

    #[test]
    fn is_focusable_matches_interactive_roles_only() {
        assert!(is_focusable(&node_with_role("button")));
        assert!(is_focusable(&node_with_role("slider")));
        assert!(!is_focusable(&node_with_role("heading")));
        assert!(!is_focusable(&node(NodeType::View, &[])));
    }

    #[test]
    fn bfs_reachable_excludes_orphans_not_linked_from_root() {
        // root -> child(1); node 2 exists in the map but nothing points to it
        // (the exact shape of the popover-close race that caused the real
        // accesskit_consumer panic this function was written to prevent).
        let mut nodes = HashMap::new();
        nodes.insert(0, node(NodeType::View, &[1]));
        nodes.insert(1, node(NodeType::View, &[]));
        nodes.insert(2, node(NodeType::View, &[])); // orphan

        let (order, seen) = bfs_reachable(&nodes, 0);
        assert_eq!(order, vec![0, 1]);
        assert!(seen.contains(&0) && seen.contains(&1));
        assert!(!seen.contains(&2));
    }

    #[test]
    fn bfs_reachable_ignores_children_pointing_at_missing_ids() {
        // A child id listed in `children` but absent from the map entirely
        // (e.g. removed in the same tick children was captured) must not
        // appear in the reachable set or crash the walk.
        let mut nodes = HashMap::new();
        nodes.insert(0, node(NodeType::View, &[1, 99])); // 99 doesn't exist
        nodes.insert(1, node(NodeType::View, &[]));

        let (order, seen) = bfs_reachable(&nodes, 0);
        assert_eq!(order, vec![0, 1]);
        assert!(!seen.contains(&99));
    }

    #[test]
    fn resolve_focus_falls_back_to_root_when_focused_node_unreachable() {
        let seen: std::collections::HashSet<u32> = [0u32, 1].into_iter().collect();
        // Focused node not in `seen` at all (e.g. removed mid-tick) -> root.
        assert_eq!(resolve_focus(Some(42), &seen, 0), 0);
        // No focus set at all -> root.
        assert_eq!(resolve_focus(None, &seen, 0), 0);
        // Focused node is reachable -> itself.
        assert_eq!(resolve_focus(Some(1), &seen, 0), 1);
    }

    // ── Text fields (screen-reader text runs + selection) ────────────────────

    /// TextInput's shape: an outer `textbox` view (id 1) whose child is the
    /// editor Text node (id 2, `showCursor` set).
    fn text_field(text: &str) -> HashMap<u32, JsNode> {
        let mut nodes = HashMap::new();
        let mut outer = node_with_role("textbox");
        outer.children = [2u32].into_iter().collect();
        nodes.insert(1, outer);
        let mut inner = node(NodeType::Text, &[]);
        inner.props.text = Some(text.to_string());
        inner.props.show_cursor = Some(false);
        nodes.insert(2, inner);
        nodes
    }

    #[test]
    fn editor_text_child_finds_the_field_text_node() {
        let nodes = text_field("hello");
        assert_eq!(editor_text_child(&nodes, 1), Some(2));
        // The Text node itself isn't a field; nor is a plain container.
        assert_eq!(editor_text_child(&nodes, 2), None);
        let mut plain = HashMap::new();
        plain.insert(1, node(NodeType::View, &[2]));
        plain.insert(2, node(NodeType::Text, &[]));
        assert_eq!(editor_text_child(&plain, 1), None);
    }

    #[test]
    fn editor_text_child_requires_an_editor_text_child() {
        // A textbox whose Text child has no showCursor (e.g. a label inside a
        // custom textbox) isn't treated as an editable field.
        let mut nodes = text_field("hello");
        nodes.get_mut(&2).unwrap().props.show_cursor = None;
        assert_eq!(editor_text_child(&nodes, 1), None);
    }

    fn props(cursor: Option<u32>, sel: Option<(u32, u32)>) -> NodeProps {
        NodeProps {
            cursor_position: cursor,
            selection_start: sel.map(|s| s.0),
            selection_end:   sel.map(|s| s.1),
            ..NodeProps::default()
        }
    }

    #[test]
    fn field_selection_is_none_without_a_caret() {
        assert_eq!(field_selection(&props(None, None), 10), None);
    }

    #[test]
    fn field_selection_collapsed_caret() {
        let s = field_selection(&props(Some(4), None), 10).unwrap();
        assert_eq!((s.anchor.offset, s.focus.offset), (4, 4));
    }

    #[test]
    fn field_selection_recovers_direction_from_the_caret_end() {
        // Selecting rightwards: caret (focus) at the end, anchor at the start.
        let s = field_selection(&props(Some(7), Some((2, 7))), 10).unwrap();
        assert_eq!((s.anchor.offset, s.focus.offset), (2, 7));
        // Selecting leftwards: caret at the start, anchor at the end.
        let s = field_selection(&props(Some(2), Some((2, 7))), 10).unwrap();
        assert_eq!((s.anchor.offset, s.focus.offset), (7, 2));
    }

    #[test]
    fn field_selection_clamps_to_the_text_length() {
        let s = field_selection(&props(Some(50), Some((3, 50))), 10).unwrap();
        assert_eq!((s.anchor.offset, s.focus.offset), (3, 10));
    }

    fn resolved_for(nodes: &mut HashMap<u32, JsNode>) -> HashMap<NodeId, glyx_layout::ResolvedLayout> {
        nodes.get_mut(&2).unwrap().layout_id = Some(NodeId::from(2u64));
        let mut r = HashMap::new();
        r.insert(NodeId::from(2u64), glyx_layout::ResolvedLayout { x: 30.0, y: 40.0, width: 200.0, height: 24.0 });
        r
    }

    #[test]
    fn field_text_uses_the_value_and_the_nodes_own_placement() {
        let mut nodes = text_field("hello");
        nodes.get_mut(&2).unwrap().props.text_scroll_x = Some(0.0); // single-line input
        let resolved = resolved_for(&mut nodes);
        let ft = field_text(&nodes, &resolved, 2).unwrap();
        assert_eq!(ft.text, "hello");
        assert_eq!(ft.placeholder, None);
        assert!(ft.bx.single_line);
        assert_eq!((ft.bx.width, ft.bx.height), (200.0, 24.0));
        assert_eq!(ft.box_origin, (30.0, 40.0));
    }

    #[test]
    fn field_text_exposes_an_empty_value_while_the_placeholder_shows() {
        // The Text node DRAWS the placeholder, but the field's value is empty:
        // a screen reader must not hear the placeholder as typed content.
        let mut nodes = text_field("Search notes");
        nodes.get_mut(&2).unwrap().props.placeholder = Some("Search notes".to_string());
        nodes.get_mut(&2).unwrap().props.cursor_position = Some(5);
        let resolved = resolved_for(&mut nodes);
        let ft = field_text(&nodes, &resolved, 2).unwrap();
        assert_eq!(ft.text, "");
        assert_eq!(ft.placeholder.as_deref(), Some("Search notes"));
        // Caret clamps into the empty value.
        let s = ft.selection.unwrap();
        assert_eq!((s.anchor.offset, s.focus.offset), (0, 0));
    }
}
