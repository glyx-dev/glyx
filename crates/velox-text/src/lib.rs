//! velox-text — text shaping and layout via Parley 0.2.
//!
//! ## Metrics cheat-sheet (parley 0.2)
//!
//! After `layout.break_all_lines(max_width)`:
//!
//!   `layout.width()`   — shaped advance width (may exceed max_width if a
//!                         single word is wider; use this for centering math)
//!   `layout.height()`  — full line-box height, including leading above and
//!                         below the glyphs.  For a SINGLE line this equals
//!                         line_height ≈ font_size * 1.2–1.4.  NOT the visual
//!                         glyph height.  Do not use for vertical centering.
//!
//!   `GlyphRun::baseline()` — distance from the layout *top* to this run's
//!                             baseline, measured in +y-down screen space.
//!                             For a single line at 16 px this is ≈ 13 px.
//!
//! ## Vertical centering strategy
//!
//! To center text visually inside a box we need the *ascent* (distance from
//! baseline up to the tallest capital letter).  Parley doesn't expose this
//! directly on the Layout, but we can recover it from the first glyph run:
//!
//!   ascent  ≈ baseline           (baseline already measured from layout top)
//!   descent ≈ height - baseline  (space below baseline to bottom of line-box)
//!   visual_height ≈ ascent       (cap-height proxy — conservative but correct)
//!
//! The y we pass to `draw_text` should be:
//!
//!   ty = box_top + (box_height - visual_height) / 2.0
//!
//! `draw_text` then adds `glyph_run.baseline()` internally, so the baseline
//! lands exactly at `ty + ascent`, which sits centred in the box.

use parley::{
    layout::{Alignment, AlignmentOptions},
    style::{FontFamily, FontWeight, StyleProperty},
    FontContext, LayoutContext,
};

pub struct TextSystem {
    font_cx:   FontContext,
    layout_cx: LayoutContext<()>,
}

