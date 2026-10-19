//! Colour glyphs (emoji) for the Vello backend.
//!
//! Vello's glyph drawing fills outlines with one brush, so an emoji would come out as a one-colour silhouette (or nothing, in a font that has
//! only bitmaps). The glyphs of a colour font are therefore rasterized once with swash (layered colour outlines, then embedded colour
//! bitmaps scaled to the size), kept as small images, and drawn as images; every other glyph still goes through Vello's own glyph path. The
//! CPU renderer does the same with its glyph cache and Direct2D asks DirectWrite for the colour layers.

use std::collections::HashMap;
use std::sync::Arc;
use swash::scale::{image::Content, Render, ScaleContext, Source, StrikeWith};
use swash::zeno::Format;
use vello::peniko::{Blob, ImageAlphaType, ImageData, ImageFormat};

/// Memory the cached colour glyphs may hold, in bytes (a colour glyph is four bytes a pixel).
const BUDGET_BYTES: usize = 16 * 1024 * 1024;

/// One rasterized colour glyph: an image, and where it goes relative to the glyph's origin on the baseline (`left` right of it, `top` above).
pub(crate) struct ColorGlyph {
    pub image: ImageData,
    pub left:  i32,
    pub top:   i32,
}

type GlyphKey = (usize, u32, u16, u16);

/// Colour glyphs rasterized so far, least recently used first out once over `BUDGET_BYTES`. A glyph a colour font cannot give in colour is
/// remembered as `None`, and so is whether a font has any colour at all, so ordinary text costs a lookup per run and nothing more.
pub(crate) struct ColorGlyphCache {
    scale_ctx: ScaleContext,
    fonts:     HashMap<(usize, u32), bool>,
    glyphs:    lru::LruCache<GlyphKey, Option<Arc<ColorGlyph>>>,
    bytes:     usize,
}

impl ColorGlyphCache {
    pub fn new() -> Self {
        Self {
            scale_ctx: ScaleContext::new(),
            fonts:     HashMap::new(),
            glyphs:    lru::LruCache::unbounded(),
            bytes:     0,
        }
    }

    /// Whether this font has colour glyphs at all (colour outlines or colour bitmaps).
    pub fn font_has_color(&mut self, font: &vello::peniko::FontData, size: f32) -> bool {
        let data = font.data.data();
        let key = (data.as_ptr() as usize, font.index);
        if let Some(&has) = self.fonts.get(&key) { return has; }
        let has = swash::FontRef::from_index(data, font.index as usize).is_some_and(|font_ref| {
            let scaler = self.scale_ctx.builder(font_ref).size(size).build();
            scaler.has_color_outlines() || scaler.has_color_bitmaps()
        });
        self.fonts.insert(key, has);
        has
    }

    /// The colour image of glyph `glyph_id` at `size`, or `None` when this glyph has none (an ordinary letter in a font that also holds emoji).
    pub fn glyph(&mut self, font: &vello::peniko::FontData, size: f32, glyph_id: u16) -> Option<Arc<ColorGlyph>> {
        let data = font.data.data();
        let key = (data.as_ptr() as usize, font.index, glyph_id, (size * 4.0) as u16);
        if let Some(hit) = self.glyphs.get(&key) { return hit.clone(); }
        let made = swash::FontRef::from_index(data, font.index as usize).and_then(|font_ref| {
            let mut scaler = self.scale_ctx.builder(font_ref).size(size).hint(true).build();
            let rendered = Render::new(&[Source::ColorOutline(0), Source::ColorBitmap(StrikeWith::BestFit)])
                .format(Format::Alpha)
                .render(&mut scaler, glyph_id)?;
            let (w, h) = (rendered.placement.width, rendered.placement.height);
            if rendered.content != Content::Color || w == 0 || h == 0 || rendered.data.len() != w as usize * h as usize * 4 {
                return None;
            }
            // Straight-alpha sRGB from swash to premultiplied. Left as sRGB: Vello blends in sRGB (as the text colour is used), so the
            // colours come out as the font has them (converting to linear, as the loaded images are, made them darker).
            let mut px = rendered.data;
            for p in px.chunks_exact_mut(4) {
                let a = p[3] as u16;
                for c in &mut p[..3] {
                    *c = ((*c as u16 * a + 127) / 255) as u8;
                }
            }
            Some(Arc::new(ColorGlyph {
                image: ImageData { data: Blob::from(px), format: ImageFormat::Rgba8, alpha_type: ImageAlphaType::AlphaPremultiplied, width: w, height: h },
                left: rendered.placement.left,
                top:  rendered.placement.top,
            }))
        });
        self.bytes += made.as_ref().map_or(0, |g| g.image.data.data().len());
        if let Some((_, Some(old))) = self.glyphs.push(key, made.clone()) { self.bytes -= old.image.data.data().len(); }
        while self.bytes > BUDGET_BYTES && self.glyphs.len() > 1 {
            match self.glyphs.pop_lru() {
                Some((_, Some(old))) => self.bytes -= old.image.data.data().len(),
                Some(_) => {}
                None => break,
            }
        }
        made
    }
}
