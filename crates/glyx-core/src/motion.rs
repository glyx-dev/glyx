//! `@glyx-dev/motion`: Rust-owned property transitions.
//!
//! JS declares a `transition` once (duration, easing, which properties); when
//! a later `UpdateNode` changes one of those properties, the change is
//! interpolated here, sampled fresh every frame by the render loop, with zero
//! JS re-entry. Only render-only properties animate — none of them touch
//! Taffy, so an animation never triggers a layout pass.
//!
//! Transforms interpolate their parsed parts (translate / rotate / scale), not
//! the composed matrix: blending two rotation matrices component-wise shrinks
//! and skews the element mid-way.

use crate::rgba_to_vello;
use glyx_renderer::peniko::{self, kurbo::Affine};
use std::time::Instant;

// ── Properties ────────────────────────────────────────────────────────────────

pub(crate) const P_OPACITY:      u8 = 1 << 0;
pub(crate) const P_TRANSFORM:    u8 = 1 << 1;
pub(crate) const P_BACKGROUND:   u8 = 1 << 2;
pub(crate) const P_BORDER_COLOR: u8 = 1 << 3;
pub(crate) const P_RADIUS:       u8 = 1 << 4;
pub(crate) const P_SHADOW:       u8 = 1 << 5;
pub(crate) const P_ALL:          u8 = 0b11_1111;

/// `transitionProperty` (`"opacity,transform"`, `"all"`) → property mask.
/// `None` → opacity only: the original `@glyx-dev/motion` v1 behaviour, kept so
/// existing `transition={{ duration }}` users don't start animating colours.
pub(crate) fn property_mask(list: Option<&str>) -> u8 {
    let Some(list) = list else { return P_OPACITY };
    list.split(',').fold(0, |m, p| m | match p.trim() {
        "all"             => P_ALL,
        "opacity"         => P_OPACITY,
        "transform"       => P_TRANSFORM,
        "backgroundColor" => P_BACKGROUND,
        "borderColor"     => P_BORDER_COLOR,
        "borderRadius"    => P_RADIUS,
        "boxShadow"       => P_SHADOW,
        _                 => 0,
    })
}

// ── Easing ────────────────────────────────────────────────────────────────────

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum Easing {
    Linear,
    /// `1 - (1 - t)^3` — the v1 default, kept exactly.
    EaseOutCubic,
    /// CSS `cubic-bezier(x1, y1, x2, y2)`.
    Bezier(f32, f32, f32, f32),
}

impl Easing {
    /// CSS keyword or `cubic-bezier(...)`; unknown/absent → ease-out cubic.
    pub(crate) fn parse(s: Option<&str>) -> Self {
        let Some(s) = s.map(str::trim) else { return Easing::EaseOutCubic };
        match s {
            "linear"      => Easing::Linear,
            "ease"        => Easing::Bezier(0.25, 0.1, 0.25, 1.0),
            "ease-in"     => Easing::Bezier(0.42, 0.0, 1.0, 1.0),
            "ease-out"    => Easing::EaseOutCubic,
            "ease-in-out" => Easing::Bezier(0.42, 0.0, 0.58, 1.0),
            _ => s.strip_prefix("cubic-bezier(")
                .and_then(|r| r.strip_suffix(')'))
                .and_then(|args| {
                    let v: Vec<f32> = args.split(',').filter_map(|a| a.trim().parse().ok()).collect();
                    // x1/x2 outside [0,1] make the curve non-monotonic in x (CSS rejects them too).
                    (v.len() == 4 && (0.0..=1.0).contains(&v[0]) && (0.0..=1.0).contains(&v[2]))
                        .then(|| Easing::Bezier(v[0], v[1], v[2], v[3]))
                })
                .unwrap_or(Easing::EaseOutCubic),
        }
    }

    pub(crate) fn apply(self, t: f32) -> f32 {
        let t = t.clamp(0.0, 1.0);
        match self {
            Easing::Linear       => t,
            Easing::EaseOutCubic => 1.0 - (1.0 - t).powi(3),
            Easing::Bezier(x1, y1, x2, y2) => {
                if t == 0.0 || t == 1.0 { return t; }
                // Solve x(s) = t for the curve parameter s (Newton, then bisection
                // fallback), then return y(s).
                let bez = |a: f32, b: f32, s: f32| {
                    let u = 1.0 - s;
                    3.0 * u * u * s * a + 3.0 * u * s * s * b + s * s * s
                };
                let dbez = |a: f32, b: f32, s: f32| {
                    let u = 1.0 - s;
                    3.0 * u * u * a + 6.0 * u * s * (b - a) + 3.0 * s * s * (1.0 - b)
                };
                let mut s = t;
                for _ in 0..8 {
                    let err = bez(x1, x2, s) - t;
                    if err.abs() < 1e-5 { return bez(y1, y2, s); }
                    let d = dbez(x1, x2, s);
                    if d.abs() < 1e-6 { break; }
                    s = (s - err / d).clamp(0.0, 1.0);
                }
                let (mut lo, mut hi) = (0.0f32, 1.0f32);
                s = t;
                for _ in 0..30 {
                    let x = bez(x1, x2, s);
                    if (x - t).abs() < 1e-5 { break; }
                    if x < t { lo = s } else { hi = s }
                    s = (lo + hi) / 2.0;
                }
                bez(y1, y2, s)
            }
        }
    }
}

// ── Transform parts ───────────────────────────────────────────────────────────

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum TfOp {
    Translate(f64, f64),
    Rotate(f64),
    Scale(f64, f64),
}

