//! Accessibility tree sync — walks the glyx scene graph into an
//! `accesskit::TreeUpdate` pushed to the OS AT (screen reader, etc.) via
//! `accesskit_winit`. Gated behind the `a11y` Cargo feature (`glyx-core`'s
//! Cargo.toml pins `accesskit = "0.19"` and `accesskit_winit = "0.27"` —
//! these two crates must be upgraded together, since `accesskit_winit`
//! re-exports `accesskit` types across its public API; a version skew
//! between them is a compile error, not a runtime surprise).
//!
//! Known scope limits: `Action::Focus`/`Click`/`Increment`/`Decrement`/
//! `SetValue` (numeric only) are wired; `Expand`/`Collapse`,
//! `ScrollIntoView`, and text-selection actions are not. Role coverage is
//! View/Text/Pressable/TextInput/CheckBox/RadioButton/Switch/Slider/ComboBox
//! — see `infer_role` below for the full list.

use super::*;
use accesskit::{Action, Node as AxNode, NodeId as AxId, Rect as AxRect, Role, Toggled, Tree, TreeUpdate};

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
            // accesskit 0.19 has no separate `Role::Presentation` — its own
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

/// Build a full `TreeUpdate` from the current scene graph. Called once per
/// rendered frame (see the `RedrawRequested` handler in `lib.rs`) — cheap to
/// call unconditionally since `accesskit_winit::Adapter::update_if_active`
/// no-ops internally when no assistive technology is actually attached.
pub(super) fn build_tree(state: &PerWindowState) -> Option<TreeUpdate> {
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

    let mut nodes: Vec<(AxId, AxNode)> = Vec::with_capacity(order.len());

    for id in order {
        let Some(node) = state.js_nodes.get(&id) else { continue };
        let role = infer_role(node);
        let mut ax = AxNode::new(role);

        let label = node.props.aria_label.clone()
            .or_else(|| if matches!(node.node_type, NodeType::Text) { node.props.text.clone() } else { None });
        if let Some(l) = label {
            ax.set_label(l);
        }

        let children: Vec<AxId> = node.children.iter()
            .filter(|&&c| seen.contains(&c))
            .map(|&c| AxId(c as u64))
            .collect();
        if !children.is_empty() {
            ax.set_children(children);
        }

        if let Some(layout_id) = node.layout_id {
            if let Some((_, rl)) = state.resolved.iter().find(|(nid, _)| *nid == layout_id) {
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

        nodes.push((AxId(id as u64), ax));
    }

    if nodes.is_empty() {
        return None;
    }

    // Diagnostic (RUST_LOG=debug, or RUST_LOG=glyx_core::a11y=debug to scope
    // it) — dumps every non-generic-container node's id/role/label/bounds.
    // This is what found the popover-focus-race bug (see memory), kept
    // permanently since it's free unless someone opts into debug logging.
    log::debug!("[a11y] tree: {} nodes reachable from root {}", nodes.len(), root_id);
    for (nid, n) in &nodes {
        if n.role() != Role::GenericContainer {
            log::debug!(
                "[a11y]   id={} role={:?} label={:?} bounds={:?}",
                nid.0, n.role(), n.label(), n.bounds(),
            );
        }
    }

    let focus = AxId(resolve_focus(state.focused_node, &seen, root_id) as u64);

    Some(TreeUpdate {
        nodes,
        tree: Some(Tree::new(AxId(root_id as u64))),
        focus,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn node(node_type: NodeType, children: &[u32]) -> JsNode {
        JsNode {
            node_type,
            props: NodeProps::default(),
            children: children.iter().copied().collect(),
            layout_id: None,
        }
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
}
