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

    #[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools only
    pub(crate) fn rate(&self) -> f64 { self.rate }

    /// Paused: animations hold still, and don't need frames.
    pub(crate) fn paused(&self) -> bool { self.rate == 0.0 }

    #[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools only
    pub(crate) fn set_rate(&mut self, rate: f64) { self.rebase(Instant::now(), rate); }

    fn rebase(&mut self, real: Instant, rate: f64) {
        self.virt_base = self.at(real);
        self.real_base = real;
        self.rate = rate.clamp(0.0, 4.0);
    }

    /// Move the clock by `ms` (negative = back).
    #[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools only
    pub(crate) fn seek_by(&mut self, ms: f64) {
        let real = Instant::now();
        let rate = self.rate;
        self.rebase(real, rate);
        let d = std::time::Duration::from_secs_f64(ms.abs() / 1000.0);
        self.virt_base = if ms >= 0.0 { self.virt_base + d } else { self.virt_base.checked_sub(d).unwrap_or(self.virt_base) };
    }
}

/// A spring (mass 1) driving a transition's progress from 0 to 1. Unlike an
/// eased tween it can overshoot, and it takes an initial velocity, so a
/// transition retargeted mid-flight carries its momentum instead of restarting
/// from rest. Solved in closed form, so it's a pure function of elapsed time
/// (the devtools clock can pause or seek it).
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct Spring {
    omega: f64,
    zeta:  f64,
    /// Initial progress velocity, in progress-units per second.
    v0:    f64,
}

impl Spring {
    pub(crate) const DEFAULT_STIFFNESS: f32 = 300.0;
    pub(crate) const DEFAULT_DAMPING:   f32 = 30.0;
    /// A spring that hasn't settled by now is cut off and snapped (an
    /// undamped one never would).
    const MAX_MS: u32 = 4000;

    pub(crate) fn new(stiffness: f32, damping: f32) -> Self {
        let omega = (stiffness.max(1.0) as f64).sqrt();
        Spring { omega, zeta: damping.max(0.0) as f64 / (2.0 * omega), v0: 0.0 }
    }

    /// From the node's `transitionStiffness` / `transitionDamping`. `None`
    /// when neither is set (a timed transition).
    pub(crate) fn from_props(p: &glyx_runtime::bindings::NodeProps) -> Option<Self> {
        if p.transition_stiffness.is_none() && p.transition_damping.is_none() { return None; }
        Some(Spring::new(
            p.transition_stiffness.unwrap_or(Self::DEFAULT_STIFFNESS),
            p.transition_damping.unwrap_or(Self::DEFAULT_DAMPING),
        ))
    }

    /// `(progress, velocity)` `t` seconds in. Progress starts at 0, aims at 1
    /// and may pass it (underdamped); velocity is progress-units per second.
    fn at(&self, t: f64) -> (f64, f64) {
        let (w, z, v0) = (self.omega, self.zeta, self.v0);
        let d0 = -1.0; // displacement from the target at t = 0
        if (z - 1.0).abs() < 1e-6 {
            let k = v0 + w * d0;
            let e = (-w * t).exp();
            (1.0 + (d0 + k * t) * e, (v0 - w * k * t) * e)
        } else if z < 1.0 {
            let wd = w * (1.0 - z * z).sqrt();
            let b = (v0 + z * w * d0) / wd;
            let e = (-z * w * t).exp();
            let (s, c) = (wd * t).sin_cos();
            (1.0 + e * (d0 * c + b * s), e * ((-z * w * d0 + wd * b) * c + (-z * w * b - wd * d0) * s))
        } else {
            let q = w * (z * z - 1.0).sqrt();
            let (r1, r2) = (-w * z + q, -w * z - q);
            let c2 = (v0 - r1 * d0) / (r2 - r1);
            let c1 = d0 - c2;
            let (e1, e2) = ((r1 * t).exp(), (r2 * t).exp());
            (1.0 + c1 * e1 + c2 * e2, c1 * r1 * e1 + c2 * r2 * e2)
        }
    }

    /// Milliseconds until it is at rest (within 0.1% of the target and slow),
    /// capped at `MAX_MS`.
    fn settle_ms(&self) -> u32 {
        let mut ms = 8;
        while ms < Self::MAX_MS {
            let (x, v) = self.at(ms as f64 / 1000.0);
            if (x - 1.0).abs() < 1e-3 && v.abs() < 1e-2 { return ms; }
            ms += 8;
        }
        Self::MAX_MS
    }
}