impl TfOp {
    fn identity_like(self) -> TfOp {
        match self {
            TfOp::Translate(..) => TfOp::Translate(0.0, 0.0),
            TfOp::Rotate(_)     => TfOp::Rotate(0.0),
            TfOp::Scale(..)     => TfOp::Scale(1.0, 1.0),
        }
    }
    fn same_kind(self, o: TfOp) -> bool {
        std::mem::discriminant(&self) == std::mem::discriminant(&o)
    }
    fn lerp(self, o: TfOp, t: f64) -> TfOp {
        let l = |a: f64, b: f64| a + (b - a) * t;
        match (self, o) {
            (TfOp::Translate(ax, ay), TfOp::Translate(bx, by)) => TfOp::Translate(l(ax, bx), l(ay, by)),
            (TfOp::Rotate(a), TfOp::Rotate(b))                 => TfOp::Rotate(l(a, b)),
            (TfOp::Scale(ax, ay), TfOp::Scale(bx, by))         => TfOp::Scale(l(ax, bx), l(ay, by)),
            _ => o,
        }
    }
    fn affine(self) -> Affine {
        match self {
            TfOp::Translate(x, y) => Affine::translate((x, y)),
            TfOp::Rotate(deg)     => Affine::rotate(deg.to_radians()),
            TfOp::Scale(sx, sy)   => Affine::scale_non_uniform(sx, sy),
        }
    }
}

/// One numeric transform argument. Accepts the CSS units people actually
/// write (`10px`, `45deg`, `0.5turn`, `1.2rad`, `100grad`); angles come back
/// in degrees. A unit that doesn't fit the function (`rotate(10px)`) fails.
fn parse_arg(s: &str, angle: bool) -> Option<f64> {
    let s = s.trim();
    let split = s.find(|c: char| c.is_ascii_alphabetic() || c == '%').unwrap_or(s.len());
    let (num, unit) = s.split_at(split);
    let v: f64 = num.trim().parse().ok()?;
    match (angle, unit) {
        (true,  "" | "deg") => Some(v),
        (true,  "rad")      => Some(v.to_degrees()),
        (true,  "turn")     => Some(v * 360.0),
        (true,  "grad")     => Some(v * 0.9),
        (false, "" | "px")  => Some(v),
        _ => None,
    }
}

/// Parse a transform string into its parts: `translate(x[, y])`,
/// `rotate(angle)`, `scale(s)` / `scale(sx, sy)`, chained with spaces.
/// Shared with `render_props::parse_transform`, so drawing and animating
/// accept exactly the same strings. `None` → unparseable.
pub(crate) fn parse_ops(s: &str) -> Option<Vec<TfOp>> {
    let mut ops = Vec::new();
    let mut rest = s.trim();
    while !rest.is_empty() {
        let open  = rest.find('(')?;
        let close = rest[open..].find(')')?;
        let func  = rest[..open].trim().to_lowercase();
        let raw: Vec<&str> = rest[open + 1..open + close].split(',').collect();
        let arg = |i: usize, angle: bool| raw.get(i).and_then(|a| parse_arg(a, angle));
        ops.push(match func.as_str() {
            "translate" => TfOp::Translate(arg(0, false)?, if raw.len() > 1 { arg(1, false)? } else { 0.0 }),
            "rotate"    => TfOp::Rotate(arg(0, true)?),
            "scale"     => { let sx = arg(0, false)?; TfOp::Scale(sx, if raw.len() > 1 { arg(1, false)? } else { sx }) }
            _ => return None,
        });
        rest = rest[open + close + 1..].trim();
    }
    Some(ops)
}

/// Composes like `parse_transform` (and CSS): the rightmost op applies first.
pub(crate) fn ops_affine(ops: &[TfOp]) -> Affine {
    ops.iter().fold(Affine::IDENTITY, |acc, op| acc * op.affine())
}

/// Pair up two op lists for interpolation. A missing transform is the
/// identity of the other side's shape (`none → rotate(90)` spins from 0).
/// `None` when the lists have different shapes: those snap, like a CSS
/// transition between mismatched function lists without matrix decomposition.
fn pair_ops(from: &[TfOp], to: &[TfOp]) -> Option<(Vec<TfOp>, Vec<TfOp>)> {
    if from.is_empty() { return Some((to.iter().map(|o| o.identity_like()).collect(), to.to_vec())); }
    if to.is_empty()   { return Some((from.to_vec(), from.iter().map(|o| o.identity_like()).collect())); }
    (from.len() == to.len() && from.iter().zip(to).all(|(a, b)| a.same_kind(*b)))
        .then(|| (from.to_vec(), to.to_vec()))
}

// ── Visual state ──────────────────────────────────────────────────────────────

/// Shadow as animatable numbers: offset + RGBA.
pub(crate) type Shadow = (f64, f64, [u8; 4]);

/// Raw-colour variant of `render_props::parse_box_shadow`.
pub(crate) fn parse_shadow(s: &str) -> Option<Shadow> {
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.len() < 4 { return None; }
    let h = parts[3].strip_prefix('#')?;
    let byte = |i: usize| u8::from_str_radix(h.get(i..i + 2)?, 16).ok();
    let nib  = |i: usize| u8::from_str_radix(h.get(i..i + 1)?, 16).ok().map(|v| v * 17);
    let rgba = match h.len() {
        3 => [nib(0)?, nib(1)?, nib(2)?, 255],
        6 => [byte(0)?, byte(2)?, byte(4)?, 255],
        8 => [byte(0)?, byte(2)?, byte(4)?, byte(6)?],
        _ => return None,
    };
    Some((parts[0].parse().ok()?, parts[1].parse().ok()?, rgba))
}

/// Every animatable value of one node, as it currently appears on screen.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct Visual {
    pub opacity:      f32,
    pub transform:    Vec<TfOp>,
    pub background:   Option<[u8; 4]>,
    pub border_color: Option<[u8; 4]>,
    pub radius:       f32,
    pub shadow:       Option<Shadow>,
}

