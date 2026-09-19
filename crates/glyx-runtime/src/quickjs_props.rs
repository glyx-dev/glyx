//! Direct `NodeProps`/`NodeType` parsing for the QuickJS backend.
//!
//! V8's `parse_props` (`bindings/mod.rs`) reads directly from a
//! `v8::Local<Object>` field by field. QuickJS's equivalent does the same
//! via `rquickjs::Object::get` — no `JSON.stringify` + `serde_json` round
//! trip. The readers below intentionally mirror V8's `get_str_prop` /
//! `get_num_prop` / `get_length_prop` / `get_bool_prop` / `get_color_prop`
//! coercion rules 1:1.
//!
//! Every field name/type here is intentionally kept in the same order as
//! `bindings/mod.rs`'s `parse_props` so the two stay easy to compare.

use rquickjs::{Object, Value};

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

/// Read a property, returning `None` for an absent key or a thrown getter.
fn get_value<'js>(obj: &Object<'js>, key: &str) -> Option<Value<'js>> {
    obj.get::<&str, Value<'js>>(key).ok()
}

/// Format a JS number the way its `ToString` / previous JSON round-trip
/// would: integral values have no trailing `.0` (`42`, not `42.0`).
fn number_to_string(n: f64) -> String {
    if n.fract() == 0.0 && n.abs() < 1e15 {
        (n as i64).to_string()
    } else {
        format!("{n}")
    }
}

/// String property, coercing numbers to strings (mirrors V8's
/// `is_string() || is_number()` check in `get_str_prop`).
fn get_str(obj: &Object<'_>, key: &str) -> Option<String> {
    let v = get_value(obj, key)?;
    if let Some(s) = v.as_string() {
        s.to_string().ok()
    } else {
        v.as_number().map(number_to_string)
    }
}

/// Number property as `f32`; non-numbers (including numeric strings) give
/// `None`, matching V8's `is_number()` check in `get_num_prop`.
fn get_num(obj: &Object<'_>, key: &str) -> Option<f32> {
    get_value(obj, key)?.as_number().map(|n| n as f32)
}

fn get_bool(obj: &Object<'_>, key: &str) -> Option<bool> {
    get_value(obj, key)?.as_bool()
}

/// `"50%"` → `Percent(0.5)`, `"123"` → `Px(123.0)`, `123` → `Px(123.0)`.
fn get_length(obj: &Object<'_>, key: &str) -> Option<LengthValue> {
    let v = get_value(obj, key)?;
    if let Some(s) = v.as_string() {
        let s = s.to_string().ok()?;
        if let Some(pct) = s.strip_suffix('%') {
            return pct.parse::<f32>().ok().map(|n| LengthValue::Percent(n / 100.0));
        }
        return s.parse::<f32>().ok().map(LengthValue::Px);
    }
    v.as_number().map(|n| LengthValue::Px(n as f32))
}

fn get_color(obj: &Object<'_>, key: &str) -> Option<[u8; 4]> {
    parse_hex_color(&get_str(obj, key)?)
}