/// One node's in-flight transition: a shared clock plus a track per property.
#[derive(Clone, Debug)]
pub(crate) struct Transition {
    pub start:       Instant,
    /// Length of a tween; for a spring, how long until it settles.
    pub duration_ms: u32,
    pub easing:      Easing,
    spring:      Option<Spring>,
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
            start, duration_ms, easing, spring: None,
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
        pace_progress(self.spring.as_ref(), self.easing, self.duration_ms, self.start, now)
    }

    /// Make this a spring instead of a timed tween. The tracks are unchanged;
    /// only how far along them it is differs.
    pub(crate) fn into_spring(mut self, spring: Spring) -> Self {
        self.duration_ms = spring.settle_ms();
        self.spring = Some(spring);
        self
    }

    pub(crate) fn is_spring(&self) -> bool { self.spring.is_some() }

    /// Progress velocity (progress-units per second): zero for a tween and for
    /// a spring that has settled.
    fn velocity(&self, now: Instant) -> f64 {
        let Some(sp) = &self.spring else { return 0.0 };
        let ms = now.saturating_duration_since(self.start).as_secs_f64() * 1000.0;
        if ms >= self.duration_ms as f64 { 0.0 } else { sp.at(ms / 1000.0).1 }
    }

    /// One signed number summarising how far this transition moves: the first
    /// animating property, as `(which, from → to)`. Two transitions with the
    /// same `which` can hand velocity to each other.
    fn lead(&self) -> Option<(u8, f64)> {
        let sum = |a: [u8; 4], b: [u8; 4]| a.iter().zip(&b).map(|(x, y)| *y as f64 - *x as f64).sum::<f64>() / 4.0;
        if let Some((a, b)) = self.opacity { return Some((0, (b - a) as f64)); }
        if let Some((a, b)) = &self.transform {
            // The first component of the first function that actually moves.
            for (x, y) in a.iter().zip(b) {
                let span = match (x, y) {
                    (TfOp::Translate(ax, ay), TfOp::Translate(bx, by)) => if bx != ax { bx - ax } else { by - ay },
                    (TfOp::Rotate(a), TfOp::Rotate(b))                 => b - a,
                    (TfOp::Scale(ax, ay), TfOp::Scale(bx, by))         => if bx != ax { bx - ax } else { by - ay },
                    _ => 0.0,
                };
                if span != 0.0 { return Some((1, span)); }
            }
        }
        if let Some((a, b)) = self.background   { return Some((2, sum(a, b))); }
        if let Some((a, b)) = self.border_color { return Some((3, sum(a, b))); }
        if let Some((a, b)) = self.radius       { return Some((4, (b - a) as f64)); }
        if let Some((a, b)) = self.shadow       { return Some((5, if b.0 != a.0 { b.0 - a.0 } else { b.1 - a.1 })); }
        None
    }

    /// Start this spring with the velocity `old` had when it was interrupted,
    /// so a retarget (a hover that reverses mid-flight) keeps its momentum.
    /// Both must be springs animating the same lead property; their spans
    /// differ (this one runs from where `old` got to), so the old velocity is
    /// converted through the lead property's distances. Anything else starts
    /// from rest.
    pub(crate) fn inherit_velocity(&mut self, old: &Transition, now: Instant) {
        let (Some(mut sp), Some(_)) = (self.spring, old.spring) else { return };
        let (Some((k_old, s_old)), Some((k_new, s_new))) = (old.lead(), self.lead()) else { return };
        if k_old != k_new || s_new.abs() < 1e-6 { return; }
        sp.v0 = (old.velocity(now) * s_old / s_new).clamp(-50.0, 50.0);
        self.duration_ms = sp.settle_ms();
        self.spring = Some(sp);
    }

    /// The properties this transition animates (camelCase, as in JSX).
    #[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools only
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
            // A spring can overshoot, so keep opacity and radius in their valid range.
            opacity:      self.opacity.map(|(a, b)| lerp_f32(a, b, e).clamp(0.0, 1.0)),
            transform:    self.transform.as_ref().map(|(a, b)| {
                let ops: Vec<TfOp> = a.iter().zip(b).map(|(x, y)| x.lerp(*y, e as f64)).collect();
                ops_affine(&ops)
            }),
            background:   self.background.map(|(a, b)| lerp_rgba(a, b, e)),
            border_color: self.border_color.map(|(a, b)| lerp_rgba(a, b, e)),
            radius:       self.radius.map(|(a, b)| lerp_f32(a, b, e).max(0.0)),
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
        if let Some((a, b)) = self.opacity      { v.opacity = lerp_f32(a, b, e).clamp(0.0, 1.0); }
        if let Some((a, b)) = &self.transform   { v.transform = a.iter().zip(b).map(|(x, y)| x.lerp(*y, e as f64)).collect(); }
        if let Some((a, b)) = self.background   { v.background = Some(lerp_rgba(a, b, e)); }
        if let Some((a, b)) = self.border_color { v.border_color = Some(lerp_rgba(a, b, e)); }
        if let Some((a, b)) = self.radius       { v.radius = lerp_f32(a, b, e).max(0.0); }
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

/// How far along a run is (`0..=1`, past 1 for a bouncy spring) and whether it
/// has finished. A spring lands exactly on 1 once settled; a tween follows its
/// easing over `duration_ms`.
fn pace_progress(spring: Option<&Spring>, easing: Easing, duration_ms: u32, start: Instant, now: Instant) -> (f32, bool) {
    let ms = now.saturating_duration_since(start).as_secs_f32() * 1000.0;
    if let Some(sp) = spring {
        if ms >= duration_ms as f32 { return (1.0, true); }
        return (sp.at(ms as f64 / 1000.0).0 as f32, false);
    }
    let t = (ms / duration_ms.max(1) as f32).clamp(0.0, 1.0);
    (easing.apply(t), t >= 1.0)
}

// ── Canvas tweens ─────────────────────────────────────────────────────────────

/// What paces a canvas between two draws: a spring, or a timed, eased tween.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum Pace {
    Spring(Spring),
    Timed { ms: u32, easing: Easing },
}

impl Pace {
    /// From the canvas node's `transition` props: a spring wins over a duration.
    /// `None` → the canvas redraws instantly, as every canvas did before.
    pub(crate) fn from_props(p: &glyx_runtime::bindings::NodeProps) -> Option<Self> {
        if let Some(sp) = Spring::from_props(p) { return Some(Pace::Spring(sp)); }
        p.transition_ms.map(|ms| Pace::Timed { ms: ms.max(1), easing: Easing::parse(p.transition_easing.as_deref()) })
    }
}

/// Pace a canvas by how fast it is being updated. A spring needs a moment to
/// settle; a canvas fed updates faster than that never gets to rest. It trails
/// the data by about the settle time and shows blends of states that never
/// existed — on a fast stream the drawing is simply wrong. So when updates
/// arrive more often than the spring can settle (`cadence_ms` is the average
/// gap between them), glide linearly over that gap instead: each update is
/// reached just as the next one lands, one update behind at most, with no lag
/// building up. Slower updates, and canvases with an explicit duration, keep
/// the pace they were given.
pub(crate) fn adapt_pace(pace: Pace, cadence_ms: Option<f64>) -> Pace {
    let (Pace::Spring(sp), Some(gap)) = (pace, cadence_ms) else { return pace };
    if gap < sp.settle_ms() as f64 * 0.9 {
        Pace::Timed { ms: (gap.round() as u32).max(16), easing: Easing::Linear }
    } else {
        pace
    }
}

use glyx_runtime::bindings::CanvasCmd;

/// Every number a command animates, in a fixed order (colours aside).
fn cmd_nums(c: &CanvasCmd, out: &mut Vec<f32>) {
    use CanvasCmd::*;
    match c {
        Clear | PopClip => {}
        FillRect { x, y, w, h, .. } => out.extend([*x, *y, *w, *h]),
        StrokeRect { x, y, w, h, line_width, .. } => out.extend([*x, *y, *w, *h, *line_width]),
        FillCircle { cx, cy, r, .. } => out.extend([*cx, *cy, *r]),
        StrokeCircle { cx, cy, r, line_width, .. } => out.extend([*cx, *cy, *r, *line_width]),
        StrokeLine { x0, y0, x1, y1, line_width, .. } => out.extend([*x0, *y0, *x1, *y1, *line_width]),
        FillText { x, y, font_size, .. } => out.extend([*x, *y, *font_size]),
        FillPath { points, .. } => out.extend(points.iter().copied()),
        StrokePath { points, line_width, .. } => { out.extend(points.iter().copied()); out.push(*line_width); }
        FillPathGradient { points, x0, y0, x1, y1, stops, .. } => {
            out.extend(points.iter().copied());
            out.extend([*x0, *y0, *x1, *y1]);
            out.extend(stops.iter().map(|(o, _)| *o));
        }
        PushClip { x, y, w, h } => out.extend([*x, *y, *w, *h]),
    }
}

