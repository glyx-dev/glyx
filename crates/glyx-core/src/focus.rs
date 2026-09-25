//! Native keyboard-focus cycling (Tab / Shift+Tab) and focus survival when
//! the focused node is removed from the tree. Deliberately independent of
//! the `a11y` feature — Tab navigation is core UX and must work even in
//! builds without screen-reader support, even though "what counts as
//! focusable" mirrors `a11y.rs`'s `is_focusable` (duplicated rather than
//! shared, since that one lives behind `#[cfg(feature = "a11y")]`).

use super::*;

/// Does this node accept keyboard focus? Mirrors `a11y::is_focusable`'s
/// interactive-role set without depending on the `accesskit` crate.
fn is_focusable(node: &JsNode) -> bool {
    if node.props.disabled == Some(true) { return false; }
    if node.props.pointer_events.as_deref() == Some("none") { return false; }
    if let Some(f) = node.props.focusable { return f; }
    if let Some(role) = node.props.role.as_deref() {
        return matches!(
            role,
            "button" | "textbox" | "checkbox" | "radio" | "switch" | "link" | "combobox" | "slider"
        );
    }
    node.props.show_cursor.is_some() || node.props.pressable == Some(true)
}

/// The editor Text node INSIDE a text field (TextInput: an outer `textbox`
/// view wrapping a `text` node with `showCursor` set). The field is the one
/// focus target — it's what JS registers as the input — so its inner text
/// must not be a second Tab stop. It used to be one: every TextInput took two
/// Tab presses, and landing on the inner stop didn't focus the field at all
/// (nothing is registered for that id).
fn is_editor_text_of_focusable_parent(
    nodes: &std::collections::HashMap<u32, JsNode>,
    node:  &JsNode,
) -> bool {
    matches!(node.node_type, NodeType::Text)
        && node.props.show_cursor.is_some()
        && node.parent.and_then(|p| nodes.get(&p)).is_some_and(is_focusable)
}

/// BFS from `root` over `nodes`, collecting focusable ids in document order
/// — the natural default Tab order. Pure function taking raw data so it's
/// unit-testable without a full `PerWindowState`.
pub(super) fn focus_order(
    nodes: &std::collections::HashMap<u32, JsNode>,
    root: u32,
) -> Vec<u32> {
    let mut order = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut queue = std::collections::VecDeque::new();
    queue.push_back(root);
    seen.insert(root);
    while let Some(id) = queue.pop_front() {
        if let Some(node) = nodes.get(&id) {
            if is_focusable(node) && !is_editor_text_of_focusable_parent(nodes, node) {
                order.push(id);
            }
            for &child in node.children.iter() {
                if nodes.contains_key(&child) && seen.insert(child) {
                    queue.push_back(child);
                }
            }
        }
    }
    order
}

/// Reorder a focus order into visual reading order (top-to-bottom, then
/// left-to-right) using each node's resolved on-screen `(y, x)` position.
/// `positions` need not have an entry for every id — nodes with no known
/// position (not yet laid out) sort after everything with one, keeping
/// their relative BFS order among themselves (stable sort). Falls back to
/// pure document order entirely if `positions` is empty.
///
/// Needed because `focus_order`'s BFS walks nodes in scene-graph child-list
/// order, which does NOT reliably match visual top-to-bottom layout — e.g. a
/// toolbar row can end up after a sibling list container in that order even
/// though it renders above it, producing a Tab sequence that jumps around
/// the screen instead of following what's visually next.
pub(super) fn sort_by_position(
    order: &mut [u32],
    positions: &std::collections::HashMap<u32, (f32, f32)>,
) {
    order.sort_by(|a, b| {
        let pa = positions.get(a).copied().unwrap_or((f32::MAX, f32::MAX));
        let pb = positions.get(b).copied().unwrap_or((f32::MAX, f32::MAX));
        pa.partial_cmp(&pb).unwrap_or(std::cmp::Ordering::Equal)
    });
}