impl TextSystem {
    pub fn new() -> Self {
        let mut font_cx = FontContext::new();

        // ── Platform font registration ─────────────────────────────────────
        // Parley 0.2 relies on `fontique` for font discovery.  On Windows and
        // macOS this works automatically through `FontContext::new()`.  On
        // Linux fontique scans standard XDG font directories, but we add the
        // two most common paths as an explicit fallback in case fontique's
        // scan missed a directory or was built without the system feature.

        // On Windows, fontique discovers system fonts automatically via the
        // registry. We only explicitly load the Segoe UI family (our primary
        // font stack) to guarantee it's available without reading every font
        // in C:\Windows\Fonts — which can exceed 500 MB of font data.
        #[cfg(target_os = "windows")]
        {
            let font_dir = std::path::Path::new("C:\\Windows\\Fonts");
            if font_dir.exists() {
                let mut count = 0usize;
                if let Ok(entries) = std::fs::read_dir(font_dir) {
                    for entry in entries.flatten() {
                        let name = entry.file_name()
                            .to_string_lossy()
                            .to_ascii_lowercase();
                        // Load only the three core Segoe UI text variants needed
                        // for regular, bold, and semibold rendering.  Italic and
                        // light variants are omitted — fontique synthesises oblique
                        // on demand and the app rarely needs true italic faces.
                        // Excluded: seguiemj (Emoji, ~25 MB), seguisym (~15 MB),
                        // and all 7 condensed/light/italic variants (~40 MB total).
                        let wanted = matches!(name.as_str(),
                            "segoeui.ttf" | "segoeuib.ttf" | "seguisb.ttf"
                        );
                        if wanted && register_font_file(&mut font_cx, &entry.path()) {
                            count += 1;
                        }
                    }
                }
                log::info!("velox-text: registered {} Segoe UI / fallback fonts", count);
            } else {
                log::warn!("velox-text: C:\\Windows\\Fonts not found — text may use fallback glyphs");
            }
        }

        #[cfg(target_os = "macos")]
        {
            let dirs = [
                "/System/Library/Fonts",
                "/System/Library/Fonts/Supplemental",
                "/Library/Fonts",
            ];
            let mut count = 0usize;
            for dir in &dirs {
                if let Ok(entries) = std::fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        if register_font_file(&mut font_cx, &entry.path()) {
                            count += 1;
                        }
                    }
                }
            }
            log::info!("velox-text: registered {} fonts from macOS system dirs", count);
        }

        #[cfg(target_os = "linux")]
        {
            let dirs = ["/usr/share/fonts", "/usr/local/share/fonts"];
            let mut count = 0usize;
            for dir in &dirs {
                count += register_dir_recursive(&mut font_cx, std::path::Path::new(dir));
            }
            log::info!("velox-text: registered {} fonts from Linux font dirs", count);
        }

        Self {
            font_cx,
            layout_cx: LayoutContext::new(),
        }
    }

    /// Full-control shaping — returns a `TextLayout` whose metrics helpers
    /// give you everything you need for positioning.
    /// Color is not stored in the layout — it is applied at render time by the caller.
    pub fn shape(
        &mut self,
        text:      &str,
        font_size: f32,
        max_width: f32,
        weight:    FontWeight,
        alignment: Alignment,
    ) -> TextLayout {
        let mut builder = self.layout_cx.ranged_builder(&mut self.font_cx, text, 1.0, false);

        builder.push_default(StyleProperty::FontSize(font_size));
        builder.push_default(StyleProperty::FontWeight(weight));

        // Prefer a font that actually exists on the target platform.
        // Parley selects the first family name it can resolve, then falls back.
        //   Windows  → Segoe UI (ships on every modern Windows)
        //   macOS    → SF Pro / Helvetica Neue (system default sans)
        //   Linux    → DejaVu Sans (present in most distros)
        // The trailing "sans-serif" is a Parley generic that triggers its own
        // platform font-selection heuristic if none of the named fonts match.
        builder.push_default(StyleProperty::FontFamily(FontFamily::Source(
            std::borrow::Cow::Borrowed("Segoe UI, Helvetica Neue, DejaVu Sans, sans-serif"),
        )));

        let mut layout = builder.build(text);
        layout.break_all_lines(Some(max_width));
        layout.align(alignment, AlignmentOptions::default());

        TextLayout { inner: layout }
    }

    /// Shape a single-line label at the given size.  No wrapping.
    pub fn label(&mut self, text: &str, font_size: f32) -> TextLayout {
        self.shape(text, font_size, f32::MAX, FontWeight::NORMAL, Alignment::Start)
    }

    pub fn label_centered(&mut self, text: &str, font_size: f32, max_width: f32) -> TextLayout {
        self.shape(text, font_size, max_width, FontWeight::NORMAL, Alignment::Start)
    }

    /// Shape a bold single-line label.
    pub fn bold_label(&mut self, text: &str, font_size: f32) -> TextLayout {
        self.shape(text, font_size, f32::MAX, FontWeight::BOLD, Alignment::Start)
    }

    /// Deprecated alias kept for back-compat with early call sites.
    #[deprecated(note = "use bold_label()")]
    pub fn bold(&mut self, text: &str, font_size: f32) -> TextLayout {
        self.bold_label(text, font_size)
    }

    /// Measure the advance width of `text` up to (not including) `cursor_char` characters.
    ///
    /// Used to position the blinking cursor and selection highlight at the correct
    /// pixel offset for a given character index.  Handles multi-byte Unicode correctly.
    pub fn measure_to_cursor(&mut self, text: &str, font_size: f32, max_width: f32, cursor_char: usize) -> f32 {
        let byte_idx = text
            .char_indices()
            .nth(cursor_char)
            .map(|(i, _)| i)
            .unwrap_or(text.len());
        let slice = &text[..byte_idx];

        // Parley strips trailing whitespace from layout.width(), so a cursor
        // placed after a space would render at the same X as before the space.
        // Fix: append a non-whitespace sentinel, measure both strings, subtract.
        if slice.ends_with(|c: char| c.is_whitespace()) {
            let (w_with, _) = self.measure(&format!("{slice}x"), font_size, max_width);
            let (w_x,    _) = self.measure("x",                  font_size, max_width);
            (w_with - w_x).max(0.0)
        } else {
            let (w, _) = self.measure(slice, font_size, max_width);
            w
        }
    }

    /// Measure the natural (width, height) of `text` at `font_size` wrapped to
    /// `max_width` pixels.
    ///
    /// Used by the Taffy measure function so Text nodes with no explicit
    /// `height` prop report their real wrapped height to the layout engine.
    pub fn measure(&mut self, text: &str, font_size: f32, max_width: f32) -> (f32, f32) {
        let layout = self.shape(text, font_size, max_width.max(1.0), FontWeight::NORMAL, Alignment::Start);
        (layout.width(), layout.height())
    }
}

