//! The ONE mapping from a Text node's props to `glyx-text`'s placement types.
//!
//! Both the renderer (`glyx-core`'s `render.rs`) and the JS hit-test bindings
//! (`__glyx_text_pos_at` / `__glyx_text_caret_at`) build their `TextStyle` and
//! `TextBox` here, from the same `NodeProps`. That's what guarantees a click
//! resolves to the character that was actually drawn under it: there is no
//! second copy of "how is this text shaped and placed" to drift out of sync.

use glyx_text::{TextAlign, TextBox, TextStyle};

use crate::bindings::NodeProps;

/// How the node's text is shaped (weight, style, size, line spacing).
pub fn text_style(props: &NodeProps) -> TextStyle {
    TextStyle {
        font_size:   props.font_size.unwrap_or(16.0),
        bold:        props.font_weight.as_deref() == Some("bold"),
        italic:      props.font_style.as_deref() == Some("italic"),
        line_height: props.line_height,
    }
}

/// How the shaped text is placed inside a `width` × `height` layout box.
///
/// Single-line inputs are marked by `textScrollX` being present (TextInput
/// sets it for every non-multiline field); an editor is a node showing a
/// caret (`showCursor`).
pub fn text_box(props: &NodeProps, width: f32, height: f32) -> TextBox {
    TextBox {
        width,
        height,
        align:       TextAlign::from_prop(props.text_align.as_deref()),
        single_line: props.text_scroll_x.is_some(),
        scroll_x:    props.text_scroll_x.unwrap_or(0.0),
        editor:      props.show_cursor.unwrap_or(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn style_reads_weight_style_and_line_height() {
        let props = NodeProps {
            font_size:   Some(20.0),
            font_weight: Some("bold".to_string()),
            font_style:  Some("italic".to_string()),
            line_height: Some(30.0),
            ..NodeProps::default()
        };
        let s = text_style(&props);
        assert_eq!(s.font_size, 20.0);
        assert!(s.bold && s.italic);
        assert_eq!(s.line_height, Some(30.0));
        assert_eq!(text_style(&NodeProps::default()).font_size, 16.0);
    }

    #[test]
    fn text_scroll_x_marks_single_line_and_show_cursor_marks_editor() {
        let single = NodeProps { text_scroll_x: Some(12.0), show_cursor: Some(true), ..NodeProps::default() };
        let b = text_box(&single, 100.0, 30.0);
        assert!(b.single_line && b.editor);
        assert_eq!(b.scroll_x, 12.0);

        let plain = text_box(&NodeProps { text_align: Some("center".to_string()), ..NodeProps::default() }, 100.0, 30.0);
        assert!(!plain.single_line && !plain.editor);
        assert_eq!(plain.align, TextAlign::Center);
        assert_eq!(plain.scroll_x, 0.0);
    }
}
