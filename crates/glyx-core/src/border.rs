//! Border geometry: rounded-rectangle contours and the four per-side bands.
//!
//! The renderer backends already fill and stroke flat point lists, so the
//! geometry for per-side widths/colours and per-corner radii stays here and
//! no backend needs a new primitive. Uniform borders keep their old
//! `stroke_rounded_rect` fast path in `render.rs`; this module only runs when
//! the sides or corners differ.

use smallvec::SmallVec;

pub(crate) type Contour = SmallVec<[f32; 64]>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum BorderSide {
    Top,
    Right,
    Bottom,
    Left,
}

impl BorderSide {
    pub(crate) const ALL: [BorderSide; 4] = [
        BorderSide::Top,
        BorderSide::Right,
        BorderSide::Bottom,
        BorderSide::Left,
    ];

    pub(crate) fn index(self) -> usize {
        match self {
            BorderSide::Top => 0,
            BorderSide::Right => 1,
            BorderSide::Bottom => 2,
            BorderSide::Left => 3,
        }
    }
}

/// The full rounded outline, clockwise, from the left edge of the top-left
/// corner. Used for per-corner radii on backgrounds, shadows, images and
/// clip layers.
pub(crate) fn rounded_rect_contour(
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    radii: [f64; 4],
) -> Contour {
    let mut out = Contour::new();
    if w <= 0.0 || h <= 0.0 {
        return out;
    }
    let r = clamp_radii(w, h, radii);
    // TL, TR, BR, BL, clockwise.
    push_arc(&mut out, x + r[0], y + r[0], r[0], 180.0, 270.0, true);
    push_arc(&mut out, x + w - r[1], y + r[1], r[1], 270.0, 360.0, true);
    push_arc(&mut out, x + w - r[2], y + h - r[2], r[2], 0.0, 90.0, true);
    push_arc(&mut out, x + r[3], y + h - r[3], r[3], 90.0, 180.0, true);
    out
}

/// One side's band: the outer rounded edge and the inner rounded edge,
/// joined by the diagonals where the two neighbouring side colours meet.
pub(crate) fn side_contour(
    side: BorderSide,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    widths: [f64; 4],
    radii: [f64; 4],
) -> Contour {
    let mut out = Contour::new();
    if w <= 0.0 || h <= 0.0 {
        return out;
    }
    let widths = clamp_widths(w, h, widths);
    if widths[side.index()] <= 0.0 {
        return out;
    }
    let radii = clamp_radii(w, h, radii);
    let inner_radii = inner_radii(w, h, widths, radii);
    let outer = outer_corners(x, y, w, h, radii);
    let inner = inner_corners(x, y, w, h, widths, inner_radii);
    let angles = corner_angles(widths);

    let (start, end, mid, a_start, a_end) = match side {
        BorderSide::Top => (0, 1, 270.0, angles[0], angles[1]),
        BorderSide::Right => (1, 2, 360.0, angles[1], angles[2]),
        BorderSide::Bottom => (2, 3, 90.0, angles[2], angles[3]),
        BorderSide::Left => (3, 0, 180.0, angles[3], angles[0]),
    };

    // Outer edge, clockwise.
    push_arc(&mut out, outer[start].0, outer[start].1, outer[start].2, a_start, mid, true);
    push_arc(&mut out, outer[end].0, outer[end].1, outer[end].2, mid, a_end, true);
    // Inner edge, back the other way.
    push_arc(&mut out, inner[end].0, inner[end].1, inner[end].2, a_end, mid, false);
    push_arc(&mut out, inner[start].0, inner[start].1, inner[start].2, mid, a_start, false);
    out
}

pub(crate) fn widths_are_uniform(widths: [f64; 4]) -> bool {
    widths.iter().all(|w| (*w - widths[0]).abs() < 1e-4)
}

pub(crate) fn radii_are_uniform(radii: [f64; 4]) -> bool {
    radii.iter().all(|r| (*r - radii[0]).abs() < 1e-4)
}