impl Default for TextSystem {
    fn default() -> Self { Self::new() }
}

// ── TextLayout ────────────────────────────────────────────────────────────────

pub struct TextLayout {
    pub inner: parley::Layout<()>,
}

impl TextLayout {
    /// Total shaped advance width.  Use this for horizontal centering.
    ///
    /// If text is very short this may be less than the container width.
    /// If a single word is wider than max_width it may exceed it.
    pub fn width(&self) -> f32 {
        self.inner.width()
    }

    /// Full line-box height including leading.  Includes space above and below
    /// the visible glyphs.  **Do not use for vertical centering** — use
    /// `ascent()` instead.
    pub fn height(&self) -> f32 {
        self.inner.height()
    }

    /// Distance from the top of the layout box to the text baseline.
    ///
    /// For a single-line layout this equals the ascent of the first glyph run.
    /// This is the value you want for vertical centering:
    ///
    /// ```
    /// let ty = box_top + (box_height - layout.ascent()) / 2.0;
    /// frame.draw_text(&layout, tx, ty, color);
    /// ```
    ///
    /// `draw_text` adds the per-run baseline internally, so the glyphs end up
    /// sitting exactly centred in the box.
    pub fn ascent(&self) -> f32 {
        // Walk the first line's first glyph run and return its baseline offset.
        // `baseline()` in parley 0.2 = distance from layout top to baseline
        // in +y-down coordinates, which is numerically equal to the ascent.
        self.inner
            .lines()
            .next()
            .and_then(|line| {
                line.items().find_map(|item| {
                    if let parley::layout::PositionedLayoutItem::GlyphRun(gr) = item {
                        Some(gr.baseline())
                    } else {
                        None
                    }
                })
            })
            .unwrap_or_else(|| self.inner.height() * 0.8)
    }

    /// Returns `(cursor_top_offset, cursor_height)` relative to the `ty` argument
    /// passed to `draw_text`.
    ///
    /// Parley's line-box includes leading above ascenders and below descenders.
    /// Drawing the cursor at raw `ty` makes it float above the visible glyphs.
    /// This method uses the glyph-run's font metrics (`ascent + descent` without
    /// leading) so the cursor aligns exactly with the visible character strokes.
    ///
    /// - `cursor_top_offset` — offset from `ty` to the cursor rect's top edge.
    /// - `cursor_height` — `font_ascent + font_descent` (glyph region only).
    pub fn cursor_metrics(&self) -> (f32, f32) {
        self.inner
            .lines()
            .next()
            .and_then(|line| {
                line.items().find_map(|item| {
                    if let parley::layout::PositionedLayoutItem::GlyphRun(gr) = item {
                        let baseline = gr.baseline();
                        let metrics  = gr.run().metrics();
                        let top    = (baseline - metrics.ascent).max(0.0);
                        let height = metrics.ascent + metrics.descent;
                        Some((top, height))
                    } else {
                        None
                    }
                })
            })
            .unwrap_or_else(|| (0.0, self.inner.height()))
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Try to register a single font file.  Returns true if it was registered.
fn register_font_file(font_cx: &mut FontContext, path: &std::path::Path) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if matches!(ext.as_str(), "ttf" | "otf" | "ttc") {
        if let Ok(data) = std::fs::read(path) {
            font_cx.collection.register_fonts(parley::fontique::Blob::from(data), None);
            return true;
        }
    }
    false
}

/// Recursively register all fonts under a directory.  Returns count registered.
#[cfg(target_os = "linux")]
fn register_dir_recursive(font_cx: &mut FontContext, dir: &std::path::Path) -> usize {
    let Ok(entries) = std::fs::read_dir(dir) else { return 0 };
    let mut count = 0usize;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            count += register_dir_recursive(font_cx, &path);
        } else {
            if register_font_file(font_cx, &path) {
                count += 1;
            }
        }
    }
    count
}
