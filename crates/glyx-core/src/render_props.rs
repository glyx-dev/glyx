//! Pure string → render-value parsers, shared by the scene-command path (which
//! pre-parses render props onto `JsNode` once per change) and the render path
//! (which reads the pre-parsed values instead of re-parsing every frame).

use crate::rgba_to_vello;
use glyx_renderer::peniko;

/// Parse a hex colour string (`#RGB`, `#RRGGBB`, `#RRGGBBAA`) into RGBA bytes.
fn hex_color(s: &str) -> Option<[u8; 4]> {
    let h = s.strip_prefix('#')?;
    let (r, g, b, a) = match h.len() {
        3 => (u8::from_str_radix(&h[0..1], 16).ok()? * 17,
              u8::from_str_radix(&h[1..2], 16).ok()? * 17,
              u8::from_str_radix(&h[2..3], 16).ok()? * 17, 255),
        6 => (u8::from_str_radix(&h[0..2], 16).ok()?,
              u8::from_str_radix(&h[2..4], 16).ok()?,
              u8::from_str_radix(&h[4..6], 16).ok()?, 255),
        8 => (u8::from_str_radix(&h[0..2], 16).ok()?,
              u8::from_str_radix(&h[2..4], 16).ok()?,
              u8::from_str_radix(&h[4..6], 16).ok()?,
              u8::from_str_radix(&h[6..8], 16).ok()?),
        _ => return None,
    };
    Some([r, g, b, a])
}

/// `"dx dy blur colour"` → shadow offset + colour. The blur radius (parts[2]) is
/// currently ignored for drawing — matches the pre-cache renderer behaviour.
pub(crate) fn parse_box_shadow(s: &str) -> Option<(f64, f64, peniko::Color)> {
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.len() < 4 { return None; }
    let dx    = parts[0].parse::<f64>().ok()?;
    let dy    = parts[1].parse::<f64>().ok()?;
    let color = hex_color(parts[3])?;
    Some((dx, dy, rgba_to_vello(color)))
}

/// `"colour1 colour2"` → vertical gradient endpoints.
pub(crate) fn parse_gradient(s: &str) -> Option<(peniko::Color, peniko::Color)> {
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.len() < 2 { return None; }
    let c1 = hex_color(parts[0])?;
    let c2 = hex_color(parts[1])?;
    Some((rgba_to_vello(c1), rgba_to_vello(c2)))
}

/// Parse a transform string into a kurbo Affine.
/// Supports `"translate(x, y)"`, `"rotate(deg)"`, `"scale(sx, sy)"` / `"scale(s)"`,
/// and chaining: `"translate(10,20) rotate(45)"`. Chains compose like CSS:
/// the rightmost function applies first, so that example moves the element
/// by (10,20) and rotates it in place, rather than rotating the offset.
pub(crate) fn parse_transform(s: &str) -> Option<peniko::kurbo::Affine> {
    // One grammar for drawing and animating (see `motion::parse_ops`).
    crate::motion::parse_ops(s).map(|ops| crate::motion::ops_affine(&ops))
}

/// `"#RGB"` / `"#RRGGBB"` / `"#RRGGBBAA"` scrollbar colour.
/// Falls back to a semi-transparent grey on parse failure.
pub(crate) fn parse_scrollbar_color(s: &str) -> peniko::Color {
    if let Some(rgba) = hex_color(s) {
        rgba_to_vello(rgba)
    } else {
        peniko::Color::from_rgba8(140, 140, 170, 153) // default: semi-transparent grey-blue
    }
}