/// Parse a `NodeProps` directly from the JS props object. Field list
/// intentionally mirrors `bindings/mod.rs`'s `parse_props` 1:1 — see that
/// function if a field is missing here after a NodeProps change upstream.
pub(crate) fn parse_props_value(props: Value<'_>) -> NodeProps {
    let mut out = NodeProps::default();
    let Some(obj) = props.into_object() else { return out };

    out.width  = get_length(&obj, "width");
    out.height = get_length(&obj, "height");

    out.text                  = get_str(&obj, "text");
    out.font_size             = get_num(&obj, "fontSize");
    out.line_height           = get_num(&obj, "lineHeight");
    out.font_weight           = get_str(&obj, "fontWeight");
    out.font_style            = get_str(&obj, "fontStyle");
    out.text_decoration_line  = get_str(&obj, "textDecorationLine");
    out.number_of_lines       = get_num(&obj, "numberOfLines").map(|n| n as u32);
    out.color                 = get_color(&obj, "color");

    out.background_color = get_color(&obj, "backgroundColor");
    out.border_radius    = get_num(&obj, "borderRadius");

    out.flex            = get_num(&obj, "flex");
    out.flex_direction   = get_str(&obj, "flexDirection");
    out.justify_content  = get_str(&obj, "justifyContent");
    out.align_items      = get_str(&obj, "alignItems");
    out.padding          = get_length(&obj, "padding");
    out.gap              = get_length(&obj, "gap");
    out.flex_grow        = get_num(&obj, "flexGrow");
    out.flex_shrink      = get_num(&obj, "flexShrink");
    out.flex_basis       = get_length(&obj, "flexBasis");
    out.flex_wrap        = get_str(&obj, "flexWrap");

    out.align_self    = get_str(&obj, "alignSelf");
    out.align_content  = get_str(&obj, "alignContent");
    out.justify_self   = get_str(&obj, "justifySelf");
    out.justify_items  = get_str(&obj, "justifyItems");

    out.display               = get_str(&obj, "display");
    out.grid_template_columns = get_str(&obj, "gridTemplateColumns");
    out.grid_template_rows    = get_str(&obj, "gridTemplateRows");
    out.grid_column           = get_str(&obj, "gridColumn");
    out.grid_row              = get_str(&obj, "gridRow");

    out.show_cursor       = get_bool(&obj, "showCursor");
    out.cursor_position   = get_num(&obj, "cursorPosition").map(|n| n as u32);
    out.selection_start   = get_num(&obj, "selectionStart").map(|n| n as u32);
    out.selection_end     = get_num(&obj, "selectionEnd").map(|n| n as u32);
    out.ime_preedit_start = get_num(&obj, "imePreeditStart").map(|n| n as u32);
    out.ime_preedit_end   = get_num(&obj, "imePreeditEnd").map(|n| n as u32);
    out.role         = get_str(&obj, "role");
    out.aria_label    = get_str(&obj, "ariaLabel");
    out.checked       = get_bool(&obj, "checked");
    out.numeric_value = get_num(&obj, "numericValue").map(|n| n as f64);
    out.numeric_min   = get_num(&obj, "numericMin").map(|n| n as f64);
    out.numeric_max   = get_num(&obj, "numericMax").map(|n| n as f64);
    out.text_align    = get_str(&obj, "textAlign");
    out.border_width  = get_num(&obj, "borderWidth");
    out.border_color  = get_color(&obj, "borderColor");

    out.clip              = get_bool(&obj, "clip");
    out.scroll_offset_y   = get_num(&obj, "scrollOffsetY");
    out.image_id          = get_num(&obj, "imageId").map(|n| n as u32);
    out.image_resize_mode = get_str(&obj, "resizeMode");
    out.z_index           = get_num(&obj, "zIndex").map(|n| n as i32);
    out.draggable         = get_bool(&obj, "draggable");
    out.pressable         = get_bool(&obj, "pressable");
    out.test_id           = get_str(&obj, "testID");
    out.text_scroll_x     = get_num(&obj, "textScrollX");
    out.camera_handle     = get_num(&obj, "cameraHandle").map(|n| n as u32);
    out.mirror            = get_bool(&obj, "mirror");
    out.video_handle      = get_num(&obj, "videoHandle").map(|n| n as u32);
    out.webview_src       = get_str(&obj, "webviewSrc");
    out.webview_html      = get_str(&obj, "webviewHtml");
    out.webview_opts      = get_str(&obj, "webviewOpts");

    out.margin            = get_length(&obj, "margin");
    out.margin_horizontal = get_length(&obj, "marginHorizontal");
    out.margin_vertical   = get_length(&obj, "marginVertical");
    out.margin_left       = get_length(&obj, "marginLeft");
    out.margin_right      = get_length(&obj, "marginRight");
    out.margin_top        = get_length(&obj, "marginTop");
    out.margin_bottom     = get_length(&obj, "marginBottom");

    out.padding_horizontal = get_length(&obj, "paddingHorizontal");
    out.padding_vertical   = get_length(&obj, "paddingVertical");
    out.padding_left       = get_length(&obj, "paddingLeft");
    out.padding_right      = get_length(&obj, "paddingRight");
    out.padding_top        = get_length(&obj, "paddingTop");
    out.padding_bottom     = get_length(&obj, "paddingBottom");

    out.min_width  = get_length(&obj, "minWidth");
    out.min_height = get_length(&obj, "minHeight");
    out.max_width  = get_length(&obj, "maxWidth");
    out.max_height = get_length(&obj, "maxHeight");

    out.overflow       = get_str(&obj, "overflow");
    out.hidden         = get_bool(&obj, "hidden");
    out.disabled       = get_bool(&obj, "disabled");
    out.pointer_events = get_str(&obj, "pointerEvents");

    out.opacity             = get_num(&obj, "opacity");
    out.transition_ms       = get_num(&obj, "transitionMs").map(|n| n as u32);
    out.box_shadow          = get_str(&obj, "boxShadow");
    out.background_gradient = get_str(&obj, "backgroundGradient");

    out.position  = get_str(&obj, "position");
    out.top       = get_length(&obj, "top");
    out.left      = get_length(&obj, "left");
    out.right     = get_length(&obj, "right");
    out.bottom    = get_length(&obj, "bottom");
    out.transform = get_str(&obj, "transform");
    out.box_sizing = get_str(&obj, "boxSizing");

    out.scrollbar_width = get_num(&obj, "scrollbarWidth");
    out.scrollbar_color = get_str(&obj, "scrollbarColor");
    out.show_scrollbar  = get_bool(&obj, "showScrollbar");

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a real JS object in a throwaway QuickJS context and parse it,
    /// exercising the same path `createNode`/`updateNode` use.
    fn parse(source: &str) -> NodeProps {
        let rt = rquickjs::Runtime::new().expect("quickjs runtime should build");
        let ctx = rquickjs::Context::full(&rt).expect("quickjs context should build");
        ctx.with(|ctx| {
            let value: Value = ctx.eval(source).expect("test snippet should eval");
            parse_props_value(value)
        })
    }

    #[test]
    fn parses_length_values_number_and_percent() {
        let props = parse("({ width: 100, height: '50%' })");
        assert_eq!(props.width, Some(LengthValue::Px(100.0)));
        assert_eq!(props.height, Some(LengthValue::Percent(0.5)));
    }

    #[test]
    fn parses_hex_colors() {
        let props = parse("({ backgroundColor: '#ff0000', color: '#00ff00ff' })");
        assert_eq!(props.background_color, Some([255, 0, 0, 255]));
        assert_eq!(props.color, Some([0, 255, 0, 255]));
    }

    #[test]
    fn parses_strings_bools_and_numbers() {
        let props = parse("({ text: 'hi', flex: 1, hidden: true, zIndex: -2 })");
        assert_eq!(props.text, Some("hi".to_string()));
        assert_eq!(props.flex, Some(1.0));
        assert_eq!(props.hidden, Some(true));
        assert_eq!(props.z_index, Some(-2));
    }

    #[test]
    fn coerces_numbers_used_as_strings_without_trailing_zero() {
        let props = parse("({ text: 42, fontWeight: 700 })");
        assert_eq!(props.text, Some("42".to_string()));
        assert_eq!(props.font_weight, Some("700".to_string()));
    }

    #[test]
    fn missing_fields_stay_none() {
        let props = parse("({})");
        assert_eq!(props.width, None);
        assert_eq!(props.text, None);
    }

    #[test]
    fn undefined_and_null_props_yield_default() {
        let props = parse("undefined");
        assert_eq!(props, NodeProps::default());
    }

    #[test]
    fn node_type_strings_map_correctly() {
        assert_eq!(parse_node_type_str("text"), NodeType::Text);
        assert_eq!(parse_node_type_str("IMAGE"), NodeType::Image);
        assert_eq!(parse_node_type_str("webview"), NodeType::WebView);
        assert_eq!(parse_node_type_str("bogus"), NodeType::View);
    }

    /// Golden parity fixture: one object covering EVERY field V8's `parse_props`
    /// reads (`bindings/mod.rs:2196-2311`). Both parsers must yield the same
    /// `NodeProps` for this object — if a field is added to V8's parser, it must
    /// be added here (and to `parse_props_value`) or this test only covers the
    /// subset it names.
    #[test]
    fn v8_field_for_v8_field_parity() {
        let props = parse("({
            width: 100, height: '50%',
            fontSize: 16, lineHeight: 22, fontWeight: 'bold', fontStyle: 'italic',
            textDecorationLine: 'underline', text: 'Hello',
            numberOfLines: 2, color: '#00ff00ff',
            backgroundColor: '#ff0000', borderRadius: 4,
            flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch',
            padding: 8, gap: '12', flexGrow: 0.5, flexShrink: 1, flexBasis: '200',
            flexWrap: 'wrap',
            alignSelf: 'flex-start', alignContent: 'space-between',
            justifySelf: 'auto', justifyItems: 'start',
            display: 'flex',
            gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto',
            gridColumn: '1', gridRow: '2',
            showCursor: true, cursorPosition: 3, selectionStart: 1, selectionEnd: 5,
            imePreeditStart: 2, imePreeditEnd: 4,
            role: 'button', ariaLabel: 'Submit', checked: true,
            numericValue: 7.5, numericMin: 0, numericMax: 10,
            textAlign: 'center', borderWidth: 2, borderColor: '#0000ff',
            clip: true, scrollOffsetY: 100, imageId: 42, resizeMode: 'cover',
            zIndex: -3, draggable: true, pressable: true, testID: 'submit-btn',
            textScrollX: 12.5, cameraHandle: 7, mirror: false, videoHandle: 8,
            webviewSrc: 'https://example.com', webviewHtml: '<p>hi</p>',
            webviewOpts: '{\"x\":1}',
            margin: '10', marginHorizontal: 5, marginVertical: '1%',
            marginLeft: 1, marginRight: 2, marginTop: 3, marginBottom: 4,
            paddingHorizontal: '6', paddingVertical: 7, paddingLeft: '8',
            paddingRight: 9, paddingTop: '1%', paddingBottom: 11,
            minWidth: 10, minHeight: '20', maxWidth: '30%', maxHeight: 40,
            overflow: 'hidden', hidden: false, disabled: true, pointerEvents: 'auto',
            opacity: 0.5, transitionMs: 250,
            boxShadow: '2px 3px #000000', backgroundGradient: '#ff0000 #0000ff',
            position: 'absolute', top: 1, left: '2%', right: 3, bottom: '4',
            transform: 'translate(10,20) rotate(45)', boxSizing: 'border-box',
            scrollbarWidth: 9, scrollbarColor: '#888888', showScrollbar: false
        })");

        let expected = NodeProps {
            width:  Some(LengthValue::Px(100.0)),
            height: Some(LengthValue::Percent(0.5)),
            font_size:  Some(16.0),
            line_height: Some(22.0),
            font_weight: Some("bold".to_string()),
            font_style: Some("italic".to_string()),
            text_decoration_line: Some("underline".to_string()),
            text: Some("Hello".to_string()),
            number_of_lines: Some(2),
            color: Some([0, 255, 0, 255]),
            background_color: Some([255, 0, 0, 255]),
            border_radius: Some(4.0),
            flex: Some(1.0),
            flex_direction: Some("row".to_string()),
            justify_content: Some("center".to_string()),
            align_items: Some("stretch".to_string()),
            padding: Some(LengthValue::Px(8.0)),
            gap: Some(LengthValue::Px(12.0)),
            flex_grow: Some(0.5),
            flex_shrink: Some(1.0),
            flex_basis: Some(LengthValue::Px(200.0)),
            flex_wrap: Some("wrap".to_string()),
            align_self: Some("flex-start".to_string()),
            align_content: Some("space-between".to_string()),
            justify_self: Some("auto".to_string()),
            justify_items: Some("start".to_string()),
            display: Some("flex".to_string()),
            grid_template_columns: Some("1fr 1fr".to_string()),
            grid_template_rows: Some("auto".to_string()),
            grid_column: Some("1".to_string()),
            grid_row: Some("2".to_string()),
            show_cursor: Some(true),
            cursor_position: Some(3),
            selection_start: Some(1),
            selection_end: Some(5),
            ime_preedit_start: Some(2),
            ime_preedit_end: Some(4),
            role: Some("button".to_string()),
            aria_label: Some("Submit".to_string()),
            checked: Some(true),
            numeric_value: Some(7.5),
            numeric_min: Some(0.0),
            numeric_max: Some(10.0),
            text_align: Some("center".to_string()),
            border_width: Some(2.0),
            border_color: Some([0, 0, 255, 255]),
            clip: Some(true),
            scroll_offset_y: Some(100.0),
            image_id: Some(42),
            image_resize_mode: Some("cover".to_string()),
            z_index: Some(-3),
            draggable: Some(true),
            pressable: Some(true),
            test_id: Some("submit-btn".to_string()),
            text_scroll_x: Some(12.5),
            camera_handle: Some(7),
            mirror: Some(false),
            video_handle: Some(8),
            webview_src: Some("https://example.com".to_string()),
            webview_html: Some("<p>hi</p>".to_string()),
            webview_opts: Some("{\"x\":1}".to_string()),
            margin: Some(LengthValue::Px(10.0)),
            margin_horizontal: Some(LengthValue::Px(5.0)),
            margin_vertical: Some(LengthValue::Percent(0.01)),
            margin_left: Some(LengthValue::Px(1.0)),
            margin_right: Some(LengthValue::Px(2.0)),
            margin_top: Some(LengthValue::Px(3.0)),
            margin_bottom: Some(LengthValue::Px(4.0)),
            padding_horizontal: Some(LengthValue::Px(6.0)),
            padding_vertical: Some(LengthValue::Px(7.0)),
            padding_left: Some(LengthValue::Px(8.0)),
            padding_right: Some(LengthValue::Px(9.0)),
            padding_top: Some(LengthValue::Percent(0.01)),
            padding_bottom: Some(LengthValue::Px(11.0)),
            min_width: Some(LengthValue::Px(10.0)),
            min_height: Some(LengthValue::Px(20.0)),
            max_width: Some(LengthValue::Percent(0.3)),
            max_height: Some(LengthValue::Px(40.0)),
            overflow: Some("hidden".to_string()),
            hidden: Some(false),
            disabled: Some(true),
            pointer_events: Some("auto".to_string()),
            opacity: Some(0.5),
            transition_ms: Some(250),
            box_shadow: Some("2px 3px #000000".to_string()),
            background_gradient: Some("#ff0000 #0000ff".to_string()),
            position: Some("absolute".to_string()),
            top: Some(LengthValue::Px(1.0)),
            left: Some(LengthValue::Percent(0.02)),
            right: Some(LengthValue::Px(3.0)),
            bottom: Some(LengthValue::Px(4.0)),
            transform: Some("translate(10,20) rotate(45)".to_string()),
            box_sizing: Some("border-box".to_string()),
            scrollbar_width: Some(9.0),
            scrollbar_color: Some("#888888".to_string()),
            show_scrollbar: Some(false),
        };
        assert_eq!(props, expected);
    }
}
