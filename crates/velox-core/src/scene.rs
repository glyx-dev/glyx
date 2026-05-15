use super::*;
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
    let mut layout_changed = false;
    for cmd in commands {
        match cmd {
            SceneCommand::CreateNode { id, node_type, props } => {
                state.js_nodes.insert(id, JsNode {
                    node_type,
                    props,
                    children:  Vec::new(),
                    layout_id: None,
                });
                if state.js_root.is_none() {
                    state.js_root = Some(id);
                }
                layout_changed = true;
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
                layout_changed = true;
            }
            SceneCommand::UpdateNode { id, props } => {
                if let Some(node) = state.js_nodes.get_mut(&id) {
                    if layout_props_changed(&props, &node.props) {
                        layout_changed = true;
                    }
                    node.props = props;
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
                state.js_nodes.remove(&id);
                // Unlink from any parent's children list so stale ghost IDs don't
                // accumulate in the renderer's traversal.  O(n × avg_children) but
                // n < 1000 in practice so this is negligible.
                for node in state.js_nodes.values_mut() {
                    node.children.retain(|&c| c != id);
                }
                layout_changed = true;
            }
            SceneCommand::SetRoot { id } => {
                state.js_root = Some(id);
                layout_changed = true;
            }
        }
    }
    if layout_changed {
        state.layout_dirty = true;
    }
    true
}