/// Whether `a` can ease into `b`: the same kind of command with the same
/// number of points/stops. Text content may differ (a label's value changes;
/// its position still moves).
fn same_shape(a: &CanvasCmd, b: &CanvasCmd) -> bool {
    use CanvasCmd::*;
    match (a, b) {
        (Clear, Clear) | (PopClip, PopClip) => true,
        (FillRect { .. }, FillRect { .. }) | (StrokeRect { .. }, StrokeRect { .. })
        | (FillCircle { .. }, FillCircle { .. }) | (StrokeCircle { .. }, StrokeCircle { .. })
        | (StrokeLine { .. }, StrokeLine { .. }) | (FillText { .. }, FillText { .. })
        | (PushClip { .. }, PushClip { .. }) => true,
        (FillPath { points: p, .. }, FillPath { points: q, .. }) => p.len() == q.len(),
        (StrokePath { points: p, .. }, StrokePath { points: q, .. }) => p.len() == q.len(),
        (FillPathGradient { points: p, stops: s, .. }, FillPathGradient { points: q, stops: t, .. }) => p.len() == q.len() && s.len() == t.len(),
        _ => false,
    }
}

/// `a` → `b` at progress `t` (call only for same-shape pairs). Counts that
/// can't go negative (radii, widths, sizes) stay in range while a spring
/// overshoots; discrete fields (text, `closed`, `bold`) come from `b`.
fn lerp_cmd(a: &CanvasCmd, b: &CanvasCmd, t: f32) -> CanvasCmd {
    use CanvasCmd::*;
    let l = |x: f32, y: f32| x + (y - x) * t;
    let pos = |x: f32, y: f32| (x + (y - x) * t).max(0.0);
    let pts = |p: &[f32], q: &[f32]| p.iter().zip(q).map(|(x, y)| x + (y - x) * t).collect::<Vec<f32>>();
    match (a, b) {
        (FillRect { x: ax, y: ay, w: aw, h: ah, color: ac }, FillRect { x, y, w, h, color }) =>
            FillRect { x: l(*ax, *x), y: l(*ay, *y), w: pos(*aw, *w), h: pos(*ah, *h), color: lerp_rgba(*ac, *color, t) },
        (StrokeRect { x: ax, y: ay, w: aw, h: ah, color: ac, line_width: alw }, StrokeRect { x, y, w, h, color, line_width }) =>
            StrokeRect { x: l(*ax, *x), y: l(*ay, *y), w: pos(*aw, *w), h: pos(*ah, *h), color: lerp_rgba(*ac, *color, t), line_width: pos(*alw, *line_width) },
        (FillCircle { cx: acx, cy: acy, r: ar, color: ac }, FillCircle { cx, cy, r, color }) =>
            FillCircle { cx: l(*acx, *cx), cy: l(*acy, *cy), r: pos(*ar, *r), color: lerp_rgba(*ac, *color, t) },
        (StrokeCircle { cx: acx, cy: acy, r: ar, color: ac, line_width: alw }, StrokeCircle { cx, cy, r, color, line_width }) =>
            StrokeCircle { cx: l(*acx, *cx), cy: l(*acy, *cy), r: pos(*ar, *r), color: lerp_rgba(*ac, *color, t), line_width: pos(*alw, *line_width) },
        (StrokeLine { x0: ax0, y0: ay0, x1: ax1, y1: ay1, color: ac, line_width: alw }, StrokeLine { x0, y0, x1, y1, color, line_width }) =>
            StrokeLine { x0: l(*ax0, *x0), y0: l(*ay0, *y0), x1: l(*ax1, *x1), y1: l(*ay1, *y1), color: lerp_rgba(*ac, *color, t), line_width: pos(*alw, *line_width) },
        (FillText { x: ax, y: ay, font_size: af, color: ac, .. }, FillText { text, x, y, font_size, color, bold }) =>
            FillText { text: text.clone(), x: l(*ax, *x), y: l(*ay, *y), font_size: l(*af, *font_size).max(1.0), color: lerp_rgba(*ac, *color, t), bold: *bold },
        (FillPath { points: p, color: ac }, FillPath { points: q, color }) =>
            FillPath { points: pts(p, q), color: lerp_rgba(*ac, *color, t) },
        (StrokePath { points: p, color: ac, line_width: alw, .. }, StrokePath { points: q, color, line_width, closed }) =>
            StrokePath { points: pts(p, q), color: lerp_rgba(*ac, *color, t), line_width: pos(*alw, *line_width), closed: *closed },
        (FillPathGradient { points: p, x0: ax0, y0: ay0, x1: ax1, y1: ay1, stops: s }, FillPathGradient { points: q, x0, y0, x1, y1, stops: u }) =>
            FillPathGradient {
                points: pts(p, q),
                x0: l(*ax0, *x0), y0: l(*ay0, *y0), x1: l(*ax1, *x1), y1: l(*ay1, *y1),
                stops: s.iter().zip(u).map(|((ao, ac), (o, c))| (l(*ao, *o), lerp_rgba(*ac, *c, t))).collect(),
            },
        (PushClip { x: ax, y: ay, w: aw, h: ah }, PushClip { x, y, w, h }) =>
            PushClip { x: l(*ax, *x), y: l(*ay, *y), w: pos(*aw, *w), h: pos(*ah, *h) },
        // Not same-shape: take the new command whole.
        (_, b) => b.clone(),
    }
}

/// A canvas easing from what it showed to a new command list.
///
/// JS draws the final state once per update; Rust moves the drawn commands
/// toward it every frame, with no JS per frame. Only the starting list is
/// stored: the target is the canvas's own `canvas_cmds` entry, passed in.
#[derive(Clone, Debug)]
pub(crate) struct CanvasTween {
    from:        Vec<CanvasCmd>,
    start:       Instant,
    pub duration_ms: u32,
    easing:      Easing,
    spring:      Option<Spring>,
}

