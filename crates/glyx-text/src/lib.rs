//! glyx-text — text shaping and layout via Parley 0.2.
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
    Affinity, Cursor, FontContext, LayoutContext,
};

// ── Canonical selection model ─────────────────────────────────────────────────
//
// Every text consumer (SelectableText, TextInput, RichText) performs the same
// two operations — "character under a pointer" and "rendered x of a character"
// — but today each implements them independently in JS, with subtly different
// empty/offset conventions, so the same click can land on different characters
// depending on which component owns the field.  These are the shared, native
// primitives the whole text layer is built on.  JS keeps owning selection
// *state*; native owns selection *geometry*.

/// A character offset into a string.  Zero-based, Unicode-aware: the JS layer
/// indexes selections in characters (not bytes), matching how `Text` receives
/// `selectionStart`/`selectionEnd`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default)]
pub struct TextPosition {
    /// 0-based character offset from the start of the text.
    pub offset: usize,
}

impl TextPosition {
    pub const fn new(offset: usize) -> Self {
        Self { offset }
    }
}

/// A text selection: `anchor` is the fixed end (press-down), `focus` the moving
/// end (drag / shift-arrow).  The two may be in either order; callers that need
/// an ordered range use [`TextSelection::normalized`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct TextSelection {
    pub anchor: TextPosition,
    pub focus:  TextPosition,
}

impl TextSelection {
    pub const fn new(anchor: TextPosition, focus: TextPosition) -> Self {
        Self { anchor, focus }
    }

    pub const fn collapsed() -> Self {
        Self {
            anchor: TextPosition::new(0),
            focus:  TextPosition::new(0),
        }
    }

    /// True when both ends coincide (no text is highlighted).
    pub fn is_collapsed(&self) -> bool {
        self.anchor.offset == self.focus.offset
    }

    /// Return `(start, end)` in offset order, mirroring RichText's `normSel`
    /// convention so all consumers agree on which end comes first.
    pub fn normalized(&self) -> (TextPosition, TextPosition) {
        if self.anchor.offset <= self.focus.offset {
            (self.anchor, self.focus)
        } else {
            (self.focus, self.anchor)
        }
    }
}

// ── Canonical text placement ──────────────────────────────────────────────────
//
// Where a text node's glyphs land inside its layout box. The renderer and
// every hit-test query derive placement from THIS — not from their own copy
// of the rules — so what's drawn and what a click resolves to can't drift
// apart. (They did: the hit-test used to shape at a different wrap width,
// ignore bold/italic/lineHeight, and skip vertical centering, each of which
// made clicks land on a different character than the one under the pointer.)

/// Horizontal text alignment within a box. CSS default is `Left`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum TextAlign {
    #[default]
    Left,
    Center,
    Right,
}

impl TextAlign {
    /// Parse the `textAlign` prop value; anything unrecognised is `Left`.
    pub fn from_prop(s: Option<&str>) -> Self {
        match s {
            Some("center") => Self::Center,
            Some("right")  => Self::Right,
            _              => Self::Left,
        }
    }
}

/// Everything that affects how a string is SHAPED (glyph widths, wraps,
/// line spacing). Two layouts shaped with equal `TextStyle` and wrap width
/// are identical.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TextStyle {
    pub font_size:   f32,
    pub bold:        bool,
    pub italic:      bool,
    /// Absolute line height in px; `None` = the font's own metrics.
    pub line_height: Option<f32>,
}

impl TextStyle {
    pub fn new(font_size: f32) -> Self {
        Self { font_size, bold: false, italic: false, line_height: None }
    }
}

/// The layout box a text node is drawn into, plus the rules for placing a
/// shaped layout inside it.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TextBox {
    pub width:  f32,
    pub height: f32,
    pub align:  TextAlign,
    /// Single-line input text: shaped UNBOUNDED (never wraps) and panned
    /// left by `scroll_x`, with the container clipping the overflow.
    pub single_line: bool,
    /// Horizontal pan for single-line inputs (caret-follow).
    pub scroll_x: f32,
    /// A text node showing an editing caret. Multiline editors are TOP-
    /// aligned: centering would make the text drift down as content shrinks
    /// below the box height (e.g. while deleting).
    pub editor: bool,
}

impl TextBox {
    /// The max width the text is wrapped at.
    ///
    /// Single-line inputs are unbounded (1e6 — matches the JS side's
    /// `__glyx_measure_text(…, 1e6)` caret measurements). Otherwise the box
    /// width +1px: guards against Taffy rounding shaving a sub-pixel off the
    /// measured width and wrapping the last word.
    pub fn wrap_width(&self) -> f32 {
        if self.single_line { 1.0e6 } else { self.width.max(1.0) + 1.0 }
    }

    /// Offset `(dx, dy)` from the box's top-left to the shaped layout's
    /// origin, for a layout of the given size.
    ///
    /// The whole layout is shaped left-aligned and then translated as ONE
    /// block, so the horizontal shift uses the widest line.
    pub fn origin(&self, text_width: f32, text_height: f32) -> (f32, f32) {
        let slack_x = (self.width - text_width).max(0.0);
        let dx = match self.align {
            TextAlign::Left   => 0.0,
            TextAlign::Center => slack_x / 2.0,
            TextAlign::Right  => slack_x,
        } - self.scroll_x;
        let top_aligned = self.editor && !self.single_line;
        let dy = if top_aligned { 0.0 } else { (self.height - text_height).max(0.0) / 2.0 };
        (dx, dy)
    }
}