impl Visual {
    pub(crate) fn of(props: &glyx_runtime::bindings::NodeProps) -> Self {
        Visual {
            opacity:      props.opacity.unwrap_or(1.0),
            transform:    props.transform.as_deref().and_then(parse_ops).unwrap_or_default(),
            background:   props.background_color,
            border_color: props.border_color,
            radius:       props.border_radius.unwrap_or(0.0),
            shadow:       props.box_shadow.as_deref().and_then(parse_shadow),
        }
    }
}

fn lerp_f32(a: f32, b: f32, t: f32) -> f32 { a + (b - a) * t }

fn lerp_rgba(a: [u8; 4], b: [u8; 4], t: f32) -> [u8; 4] {
    std::array::from_fn(|i| lerp_f32(a[i] as f32, b[i] as f32, t).round().clamp(0.0, 255.0) as u8)
}

/// A colour that's absent on one side fades from/to a transparent copy of
/// the other (fading from transparent BLACK would darken mid-way).
fn pair_colors(a: Option<[u8; 4]>, b: Option<[u8; 4]>) -> Option<([u8; 4], [u8; 4])> {
    match (a, b) {
        (Some(a), Some(b)) => Some((a, b)),
        (None, Some(b))    => Some(([b[0], b[1], b[2], 0], b)),
        (Some(a), None)    => Some((a, [a[0], a[1], a[2], 0])),
        (None, None)       => None,
    }
}

fn pair_shadows(a: Option<Shadow>, b: Option<Shadow>) -> Option<(Shadow, Shadow)> {
    match (a, b) {
        (Some(a), Some(b)) => Some((a, b)),
        (None, Some(b))    => Some(((b.0, b.1, [b.2[0], b.2[1], b.2[2], 0]), b)),
        (Some(a), None)    => Some((a, (a.0, a.1, [a.2[0], a.2[1], a.2[2], 0]))),
        (None, None)       => None,
    }
}

// ── Transition ────────────────────────────────────────────────────────────────

/// Per-frame values the renderer uses instead of the node's own props.
/// `None` fields aren't animating.
#[derive(Clone, Debug, Default)]
pub(crate) struct Overrides {
    pub opacity:      Option<f32>,
    pub transform:    Option<Affine>,
    pub background:   Option<[u8; 4]>,
    pub border_color: Option<[u8; 4]>,
    pub radius:       Option<f32>,
    pub shadow:       Option<(f64, f64, peniko::Color)>,
}

impl Overrides {
    /// Layer `top` over `self`: every property `top` animates wins (a
    /// keyframe animation over a transition on the same property, as in CSS).
    pub(crate) fn overlay(&mut self, top: Overrides) {
        if top.opacity.is_some()      { self.opacity = top.opacity; }
        if top.transform.is_some()    { self.transform = top.transform; }
        if top.background.is_some()   { self.background = top.background; }
        if top.border_color.is_some() { self.border_color = top.border_color; }
        if top.radius.is_some()       { self.radius = top.radius; }
        if top.shadow.is_some()       { self.shadow = top.shadow; }
    }
}

/// The clock transitions and keyframe animations run on. At rate 1 (always,
/// unless devtools changes it) it's the real clock. Devtools can slow it down
/// (`0.25`), pause it (`0`) or move it (`seek_by`) to study an animation;
/// changing the rate rebases the clock, so nothing jumps.
#[derive(Debug, Clone, Copy)]
pub(crate) struct MotionClock {
    rate: f64,
    real_base: Instant,
    virt_base: Instant,
}

impl Default for MotionClock {
    fn default() -> Self { let n = Instant::now(); Self { rate: 1.0, real_base: n, virt_base: n } }
}

impl MotionClock {
    pub(crate) fn now(&self) -> Instant { self.at(Instant::now()) }

    fn at(&self, real: Instant) -> Instant {
        self.virt_base + real.saturating_duration_since(self.real_base).mul_f64(self.rate)
    }

    pub(crate) fn rate(&self) -> f64 { self.rate }

    /// Paused: animations hold still, and don't need frames.
    pub(crate) fn paused(&self) -> bool { self.rate == 0.0 }

    pub(crate) fn set_rate(&mut self, rate: f64) { self.rebase(Instant::now(), rate); }

    fn rebase(&mut self, real: Instant, rate: f64) {
        self.virt_base = self.at(real);
        self.real_base = real;
        self.rate = rate.clamp(0.0, 4.0);
    }

    /// Move the clock by `ms` (negative = back).
    pub(crate) fn seek_by(&mut self, ms: f64) {
        let real = Instant::now();
        let rate = self.rate;
        self.rebase(real, rate);
        let d = std::time::Duration::from_secs_f64(ms.abs() / 1000.0);
        self.virt_base = if ms >= 0.0 { self.virt_base + d } else { self.virt_base.checked_sub(d).unwrap_or(self.virt_base) };
    }
}

/// One node's in-flight transition: a shared clock plus a track per property.
#[derive(Clone, Debug)]
pub(crate) struct Transition {
    pub start:       Instant,
    pub duration_ms: u32,
    pub easing:      Easing,
    opacity:      Option<(f32, f32)>,
    transform:    Option<(Vec<TfOp>, Vec<TfOp>)>,
    background:   Option<([u8; 4], [u8; 4])>,
    border_color: Option<([u8; 4], [u8; 4])>,
    radius:       Option<(f32, f32)>,
    shadow:       Option<(Shadow, Shadow)>,
}

