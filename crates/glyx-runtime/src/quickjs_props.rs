//! JSON-based `NodeProps`/`NodeType` parsing for the QuickJS backend.
//!
//! V8's `parse_props` (`bindings/mod.rs`) reads directly from a
//! `v8::Local<Object>` field by field. QuickJS's equivalent instead
//! stringifies the incoming JS object once (`ctx.json_stringify`) and
//! parses the result as `serde_json::Value` — avoids writing ~100 lines of
//! bespoke `rquickjs::Object` field-reads for a struct this wide, and keeps
//! the actual field list (this file) trivially diffable against V8's.
//!
//! Every field name/type here is intentionally kept in the same order as
//! `bindings/mod.rs`'s `parse_props` so the two stay easy to compare.

use serde_json::Value as Json;
use crate::bindings::{parse_hex_color, LengthValue, NodeProps, NodeType};

pub(crate) fn parse_node_type_str(s: &str) -> NodeType {
    match s.to_lowercase().as_str() {
        "text"            => NodeType::Text,
        "image"           => NodeType::Image,
        "canvas"          => NodeType::Canvas,
        "canvas3d"        => NodeType::Canvas3D,
        "camera"          => NodeType::Camera,
        "video"           => NodeType::Video,
        "repaintboundary" => NodeType::RepaintBoundary,
        "webview"         => NodeType::WebView,
        _                 => NodeType::View,
    }
}

