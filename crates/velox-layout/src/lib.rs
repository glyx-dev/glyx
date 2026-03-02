//! velox-layout — Taffy flexbox layout engine integration.
//!
//! Responsibilities:
//!   - Own a `taffy::TaffyTree` and a node-to-metadata map
//!   - Accept style definitions and build the Taffy node tree
//!   - Run the layout compute pass given an available viewport size
//!   - Return resolved positions/sizes that `velox-renderer` uses for
//!     Vello draw-call placement
//!
//! Taffy knows nothing about rendering. It only computes geometry.

use std::collections::HashMap;
use taffy::prelude::*;
use thiserror::Error;

// Re-export so callers do not need taffy as a direct dependency.
pub use taffy::NodeId;

#[derive(Debug, Error)]
pub enum LayoutError {
    #[error("Taffy error: {0}")]
    Taffy(#[from] taffy::TaffyError),
    #[error("Node not found: {0:?}")]
    NodeNotFound(NodeId),
}

// ── Public types ──────────────────────────────────────────────────────────────

/// The resolved geometry of a single node after layout computation.
#[derive(Debug, Clone, Copy)]
pub struct ResolvedLayout {
    pub x:      f32,
    pub y:      f32,
    pub width:  f32,
    pub height: f32,
}

/// Optional user-defined tag attached to each layout node.
/// Use this to correlate layout nodes back to your own widget IDs.
#[derive(Debug, Clone)]
pub struct NodeMeta {
    pub tag: Option<String>,
}

// ── LayoutTree ────────────────────────────────────────────────────────────────

/// Wraps Taffy with metadata and a clean compute API.
pub struct LayoutTree {
    tree:  TaffyTree<()>,
    meta:  HashMap<NodeId, NodeMeta>,
    root:  Option<NodeId>,
}

impl LayoutTree {
    pub fn new() -> Self {
        Self {
            tree: TaffyTree::new(),
            meta: HashMap::new(),
            root: None,
        }
    }

    /// Add a node with the given Taffy style.
    ///
    /// Returns a `NodeId` you use to add children and read results.
    pub fn add_node(&mut self, style: Style, tag: Option<String>) -> Result<NodeId, LayoutError> {
        let id = self.tree.new_leaf(style)?;
        self.meta.insert(id, NodeMeta { tag });
        Ok(id)
    }

    /// Add a node that has children (e.g., a flex container).
    pub fn add_container(
        &mut self,
        style:    Style,
        children: &[NodeId],
        tag:      Option<String>,
    ) -> Result<NodeId, LayoutError> {
        let id = self.tree.new_with_children(style, children)?;
        self.meta.insert(id, NodeMeta { tag });
        Ok(id)
    }

    /// Set the root node.  The root is what `compute()` runs from.
    pub fn set_root(&mut self, node: NodeId) {
        self.root = Some(node);
    }

    /// Compute the layout for all nodes given a viewport size in pixels.
    ///
    /// Call this every time the window resizes.  Returns all resolved
    /// layouts in a flat `Vec` so callers can iterate without touching Taffy.
    pub fn compute(
        &mut self,
        viewport_width:  f32,
        viewport_height: f32,
    ) -> Result<Vec<(NodeId, ResolvedLayout)>, LayoutError> {
        let root = self.root.ok_or_else(|| LayoutError::Taffy(
            taffy::TaffyError::InvalidInputNode(NodeId::from(u64::MAX))
        ))?;

        self.tree.compute_layout(
            root,
            Size {
                width:  AvailableSpace::Definite(viewport_width),
                height: AvailableSpace::Definite(viewport_height),
            },
        )?;

        let mut results = Vec::with_capacity(self.meta.len());
        self.collect_layouts(root, 0.0, 0.0, &mut results)?;
        Ok(results)
    }

    /// Recursively collect resolved layouts with absolute (not relative) positions.
    fn collect_layouts(
        &self,
        node:    NodeId,
        off_x:   f32,
        off_y:   f32,
        out:     &mut Vec<(NodeId, ResolvedLayout)>,
    ) -> Result<(), LayoutError> {
        let layout = self.tree.layout(node)?;
        let abs_x  = off_x + layout.location.x;
        let abs_y  = off_y + layout.location.y;

        out.push((node, ResolvedLayout {
            x:      abs_x,
            y:      abs_y,
            width:  layout.size.width,
            height: layout.size.height,
        }));

        for child in self.tree.children(node)? {
            self.collect_layouts(child, abs_x, abs_y, out)?;
        }

        Ok(())
    }

    /// Look up metadata for a node.
    pub fn meta(&self, node: NodeId) -> Option<&NodeMeta> {
        self.meta.get(&node)
    }
}

impl Default for LayoutTree {
    fn default() -> Self {
        Self::new()
    }
}

// ── Style helpers ─────────────────────────────────────────────────────────────

/// Build a flex column container style — the most common root layout.
pub fn flex_column(gap: f32) -> Style {
    Style {
        display:         Display::Flex,
        flex_direction:  FlexDirection::Column,
        align_items:     Some(AlignItems::Center),
        justify_content: Some(JustifyContent::Center),
        gap:             Size {
            width:  length(gap),
            height: length(gap),
        },
        size: Size {
            width:  Dimension::Percent(1.0),
            height: Dimension::Percent(1.0),
        },
        ..Default::default()
    }
}

/// Build a fixed-size leaf node style.
pub fn fixed_box(width: f32, height: f32) -> Style {
    Style {
        size: Size {
            width:  length(width),
            height: length(height),
        },
        ..Default::default()
    }
}
