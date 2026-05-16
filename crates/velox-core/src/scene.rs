use super::*;
use smallvec::SmallVec;
use crate::layout::layout_props_changed;

fn srgb_to_linear_u8(v: u8) -> u8 {
    let c = v as f32 / 255.0;
    let lin = if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    };
    (lin * 255.0).round().clamp(0.0, 255.0) as u8
}

fn load_image_from_path(path: &str) -> Option<peniko::Image> {
    let decoded = image::open(path).ok()?;
    let rgba = decoded.into_rgba8();
    let (w, h) = rgba.dimensions();
    let mut bytes = rgba.into_raw();
    for px in bytes.chunks_exact_mut(4) {
        px[0] = srgb_to_linear_u8(px[0]);
        px[1] = srgb_to_linear_u8(px[1]);
        px[2] = srgb_to_linear_u8(px[2]);
        let a = px[3] as u16;
        px[0] = ((px[0] as u16 * a + 127) / 255) as u8;
        px[1] = ((px[1] as u16 * a + 127) / 255) as u8;
        px[2] = ((px[2] as u16 * a + 127) / 255) as u8;
    }
    Some(peniko::Image::new(bytes.into(), peniko::Format::Rgba8, w, h))
}

pub(crate) fn apply_scene_commands(state: &mut PerWindowState, commands: Vec<SceneCommand>) -> bool {
    if commands.is_empty() {
        return false;
    }
    let mut layout_changed   = false;
    // Tracks whether the Taffy tree structure itself changed (nodes added / removed /
    // reparented).  When only style props changed we skip the full rebuild and rely
    // on the incremental mark_dirty path already applied per-node below.
    let mut structure_changed = false;
    for cmd in commands {
        match cmd {
            SceneCommand::CreateNode { id, node_type, props } => {
                state.js_nodes.insert(id, JsNode {
                    node_type,
                    props,
                    children:  SmallVec::new(),
                    layout_id: None,
                });
                if state.js_root.is_none() {
                    state.js_root = Some(id);
                }
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::CreateImage { id, path } => {
                if let Some(image) = state.images_by_path.get(&path).cloned() {
                    state.image_cache_hits += 1;
                    state.images.insert(id, image);
                } else {
                    state.image_cache_misses += 1;
                    if let Some(image) = load_image_from_path(&path) {
                        state.images_by_path.put(path.clone(), image.clone());
                        state.images.insert(id, image);
                    } else {
                        log::error!("Failed to load image at path: {}", path);
                    }
                }
                let total = state.image_cache_hits + state.image_cache_misses;
                if total > 0 && total % 16 == 0 {
                    let rate = state.image_cache_hits as f64 * 100.0 / total as f64;
                    log::info!(
                        "Image cache stats: hits={}, misses={}, hit_rate={:.1}%",
                        state.image_cache_hits,
                        state.image_cache_misses,
                        rate
                    );
                }
            }
            SceneCommand::AppendChild { parent_id, child_id } => {
                if let Some(parent) = state.js_nodes.get_mut(&parent_id) {
                    if !parent.children.contains(&child_id) {
                        parent.children.push(child_id);
                    }
                }
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::UpdateNode { id, props } => {
                // Check layout-prop changes before mutating — need old props for comparison.
                let (changed, opt_lid, opt_nt) = if let Some(node) = state.js_nodes.get(&id) {
                    if layout_props_changed(&props, &node.props) {
                        (true, node.layout_id, Some(node.node_type.clone()))
                    } else {
                        (false, None, None)
                    }
                } else {
                    (false, None, None)
                };
                if let Some(node) = state.js_nodes.get_mut(&id) {
                    node.props = props.clone();
                }
                if changed {
                    layout_changed = true;
                    // Incremental path: update Taffy style in-place + mark dirty.
                    // No structure change — skip full rebuild in recompute_layout.
                    if let (Some(lid), Some(nt)) = (opt_lid, opt_nt) {
                        let new_style = layout::to_taffy_style(&nt, &props);
                        let _ = state.layout.set_style(lid, new_style);
                        let _ = state.layout.mark_dirty(lid);
                    }
                }
            }
            SceneCommand::RemoveNode { id } => {
                // If this is an Image node, drop its decoded resource from the
                // id-keyed cache.  images_by_path keeps the bytes for reuse on
                // remount (no re-decode), but images must not accumulate stale
                // entries for node ids that no longer exist.
                if let Some(node) = state.js_nodes.get(&id) {
                    if let Some(image_id) = node.props.image_id {
                        state.images.remove(&image_id);
                    }
                }
                // Also clean up canvas data for this node.
                state.canvas_cmds.remove(&id);
                state.canvas3d_scenes.remove(&id);
                if let Some(r3d) = &mut state.renderer_3d {
                    r3d.remove_canvas(id);
                }
                state.js_nodes.remove(&id);
                // Unlink from any parent's children list so stale ghost IDs don't
                // accumulate in the renderer's traversal.  O(n × avg_children) but
                // n < 1000 in practice so this is negligible.
                for node in state.js_nodes.values_mut() {
                    node.children.retain(|c| *c != id);
                }
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::SetRoot { id } => {
                state.js_root = Some(id);
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::CanvasUpdate { id, cmds } => {
                state.canvas_cmds.insert(id, cmds);
                // Canvas draw commands don't affect layout.
            }
            SceneCommand::Canvas3DUpdate { id, scene } => {
                state.canvas3d_scenes.insert(id, scene);
                // 3D scenes don't affect layout — they blit on top of Vello.
            }
        }
    }
    if layout_changed   { state.layout_dirty           = true; }
    if structure_changed { state.layout_structure_dirty = true; }
    true
}