/// For each command of `to`, the command of `from` it eases from. Two draws
/// whose command lists differ — an axis gained a tick, a label came or went —
/// still ease wherever they line up: commands are matched in order, pairing
/// only ones that can ease into each other (`same_shape`), by longest common
/// subsequence. A command of `to` with no partner stands for itself (it
/// appears at once); a command of `from` with no partner is dropped. Lists of
/// the same shape (the common case) skip the search. `None` when the lists are
/// too long to match without a noticeable cost.
fn align(from: &[CanvasCmd], to: &[CanvasCmd]) -> Option<Vec<CanvasCmd>> {
    if from.len() == to.len() && from.iter().zip(to).all(|(a, b)| same_shape(a, b)) {
        return Some(from.to_vec());
    }
    let (n, m) = (from.len(), to.len());
    if n * m > 250_000 { return None; }
    // lcs[i][j]: the longest run of matches between from[i..] and to[j..].
    let w = m + 1;
    let mut lcs = vec![0u16; (n + 1) * w];
    for i in (0..n).rev() {
        for j in (0..m).rev() {
            lcs[i * w + j] = if same_shape(&from[i], &to[j]) {
                lcs[(i + 1) * w + j + 1] + 1
            } else {
                lcs[(i + 1) * w + j].max(lcs[i * w + j + 1])
            };
        }
    }
    let mut out = to.to_vec();
    let (mut i, mut j) = (0, 0);
    while i < n && j < m {
        if same_shape(&from[i], &to[j]) && lcs[i * w + j] == lcs[(i + 1) * w + j + 1] + 1 {
            out[j] = from[i].clone();
            i += 1;
            j += 1;
        } else if lcs[(i + 1) * w + j] >= lcs[i * w + j + 1] {
            i += 1;
        } else {
            j += 1;
        }
    }
    Some(out)
}

impl CanvasTween {
    /// `None` when there is nothing to animate: the draws are identical, or
    /// nothing in the old one can ease into anything in the new one, in which
    /// case the new draw simply replaces the old. Commands present in only one
    /// of them (see `align`) appear or disappear at once while the rest ease.
    pub(crate) fn between(from: Vec<CanvasCmd>, to: &[CanvasCmd], pace: Pace, start: Instant) -> Option<Self> {
        let from = align(&from, to)?;
        if from == to { return None; }
        let (duration_ms, easing, spring) = match pace {
            Pace::Spring(sp)           => (sp.settle_ms(), Easing::Linear, Some(sp)),
            Pace::Timed { ms, easing } => (ms, easing, None),
        };
        Some(CanvasTween { from, start, duration_ms, easing, spring })
    }

    fn progress(&self, now: Instant) -> (f32, bool) {
        pace_progress(self.spring.as_ref(), self.easing, self.duration_ms, self.start, now)
    }

    pub(crate) fn is_spring(&self) -> bool { self.spring.is_some() }

    pub(crate) fn start(&self) -> Instant { self.start }

    /// The commands to draw at `now`, and whether it has arrived at `to`.
    pub(crate) fn sample(&self, to: &[CanvasCmd], now: Instant) -> (Vec<CanvasCmd>, bool) {
        let (e, done) = self.progress(now);
        if done { return (to.to_vec(), true); }
        (self.from.iter().zip(to).map(|(a, b)| lerp_cmd(a, b, e)).collect(), false)
    }

    fn velocity(&self, now: Instant) -> f64 {
        let Some(sp) = &self.spring else { return 0.0 };
        let ms = now.saturating_duration_since(self.start).as_secs_f64() * 1000.0;
        if ms >= self.duration_ms as f64 { 0.0 } else { sp.at(ms / 1000.0).1 }
    }

    /// The first number that moves, as `(which, from → to)`: two tweens with the
    /// same `which` can hand velocity to each other.
    fn lead(&self, to: &[CanvasCmd]) -> Option<(usize, f64)> {
        let (mut a, mut b) = (Vec::new(), Vec::new());
        for (x, y) in self.from.iter().zip(to) { cmd_nums(x, &mut a); cmd_nums(y, &mut b); }
        a.iter().zip(&b).position(|(x, y)| (y - x).abs() > 1e-4).map(|i| (i, (b[i] - a[i]) as f64))
    }

    /// Start with the velocity `old` (running toward `old_to`) had when this
    /// update interrupted it, so a stream of updates — a realtime chart
    /// sliding along — keeps moving instead of stopping at every point. Only
    /// between springs moving the same number; otherwise from rest.
    pub(crate) fn inherit_velocity(&mut self, to: &[CanvasCmd], old: &CanvasTween, old_to: &[CanvasCmd], now: Instant) {
        let (Some(mut sp), Some(_)) = (self.spring, old.spring) else { return };
        // The "same number" test below compares positions in the two lists, which
        // only mean the same thing when both draws have the same commands.
        if old_to.len() != to.len() { return; }
        let (Some((k_old, s_old)), Some((k_new, s_new))) = (old.lead(old_to), self.lead(to)) else { return };
        if k_old != k_new || s_new.abs() < 1e-6 { return; }
        sp.v0 = (old.velocity(now) * s_old / s_new).clamp(-50.0, 50.0);
        self.duration_ms = sp.settle_ms();
        self.spring = Some(sp);
    }
}

// ── Smooth scrolling ──────────────────────────────────────────────────────────

/// A scroll offset easing toward a target on a critically damped spring.
///
/// JS still decides *where* to scroll (`scrollOffsetY`); this decides what is
/// drawn on the way there. Velocity survives a retarget, so a run of wheel
/// notches accelerates smoothly instead of restarting an ease at each one.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct ScrollSpring {
    pub pos:    f64,
    vel:        f64,
    pub target: f64,
    last:       Instant,
}

impl ScrollSpring {
    /// Natural frequency (rad/s). ~95% of the way in 140 ms, settled in ~0.3 s:
    /// quick enough to feel direct, slow enough to read as smooth.
    const OMEGA: f64 = 22.0;
    /// At rest when this close (px) and this slow (px/s): snap to the target.
    const REST_DIST: f64 = 0.25;
    const REST_VEL:  f64 = 8.0;
    /// A long frame (stall, breakpoint) must not fling the offset.
    const MAX_DT: f64 = 0.05;

    pub(crate) fn new(pos: f64, target: f64, now: Instant) -> Self {
        Self { pos, vel: 0.0, target, last: now }
    }

    /// Aim at a new target, keeping the current position and velocity.
    pub(crate) fn retarget(&mut self, target: f64) { self.target = target; }