impl Transition {
    /// Tracks for every property in `mask` that differs between `from` (what's
    /// on screen now, mid-flight values included) and `to`. `None` when
    /// nothing animatable changed.
    pub(crate) fn between(from: &Visual, to: &Visual, mask: u8, duration_ms: u32, easing: Easing, start: Instant) -> Option<Self> {
        let on = |p: u8| mask & p != 0;
        let tr = Transition {
            start, duration_ms, easing,
            opacity: (on(P_OPACITY) && (from.opacity - to.opacity).abs() > f32::EPSILON)
                .then_some((from.opacity, to.opacity)),
            transform: (on(P_TRANSFORM) && from.transform != to.transform)
                .then(|| pair_ops(&from.transform, &to.transform)).flatten(),
            background: (on(P_BACKGROUND) && from.background != to.background)
                .then(|| pair_colors(from.background, to.background)).flatten(),
            border_color: (on(P_BORDER_COLOR) && from.border_color != to.border_color)
                .then(|| pair_colors(from.border_color, to.border_color)).flatten(),
            radius: (on(P_RADIUS) && (from.radius - to.radius).abs() > f32::EPSILON)
                .then_some((from.radius, to.radius)),
            shadow: (on(P_SHADOW) && from.shadow != to.shadow)
                .then(|| pair_shadows(from.shadow, to.shadow)).flatten(),
        };
        let any = tr.opacity.is_some() || tr.transform.is_some() || tr.background.is_some()
            || tr.border_color.is_some() || tr.radius.is_some() || tr.shadow.is_some();
        any.then_some(tr)
    }

    fn progress(&self, now: Instant) -> (f32, bool) {
        let ms = now.saturating_duration_since(self.start).as_secs_f32() * 1000.0;
        let t = (ms / self.duration_ms.max(1) as f32).clamp(0.0, 1.0);
        (self.easing.apply(t), t >= 1.0)
    }

    /// The properties this transition animates (camelCase, as in JSX).
    pub(crate) fn properties(&self) -> Vec<&'static str> {
        let mut out = Vec::new();
        if self.opacity.is_some() { out.push("opacity"); }
        if self.transform.is_some() { out.push("transform"); }
        if self.background.is_some() { out.push("backgroundColor"); }
        if self.border_color.is_some() { out.push("borderColor"); }
        if self.radius.is_some() { out.push("borderRadius"); }
        if self.shadow.is_some() { out.push("boxShadow"); }
        out
    }

    /// Current values plus whether the transition has finished.
    pub(crate) fn sample(&self, now: Instant) -> (Overrides, bool) {
        let (e, done) = self.progress(now);
        let ov = Overrides {
            opacity:      self.opacity.map(|(a, b)| lerp_f32(a, b, e)),
            transform:    self.transform.as_ref().map(|(a, b)| {
                let ops: Vec<TfOp> = a.iter().zip(b).map(|(x, y)| x.lerp(*y, e as f64)).collect();
                ops_affine(&ops)
            }),
            background:   self.background.map(|(a, b)| lerp_rgba(a, b, e)),
            border_color: self.border_color.map(|(a, b)| lerp_rgba(a, b, e)),
            radius:       self.radius.map(|(a, b)| lerp_f32(a, b, e)),
            shadow:       self.shadow.map(|(a, b)| {
                let t = e as f64;
                (a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t, rgba_to_vello(lerp_rgba(a.2, b.2, e)))
            }),
        };
        (ov, done)
    }

    /// The node's on-screen values right now: its props with every animating
    /// property replaced by its mid-flight value. Used as the `from` side when
    /// a new change retargets a running transition, so nothing jumps.
    pub(crate) fn current(&self, base: &Visual, now: Instant) -> Visual {
        let (e, _) = self.progress(now);
        let mut v = base.clone();
        if let Some((a, b)) = self.opacity      { v.opacity = lerp_f32(a, b, e); }
        if let Some((a, b)) = &self.transform   { v.transform = a.iter().zip(b).map(|(x, y)| x.lerp(*y, e as f64)).collect(); }
        if let Some((a, b)) = self.background   { v.background = Some(lerp_rgba(a, b, e)); }
        if let Some((a, b)) = self.border_color { v.border_color = Some(lerp_rgba(a, b, e)); }
        if let Some((a, b)) = self.radius       { v.radius = lerp_f32(a, b, e); }
        if let Some((a, b)) = self.shadow {
            let t = e as f64;
            v.shadow = Some((a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t, lerp_rgba(a.2, b.2, e)));
        }
        v
    }
}


// ── Keyframe animation ────────────────────────────────────────────────────────

/// One keyframe: an offset in 0..=1 plus whichever properties it sets.
#[derive(Clone, Debug, Default, PartialEq)]
pub(crate) struct Stop {
    pub offset:       f32,
    pub opacity:      Option<f32>,
    pub transform:    Option<Vec<TfOp>>,
    pub background:   Option<[u8; 4]>,
    pub border_color: Option<[u8; 4]>,
    pub radius:       Option<f32>,
    pub shadow:       Option<Shadow>,
}

/// `[[offset, {prop: value, ...}], ...]` (built by `@glyx-dev/react` from the
/// `animation` prop) → stops sorted by offset. Unknown props and unparseable
/// values are ignored, like an invalid style value. `None` if the JSON itself
/// is malformed or there are no stops.
pub(crate) fn parse_keyframes(json: &str) -> Option<Vec<Stop>> {
    let raw: Vec<(f32, serde_json::Map<String, serde_json::Value>)> = serde_json::from_str(json).ok()?;
    let num = |v: &serde_json::Value| v.as_f64().map(|n| n as f32);
    let text = |v: &serde_json::Value| v.as_str().map(str::to_owned);
    let mut stops: Vec<Stop> = raw.into_iter().map(|(offset, props)| Stop {
        offset:       offset.clamp(0.0, 1.0),
        opacity:      props.get("opacity").and_then(num),
        transform:    props.get("transform").and_then(text).and_then(|t| parse_ops(&t)),
        background:   props.get("backgroundColor").and_then(text)
                          .and_then(|c| glyx_runtime::bindings::parse_hex_color(&c)),
        border_color: props.get("borderColor").and_then(text)
                          .and_then(|c| glyx_runtime::bindings::parse_hex_color(&c)),
        radius:       props.get("borderRadius").and_then(num),
        shadow:       props.get("boxShadow").and_then(text).and_then(|t| parse_shadow(&t)),
    }).collect();
    if stops.is_empty() { return None; }
    stops.sort_by(|a, b| a.offset.total_cmp(&b.offset));
    Some(stops)
}