fn outer_corners(x: f64, y: f64, w: f64, h: f64, r: [f64; 4]) -> [(f64, f64, f64); 4] {
    [
        (x + r[0], y + r[0], r[0]),
        (x + w - r[1], y + r[1], r[1]),
        (x + w - r[2], y + h - r[2], r[2]),
        (x + r[3], y + h - r[3], r[3]),
    ]
}

fn inner_corners(
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    widths: [f64; 4],
    r: [f64; 4],
) -> [(f64, f64, f64); 4] {
    let [top, right, bottom, left] = widths;
    [
        (x + left + r[0], y + top + r[0], r[0]),
        (x + w - right - r[1], y + top + r[1], r[1]),
        (x + w - right - r[2], y + h - bottom - r[2], r[2]),
        (x + left + r[3], y + h - bottom - r[3], r[3]),
    ]
}

/// The angle where two neighbouring side colours meet at each corner
/// (TL, TR, BR, BL), in degrees. Equal widths cut at 45 degrees; a zero-width
/// side lets the other one wrap the whole corner, so there is no gap.
fn corner_angles(widths: [f64; 4]) -> [f64; 4] {
    let [top, right, bottom, left] = widths;
    [
        180.0 + left.atan2(top).to_degrees(),
        270.0 + top.atan2(right).to_degrees(),
        right.atan2(bottom).to_degrees(),
        90.0 + bottom.atan2(left).to_degrees(),
    ]
}

fn inner_radii(w: f64, h: f64, widths: [f64; 4], radii: [f64; 4]) -> [f64; 4] {
    let [top, right, bottom, left] = widths;
    let raw = [
        (radii[0] - top.max(left)).max(0.0),
        (radii[1] - top.max(right)).max(0.0),
        (radii[2] - bottom.max(right)).max(0.0),
        (radii[3] - bottom.max(left)).max(0.0),
    ];
    clamp_radii((w - left - right).max(0.0), (h - top - bottom).max(0.0), raw)
}

fn clamp_radii(w: f64, h: f64, radii: [f64; 4]) -> [f64; 4] {
    let max = (w.min(h) * 0.5).max(0.0);
    radii.map(|r| if r.is_finite() { r.max(0.0).min(max) } else { 0.0 })
}

fn clamp_widths(w: f64, h: f64, widths: [f64; 4]) -> [f64; 4] {
    let mut out = widths.map(|v| if v.is_finite() { v.max(0.0) } else { 0.0 });
    let (top, bottom) = fit_pair(out[0], out[2], h.max(0.0));
    let (left, right) = fit_pair(out[3], out[1], w.max(0.0));
    out[0] = top;
    out[1] = right;
    out[2] = bottom;
    out[3] = left;
    out
}

fn fit_pair(a: f64, b: f64, limit: f64) -> (f64, f64) {
    let sum = a + b;
    if sum > limit && sum > 0.0 {
        let scale = limit / sum;
        (a * scale, b * scale)
    } else {
        (a, b)
    }
}

fn arc_segments(radius: f64) -> f64 {
    (radius * 0.8).ceil().clamp(4.0, 32.0)
}

/// Append one arc. `clockwise` decides which way a wrapped span goes; a
/// zero-radius corner contributes its centre once, which is exactly the
/// square corner point.
fn push_arc(
    out: &mut Contour,
    cx: f64,
    cy: f64,
    radius: f64,
    start: f64,
    end: f64,
    clockwise: bool,
) {
    if radius <= 0.0 {
        push_point(out, cx, cy);
        return;
    }
    let a0 = start;
    let mut a1 = end;
    if clockwise {
        while a1 < a0 {
            a1 += 360.0;
        }
    } else {
        while a1 > a0 {
            a1 -= 360.0;
        }
    }
    let span = (a1 - a0).abs();
    if span < 1e-6 {
        push_point(out, cx + radius * a0.to_radians().cos(), cy + radius * a0.to_radians().sin());
        return;
    }
    let steps = ((span / 90.0) * arc_segments(radius)).ceil().max(1.0) as usize;
    for i in 0..=steps {
        let t = i as f64 / steps as f64;
        let a = a0 + (a1 - a0) * t;
        push_point(out, cx + radius * a.to_radians().cos(), cy + radius * a.to_radians().sin());
    }
}