    /// Advance to `now`. Returns `true` while still moving; on the frame it
    /// comes to rest `pos` is exactly `target`.
    pub(crate) fn step(&mut self, now: Instant) -> bool {
        let dt = now.saturating_duration_since(self.last).as_secs_f64().min(Self::MAX_DT);
        self.last = now;
        let w = Self::OMEGA;
        let d = self.pos - self.target;
        let k = self.vel + w * d;
        let e = (-w * dt).exp();
        self.pos = self.target + (d + k * dt) * e;
        self.vel = (self.vel - w * k * dt) * e;
        if (self.pos - self.target).abs() < Self::REST_DIST && self.vel.abs() < Self::REST_VEL {
            self.pos = self.target;
            self.vel = 0.0;
            return false;
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_scroll_spring_settles_exactly_on_its_target_without_overshoot() {
        let t0 = Instant::now();
        let mut s = ScrollSpring::new(0.0, 400.0, t0);
        let (mut ms, mut max, mut running) = (0u64, 0.0f64, true);
        while running && ms < 3000 {
            ms += 8;
            running = s.step(t0 + Duration::from_millis(ms));
            max = max.max(s.pos);
        }
        assert!(!running, "settles");
        assert!(ms < 1000, "settles quickly, took {ms} ms");
        assert_eq!(s.pos, 400.0);
        assert!(max <= 400.0, "critically damped: no overshoot, peaked at {max}");
    }

    #[test]
    fn a_scroll_spring_keeps_its_velocity_when_retargeted() {
        let t0 = Instant::now();
        let mut s = ScrollSpring::new(0.0, 100.0, t0);
        s.step(t0 + Duration::from_millis(50));
        let pos = s.pos;
        s.retarget(300.0);
        assert_eq!(s.pos, pos, "retargeting does not jump");
        let before = s.pos;
        s.step(t0 + Duration::from_millis(66));
        assert!(s.pos > before, "still moving forward toward the new target");
    }

    #[test]
    fn a_scroll_spring_ignores_a_stalled_frame() {
        let t0 = Instant::now();
        let mut s = ScrollSpring::new(0.0, 1000.0, t0);
        s.step(t0 + Duration::from_secs(5));
        assert!(s.pos < 1000.0, "a 5 s hitch is clamped to one short step");
    }

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

    // ── Springs ───────────────────────────────────────────────────────────────

    fn ms(n: u64) -> Duration { Duration::from_millis(n) }

    #[test]
    fn springs_start_at_zero_and_settle_on_one() {
        for (k, c) in [(300.0, 30.0), (170.0, 26.0), (500.0, 10.0), (100.0, 40.0), (400.0, 40.0)] {
            let s = Spring::new(k, c);
            let (x0, v0) = s.at(0.0);
            assert!(x0.abs() < 1e-9 && v0.abs() < 1e-9, "k={k} c={c}: starts at rest at 0");
            let settle = s.settle_ms();
            assert!(settle < Spring::MAX_MS, "k={k} c={c}: should settle, took {settle} ms");
            let (x, v) = s.at(settle as f64 / 1000.0);
            assert!((x - 1.0).abs() < 2e-3 && v.abs() < 2e-2, "k={k} c={c}: at rest at the end, x={x} v={v}");
        }
        assert!(Spring::new(300.0, 30.0).settle_ms() < 1000, "the default feels quick");
    }

    #[test]
    fn a_damped_spring_never_overshoots_and_an_underdamped_one_does() {
        let peak = |s: Spring| (0..500).map(|i| s.at(i as f64 / 250.0).0).fold(f64::MIN, f64::max);
        // zeta = 1 and zeta > 1: monotonic approach.
        assert!(peak(Spring::new(100.0, 20.0)) <= 1.0 + 1e-9, "critically damped");
        assert!(peak(Spring::new(100.0, 40.0)) <= 1.0 + 1e-9, "overdamped");
        // Bouncy: noticeably past the target.
        assert!(peak(Spring::new(500.0, 10.0)) > 1.1, "underdamped overshoots");
    }

    #[test]
    fn spring_velocity_is_the_derivative_of_its_progress() {
        for s in [Spring::new(300.0, 30.0), Spring::new(500.0, 10.0), Spring::new(100.0, 20.0), Spring::new(100.0, 40.0)] {
            let mut s = s;
            s.v0 = 1.5; // also with an inherited velocity
            for &t in &[0.02, 0.1, 0.3] {
                let h = 1e-6;
                let numeric = (s.at(t + h).0 - s.at(t - h).0) / (2.0 * h);
                let (_, analytic) = s.at(t);
                assert!((numeric - analytic).abs() < 1e-3, "{s:?} at {t}: {numeric} vs {analytic}");
            }
        }
    }

    #[test]
    fn a_spring_transition_samples_mid_flight_and_lands_exactly() {
        let to = Visual { opacity: 0.0, radius: 20.0, ..vis() };
        let start = Instant::now();
        let tr = Transition::between(&vis(), &to, P_OPACITY | P_RADIUS, 1, Easing::Linear, start).unwrap()
            .into_spring(Spring::new(300.0, 30.0));
        assert!(tr.is_spring());
        let (mid, done) = tr.sample(start + ms(60));
        assert!(!done);
        let (o, r) = (mid.opacity.unwrap(), mid.radius.unwrap());
        assert!(o < 1.0 && o > 0.0 && r > 0.0 && r < 20.0, "partway: opacity {o}, radius {r}");
        let (end, done) = tr.sample(start + ms(tr.duration_ms as u64 + 1));
        assert!(done);
        assert_eq!((end.opacity, end.radius), (Some(0.0), Some(20.0)), "exactly on target when settled");
    }

    #[test]
    fn a_bouncy_spring_keeps_opacity_and_radius_in_range() {
        let start = Instant::now();
        let to   = Visual { opacity: 1.0, radius: 10.0, ..vis() };
        let from = Visual { opacity: 0.0, radius: 0.0, ..vis() };
        let tr = Transition::between(&from, &to, P_OPACITY | P_RADIUS, 1, Easing::Linear, start).unwrap()
            .into_spring(Spring::new(600.0, 6.0));
        for t in (0..tr.duration_ms as u64).step_by(5) {
            let (ov, _) = tr.sample(start + ms(t));
            assert!((0.0..=1.0).contains(&ov.opacity.unwrap()), "opacity out of range at {t} ms");
            assert!(ov.radius.unwrap() >= 0.0, "negative radius at {t} ms");
        }
    }

    #[test]
    fn a_reversed_spring_carries_its_velocity() {
        // Fade out; interrupt part-way and fade back in. The value must not
        // change speed at the instant of the reversal.
        let start = Instant::now();
        let hidden = Visual { opacity: 0.0, ..vis() };
        let spring = Spring::new(200.0, 22.0);
        let out = Transition::between(&vis(), &hidden, P_OPACITY, 1, Easing::Linear, start).unwrap().into_spring(spring);

        let t_rev = start + ms(70);
        let at_rev = out.current(&hidden, t_rev);
        let mut back = Transition::between(&at_rev, &vis(), P_OPACITY, 1, Easing::Linear, t_rev).unwrap().into_spring(spring);
        back.inherit_velocity(&out, t_rev);

        // Opacity speed (per second) just before, from the old spring...
        let h = ms(1);
        let op = |tr: &Transition, t: Instant| tr.sample(t).0.opacity.unwrap() as f64;
        let before = (op(&out, t_rev) - op(&out, t_rev - h)) / 0.001;
        // ...and just after, from the new one.
        let after = (op(&back, t_rev + h) - op(&back, t_rev)) / 0.001;
        assert!(before < -1.0, "heading down fast: {before}");
        assert!((after - before).abs() < 0.35 * before.abs(), "velocity carried: before {before}, after {after}");

        // Without the hand-over it would restart from rest.
        let rested = Transition::between(&at_rev, &vis(), P_OPACITY, 1, Easing::Linear, t_rev).unwrap().into_spring(spring);
        let from_rest = (op(&rested, t_rev + h) - op(&rested, t_rev)) / 0.001;
        assert!(from_rest.abs() < 0.2 * before.abs(), "no hand-over starts from rest: {from_rest}");
    }

    #[test]
    fn velocity_only_passes_between_springs_on_the_same_property() {
        let start = Instant::now();
        let spring = Spring::new(200.0, 22.0);
        let faded = Transition::between(&vis(), &Visual { opacity: 0.0, ..vis() }, P_OPACITY, 1, Easing::Linear, start).unwrap().into_spring(spring);
        let grown = Transition::between(&vis(), &Visual { radius: 9.0, ..vis() }, P_RADIUS, 1, Easing::Linear, start).unwrap().into_spring(spring);
        let mut other = grown.clone();
        other.inherit_velocity(&faded, start + ms(50));
        assert_eq!(other.spring.unwrap().v0, 0.0, "different lead property: from rest");
        // A tween has no velocity to give.
        let tween = Transition::between(&vis(), &Visual { radius: 9.0, ..vis() }, P_RADIUS, 200, Easing::Linear, start).unwrap();
        let mut s = grown.clone();
        s.inherit_velocity(&tween, start + ms(50));
        assert_eq!(s.spring.unwrap().v0, 0.0, "tween → spring: from rest");
    }

    // ── Canvas tweens ─────────────────────────────────────────────────────────

    fn line(x0: f32, y: f32) -> CanvasCmd {
        CanvasCmd::StrokePath { points: vec![x0, y, x0 + 10.0, y + 5.0, x0 + 20.0, y], color: [255, 0, 0, 255], line_width: 2.0, closed: false }
    }
    fn rect(w: f32, c: [u8; 4]) -> CanvasCmd { CanvasCmd::FillRect { x: 0.0, y: 0.0, w, h: 10.0, color: c } }
    fn pts(c: &CanvasCmd) -> Vec<f32> { let mut v = Vec::new(); cmd_nums(c, &mut v); v }
    const SPRING_PACE: Pace = Pace::Spring(Spring { omega: 17.320508, zeta: 1.0, v0: 0.0 });

    /// A window of a sine sliding left by some samples per update, drawn as one
    /// polyline whose points sit at fixed x positions (as the charts draw it).
    fn sine_window(offset: usize, n: usize) -> Vec<CanvasCmd> {
        let mut points = Vec::new();
        for i in 0..n {
            let k = (offset + i) as f32;
            points.push(i as f32 * 7.0);
            points.push(100.0 + 60.0 * (k / 40.0).sin() + 15.0 * (k * 0.092).sin());
        }
        vec![CanvasCmd::StrokePath { points, color: [255, 255, 255, 255], line_width: 2.0, closed: false }]
    }

    /// The worst vertical gap between two same-shape polylines.
    fn y_error(shown: &[CanvasCmd], target: &[CanvasCmd]) -> f32 {
        let (mut a, mut b) = (Vec::new(), Vec::new());
        cmd_nums(&shown[0], &mut a);
        cmd_nums(&target[0], &mut b);
        // Odd slots are y.
        a.iter().zip(&b).enumerate().filter(|(i, _)| i % 2 == 1).map(|(_, (x, y))| (x - y).abs()).fold(0.0, f32::max)
    }

    /// Chains canvas tweens the way the app does (retarget from what is on
    /// screen, carry the velocity) and reports how far the drawing is from the
    /// data it is heading for, a moment before the next update arrives.
    #[test]
    fn a_streamed_window_stays_close_to_its_data_at_any_update_rate() {
        for (label, shift, tick_ms) in [
            ("10 samples / 50 ms (200/s, 20 Hz)", 10usize, 50u64),
            ("2 samples / 33 ms (60/s, 30 Hz)", 2, 33),
            ("1 sample / 1000 ms (1/s)", 1, 1000),
        ] {
            let n = 120;
            let t0 = Instant::now();
            let mut target = sine_window(0, n);
            let mut tw: Option<CanvasTween> = None;
            let (mut worst, mut sum, mut count) = (0.0f32, 0.0f32, 0);
            for step in 1..=60u64 {
                let now = t0 + ms(step * tick_ms);
                let next = sine_window(step as usize * shift, n);
                let from = match &tw { Some(t) => t.sample(&target, now).0, None => target.clone() };
                // Updates arrive every tick: pace the glide by that cadence.
                let pace = adapt_pace(SPRING_PACE, if step > 1 { Some(tick_ms as f64) } else { None });
                let mut new = CanvasTween::between(from, &next, pace, now);
                if let (Some(n_), Some(o)) = (new.as_mut(), tw.as_ref()) { n_.inherit_velocity(&next, o, &target, now); }
                tw = new;
                target = next;
                let end = now + ms(tick_ms.saturating_sub(1));
                let shown = match &tw { Some(t) => t.sample(&target, end).0, None => target.clone() };
                if step > 20 { let e = y_error(&shown, &target); worst = worst.max(e); sum += e; count += 1; }
            }
            // The signal swings about 150; the drawing may lag by a small part of that,
            // not by half of it as a spring chasing a fast stream does.
            assert!(worst < 15.0, "{label}: drawing is {worst} from its data (mean {})", sum / count as f32);
        }
    }


    #[test]
    fn a_canvas_tween_moves_path_points_and_lands_exactly() {
        let (a, b) = (vec![line(0.0, 0.0)], vec![line(10.0, 40.0)]);
        let t0 = Instant::now();
        let tw = CanvasTween::between(a.clone(), &b, SPRING_PACE, t0).unwrap();
        assert!(tw.is_spring());
        let (mid, done) = tw.sample(&b, t0 + ms(80));
        assert!(!done);
        let (m, from, to) = (pts(&mid[0]), pts(&a[0]), pts(&b[0]));
        assert!(m.iter().zip(from.iter().zip(&to)).all(|(m, (f, t))| m > f && m < t || (f == t && m == f)), "partway between: {m:?}");
        let (end, done) = tw.sample(&b, t0 + ms(tw.duration_ms as u64 + 1));
        assert!(done);
        assert_eq!(end, b, "exactly the new draw once settled");
    }

    #[test]
    fn nothing_eases_when_the_two_draws_differ_in_shape_or_are_identical() {
        let t0 = Instant::now();
        let two = |a: CanvasCmd, b: CanvasCmd| CanvasTween::between(vec![a], &[b], SPRING_PACE, t0);
        assert!(two(line(0.0, 0.0), line(0.0, 0.0)).is_none(), "identical: nothing to do");
        assert!(two(line(0.0, 0.0), CanvasCmd::StrokePath { points: vec![0.0, 0.0, 5.0, 5.0], color: [0; 4], line_width: 1.0, closed: false }).is_none(),
                "another point count (a stream that grew)");
        assert!(two(rect(5.0, [0; 4]), CanvasCmd::FillCircle { cx: 0.0, cy: 0.0, r: 1.0, color: [0; 4] }).is_none(), "different command");
        assert!(CanvasTween::between(vec![rect(1.0, [0; 4])], &[rect(1.0, [0; 4]), rect(2.0, [0; 4])], SPRING_PACE, t0).is_none(), "another command count");
    }

    #[test]
    fn a_canvas_tween_blends_colour_and_text_keeps_the_new_words() {
        let t0 = Instant::now();
        let a = vec![rect(10.0, [0, 0, 0, 255]), CanvasCmd::FillText { text: "1.2k".into(), x: 0.0, y: 0.0, font_size: 12.0, color: [0; 4], bold: false }];
        let b = vec![rect(30.0, [200, 100, 50, 255]), CanvasCmd::FillText { text: "1.4k".into(), x: 20.0, y: 8.0, font_size: 12.0, color: [255; 4], bold: true }];
        let tw = CanvasTween::between(a, &b, Pace::Timed { ms: 1000, easing: Easing::Linear }, t0).unwrap();
        let (mid, _) = tw.sample(&b, t0 + ms(500));
        assert_eq!(mid[0], rect(20.0, [100, 50, 25, 255]), "width and colour halfway");
        match &mid[1] {
            CanvasCmd::FillText { text, x, y, bold, color, .. } => {
                assert_eq!((text.as_str(), *bold), ("1.4k", true), "the words come from the new draw");
                assert_eq!((*x, *y), (10.0, 4.0), "but the position moves");
                assert_eq!(color[0], 128);
            }
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn a_bouncy_canvas_tween_keeps_sizes_in_range() {
        let t0 = Instant::now();
        let bouncy = Pace::Spring(Spring::new(600.0, 6.0));
        let tw = CanvasTween::between(vec![rect(0.0, [0; 4])], &[rect(40.0, [9; 4])], bouncy, t0).unwrap();
        let to = [rect(40.0, [9; 4])];
        for t in (0..tw.duration_ms as u64).step_by(5) {
            match &tw.sample(&to, t0 + ms(t)).0[0] {
                CanvasCmd::FillRect { w, h, .. } => assert!(*w >= 0.0 && *h >= 0.0, "negative size at {t} ms"),
                other => panic!("{other:?}"),
            }
        }
    }

    #[test]
    fn a_canvas_retargeted_mid_flight_starts_from_what_was_on_screen() {
        let t0 = Instant::now();
        let (a, b, c) = (vec![line(0.0, 0.0)], vec![line(100.0, 0.0)], vec![line(0.0, 0.0)]);
        let tw = CanvasTween::between(a, &b, SPRING_PACE, t0).unwrap();
        let t1 = t0 + ms(90);
        let on_screen = tw.sample(&b, t1).0;
        let back = CanvasTween::between(on_screen.clone(), &c, SPRING_PACE, t1).unwrap();
        assert_eq!(back.sample(&c, t1).0, on_screen, "no jump at the instant of the retarget");
    }

    #[test]
    fn a_stream_of_updates_keeps_its_speed_instead_of_stopping_at_each_one() {
        // A window sliding left by 10px per update. Each update arrives while
        // the last is still moving.
        let t0 = Instant::now();
        let (w0, w1, w2) = (vec![line(0.0, 0.0)], vec![line(-10.0, 0.0)], vec![line(-20.0, 0.0)]);
        let first = CanvasTween::between(w0, &w1, SPRING_PACE, t0).unwrap();
        let t1 = t0 + ms(70);
        let cur = first.sample(&w1, t1).0;
        let mut second = CanvasTween::between(cur, &w2, SPRING_PACE, t1).unwrap();
        second.inherit_velocity(&w2, &first, &w1, t1);
        let mut from_rest = CanvasTween::between(first.sample(&w1, t1).0, &w2, SPRING_PACE, t1).unwrap();
        from_rest.spring = from_rest.spring.map(|s| Spring { v0: 0.0, ..s });

        let x = |tw: &CanvasTween, to: &[CanvasCmd], t: Instant| pts(&tw.sample(to, t).0[0])[0] as f64;
        let h = ms(1);
        let before = (x(&first, &w1, t1) - x(&first, &w1, t1 - h)) / 0.001;
        let after  = (x(&second, &w2, t1 + h) - x(&second, &w2, t1)) / 0.001;
        let rested = (x(&from_rest, &w2, t1 + h) - x(&from_rest, &w2, t1)) / 0.001;
        assert!(before < -10.0, "moving left: {before}");
        assert!((after - before).abs() < 0.35 * before.abs(), "speed carried across the update: {before} → {after}");
        assert!(rested.abs() < 0.2 * before.abs(), "without it, each update starts from rest: {rested}");
    }

    #[test]
    fn a_canvas_updated_faster_than_its_spring_settles_glides_at_the_update_rate() {
        let spring = Pace::Spring(Spring::new(300.0, 35.0));
        let settle = Spring::new(300.0, 35.0).settle_ms() as f64;
        // 20 updates a second: a linear glide over the 50 ms between them.
        assert_eq!(adapt_pace(spring, Some(50.0)), Pace::Timed { ms: 50, easing: Easing::Linear });
        // Even a fast hover sweep is never shorter than a frame.
        assert_eq!(adapt_pace(spring, Some(2.0)), Pace::Timed { ms: 16, easing: Easing::Linear });
        // Just under the settle time still counts as "too fast for the spring"...
        assert!(matches!(adapt_pace(spring, Some(settle * 0.8)), Pace::Timed { .. }));
        // ...but a slow feed (one update a second) and an unknown cadence keep the spring.
        assert_eq!(adapt_pace(spring, Some(1000.0)), spring);
        assert_eq!(adapt_pace(spring, None), spring);
    }

    #[test]
    fn an_explicit_duration_is_never_adapted() {
        let timed = Pace::Timed { ms: 300, easing: Easing::parse(Some("ease-in-out")) };
        assert_eq!(adapt_pace(timed, Some(20.0)), timed);
        assert_eq!(adapt_pace(timed, None), timed);
    }

    fn label(text: &str, x: f32) -> CanvasCmd {
        CanvasCmd::FillText { text: text.into(), x, y: 0.0, font_size: 11.0, color: [200; 4], bold: false }
    }
    fn grid(y: f32) -> CanvasCmd {
        CanvasCmd::StrokeLine { x0: 0.0, y0: y, x1: 100.0, y1: y, color: [255, 255, 255, 30], line_width: 1.0 }
    }

    #[test]
    fn a_draw_that_gains_an_axis_tick_still_eases_its_data() {
        // Auto-scaled axes change their tick count as the data moves. The whole
        // canvas used to snap when that happened; the data should still glide.
        let old = vec![grid(10.0), grid(20.0), label("20", 0.0), line(0.0, 0.0)];
        let new = vec![grid(10.0), grid(20.0), grid(30.0), label("0", 0.0), label("20", 0.0), line(10.0, 40.0)];
        let t0 = Instant::now();
        let tw = CanvasTween::between(old, &new, Pace::Timed { ms: 1000, easing: Easing::Linear }, t0)
            .expect("the data path lines up, so there is something to ease");
        let (mid, done) = tw.sample(&new, t0 + ms(500));
        assert!(!done);
        assert_eq!(mid.len(), new.len(), "it draws exactly the new commands");
        // The data path is halfway between its old and new points.
        let (want, got) = (pts(&new[5]), pts(&mid[5]));
        let from = pts(&line(0.0, 0.0));
        assert!(got.iter().zip(from.iter().zip(&want)).all(|(g, (f, w))| (g - (f + w) / 2.0).abs() < 1e-4), "{got:?}");
        // The tick and label that only the new draw has stand for themselves.
        assert_eq!(mid[2], new[2], "the new grid line appears at once");
        assert_eq!(mid[3], new[3], "the new label appears at once");
        // And it still lands exactly on the new draw.
        assert_eq!(tw.sample(&new, t0 + ms(1001)).0, new);
    }

    #[test]
    fn a_draw_that_loses_commands_eases_what_remains_and_drops_the_rest() {
        let old = vec![grid(10.0), grid(20.0), grid(30.0), line(0.0, 0.0)];
        let new = vec![grid(12.0), line(10.0, 40.0)];
        let t0 = Instant::now();
        let tw = CanvasTween::between(old, &new, Pace::Timed { ms: 1000, easing: Easing::Linear }, t0).unwrap();
        let (mid, _) = tw.sample(&new, t0 + ms(500));
        assert_eq!(mid.len(), 2);
        assert_ne!(mid[1], new[1], "the line is still on its way");
        assert!(matches!(mid[1], CanvasCmd::StrokePath { .. }));
    }

    #[test]
    fn matching_is_in_order_and_pairs_only_commands_that_can_ease() {
        // Nothing in the old draw can ease into anything in the new one.
        let t0 = Instant::now();
        let pace = Pace::Timed { ms: 100, easing: Easing::Linear };
        assert!(CanvasTween::between(vec![rect(5.0, [0; 4])], &[line(0.0, 0.0)], pace, t0).is_none());
        // A path with a different point count can't pair with the old path, so it just replaces it.
        let short = CanvasCmd::StrokePath { points: vec![0.0, 0.0, 5.0, 5.0], color: [0; 4], line_width: 1.0, closed: false };
        assert!(CanvasTween::between(vec![line(0.0, 0.0)], &[short], pace, t0).is_none());
        // Same shape, same content: nothing to do.
        assert!(CanvasTween::between(vec![grid(1.0), label("a", 0.0)], &[grid(1.0), label("a", 0.0)], pace, t0).is_none());
    }

    #[test]
    fn a_very_long_mismatched_draw_just_replaces_instead_of_costing_a_search() {
        let many = |n: usize| (0..n).map(|i| grid(i as f32)).collect::<Vec<_>>();
        let (a, b) = (many(600), many(700));
        assert!(align(&a, &b).is_none(), "600 x 700 commands is past the search cap");
        // The same-length fast path needs no search at any size.
        assert!(align(&many(2000), &many(2000)).is_some());
    }

    #[test]
    fn canvas_pace_comes_from_the_transition_props() {
        use glyx_runtime::bindings::NodeProps;
        assert!(Pace::from_props(&NodeProps::default()).is_none(), "no transition prop: instant, as before");
        assert!(matches!(Pace::from_props(&NodeProps { transition_stiffness: Some(200.0), ..Default::default() }), Some(Pace::Spring(_))));
        assert_eq!(Pace::from_props(&NodeProps { transition_ms: Some(300), transition_easing: Some("linear".into()), ..Default::default() }),
                   Some(Pace::Timed { ms: 300, easing: Easing::Linear }));
        let both = NodeProps { transition_ms: Some(300), transition_damping: Some(20.0), ..Default::default() };
        assert!(matches!(Pace::from_props(&both), Some(Pace::Spring(_))), "a spring wins over a duration");
    }

    #[test]
    fn spring_props_make_a_spring_and_default_the_missing_half() {
        use glyx_runtime::bindings::NodeProps;
        assert!(Spring::from_props(&NodeProps::default()).is_none(), "no spring props: a timed transition");
        let only_stiff = Spring::from_props(&NodeProps { transition_stiffness: Some(500.0), ..Default::default() }).unwrap();
        assert_eq!(only_stiff, Spring::new(500.0, Spring::DEFAULT_DAMPING));
        let only_damp = Spring::from_props(&NodeProps { transition_damping: Some(12.0), ..Default::default() }).unwrap();
        assert_eq!(only_damp, Spring::new(Spring::DEFAULT_STIFFNESS, 12.0));
    }
}