fn get_str(v: &Json, key: &str) -> Option<String> {
    match v.get(key)? {
        Json::String(s) => Some(s.clone()),
        Json::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn get_num(v: &Json, key: &str) -> Option<f32> {
    v.get(key)?.as_f64().map(|n| n as f32)
}

fn get_bool(v: &Json, key: &str) -> Option<bool> {
    v.get(key)?.as_bool()
}

fn get_length(v: &Json, key: &str) -> Option<LengthValue> {
    match v.get(key)? {
        Json::String(s) => {
            if let Some(pct) = s.strip_suffix('%') {
                pct.parse::<f32>().ok().map(|n| LengthValue::Percent(n / 100.0))
            } else {
                s.parse::<f32>().ok().map(LengthValue::Px)
            }
        }
        Json::Number(n) => n.as_f64().map(|n| LengthValue::Px(n as f32)),
        _ => None,
    }
}

fn get_color(v: &Json, key: &str) -> Option<[u8; 4]> {
    parse_hex_color(&get_str(v, key)?)
}

/// Parse a `NodeProps` from a JSON-stringified JS props object. Field list
/// intentionally mirrors `bindings/mod.rs`'s `parse_props` 1:1 — see that
/// function if a field is missing here after a NodeProps change upstream.
pub(crate) fn parse_props_json(json: &str) -> NodeProps {
    let v: Json = match serde_json::from_str(json) {
        Ok(v) => v,
        Err(_) => return NodeProps::default(),
    };
    let mut props = NodeProps::default();

    props.width  = get_length(&v, "width");
    props.height = get_length(&v, "height");

    props.text                  = get_str(&v, "text");
    props.font_size             = get_num(&v, "fontSize");
    props.line_height           = get_num(&v, "lineHeight");
    props.font_weight           = get_str(&v, "fontWeight");
    props.font_style            = get_str(&v, "fontStyle");
    props.text_decoration_line  = get_str(&v, "textDecorationLine");
    props.number_of_lines       = get_num(&v, "numberOfLines").map(|n| n as u32);
    props.color                 = get_color(&v, "color");

    props.background_color = get_color(&v, "backgroundColor");
    props.border_radius    = get_num(&v, "borderRadius");

    props.flex            = get_num(&v, "flex");
    props.flex_direction   = get_str(&v, "flexDirection");
    props.justify_content  = get_str(&v, "justifyContent");
    props.align_items      = get_str(&v, "alignItems");
    props.padding          = get_length(&v, "padding");
    props.gap              = get_length(&v, "gap");
    props.flex_grow        = get_num(&v, "flexGrow");
    props.flex_shrink      = get_num(&v, "flexShrink");
    props.flex_basis       = get_length(&v, "flexBasis");
    props.flex_wrap        = get_str(&v, "flexWrap");

    props.align_self    = get_str(&v, "alignSelf");
    props.align_content  = get_str(&v, "alignContent");
    props.justify_self   = get_str(&v, "justifySelf");
    props.justify_items  = get_str(&v, "justifyItems");

    props.display               = get_str(&v, "display");
    props.grid_template_columns = get_str(&v, "gridTemplateColumns");
    props.grid_template_rows    = get_str(&v, "gridTemplateRows");
    props.grid_column           = get_str(&v, "gridColumn");
    props.grid_row              = get_str(&v, "gridRow");

    props.show_cursor       = get_bool(&v, "showCursor");
    props.cursor_position   = get_num(&v, "cursorPosition").map(|n| n as u32);
    props.selection_start   = get_num(&v, "selectionStart").map(|n| n as u32);
    props.selection_end     = get_num(&v, "selectionEnd").map(|n| n as u32);
    props.ime_preedit_start = get_num(&v, "imePreeditStart").map(|n| n as u32);
    props.ime_preedit_end   = get_num(&v, "imePreeditEnd").map(|n| n as u32);
    props.role         = get_str(&v, "role");
    props.aria_label    = get_str(&v, "ariaLabel");
    props.checked       = get_bool(&v, "checked");
    props.numeric_value = get_num(&v, "numericValue").map(|n| n as f64);
    props.numeric_min   = get_num(&v, "numericMin").map(|n| n as f64);
    props.numeric_max   = get_num(&v, "numericMax").map(|n| n as f64);
    props.text_align    = get_str(&v, "textAlign");
    props.border_width  = get_num(&v, "borderWidth");
    props.border_color  = get_color(&v, "borderColor");

    props.clip              = get_bool(&v, "clip");
    props.scroll_offset_y   = get_num(&v, "scrollOffsetY");
    props.image_id          = get_num(&v, "imageId").map(|n| n as u32);
    props.image_resize_mode = get_str(&v, "resizeMode");
    props.z_index           = get_num(&v, "zIndex").map(|n| n as i32);
    props.draggable         = get_bool(&v, "draggable");
    props.pressable         = get_bool(&v, "pressable");
    props.test_id           = get_str(&v, "testID");
    props.text_scroll_x     = get_num(&v, "textScrollX");
    props.camera_handle     = get_num(&v, "cameraHandle").map(|n| n as u32);
    props.mirror            = get_bool(&v, "mirror");
    props.video_handle      = get_num(&v, "videoHandle").map(|n| n as u32);
    props.webview_src       = get_str(&v, "webviewSrc");
    props.webview_html      = get_str(&v, "webviewHtml");
    props.webview_opts      = get_str(&v, "webviewOpts");

    props.margin            = get_length(&v, "margin");
    props.margin_horizontal = get_length(&v, "marginHorizontal");
    props.margin_vertical   = get_length(&v, "marginVertical");
    props.margin_left       = get_length(&v, "marginLeft");
    props.margin_right      = get_length(&v, "marginRight");
    props.margin_top        = get_length(&v, "marginTop");
    props.margin_bottom     = get_length(&v, "marginBottom");

    props.padding_horizontal = get_length(&v, "paddingHorizontal");
    props.padding_vertical   = get_length(&v, "paddingVertical");
    props.padding_left       = get_length(&v, "paddingLeft");
    props.padding_right      = get_length(&v, "paddingRight");
    props.padding_top        = get_length(&v, "paddingTop");
    props.padding_bottom     = get_length(&v, "paddingBottom");

    props.min_width  = get_length(&v, "minWidth");
    props.min_height = get_length(&v, "minHeight");
    props.max_width  = get_length(&v, "maxWidth");
    props.max_height = get_length(&v, "maxHeight");

    props.overflow       = get_str(&v, "overflow");
    props.hidden         = get_bool(&v, "hidden");
    props.disabled       = get_bool(&v, "disabled");
    props.pointer_events = get_str(&v, "pointerEvents");

    props.opacity             = get_num(&v, "opacity");
    props.transition_ms       = get_num(&v, "transitionMs").map(|n| n as u32);
    props.box_shadow          = get_str(&v, "boxShadow");
    props.background_gradient = get_str(&v, "backgroundGradient");

    props.position  = get_str(&v, "position");
    props.top       = get_length(&v, "top");
    props.left      = get_length(&v, "left");
    props.right     = get_length(&v, "right");
    props.bottom    = get_length(&v, "bottom");
    props.transform = get_str(&v, "transform");
    props.box_sizing = get_str(&v, "boxSizing");

    props.scrollbar_width = get_num(&v, "scrollbarWidth");
    props.scrollbar_color = get_str(&v, "scrollbarColor");
    props.show_scrollbar  = get_bool(&v, "showScrollbar");

    props
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_length_values_number_and_percent() {
        let props = parse_props_json(r#"{"width": 100, "height": "50%"}"#);
        assert_eq!(props.width, Some(LengthValue::Px(100.0)));
        assert_eq!(props.height, Some(LengthValue::Percent(0.5)));
    }

    #[test]
    fn parses_hex_colors() {
        let props = parse_props_json(r##"{"backgroundColor": "#ff0000", "color": "#00ff00ff"}"##);
        assert_eq!(props.background_color, Some([255, 0, 0, 255]));
        assert_eq!(props.color, Some([0, 255, 0, 255]));
    }

    #[test]
    fn parses_strings_bools_and_numbers() {
        let props = parse_props_json(r#"{"text": "hi", "flex": 1, "hidden": true, "zIndex": -2}"#);
        assert_eq!(props.text, Some("hi".to_string()));
        assert_eq!(props.flex, Some(1.0));
        assert_eq!(props.hidden, Some(true));
        assert_eq!(props.z_index, Some(-2));
    }

    #[test]
    fn missing_fields_stay_none() {
        let props = parse_props_json("{}");
        assert_eq!(props.width, None);
        assert_eq!(props.text, None);
    }

    #[test]
    fn invalid_json_falls_back_to_default() {
        let props = parse_props_json("not json");
        assert_eq!(props, NodeProps::default());
    }

    #[test]
    fn node_type_strings_map_correctly() {
        assert_eq!(parse_node_type_str("text"), NodeType::Text);
        assert_eq!(parse_node_type_str("IMAGE"), NodeType::Image);
        assert_eq!(parse_node_type_str("webview"), NodeType::WebView);
        assert_eq!(parse_node_type_str("bogus"), NodeType::View);
    }
}