/// Next focus target for Tab (`backward = false`) / Shift+Tab
/// (`backward = true`). Wraps around at either end; when nothing is
/// currently focused, or the focused node has fallen out of `order`
/// (removed, disabled, hidden), starts from the first/last entry rather
/// than treating it as an error.
pub(super) fn next_focus(order: &[u32], current: Option<u32>, backward: bool) -> Option<u32> {
    if order.is_empty() {
        return None;
    }
    let pos = current.and_then(|id| order.iter().position(|&x| x == id));
    let next_idx = match (pos, backward) {
        (None, false)    => 0,
        (None, true)     => order.len() - 1,
        (Some(i), false) => (i + 1) % order.len(),
        (Some(i), true)  => (i + order.len() - 1) % order.len(),
    };
    Some(order[next_idx])
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn node(parent: Option<u32>, children: &[u32], role: Option<&str>) -> JsNode {
        let mut n = JsNode::new(NodeType::View, NodeProps::default());
        n.parent = parent;
        n.children = children.iter().copied().collect();
        n.props.role = role.map(|r| r.to_string());
        n
    }

    // Tree: 0 (root, container)
    //        ├─ 1 (button)
    //        ├─ 2 (container, not focusable)
    //        │   └─ 3 (textbox)
    //        └─ 4 (button, disabled)
    fn sample_tree() -> HashMap<u32, JsNode> {
        let mut nodes = HashMap::new();
        nodes.insert(0, node(None, &[1, 2, 4], None));
        nodes.insert(1, node(Some(0), &[], Some("button")));
        nodes.insert(2, node(Some(0), &[3], None));
        nodes.insert(3, node(Some(2), &[], Some("textbox")));
        let mut disabled_btn = node(Some(0), &[], Some("button"));
        disabled_btn.props.disabled = Some(true);
        nodes.insert(4, disabled_btn);
        nodes
    }

    #[test]
    fn focus_order_visits_focusable_nodes_in_document_order_and_skips_disabled() {
        let nodes = sample_tree();
        assert_eq!(focus_order(&nodes, 0), vec![1, 3]);
    }

    #[test]
    fn focusable_prop_adds_and_removes_tab_stops() {
        let mut chart = node(Some(0), &[], Some("figure"));
        chart.props.focusable = Some(true);
        assert!(is_focusable(&chart));
        let mut button = node(Some(0), &[], Some("button"));
        button.props.focusable = Some(false);
        assert!(!is_focusable(&button));
    }

    #[test]
    fn focus_order_skips_pointer_events_none() {
        let mut nodes = sample_tree();
        nodes.get_mut(&1).unwrap().props.pointer_events = Some("none".to_string());
        assert_eq!(focus_order(&nodes, 0), vec![3]);
    }

    #[test]
    fn focus_order_infers_focusability_from_show_cursor_and_pressable_without_explicit_role() {
        let mut nodes = HashMap::new();
        nodes.insert(0, node(None, &[1, 2], None));
        let mut input = node(Some(0), &[], None);
        input.props.show_cursor = Some(true);
        nodes.insert(1, input);
        let mut pressable = node(Some(0), &[], None);
        pressable.props.pressable = Some(true);
        nodes.insert(2, pressable);
        assert_eq!(focus_order(&nodes, 0), vec![1, 2]);
    }

    #[test]
    fn a_text_fields_inner_editor_text_is_not_a_second_tab_stop() {
        // TextInput: outer `textbox` view (1) wrapping the editor Text (2,
        // showCursor set). Only the field itself is a Tab stop — the inner
        // node used to be a second one that didn't even focus the field.
        let mut nodes = HashMap::new();
        nodes.insert(0, node(None, &[1, 3], None));
        nodes.insert(1, node(Some(0), &[2], Some("textbox")));
        let mut inner = JsNode::new(NodeType::Text, NodeProps::default());
        inner.parent = Some(1);
        inner.props.show_cursor = Some(false);
        nodes.insert(2, inner);
        nodes.insert(3, node(Some(0), &[], Some("button")));
        assert_eq!(focus_order(&nodes, 0), vec![1, 3]);
    }

    #[test]
    fn next_focus_starts_at_first_entry_when_nothing_focused() {
        assert_eq!(next_focus(&[1, 3], None, false), Some(1));
    }

    #[test]
    fn next_focus_shift_tab_starts_at_last_entry_when_nothing_focused() {
        assert_eq!(next_focus(&[1, 3], None, true), Some(3));
    }

    #[test]
    fn next_focus_advances_and_wraps_forward() {
        assert_eq!(next_focus(&[1, 3, 5], Some(1), false), Some(3));
        assert_eq!(next_focus(&[1, 3, 5], Some(5), false), Some(1));
    }

    #[test]
    fn next_focus_advances_and_wraps_backward() {
        assert_eq!(next_focus(&[1, 3, 5], Some(3), true), Some(1));
        assert_eq!(next_focus(&[1, 3, 5], Some(1), true), Some(5));
    }

    #[test]
    fn next_focus_falls_back_to_first_when_current_is_no_longer_in_order() {
        // Simulates the focused node having been removed/disabled since it
        // was last focused — its id no longer appears in `order`.
        assert_eq!(next_focus(&[1, 3], Some(99), false), Some(1));
    }

    #[test]
    fn next_focus_returns_none_when_nothing_is_focusable() {
        assert_eq!(next_focus(&[], Some(1), false), None);
    }

    #[test]
    fn sort_by_position_reorders_a_toolbar_row_ahead_of_a_list_that_comes_first_in_document_order() {
        // Reproduces the real bug found in examples/notes-app: a toolbar row
        // (id 20) that renders visually ABOVE a note list (ids 62, 73) ended
        // up AFTER it in `focus_order`'s document-order BFS, because the
        // list container happened to be an earlier sibling in the scene
        // graph's child lists despite rendering lower on screen.
        let mut order = vec![62, 73, 20];
        let positions: HashMap<u32, (f32, f32)> = [
            (62, (300.0, 10.0)), // note card, y=300
            (73, (360.0, 10.0)), // note card, y=360
            (20, (100.0, 10.0)), // toolbar button, y=100 — visually first
        ].into_iter().collect();
        sort_by_position(&mut order, &positions);
        assert_eq!(order, vec![20, 62, 73]);
    }

    #[test]
    fn sort_by_position_orders_same_row_items_left_to_right() {
        let mut order = vec![3, 1, 2];
        let positions: HashMap<u32, (f32, f32)> = [
            (1, (50.0, 10.0)),
            (2, (50.0, 100.0)),
            (3, (50.0, 200.0)),
        ].into_iter().collect();
        sort_by_position(&mut order, &positions);
        assert_eq!(order, vec![1, 2, 3]);
    }

    #[test]
    fn sort_by_position_sinks_unpositioned_nodes_to_the_end_keeping_relative_order() {
        let mut order = vec![1, 2, 3];
        let positions: HashMap<u32, (f32, f32)> = [(2, (10.0, 0.0))].into_iter().collect();
        sort_by_position(&mut order, &positions);
        // 2 has a real position and sorts first; 1 and 3 (no position) sink
        // to the end, keeping their original relative order (stable sort).
        assert_eq!(order, vec![2, 1, 3]);
    }

    #[test]
    fn sort_by_position_is_a_no_op_when_positions_is_empty() {
        let mut order = vec![62, 73, 20];
        sort_by_position(&mut order, &HashMap::new());
        assert_eq!(order, vec![62, 73, 20]);
    }
}