/// A caret's rectangle, relative to the TEXT BOX's top-left.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CaretRect {
    pub x:      f32,
    pub y:      f32,
    pub height: f32,
}

/// The single rule for "which character boundary is nearest to this point"
/// — shared by every hit-test entry point (`hit_test`, `char_at_x_styled`)
/// so no two components can resolve the same click differently.
///
/// Parley's `Cursor::from_point` is used rather than hand-mapping
/// `Cluster::from_point`'s side: it never places the caret AFTER a hard
/// line break (a click right of a line ending in '\n' lands at that line's
/// end, not the start of the next) and it inverts the side for RTL clusters.
fn position_at_point(layout: &parley::Layout<()>, text: &str, x: f32, y: f32) -> TextPosition {
    let mut byte = Cursor::from_point(layout, x, y).index().min(text.len());
    // Cursor indices are cluster boundaries (always char boundaries); the
    // floor is purely defensive so a malformed index can never panic a slice.
    while !text.is_char_boundary(byte) { byte -= 1; }
    TextPosition::new(text[..byte].chars().count())
}

pub struct TextSystem {
    font_cx:   FontContext,
    layout_cx: LayoutContext<()>,
    /// `ellipsize` results by (text hash, size, width, bold, italic): the
    /// renderer asks every frame, the answer only changes with the inputs.
    ellipsis_cache: std::collections::HashMap<(u64, u32, u32, bool, bool), Option<String>>,
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
                        // Load the core Segoe UI text variants (regular, bold,
                        // semibold, italic) plus the emoji/symbol fallbacks so
                        // emoji and pictographs don't render as tofu. Real
                        // italic faces are loaded rather than relying on
                        // fontique's on-the-fly oblique synthesis, which was
                        // observed to silently no-op (StyleProperty::FontStyle
                        // request had no visible effect) — a registered italic
                        // face is the reliable path. seguiemj/seguisym cost
                        // ~40 MB of RAM; set GLYX_NO_EMOJI_FONT=1 to skip them
                        // in memory-critical apps.
                        let no_emoji = std::env::var("GLYX_NO_EMOJI_FONT").ok().as_deref() == Some("1");
                        let wanted = matches!(name.as_str(),
                            "segoeui.ttf" | "segoeuib.ttf" | "seguisb.ttf" |
                            "segoeuii.ttf" | "segoeuiz.ttf"
                        ) || (!no_emoji && matches!(name.as_str(),
                            "seguiemj.ttf" | "seguisym.ttf"
                        ));
                        if wanted && register_font_file(&mut font_cx, &entry.path()) {
                            count += 1;
                        }
                    }
                }
                log::info!("glyx-text: registered {} Segoe UI / fallback fonts", count);
            } else {
                log::warn!("glyx-text: C:\\Windows\\Fonts not found — text may use fallback glyphs");
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
                        let name = entry.file_name()
                            .to_string_lossy()
                            .to_ascii_lowercase();
                        // Load only the fonts needed for our primary stack:
                        //   SF Pro / SF Display (macOS 13+), Helvetica Neue (fallback),
                        //   Arial (broad Unicode coverage), Menlo (monospace).
                        // Excluded: CJK collections (~200 MB), symbol fonts, Arabic,
                        //   Hebrew, and 300+ language-specific supplemental fonts.
                        let wanted =
                            name.starts_with("sfns")          ||  // SF Pro text + display
                            name.starts_with("helveticaneue") ||  // Helvetica Neue family
                            name.starts_with("arial")         ||  // Arial + bold
                            name.starts_with("menlo")         ||  // Menlo monospace
                            name.starts_with("sfmono");           // SF Mono (code)
                        if wanted && register_font_file(&mut font_cx, &entry.path()) {
                            count += 1;
                        }
                    }
                }
            }
            log::info!("glyx-text: registered {} fonts from macOS system dirs", count);
        }

        #[cfg(target_os = "linux")]
        {
            let dirs = ["/usr/share/fonts", "/usr/local/share/fonts"];
            let mut count = 0usize;
            for dir in &dirs {
                count += register_dir_filtered(&mut font_cx, std::path::Path::new(dir));
            }
            log::info!("glyx-text: registered {} fonts from Linux font dirs", count);
        }

        Self {
            font_cx,
            layout_cx: LayoutContext::new(),
            ellipsis_cache: std::collections::HashMap::new(),
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
            std::borrow::Cow::Borrowed("Segoe UI, Helvetica Neue, DejaVu Sans, Segoe UI Emoji, Segoe UI Symbol, sans-serif"),
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

    /// Shape with explicit bold + italic flags and optional max_width.
    /// `line_height`, when `Some`, overrides Parley's default
    /// metrics-relative line spacing with an absolute px value — needed so
    /// JS-side row-height math (e.g. TextInput's auto-height sizing) and the
    /// actual rendered line spacing can never diverge. `None` preserves the
    /// exact prior behavior (the font's own metrics).
    pub fn styled_label(
        &mut self,
        text:        &str,
        font_size:   f32,
        max_width:   f32,
        bold:        bool,
        italic:      bool,
        line_height: Option<f32>,
    ) -> TextLayout {
        use parley::style::{FontStyle, LineHeight};
        let weight = if bold { FontWeight::BOLD } else { FontWeight::NORMAL };
        let mut builder = self.layout_cx.ranged_builder(&mut self.font_cx, text, 1.0, false);
        builder.push_default(StyleProperty::FontSize(font_size));
        builder.push_default(StyleProperty::FontWeight(weight));
        if italic {
            builder.push_default(StyleProperty::FontStyle(FontStyle::Italic));
        }
        if let Some(lh) = line_height {
            builder.push_default(StyleProperty::LineHeight(LineHeight::Absolute(lh)));
        }
        builder.push_default(StyleProperty::FontFamily(FontFamily::Source(
            std::borrow::Cow::Borrowed("Segoe UI, Helvetica Neue, DejaVu Sans, Segoe UI Emoji, Segoe UI Symbol, sans-serif"),
        )));
        let mut layout = builder.build(text);
        layout.break_all_lines(Some(max_width));
        layout.align(Alignment::Start, AlignmentOptions::default());
        TextLayout { inner: layout }
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

    /// Shape `text` exactly as the renderer does for a node with this style
    /// in this box (same wrap width, weight, style, line height).
    pub fn shape_in_box(&mut self, text: &str, style: &TextStyle, bx: &TextBox) -> TextLayout {
        self.styled_label(text, style.font_size, bx.wrap_width(), style.bold, style.italic, style.line_height)
    }

    /// Character position nearest to point `(x, y)`, where the point is
    /// relative to the TEXT BOX's top-left (screen space, as drawn — the
    /// caller does no scroll/alignment/centering compensation of its own).
    ///
    /// Shapes with the renderer's exact inputs (`shape_in_box`) and applies
    /// the renderer's exact placement (`TextBox::origin`), so the result is
    /// the character actually drawn under the pointer. Handles soft wraps and
    /// explicit newlines — the proper hit-test for multiline editors.
    pub fn hit_test(&mut self, text: &str, style: &TextStyle, bx: &TextBox, x: f32, y: f32) -> TextPosition {
        if text.is_empty() { return TextPosition::new(0); }
        let layout = self.shape_in_box(text, style, bx);
        let (dx, dy) = bx.origin(layout.width(), layout.height());
        position_at_point(&layout.inner, text, x - dx, y - dy)
    }

    /// Where the caret for `pos` is drawn, relative to the TEXT BOX's
    /// top-left — the inverse of [`hit_test`](Self::hit_test), from the same
    /// shaped layout and the same placement. `y`/`height` span the caret's
    /// visual line (line box), so `y + height / 2` is safely inside it.
    pub fn caret_rect(&mut self, text: &str, style: &TextStyle, bx: &TextBox, pos: TextPosition) -> CaretRect {
        let layout = self.shape_in_box(text, style, bx);
        let (dx, dy) = bx.origin(layout.width(), layout.height());
        if text.is_empty() {
            let h = layout.height().max(style.line_height.unwrap_or(0.0)).max(style.font_size);
            return CaretRect { x: dx, y: dy, height: h };
        }
        let byte = text.char_indices().nth(pos.offset).map(|(b, _)| b).unwrap_or(text.len());
        let g = Cursor::from_byte_index(&layout.inner, byte, Affinity::Downstream)
            .geometry(&layout.inner, 0.0);
        CaretRect {
            x:      g.x0 as f32 + dx,
            y:      g.y0 as f32 + dy,
            height: (g.y1 - g.y0) as f32,
        }
    }

    /// Return the character index (0-based) whose left edge is closest to `target_x`
    /// pixels from the start of the text.  Used for pointer hit-testing in SelectableText.
    ///
    /// Shapes `text` exactly once, then hit-tests `target_x` directly against that
    /// single shaped `Layout` via Parley's `Cursor::from_point`.  Previously this
    /// binary-searched over `measure_to_cursor` calls on independently re-shaped
    /// growing substrings — since Parley's shaping isn't purely per-character
    /// additive (kerning, clustering), that approach could drift from the actual
    /// rendered glyph positions by an accumulating, off-by-one-ish amount as the
    /// substring grew. Hit-testing the one real layout can't diverge from itself.
    pub fn char_at_x(&mut self, text: &str, font_size: f32, max_width: f32, target_x: f32) -> usize {
        self.char_at_x_styled(text, font_size, max_width, target_x, false, false)
    }

    /// Bold/italic-aware variant of `char_at_x` — needed so hit-testing a
    /// styled span (rich-text bold/italic runs) shapes with the same
    /// weight/style as what was actually rendered for it.
    pub fn char_at_x_styled(&mut self, text: &str, font_size: f32, max_width: f32, target_x: f32, bold: bool, italic: bool) -> usize {
        if text.is_empty() { return 0; }
        let layout = self.styled_label(text, font_size, max_width, bold, italic, None);
        // Same boundary rule as `hit_test` — see `position_at_point`.
        position_at_point(&layout.inner, text, target_x, 0.0).offset
    }

    /// Return the X pixel offset (from the start of the text) of the cursor
    /// sitting at character index `char_idx`, for `text` shaped exactly once.
    ///
    /// This is the horizontal counterpart to `caret_line`'s vertical lookup:
    /// both query an already-shaped `Layout` directly (via Parley's `Cursor`
    /// API) instead of re-measuring an isolated substring, so the returned X
    /// always matches what was actually rendered for the *full* string.
    pub fn cursor_x_at(&mut self, text: &str, font_size: f32, max_width: f32, char_idx: usize) -> f32 {
        self.cursor_x_at_styled(text, font_size, max_width, char_idx, false, false)
    }

    /// Bold/italic-aware variant of `cursor_x_at` — see `char_at_x_styled`.
    pub fn cursor_x_at_styled(&mut self, text: &str, font_size: f32, max_width: f32, char_idx: usize, bold: bool, italic: bool) -> f32 {
        if text.is_empty() { return 0.0; }
        let layout = self.styled_label(text, font_size, max_width, bold, italic, None);
        let byte = text.char_indices().nth(char_idx).map(|(i, _)| i).unwrap_or(text.len());
        let cursor = Cursor::from_byte_index(&layout.inner, byte, Affinity::Downstream);
        cursor.geometry(&layout.inner, 0.0).x0 as f32
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

    /// Like [`measure`](Self::measure), but shapes with the given bold/italic
    /// flags so the reported size matches what render.rs will actually draw —
    /// bold glyphs are wider than `measure`'s NORMAL-weight assumption, so
    /// layout must account for it or siblings laid out beside this node overlap.
    pub fn measure_styled(&mut self, text: &str, font_size: f32, max_width: f32, bold: bool, italic: bool) -> (f32, f32) {
        let layout = self.styled_label(text, font_size, max_width.max(1.0), bold, italic, None);
        (layout.inner.width(), layout.inner.height())
    }

    /// `numberOfLines={1}`: the text's first line cut to fit `max_width`,
    /// ending in "…". `None` when it already fits (draw it unchanged).
    ///
    /// The cut is taken from ONE shaping of the whole line, at the last
    /// character boundary whose x leaves room for the ellipsis, so kerning
    /// and ligatures match what the untruncated text would draw.
    pub fn ellipsize(&mut self, text: &str, font_size: f32, bold: bool, italic: bool, max_width: f32) -> Option<String> {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        text.hash(&mut h);
        let key = (h.finish(), font_size.to_bits(), max_width.round() as u32, bold, italic);
        if let Some(hit) = self.ellipsis_cache.get(&key) { return hit.clone(); }
        let out = self.ellipsize_uncached(text, font_size, bold, italic, max_width.round());
        if self.ellipsis_cache.len() >= 1024 { self.ellipsis_cache.clear(); }
        self.ellipsis_cache.insert(key, out.clone());
        out
    }

    fn ellipsize_uncached(&mut self, text: &str, font_size: f32, bold: bool, italic: bool, max_width: f32) -> Option<String> {
        let line = text.split('\n').next().unwrap_or("");
        let multi = line.len() < text.len();
        if line.is_empty() && !multi { return None; }
        let layout = self.styled_label(line, font_size, 1.0e6, bold, italic, None);
        if !multi && layout.inner.width() <= max_width + 0.5 { return None; }
        let (dots, _) = self.measure_styled("\u{2026}", font_size, 1.0e6, bold, italic);
        let target = (max_width - dots).max(0.0);
        let mut cut = 0;
        for b in line.char_indices().map(|(i, _)| i).skip(1).chain(std::iter::once(line.len())) {
            let x = if b == line.len() {
                layout.inner.width()
            } else {
                Cursor::from_byte_index(&layout.inner, b, Affinity::Downstream).geometry(&layout.inner, 0.0).x0 as f32
            };
            if x > target { break; }
            cut = b;
        }
        Some(format!("{}\u{2026}", line[..cut].trim_end()))
    }
}

impl Default for TextSystem {
    fn default() -> Self { Self::new() }
}

// ── Screen-reader text exposure (feature `accesskit`) ─────────────────────────

/// Exposes a shaped layout's text to assistive technology as AccessKit
/// `TextRun` nodes, and converts text selections between glyx's
/// [`TextSelection`] (character offsets) and AccessKit's (run node +
/// character index) — built on Parley's own AccessKit support.
///
/// Keep ONE `TextAccess` per text field across tree updates: it remembers
/// which run node id belongs to which part of the layout, so run ids stay
/// stable while the text is edited (screen readers track nodes by id), and
/// so an AT-issued selection — which names run node ids — can be mapped back.
#[cfg(feature = "accesskit")]
#[derive(Default)]
pub struct TextAccess {
    inner: parley::LayoutAccessibility,
}

#[cfg(feature = "accesskit")]
impl TextAccess {
    /// Append `TextRun` children for `layout` to `parent`, pushing the run
    /// nodes into `update`. `origin` is the screen position of the layout's
    /// top-left (the box position plus `TextBox::origin`), in the same
    /// coordinate space as the rest of the tree's bounds. `next_id` must
    /// return ids that never collide with the tree's other node ids.
    pub fn build_runs(
        &mut self,
        text:    &str,
        layout:  &TextLayout,
        update:  &mut accesskit::TreeUpdate,
        parent:  &mut accesskit::Node,
        next_id: impl FnMut() -> accesskit::NodeId,
        origin:  (f64, f64),
    ) {
        self.inner.build_nodes(
            text, &layout.inner, update, parent, next_id, origin.0, origin.1,
            |_node, _style| {}, // no brush properties: color is render-only
        );
    }

    /// glyx selection → AccessKit selection, against the SAME layout the
    /// runs were last built from. `None` if an offset can't be mapped (e.g.
    /// `build_runs` hasn't run for this layout yet).
    pub fn to_access_selection(
        &self,
        text:   &str,
        layout: &TextLayout,
        sel:    TextSelection,
    ) -> Option<accesskit::TextSelection> {
        let cursor = |p: TextPosition| {
            parley::Cursor::from_byte_index(&layout.inner, char_to_byte(text, p.offset), Affinity::Downstream)
        };
        parley::Selection::new(cursor(sel.anchor), cursor(sel.focus))
            .to_access_selection(&layout.inner, &self.inner)
    }

    /// AccessKit selection (e.g. from an AT's `SetTextSelection` action) →
    /// glyx selection in character offsets. `None` if it names run nodes this
    /// field doesn't own.
    pub fn from_access_selection(
        &self,
        text:   &str,
        layout: &TextLayout,
        sel:    &accesskit::TextSelection,
    ) -> Option<TextSelection> {
        let s = parley::Selection::from_access_selection(sel, &layout.inner, &self.inner)?;
        let pos = |byte: usize| TextPosition::new(byte_to_char(text, byte));
        Some(TextSelection::new(pos(s.anchor().index()), pos(s.focus().index())))
    }
}

/// Character offset → byte offset, clamped to the text's end.
#[cfg(feature = "accesskit")]
fn char_to_byte(text: &str, offset: usize) -> usize {
    text.char_indices().nth(offset).map(|(b, _)| b).unwrap_or(text.len())
}

/// Byte offset → character offset (floored to a char boundary, clamped).
#[cfg(feature = "accesskit")]
fn byte_to_char(text: &str, byte: usize) -> usize {
    let mut b = byte.min(text.len());
    while !text.is_char_boundary(b) { b -= 1; }
    text[..b].chars().count()
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
    /// ```ignore
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

    /// For a caret at `byte_idx`, return `(line_top_y, line_start_byte)` of
    /// the wrapped line containing it.  Handles both explicit newlines and
    /// soft wraps, so multiline inputs can draw the caret on the correct
    /// visual line instead of always the first.
    pub fn caret_line(&self, byte_idx: usize) -> (f32, usize) {
        let mut last = (0.0_f32, 0usize);
        for line in self.inner.lines() {
            let m = line.metrics();
            let r = line.text_range();
            // block_min_coord = top edge of the line box (horizontal text).
            last = (m.block_min_coord.max(0.0), r.start);
            if byte_idx < r.end {
                return last;
            }
        }
        last
    }

    /// Per-visual-line byte ranges and extents:
    /// `(byte_start, byte_end, top, bottom, right_edge)` relative to the layout
    /// origin.  Includes soft-wrapped lines — used for multiline selection
    /// highlights.  `right_edge` is the x of the line's last *visible* glyph:
    /// measuring a cursor AT a soft-wrap boundary reports x on the NEXT line
    /// (0), so selections that reach a wrapped line's end must use this
    /// instead.  The value is glyph-tight — `inline_max_coord` is the line-box
    /// width (full wrap width including trailing whitespace), which would paint
    /// highlight over empty space past the final word.
    pub fn line_ranges(&self) -> Vec<(usize, usize, f32, f32, f32)> {
        self.inner
            .lines()
            .map(|l| {
                let r = l.text_range();
                let m = l.metrics();
                let right = m.inline_min_coord + (m.advance - m.trailing_whitespace).max(0.0);
                (r.start, r.end, m.block_min_coord.max(0.0), m.block_max_coord, right)
            })
            .collect()
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
        // Scan for the FIRST line that actually has a glyph run — text starting
        // with blank lines ('\n…') has an empty first line.  Falling back to the
        // full layout height here made the caret a full-height bar in multiline
        // fields whose content begins with a newline.
        self.inner
            .lines()
            .find_map(|line| {
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
            // No glyphs anywhere (empty text): approximate one line box.
            .unwrap_or_else(|| {
                let h = self.inner.height();
                (0.0, if h > 0.0 { h.min(24.0) } else { 18.0 })
            })
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Try to register a single font file.  Returns true if it was registered.
///
/// Fonts are MEMORY-MAPPED, not read into RAM: mapped pages are file-backed,
/// paged in on demand, and evictable under memory pressure — so even the
/// ~25 MB emoji font costs near-zero committed memory (only the glyph tables
/// actually shaped get touched).
fn register_font_file(font_cx: &mut FontContext, path: &std::path::Path) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if matches!(ext.as_str(), "ttf" | "otf" | "ttc") {
        if let Ok(file) = std::fs::File::open(path) {
            // SAFETY: system font files are not truncated while the OS has
            // them registered; a torn read would at worst fail font parsing.
            if let Ok(mmap) = unsafe { memmap2::Mmap::map(&file) } {
                let blob = parley::fontique::Blob::new(std::sync::Arc::new(mmap));
                font_cx.collection.register_fonts(blob, None);
                return true;
            }
        }
        // Fallback: plain read (e.g. mmap refused on a network drive).
        if let Ok(data) = std::fs::read(path) {
            font_cx.collection.register_fonts(parley::fontique::Blob::from(data), None);
            return true;
        }
    }
    false
}

/// Recursively register a curated subset of fonts under a directory.
/// Loads DejaVu, Liberation, and Noto Sans families — the standard Linux
/// UI stack. Excludes CJK, symbol, and language-specific supplemental
/// fonts (which can total 500 MB+ on a full desktop install).
#[cfg(target_os = "linux")]
fn register_dir_filtered(font_cx: &mut FontContext, dir: &std::path::Path) -> usize {
    let Ok(entries) = std::fs::read_dir(dir) else { return 0 };
    let mut count = 0usize;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            count += register_dir_filtered(font_cx, &path);
        } else {
            let name = path.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.to_ascii_lowercase())
                .unwrap_or_default();
            let wanted =
                name.starts_with("dejavusans")       ||  // DejaVu Sans (regular + bold + mono)
                name.starts_with("dejavumono")       ||  // DejaVu Sans Mono variants
                name.starts_with("liberationsans")   ||  // Liberation Sans (Arial metric-compat)
                name.starts_with("liberationmono")   ||  // Liberation Mono
                name.starts_with("notosans-regular") ||  // Noto Sans regular weight only
                name.starts_with("notosans-bold");        // Noto Sans bold weight only
            if wanted && register_font_file(font_cx, &path) {
                count += 1;
            }
        }
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ellipsize_cuts_to_fit_and_leaves_short_text_alone() {
        let mut ts = TextSystem::new();
        assert_eq!(ts.ellipsize("short", 14.0, false, false, 500.0), None);
        let long = "a_rather_long_file_name_that_will_not_fit.png";
        let out = ts.ellipsize(long, 14.0, false, false, 120.0).expect("cut");
        assert!(out.ends_with('\u{2026}'));
        let kept = out.trim_end_matches('\u{2026}');
        assert!(!kept.is_empty() && long.starts_with(kept));
        let (w, _) = ts.measure_styled(&out, 14.0, 1.0e6, false, false);
        assert!(w <= 121.0, "ellipsized width {w} exceeds the box");
        // Only the first line is kept, and it's marked as cut.
        assert_eq!(ts.ellipsize("one\ntwo", 14.0, false, false, 500.0).as_deref(), Some("one\u{2026}"));
        // Too narrow for any character: just the ellipsis.
        assert_eq!(ts.ellipsize(long, 14.0, false, false, 2.0).as_deref(), Some("\u{2026}"));
    }

    fn sys() -> TextSystem {
        TextSystem::new()
    }

    fn style(font_size: f32) -> TextStyle {
        TextStyle::new(font_size)
    }

    /// A plain (non-editor, wrapping) text box.
    fn tbox(width: f32, height: f32, align: TextAlign) -> TextBox {
        TextBox { width, height, align, single_line: false, scroll_x: 0.0, editor: false }
    }

    // ── TextBox placement rules ──────────────────────────────────────────────

    #[test]
    fn wrap_width_is_box_plus_one_or_unbounded_for_single_line() {
        let b = tbox(100.0, 20.0, TextAlign::Left);
        assert_eq!(b.wrap_width(), 101.0);
        let single = TextBox { single_line: true, ..b };
        assert_eq!(single.wrap_width(), 1.0e6);
    }

    #[test]
    fn origin_applies_alignment_scroll_and_vertical_centering() {
        let b = tbox(200.0, 50.0, TextAlign::Center);
        assert_eq!(b.origin(100.0, 20.0), (50.0, 15.0));
        let r = tbox(200.0, 50.0, TextAlign::Right);
        assert_eq!(r.origin(100.0, 20.0), (100.0, 15.0));
        // Wider-than-box text never shifts negative.
        assert_eq!(b.origin(300.0, 20.0), (0.0, 15.0));
        // Single-line input: panned by scroll_x.
        let s = TextBox { single_line: true, scroll_x: 30.0, ..tbox(200.0, 50.0, TextAlign::Left) };
        assert_eq!(s.origin(500.0, 20.0), (-30.0, 15.0));
    }

    #[test]
    fn multiline_editor_is_top_aligned_single_line_editor_is_centered() {
        let ml = TextBox { editor: true, ..tbox(200.0, 100.0, TextAlign::Left) };
        assert_eq!(ml.origin(50.0, 20.0).1, 0.0);
        let sl = TextBox { editor: true, single_line: true, ..tbox(200.0, 100.0, TextAlign::Left) };
        assert_eq!(sl.origin(50.0, 20.0).1, 40.0);
    }

    // ── hit_test ─────────────────────────────────────────────────────────────

    #[test]
    fn hit_test_empty_text_is_zero() {
        let mut s = sys();
        let p = s.hit_test("", &style(16.0), &tbox(200.0, 20.0, TextAlign::Left), 10.0, 0.0);
        assert_eq!(p.offset, 0);
    }

    #[test]
    fn hit_test_left_edges() {
        let mut s = sys();
        let b = tbox(200.0, 20.0, TextAlign::Left);
        assert_eq!(s.hit_test("hello", &style(16.0), &b, 0.0, 5.0).offset, 0);
        assert_eq!(s.hit_test("hello", &style(16.0), &b, 1e6, 5.0).offset, 5);
    }

    #[test]
    fn hit_test_center_and_right_match_left_at_the_drawn_position() {
        let mut s = sys();
        let text = "a centred line";
        let st = style(16.0);
        let left = tbox(300.0, 20.0, TextAlign::Left);
        let w = s.shape_in_box(text, &st, &left).width();
        for (align, shift) in [(TextAlign::Center, (300.0 - w) / 2.0), (TextAlign::Right, 300.0 - w)] {
            let b = tbox(300.0, 20.0, align);
            for x0 in [1.0, 16.0, 42.0] {
                assert_eq!(
                    s.hit_test(text, &st, &b, shift + x0, 5.0).offset,
                    s.hit_test(text, &st, &left, x0, 5.0).offset,
                    "align={align:?} x0={x0}"
                );
            }
        }
    }

    #[test]
    fn hit_test_compensates_vertical_centering() {
        // The same text in a taller box is drawn lower by (h - text_h)/2; a
        // click at the drawn glyphs must resolve to the same character as the
        // equivalent click in a snug box.
        let mut s = sys();
        let text = "aaa bbb ccc ddd eee fff";
        let st = style(16.0);
        let th = s.shape_in_box(text, &st, &tbox(60.0, 0.0, TextAlign::Left)).height();
        let snug = tbox(60.0, th, TextAlign::Left);
        let tall = tbox(60.0, th + 200.0, TextAlign::Left);
        for y0 in [2.0, th / 2.0, th - 2.0] {
            assert_eq!(
                s.hit_test(text, &st, &tall, 10.0, 100.0 + y0).offset,
                s.hit_test(text, &st, &snug, 10.0, y0).offset,
                "y0={y0}"
            );
        }
    }

    #[test]
    fn hit_test_single_line_accounts_for_scroll() {
        let mut s = sys();
        let text = "the quick brown fox jumps";
        let st = style(16.0);
        let unscrolled = TextBox { single_line: true, ..tbox(80.0, 20.0, TextAlign::Left) };
        let scrolled = TextBox { scroll_x: 40.0, ..unscrolled };
        // What's drawn at x once the text is panned left by 40 is what sat 40px
        // further along the unscrolled text.
        assert_eq!(
            s.hit_test(text, &st, &scrolled, 10.0, 5.0).offset,
            s.hit_test(text, &st, &unscrolled, 50.0, 5.0).offset,
        );
    }

    #[test]
    fn hit_test_right_of_a_hard_newline_stays_on_that_line() {
        // Regression: the previous hand-rolled Cluster-side mapping returned
        // the offset AFTER the '\n' for a click right of "line one", putting
        // the caret at the start of the NEXT line.
        let mut s = sys();
        let text = "line one\nline two";
        let b = TextBox { editor: true, ..tbox(400.0, 0.0, TextAlign::Left) };
        let p = s.hit_test(text, &style(16.0), &b, 390.0, 3.0);
        assert_eq!(p.offset, "line one".chars().count());
    }

    #[test]
    fn hit_test_respects_soft_wraps() {
        let mut s = sys();
        let st = style(16.0);
        let text = "aaa bbb ccc ddd eee";
        let b = TextBox { editor: true, ..tbox(40.0, 0.0, TextAlign::Left) };
        let lines = s.shape_in_box(text, &st, &b).line_ranges();
        assert!(lines.len() > 1, "text should wrap into >1 line");
        // A point on each visual line resolves inside that line's byte range.
        for (ls, le, top, bot, _) in &lines {
            let p = s.hit_test(text, &st, &b, 1.0, (top + bot) / 2.0);
            let byte = text.char_indices().nth(p.offset).map(|(i, _)| i).unwrap_or(text.len());
            assert!(byte >= *ls && byte <= *le, "offset {} outside line {ls}..{le}", p.offset);
        }
    }

    #[test]
    fn hit_test_line_height_moves_lines_like_the_renderer() {
        // With a large explicit lineHeight the second line sits much lower; a
        // point inside it (per the same shaped layout the renderer draws) must
        // land on it — the old hit-test shaped WITHOUT lineHeight.
        let mut s = sys();
        let text = "one\ntwo";
        let st = TextStyle { line_height: Some(60.0), ..style(16.0) };
        let b = TextBox { editor: true, ..tbox(400.0, 0.0, TextAlign::Left) };
        let lines = s.shape_in_box(text, &st, &b).line_ranges();
        let (_, _, top2, bot2, _) = lines[1];
        assert!(top2 >= 50.0, "lineHeight should push line 2 down, top={top2}");
        let p = s.hit_test(text, &st, &b, 1.0, (top2 + bot2) / 2.0);
        assert!(p.offset >= "one\n".chars().count(), "got {}", p.offset);
    }

    #[test]
    fn caret_rect_round_trips_through_hit_test() {
        let mut s = sys();
        let st = style(16.0);
        let text = "aaa bbb ccc ddd eee fff";
        for b in [
            TextBox { editor: true, ..tbox(60.0, 0.0, TextAlign::Left) },
            tbox(300.0, 120.0, TextAlign::Center),
            tbox(300.0, 120.0, TextAlign::Right),
        ] {
            for off in [0usize, 5, 9, 14, 20] {
                let c = s.caret_rect(text, &st, &b, TextPosition::new(off));
                let p = s.hit_test(text, &st, &b, c.x, c.y + c.height / 2.0);
                assert_eq!(p.offset, off, "box={b:?} caret={c:?}");
            }
        }
    }

    #[test]
    fn char_at_x_uses_the_same_boundary_rule_as_hit_test() {
        let mut s = sys();
        let text = "hello world";
        let b = TextBox { single_line: true, ..tbox(400.0, 20.0, TextAlign::Left) };
        for x in [0.0, 3.0, 17.0, 40.0, 1e6] {
            assert_eq!(
                s.char_at_x(text, 16.0, 1.0e6, x),
                s.hit_test(text, &style(16.0), &b, x, 5.0).offset,
                "x={x}"
            );
        }
    }

    // ── line_ranges / selection types ────────────────────────────────────────

    #[test]
    fn line_ranges_right_edge_is_glyph_tight_not_box_width() {
        let mut s = sys();
        // Short single line in a wide box: right edge must be the text width,
        // NOT the box width (inline_max_coord) — so selection highlights don't
        // paint over the empty space past the last word.
        let l = s.shape("hello", 16.0, 400.0, FontWeight::NORMAL, Alignment::Start);
        let (_, _, _, _, right) = l.line_ranges()[0];
        assert_eq!(right, l.width());

        // Explicit newline: "hi" on line 2 must end at its own advance, not 200.
        let n = s.shape("line one\nhi", 16.0, 200.0, FontWeight::NORMAL, Alignment::Start);
        let hi_w = s.label("hi", 16.0).width();
        let line2 = &n.line_ranges()[1];
        assert!((line2.4 - hi_w).abs() < 0.01, "right={} hi_w={hi_w}", line2.4);
    }

    #[test]
    fn selection_types_normalize_in_offset_order() {
        let s = TextSelection::new(TextPosition::new(5), TextPosition::new(2));
        let (a, b) = s.normalized();
        assert_eq!(a.offset, 2);
        assert_eq!(b.offset, 5);
        assert!(!s.is_collapsed());
        assert!(TextSelection::collapsed().is_collapsed());
    }

    // ── TextAccess (screen-reader text runs + selection) ─────────────────────

    #[cfg(feature = "accesskit")]
    fn build(access: &mut TextAccess, text: &str, layout: &TextLayout) -> (accesskit::TreeUpdate, accesskit::Node) {
        let mut update = accesskit::TreeUpdate {
            nodes: vec![],
            tree: None,
            tree_id: accesskit::TreeId::ROOT,
            focus: accesskit::NodeId(1),
        };
        let mut parent = accesskit::Node::new(accesskit::Role::TextInput);
        let mut next = 1000u64;
        access.build_runs(text, layout, &mut update, &mut parent, || { next += 1; accesskit::NodeId(next) }, (10.0, 20.0));
        (update, parent)
    }

    #[cfg(feature = "accesskit")]
    #[test]
    fn text_access_builds_runs_covering_the_whole_text() {
        let mut s = sys();
        let text = "hello world\nsecond line";
        let b = TextBox { editor: true, ..tbox(400.0, 0.0, TextAlign::Left) };
        let layout = s.shape_in_box(text, &style(16.0), &b);
        let mut access = TextAccess::default();
        let (update, parent) = build(&mut access, text, &layout);
        assert!(!update.nodes.is_empty());
        assert_eq!(parent.children().len(), update.nodes.len());
        // Every run is a TextRun, and their values concatenate to the text.
        let joined: String = update.nodes.iter()
            .inspect(|(_, n)| assert_eq!(n.role(), accesskit::Role::TextRun))
            .map(|(_, n)| n.value().unwrap_or_default().to_string())
            .collect();
        assert_eq!(joined, text);
    }

    #[cfg(feature = "accesskit")]
    #[test]
    fn text_access_selection_round_trips_in_both_directions() {
        let mut s = sys();
        let text = "the quick brown fox\njumps over";
        let b = TextBox { editor: true, ..tbox(90.0, 0.0, TextAlign::Left) }; // wraps
        let layout = s.shape_in_box(text, &style(16.0), &b);
        let mut access = TextAccess::default();
        build(&mut access, text, &layout);
        for (a, f) in [(0, 0), (4, 9), (15, 3), (20, 25), (text.chars().count(), 0)] {
            let sel = TextSelection::new(TextPosition::new(a), TextPosition::new(f));
            let ak = access.to_access_selection(text, &layout, sel).expect("maps to access");
            let back = access.from_access_selection(text, &layout, &ak).expect("maps back");
            assert_eq!(back, sel, "anchor={a} focus={f}");
        }
    }

    #[cfg(feature = "accesskit")]
    #[test]
    fn text_access_run_ids_stay_stable_across_edits() {
        // Screen readers track nodes by id: re-building runs for edited text
        // must reuse the ids of runs that still exist.
        let mut s = sys();
        let b = TextBox { editor: true, ..tbox(400.0, 0.0, TextAlign::Left) };
        let mut access = TextAccess::default();
        let l1 = s.shape_in_box("hello", &style(16.0), &b);
        let (u1, _) = build(&mut access, "hello", &l1);
        let l2 = s.shape_in_box("hello!", &style(16.0), &b);
        let (u2, _) = build(&mut access, "hello!", &l2);
        assert_eq!(u1.nodes[0].0, u2.nodes[0].0);
    }

    #[cfg(feature = "accesskit")]
    #[test]
    fn text_access_handles_empty_text() {
        // An empty field still needs a caret position for the AT.
        let mut s = sys();
        let b = TextBox { editor: true, ..tbox(200.0, 0.0, TextAlign::Left) };
        let layout = s.shape_in_box("", &style(16.0), &b);
        let mut access = TextAccess::default();
        build(&mut access, "", &layout);
        let sel = TextSelection::collapsed();
        let ak = access.to_access_selection("", &layout, sel).expect("caret maps");
        assert_eq!(access.from_access_selection("", &layout, &ak), Some(sel));
    }

    #[test]
    fn text_align_parses_prop_values() {
        assert_eq!(TextAlign::from_prop(Some("center")), TextAlign::Center);
        assert_eq!(TextAlign::from_prop(Some("right")), TextAlign::Right);
        assert_eq!(TextAlign::from_prop(Some("left")), TextAlign::Left);
        assert_eq!(TextAlign::from_prop(None), TextAlign::Left);
    }
}