/// Everything declared by a node's `animation*` props.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct AnimSpec {
    pub stops:         Vec<Stop>,
    pub duration_ms:   u32,
    pub easing:        Easing,
    /// `f32::INFINITY` = forever.
    pub iterations:    f32,
    pub alternate:     bool,
    pub fill_forwards: bool,
}

impl AnimSpec {
    pub(crate) fn from_props(p: &glyx_runtime::bindings::NodeProps) -> Option<Self> {
        let stops = parse_keyframes(p.animation_keyframes.as_deref()?)?;
        let iterations = match p.animation_iterations {
            Some(n) if n < 0.0 || n.is_infinite() => f32::INFINITY,
            Some(n) => n.max(0.0),
            None    => 1.0,
        };
        Some(AnimSpec {
            stops,
            duration_ms:   p.animation_ms.unwrap_or(0).max(1),
            // CSS's `animation-timing-function` default is `ease`.
            easing:        p.animation_easing.as_deref().map_or(Easing::Bezier(0.25, 0.1, 0.25, 1.0), |e| Easing::parse(Some(e))),
            iterations,
            alternate:     p.animation_direction.as_deref() == Some("alternate"),
            fill_forwards: p.animation_fill.as_deref() == Some("forwards"),
        })
    }
}

/// A running keyframe animation.
#[derive(Clone, Debug)]
pub(crate) struct Animation {
    pub spec:  AnimSpec,
    pub start: Instant,
    /// Finished and has drawn its final frame; no longer drives redraws.
    /// Kept (not removed) so an identical re-render doesn't replay it: with
    /// `fill: 'forwards'` it keeps overriding with the last keyframe,
    /// otherwise it's inert and the node shows its own style.
    pub settled: bool,
}

/// What one frame tick means for an animation.
#[derive(Debug, PartialEq)]
pub(crate) struct Tick {
    /// Its node must re-render this frame.
    pub dirty:   bool,
    /// It still needs future frames.
    pub running: bool,
}

/// Whether props declaring `spec` must (re)start the animation: only when
/// there's none yet or the spec changed. React re-sends identical props on
/// every re-render (a live dashboard: every second), and those must not
/// replay a finished entrance animation.
pub(crate) fn needs_restart(existing: Option<&Animation>, spec: &AnimSpec) -> bool {
    existing.map_or(true, |a| a.spec != *spec)
}

/// Interpolate one property across keyframe segments. `pick` reads the
/// property from a stop; stops that don't set it are skipped, and the node's
/// own value (`base`) stands in at 0% / 100% when no stop sets it there.
/// Returns `None` when no stop animates this property.
fn sample_track<T: Clone>(
    stops:  &[Stop],
    p:      f32,
    easing: Easing,
    base:   &T,
    pick:   impl Fn(&Stop) -> Option<T>,
    lerp:   impl Fn(&T, &T, f32) -> T,
) -> Option<T> {
    let mut pts: Vec<(f32, T)> = stops.iter().filter_map(|s| pick(s).map(|v| (s.offset, v))).collect();
    if pts.is_empty() { return None; }
    if pts[0].0 > 0.0 { pts.insert(0, (0.0, base.clone())); }
    if pts[pts.len() - 1].0 < 1.0 { pts.push((1.0, base.clone())); }
    let i = pts.iter().rposition(|(o, _)| *o <= p).unwrap_or(0);
    let Some((o1, v1)) = pts.get(i + 1) else { return Some(pts[i].1.clone()) };
    let (o0, v0) = &pts[i];
    let span = o1 - o0;
    let t = if span <= f32::EPSILON { 1.0 } else { (p - o0) / span };
    Some(lerp(v0, v1, easing.apply(t)))
}

impl Animation {
    /// Advance one frame. The frame it finishes on is still dirty (it draws
    /// the end state); after that it's settled and costs nothing.
    pub(crate) fn tick(&mut self, now: Instant) -> Tick {
        if self.settled { return Tick { dirty: false, running: false }; }
        if !self.finished(now) { return Tick { dirty: true, running: true }; }
        self.settled = true;
        Tick { dirty: true, running: false }
    }

    /// This frame's values, or `None` once it's settled without
    /// `fill: 'forwards'` (the node then renders its own style).
    pub(crate) fn overrides(&self, base: &Visual, now: Instant) -> Option<Overrides> {
        if self.settled && !self.spec.fill_forwards { return None; }
        Some(self.sample(base, now))
    }

    /// Where in the keyframes (0..=1) the animation is, and whether it has
    /// run all its iterations.
    fn progress(&self, now: Instant) -> (f32, bool) {
        let s = &self.spec;
        let total = now.saturating_duration_since(self.start).as_secs_f32() * 1000.0 / s.duration_ms as f32;
        let (iter, mut p, done) = if total >= s.iterations {
            // Finished: the end state of the last (possibly partial) iteration.
            let last = (s.iterations.ceil() - 1.0).max(0.0);
            let frac = s.iterations - last;
            (last, if frac > 0.0 { frac } else { 1.0 }, true)
        } else {
            (total.floor(), total.fract(), false)
        };
        if s.alternate && (iter as u64) % 2 == 1 { p = 1.0 - p; }
        (p.clamp(0.0, 1.0), done)
    }

    /// Whether it's finished and should stop driving frames.
    pub(crate) fn finished(&self, now: Instant) -> bool {
        self.progress(now).1
    }