fn push_point(out: &mut Contour, x: f64, y: f64) {
    let x = x as f32;
    let y = y as f32;
    if out.len() >= 2 {
        let n = out.len();
        if (out[n - 2] - x).abs() < 1e-4 && (out[n - 1] - y).abs() < 1e-4 {
            return;
        }
    }
    out.push(x);
    out.push(y);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approx(a: f32, b: f32) -> bool {
        (a - b).abs() < 0.01
    }

    #[test]
    fn equal_widths_split_each_corner_at_45_degrees() {
        let angles = corner_angles([2.0, 2.0, 2.0, 2.0]);
        assert!(approx(angles[0] as f32, 225.0));
        assert!(approx(angles[1] as f32, 315.0));
        assert!(approx(angles[2] as f32, 45.0));
        assert!(approx(angles[3] as f32, 135.0));
    }

    #[test]
    fn a_zero_width_side_lets_the_other_wrap_the_corner() {
        // Top only: the top band owns the whole top-left and top-right corners.
        let angles = corner_angles([1.0, 0.0, 0.0, 0.0]);
        assert!(approx(angles[0] as f32, 180.0));
        assert!(approx(angles[1] as f32, 360.0));
    }

    #[test]
    fn widths_that_do_not_fit_shrink_proportionally() {
        let w = clamp_widths(10.0, 10.0, [8.0, 8.0, 8.0, 8.0]);
        assert!(approx((w[0] + w[2]) as f32, 10.0));
        assert!(approx((w[1] + w[3]) as f32, 10.0));
        assert!(approx(w[0] as f32, 5.0));
    }

    #[test]
    fn inner_radius_never_goes_negative() {
        let inner = inner_radii(100.0, 100.0, [10.0, 10.0, 10.0, 10.0], [4.0, 4.0, 4.0, 4.0]);
        assert_eq!(inner, [0.0, 0.0, 0.0, 0.0]);
    }

    #[test]
    fn rounded_contour_stays_in_bounds_and_has_four_sides() {
        let c = rounded_rect_contour(10.0, 20.0, 100.0, 60.0, [8.0, 12.0, 4.0, 0.0]);
        assert!(c.len() >= 8);
        for p in c.chunks_exact(2) {
            assert!(p[0] >= 9.99 && p[0] <= 110.01, "{p:?}");
            assert!(p[1] >= 19.99 && p[1] <= 80.01, "{p:?}");
        }
    }

    #[test]
    fn a_top_only_border_wraps_both_top_corners() {
        let c = side_contour(BorderSide::Top, 0.0, 0.0, 100.0, 40.0, [2.0, 0.0, 0.0, 0.0], [8.0; 4]);
        // Outer arc starts at the left edge of the top-left corner and ends
        // at the right edge of the top-right corner.
        assert!(c.len() >= 6);
        let xs: Vec<f32> = c.chunks_exact(2).map(|p| p[0]).collect();
        let ys: Vec<f32> = c.chunks_exact(2).map(|p| p[1]).collect();
        assert!(xs.iter().any(|x| approx(*x, 0.0)), "reaches the left edge: {xs:?}");
        assert!(xs.iter().any(|x| approx(*x, 100.0)), "reaches the right edge: {xs:?}");
        assert!(ys.iter().all(|y| *y >= -0.01 && *y <= 40.01), "{ys:?}");
    }

    #[test]
    fn a_left_only_border_wraps_both_left_corners() {
        let c = side_contour(BorderSide::Left, 0.0, 0.0, 100.0, 40.0, [0.0, 0.0, 0.0, 2.0], [8.0; 4]);
        assert!(c.len() >= 6);
        let ys: Vec<f32> = c.chunks_exact(2).map(|p| p[1]).collect();
        assert!(ys.iter().any(|y| approx(*y, 0.0)), "reaches the top edge: {ys:?}");
        assert!(ys.iter().any(|y| approx(*y, 40.0)), "reaches the bottom edge: {ys:?}");
    }
}
