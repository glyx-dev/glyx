//! glyx-layout — Taffy flexbox layout engine integration.
//!
//! Responsibilities:
//!   - Own a `taffy::TaffyTree` and a node-to-metadata map
//!   - Accept style definitions and build the Taffy node tree
//!   - Run the layout compute pass given an available viewport size
//!   - Return resolved positions/sizes that `glyx-renderer` uses for
//!     Vello draw-call placement
//!
//! Taffy knows nothing about rendering. It only computes geometry.
//!
//! ## Measure function (Week 15A)
//!
//! Text leaf nodes store a `TextMeasureCtx` so Taffy can call the measure
//! function to determine their natural size.  When a Text node has no
//! explicit `height` prop, Taffy passes available space to the measure
//! closure; the caller (glyx-core) shapes the text with Parley and returns
//! the actual wrapped height.  Nodes with explicit height skip the measure
//! call (Taffy uses the definite size directly).

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

/// Context stored in Text leaf nodes so Taffy can call a measure function
/// when the node has no explicit `height` prop.
///
/// Passed to `add_text_node`; the caller provides a measure closure to
/// `compute_with_measure` that receives this context and returns the
/// natural (width, height) of the shaped text.
#[derive(Debug, Clone)]
pub struct TextMeasureCtx {
    pub text:       String,
    pub font_size:  f32,
    /// Pre-computed height cap from `numberOfLines × estimated_line_height`.
    /// `None` = no cap (text wraps freely).
    pub max_height: Option<f32>,
    /// Bold/italic glyphs are wider/taller than regular — must match what
    /// render.rs actually shapes, or Taffy reserves too little space and
    /// sibling text nodes (e.g. rich-text's per-span Text row) overlap.
    pub bold:       bool,
    pub italic:     bool,
}

// ── LayoutTree ────────────────────────────────────────────────────────────────

/// Wraps Taffy with metadata and a clean compute API.
///
/// `TaffyTree<TextMeasureCtx>` stores text content per Text leaf node so
/// the measure function closure can shape the text and return its height.
/// Non-text nodes (Views) are created with `new_leaf` / `new_with_children`
/// and have no context (`None` passed to measure).
pub struct LayoutTree {
    tree:  TaffyTree<TextMeasureCtx>,
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

    /// Add a non-text leaf node (View) with the given Taffy style.
    ///
    /// Returns a `NodeId` you use to add children and read results.
    pub fn add_node(&mut self, style: Style, tag: Option<String>) -> Result<NodeId, LayoutError> {
        let id = self.tree.new_leaf(style)?;
        self.meta.insert(id, NodeMeta { tag });
        Ok(id)
    }

    /// Add a Text leaf node with content metadata for the measure function.
    ///
    /// When the node has no explicit `height` in `style`, Taffy will call
    /// the measure closure passed to `compute_with_measure`, giving the
    /// caller (glyx-core) a chance to shape the text and return its real
    /// height from Parley.
    pub fn add_text_node(
        &mut self,
        style: Style,
        ctx:   TextMeasureCtx,
        tag:   Option<String>,
    ) -> Result<NodeId, LayoutError> {
        let id = self.tree.new_leaf_with_context(style, ctx)?;
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

    /// Set the root node.  The root is what `compute_with_measure()` runs from.
    pub fn set_root(&mut self, node: NodeId) {
        self.root = Some(node);
    }

    /// Compute the layout for all nodes given a viewport size in pixels.
    ///
    /// `measure_fn` is called by Taffy for every Text leaf node that has no
    /// explicit dimension.  Signature matches Taffy 0.5's
    /// `compute_layout_with_measure`.
    ///
    /// For a non-text node the closure receives `None` for the context
    /// parameter and should return `Size::ZERO` (Taffy ignores the result
    /// when the node has definite dimensions from its style).
    pub fn compute_with_measure<F>(
        &mut self,
        viewport_width:  f32,
        viewport_height: f32,
        measure_fn: F,
    ) -> Result<Vec<(NodeId, ResolvedLayout)>, LayoutError>
    where
        F: FnMut(
            Size<Option<f32>>,
            Size<AvailableSpace>,
            NodeId,
            Option<&mut TextMeasureCtx>,
            &Style,
        ) -> Size<f32>,
    {
        let root = self.root.ok_or_else(|| LayoutError::Taffy(
            taffy::TaffyError::InvalidInputNode(NodeId::from(u64::MAX))
        ))?;

        self.tree.compute_layout_with_measure(
            root,
            Size {
                width:  AvailableSpace::Definite(viewport_width),
                height: AvailableSpace::Definite(viewport_height),
            },
            measure_fn,
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

    /// Update the Taffy style for an existing node in-place.
    ///
    /// Use this when only CSS-equivalent props changed (flex, width, height, etc.)
    /// without any structural change (no appendChild / removeChild).
    /// Combine with `mark_dirty` to trigger an incremental recompute.
    pub fn set_style(&mut self, node: NodeId, style: Style) -> Result<(), LayoutError> {
        self.tree.set_style(node, style).map_err(LayoutError::Taffy)
    }

    /// Mark a node dirty so Taffy recomputes it and its ancestors on the next
    /// `compute_with_measure` call.  Subtrees that were not marked dirty are
    /// skipped, making updates proportional to the number of changed nodes.
    pub fn mark_dirty(&mut self, node: NodeId) -> Result<(), LayoutError> {
        self.tree.mark_dirty(node).map_err(LayoutError::Taffy)
    }

    /// Return the root node id (if set).
    pub fn root(&self) -> Option<NodeId> {
        self.root
    }

    /// Return a clone of the Taffy style for an existing node.
    pub fn get_style(&self, node: NodeId) -> Result<Style, LayoutError> {
        self.tree.style(node).cloned().map_err(LayoutError::Taffy)
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
            width:  Dimension::percent(1.0),
            height: Dimension::percent(1.0),
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