    /// Current values. `base` is the node's own style, used where the
    /// keyframes leave a property unset at 0% or 100%.
    pub(crate) fn sample(&self, base: &Visual, now: Instant) -> Overrides {
        let (p, _) = self.progress(now);
        let st = &self.spec.stops;
        let e = self.spec.easing;
        let transform = sample_track(st, p, e, &base.transform, |s| s.transform.clone(), |a, b, t| {
            match pair_ops(a, b) {
                Some((a, b)) => a.iter().zip(&b).map(|(x, y)| x.lerp(*y, t as f64)).collect(),
                // Different function lists can't interpolate: flip half-way (CSS
                // discrete animation).
                None => if t < 0.5 { a.clone() } else { b.clone() },
            }
        });
        let color = |a: &Option<[u8; 4]>, b: &Option<[u8; 4]>, t: f32| match pair_colors(*a, *b) {
            Some((a, b)) => Some(lerp_rgba(a, b, t)),
            None => None,
        };
        let shadow = sample_track(st, p, e, &base.shadow, |s| s.shadow.map(Some), |a, b, t| {
            pair_shadows(*a, *b).map(|(a, b)| {
                let tt = t as f64;
                (a.0 + (b.0 - a.0) * tt, a.1 + (b.1 - a.1) * tt, lerp_rgba(a.2, b.2, t))
            })
        });
        Overrides {
            opacity:      sample_track(st, p, e, &base.opacity, |s| s.opacity, |a, b, t| lerp_f32(*a, *b, t)),
            transform:    transform.map(|ops| ops_affine(&ops)),
            background:   sample_track(st, p, e, &base.background, |s| s.background.map(Some), color).flatten(),
            border_color: sample_track(st, p, e, &base.border_color, |s| s.border_color.map(Some), color).flatten(),
            radius:       sample_track(st, p, e, &base.radius, |s| s.radius, |a, b, t| lerp_f32(*a, *b, t)),
            shadow:       shadow.flatten().map(|(dx, dy, c)| (dx, dy, rgba_to_vello(c))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_motion_clock_scales_pauses_and_seeks_without_jumping() {
        let t0 = Instant::now();
        let mut c = MotionClock { rate: 1.0, real_base: t0, virt_base: t0 };
        let at = |c: &MotionClock, ms: u64| c.at(t0 + Duration::from_millis(ms)).duration_since(t0).as_millis();
        assert_eq!(at(&c, 100), 100, "rate 1 is the real clock");
        c.rebase(t0 + Duration::from_millis(100), 0.25);
        assert_eq!(at(&c, 100), 100, "no jump when the rate changes");
        assert_eq!(at(&c, 500), 200, "400 ms real at 0.25x = 100 ms");
        c.rebase(t0 + Duration::from_millis(500), 0.0);
        assert_eq!(at(&c, 5000), 200, "paused");
        assert!(c.paused());
        c.virt_base += Duration::from_millis(50);
        assert_eq!(at(&c, 5000), 250, "seek moves it");
        c.rebase(t0 + Duration::from_millis(5000), 9.0);
        assert_eq!(c.rate(), 4.0, "rate is clamped");
    }
    use std::time::Duration;

    fn vis() -> Visual {
        Visual { opacity: 1.0, transform: vec![], background: None, border_color: None, radius: 0.0, shadow: None }
    }


    fn anim(json: &str, ms: u32, iterations: f32, alternate: bool, fill_forwards: bool) -> (Animation, Instant) {
        let start = Instant::now();
        let spec = AnimSpec {
            stops: parse_keyframes(json).unwrap(), duration_ms: ms, easing: Easing::Linear,
            iterations, alternate, fill_forwards,
        };
        (Animation { spec, start, settled: false }, start)
    }

    #[test]
    fn keyframes_parse_sort_and_ignore_junk() {
        let s = parse_keyframes(r##"[[1,{"opacity":1}],[0,{"opacity":0,"bogus":3,"backgroundColor":"#ff0000"}]]"##).unwrap();
        assert_eq!(s.len(), 2);
        assert_eq!(s[0].offset, 0.0);
        assert_eq!(s[0].background, Some([255, 0, 0, 255]));
        assert_eq!(s[1].opacity, Some(1.0));
        assert!(parse_keyframes("not json").is_none());
        assert!(parse_keyframes("[]").is_none());
    }

    #[test]
    fn keyframes_interpolate_per_segment() {
        let (a, t0) = anim(r#"[[0,{"opacity":0}],[0.5,{"opacity":1}],[1,{"opacity":0.5}]]"#, 1000, 1.0, false, false);
        let at = |ms| a.sample(&vis(), t0 + Duration::from_millis(ms)).opacity.unwrap();
        assert!((at(250) - 0.5).abs() < 1e-3);   // half-way through segment 1
        assert!((at(500) - 1.0).abs() < 1e-3);
        assert!((at(750) - 0.75).abs() < 1e-3);  // half-way through segment 2
    }

    #[test]
    fn missing_end_stops_use_the_nodes_own_value() {
        // Only a 50% stop: 0% and 100% are the node's own opacity (1.0).
        let (a, t0) = anim(r#"[[0.5,{"opacity":0}]]"#, 1000, 1.0, false, false);
        let at = |ms| a.sample(&vis(), t0 + Duration::from_millis(ms)).opacity.unwrap();
        assert!((at(0) - 1.0).abs() < 1e-3);
        assert!((at(250) - 0.5).abs() < 1e-3);
        assert!((at(500) - 0.0).abs() < 1e-3);
        // Properties no keyframe mentions aren't overridden.
        assert!(a.sample(&vis(), t0).background.is_none());
    }

    #[test]
    fn iterations_direction_and_fill() {
        let json = r#"[[0,{"opacity":0}],[1,{"opacity":1}]]"#;
        // Alternate: the second iteration runs backwards.
        let (a, t0) = anim(json, 1000, 2.0, true, false);
        let at = |ms| a.sample(&vis(), t0 + Duration::from_millis(ms)).opacity.unwrap();
        assert!((at(250) - 0.25).abs() < 1e-3);
        assert!((at(1250) - 0.75).abs() < 1e-3);
        assert!(!a.finished(t0 + Duration::from_millis(1900)));
        assert!(a.finished(t0 + Duration::from_millis(2100)));
        // Finished alternate x2 ends where iteration 2 ends: back at 0.
        assert!((at(5000) - 0.0).abs() < 1e-3);

        // Infinite never finishes.
        let (inf, t0) = anim(json, 100, f32::INFINITY, false, false);
        assert!(!inf.finished(t0 + Duration::from_secs(60)));

        // A fractional count stops part-way through the last iteration.
        let (half, t0) = anim(json, 1000, 1.5, false, true);
        assert!(half.finished(t0 + Duration::from_millis(1600)));
        let end = half.sample(&vis(), t0 + Duration::from_millis(9000)).opacity.unwrap();
        assert!((end - 0.5).abs() < 1e-3);
    }

    #[test]
    fn a_finished_animation_settles_and_an_identical_rerender_does_not_replay_it() {
        let json = r#"[[0,{"opacity":0}],[1,{"opacity":1}]]"#;
        let (mut a, t0) = anim(json, 100, 1.0, false, false);
        assert_eq!(a.tick(t0 + Duration::from_millis(50)), Tick { dirty: true, running: true });
        // The frame it ends on still redraws (to show the node's own style)…
        assert_eq!(a.tick(t0 + Duration::from_millis(150)), Tick { dirty: true, running: false });
        // …then it's inert: no redraws, no overrides.
        assert_eq!(a.tick(t0 + Duration::from_millis(200)), Tick { dirty: false, running: false });
        assert!(a.overrides(&vis(), t0 + Duration::from_millis(200)).is_none());
        // The regression: the same spec re-sent must NOT restart it…
        assert!(!needs_restart(Some(&a), &a.spec.clone()));
        // …a changed spec, or no animation yet, must.
        let mut changed = a.spec.clone();
        changed.duration_ms = 200;
        assert!(needs_restart(Some(&a), &changed));
        assert!(needs_restart(None, &a.spec));
    }

    #[test]
    fn a_forwards_fill_keeps_its_last_frame_after_settling() {
        let (mut a, t0) = anim(r#"[[0,{"opacity":0}],[1,{"opacity":0.4}]]"#, 100, 1.0, false, true);
        a.tick(t0 + Duration::from_millis(150));
        let ov = a.overrides(&vis(), t0 + Duration::from_millis(500)).expect("holds the end state");
        assert!((ov.opacity.unwrap() - 0.4).abs() < 1e-4);
    }

    #[test]
    fn keyframe_transforms_and_colors() {
        let (a, t0) = anim(
            r##"[[0,{"transform":"translate(0px,0) rotate(0deg)","backgroundColor":"#000000"}],
                [1,{"transform":"translate(100px,0) rotate(90deg)","backgroundColor":"#ffffff"}]]"##,
            1000, 1.0, false, false);
        let ov = a.sample(&vis(), t0 + Duration::from_millis(500));
        let o = ov.transform.unwrap() * peniko::kurbo::Point::new(0.0, 0.0);
        assert!((o.x - 50.0).abs() < 1e-6 && o.y.abs() < 1e-6, "{o:?}");
        assert_eq!(ov.background, Some([128, 128, 128, 255]));
    }

    #[test]
    fn animation_overrides_win_over_transition_overrides() {
        let mut base = Overrides { opacity: Some(0.2), radius: Some(4.0), ..Default::default() };
        base.overlay(Overrides { opacity: Some(0.9), ..Default::default() });
        assert_eq!(base.opacity, Some(0.9));
        assert_eq!(base.radius, Some(4.0), "untouched by the animation");
    }

    #[test]
    fn property_mask_defaults_to_opacity_only() {
        assert_eq!(property_mask(None), P_OPACITY);
        assert_eq!(property_mask(Some("all")), P_ALL);
        assert_eq!(property_mask(Some("transform, backgroundColor")), P_TRANSFORM | P_BACKGROUND);
        assert_eq!(property_mask(Some("bogus")), 0);
    }

    #[test]
    fn easings_hit_their_endpoints_and_known_midpoints() {
        for e in ["linear", "ease", "ease-in", "ease-out", "ease-in-out", "cubic-bezier(0.1,0.7,1.0,0.1)"] {
            let e = Easing::parse(Some(e));
            assert_eq!(e.apply(0.0), 0.0);
            assert!((e.apply(1.0) - 1.0).abs() < 1e-4, "{e:?}");
        }
        assert_eq!(Easing::parse(Some("linear")).apply(0.25), 0.25);
        // ease-in-out is symmetric: exactly half-way at t = 0.5.
        assert!((Easing::parse(Some("ease-in-out")).apply(0.5) - 0.5).abs() < 1e-3);
        // ease-in starts slow, ease-out starts fast.
        assert!(Easing::parse(Some("ease-in")).apply(0.25) < 0.25);
        assert!(Easing::parse(Some("ease-out")).apply(0.25) > 0.25);
        // Unknown / invalid falls back to the v1 default.
        assert_eq!(Easing::parse(Some("wobble")), Easing::EaseOutCubic);
        assert_eq!(Easing::parse(Some("cubic-bezier(2,0,1,1)")), Easing::EaseOutCubic);
        assert_eq!(Easing::parse(None), Easing::EaseOutCubic);
    }

    #[test]
    fn default_easing_matches_v1_opacity_curve() {
        let e = Easing::parse(None);
        for t in [0.1f32, 0.3, 0.5, 0.9] {
            assert_eq!(e.apply(t), 1.0 - (1.0 - t).powi(3));
        }
    }

    #[test]
    fn css_units_parse() {
        assert_eq!(parse_ops("rotate(180deg)"), Some(vec![TfOp::Rotate(180.0)]));
        assert_eq!(parse_ops("rotate(0.5turn)"), Some(vec![TfOp::Rotate(180.0)]));
        assert_eq!(parse_ops("translate(10px, 20px) scale(2)"),
                   Some(vec![TfOp::Translate(10.0, 20.0), TfOp::Scale(2.0, 2.0)]));
        let r = parse_ops("rotate(3.14159265358979rad)").unwrap();
        assert!(matches!(r[0], TfOp::Rotate(d) if (d - 180.0).abs() < 1e-6));
        // Wrong unit for the function, or junk: rejected (not silently zero).
        assert_eq!(parse_ops("rotate(10px)"), None);
        assert_eq!(parse_ops("translate(10deg)"), None);
        assert_eq!(parse_ops("skew(10)"), None);
    }

    #[test]
    fn chains_compose_in_css_order() {
        // CSS: `translate(100,0) rotate(90)` moves the element right, then
        // rotates it in place, so the origin lands at (100, 0) and a point
        // one unit right of it lands one unit BELOW (rotated), not left.
        let a = crate::render_props::parse_transform("translate(100, 0) rotate(90)").unwrap();
        let o = a * peniko::kurbo::Point::new(0.0, 0.0);
        let p = a * peniko::kurbo::Point::new(1.0, 0.0);
        assert!((o.x - 100.0).abs() < 1e-9 && o.y.abs() < 1e-9, "{o:?}");
        assert!((p.x - 100.0).abs() < 1e-9 && (p.y - 1.0).abs() < 1e-9, "{p:?}");
    }

    #[test]
    fn rotation_interpolates_the_angle_not_the_matrix() {
        let (from, to) = (vis(), Visual { transform: parse_ops("rotate(180)").unwrap(), ..vis() });
        let start = Instant::now();
        let tr = Transition::between(&from, &to, P_TRANSFORM, 1000, Easing::Linear, start).unwrap();
        let (ov, _) = tr.sample(start + Duration::from_millis(500));
        // Half-way is a real 90° rotation (unit scale), not a collapsed matrix.
        let [a, b, c, d, ..] = ov.transform.unwrap().as_coeffs();
        assert!(a.abs() < 1e-9 && d.abs() < 1e-9);
        assert!((b - 1.0).abs() < 1e-9 && (c + 1.0).abs() < 1e-9);
    }

    #[test]
    fn mismatched_transform_shapes_snap() {
        let from = Visual { transform: parse_ops("rotate(10)").unwrap(), ..vis() };
        let to   = Visual { transform: parse_ops("scale(2)").unwrap(), ..vis() };
        assert!(Transition::between(&from, &to, P_TRANSFORM, 300, Easing::Linear, Instant::now()).is_none());
    }

    #[test]
    fn colors_fade_in_from_a_transparent_copy_not_black() {
        let to = Visual { background: Some([200, 100, 50, 255]), ..vis() };
        let start = Instant::now();
        let tr = Transition::between(&vis(), &to, P_BACKGROUND, 1000, Easing::Linear, start).unwrap();
        let (ov, _) = tr.sample(start + Duration::from_millis(500));
        assert_eq!(ov.background, Some([200, 100, 50, 128]));
    }

    #[test]
    fn only_masked_and_changed_properties_get_tracks() {
        let to = Visual { opacity: 0.5, radius: 8.0, background: Some([1, 2, 3, 255]), ..vis() };
        let start = Instant::now();
        let tr = Transition::between(&vis(), &to, P_OPACITY | P_RADIUS, 1000, Easing::Linear, start).unwrap();
        let (ov, _) = tr.sample(start);
        assert!(ov.opacity.is_some() && ov.radius.is_some());
        assert!(ov.background.is_none(), "background not in the mask");
        assert!(ov.transform.is_none(), "transform unchanged");
        assert!(Transition::between(&vis(), &vis(), P_ALL, 1000, Easing::Linear, start).is_none());
    }

    #[test]
    fn retarget_starts_from_the_mid_flight_value() {
        let to = Visual { opacity: 0.0, ..vis() };
        let start = Instant::now();
        let tr = Transition::between(&vis(), &to, P_OPACITY, 1000, Easing::Linear, start).unwrap();
        let now = Visual { ..to.clone() };
        let cur = tr.current(&now, start + Duration::from_millis(250));
        assert!((cur.opacity - 0.75).abs() < 1e-4);
    }

    #[test]
    fn finishes_on_the_target_values() {
        let to = Visual { opacity: 0.2, radius: 12.0, shadow: parse_shadow("2 4 6 #00000080"), ..vis() };
        let start = Instant::now();
        let tr = Transition::between(&vis(), &to, P_ALL, 100, Easing::parse(Some("ease")), start).unwrap();
        let (ov, done) = tr.sample(start + Duration::from_millis(150));
        assert!(done);
        assert!((ov.opacity.unwrap() - 0.2).abs() < 1e-4);
        assert!((ov.radius.unwrap() - 12.0).abs() < 1e-4);
        let (dx, dy, _) = ov.shadow.unwrap();
        assert_eq!((dx, dy), (2.0, 4.0));
    }

    #[test]
    fn shadow_parser_matches_the_renderers() {
        let s = "2 3 4 #11223344";
        let (dx, dy, c) = parse_shadow(s).unwrap();
        let (rdx, rdy, rc) = crate::render_props::parse_box_shadow(s).unwrap();
        assert_eq!((dx, dy), (rdx, rdy));
        assert_eq!(rgba_to_vello(c).to_rgba8(), rc.to_rgba8());
    }
}
