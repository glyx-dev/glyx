//! The set of rectangles a partial redraw repaints.
//!
//! A frame used to repaint one bounding box around everything that changed. Two
//! small changes far apart (a chart's crosshair and the tooltip card lagging
//! behind it on its spring) then cost everything between them. A frame now
//! repaints a short list of rectangles instead, merged so that no rectangle is
//! worth splitting: see [`coalesce`].

/// `(x, y, w, h)` in window pixels.
pub(crate) type Rect = (f64, f64, f64, f64);

/// Most rectangles a frame repaints. More than this and the extra bookkeeping
/// (a clip test per rect on every draw) outweighs the pixels saved, so the
/// closest ones are merged until it fits.
pub(crate) const MAX_RECTS: usize = 8;

/// Two rects merge when the box around them is at most this much bigger than
/// the two together: what a merge wastes is cheaper than another rect to clip
/// against.
const MERGE_WASTE: f64 = 1.25;

/// Rects this small always merge with a neighbour that is nearly as close: the
/// per-rect overhead beats a few hundred pixels.
const TINY_AREA: f64 = 1500.0;

fn area(r: Rect) -> f64 { r.2.max(0.0) * r.3.max(0.0) }

fn union(a: Rect, b: Rect) -> Rect {
    let (l, t) = (a.0.min(b.0), a.1.min(b.1));
    let (r, bt) = ((a.0 + a.2).max(b.0 + b.2), (a.1 + a.3).max(b.1 + b.3));
    (l, t, r - l, bt - t)
}

fn overlaps(a: Rect, b: Rect) -> bool {
    a.0 < b.0 + b.2 && b.0 < a.0 + a.2 && a.1 < b.1 + b.3 && b.1 < a.1 + a.3
}

/// The smallest rect holding all of `rects` (`None` when there are none).
pub(crate) fn bounds(rects: &[Rect]) -> Option<Rect> {
    rects.iter().copied().reduce(union)
}

/// Total pixels covered, counting each rect once (the rects from [`coalesce`]
/// never overlap).
pub(crate) fn total_area(rects: &[Rect]) -> f64 {
    rects.iter().map(|r| area(*r)).sum()
}

/// `GLYX_SINGLE_DAMAGE_RECT=1` repaints one box around everything that changed,
/// as before several rects were supported: for ruling multi-rect repaint out
/// when something looks stale, and for comparing the two.
fn single_rect_forced() -> bool {
    static ON: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *ON.get_or_init(|| std::env::var_os("GLYX_SINGLE_DAMAGE_RECT").is_some())
}

/// Merge `rects` into a short list of disjoint rectangles covering all of them.
///
/// Overlapping rects always merge (so the result never overlaps itself, which
/// the renderer relies on). Otherwise two merge when the box around them wastes
/// little (`MERGE_WASTE`), or when both are tiny. If more than `MAX_RECTS`
/// remain, the pair whose merge wastes least is merged until it fits, so many
/// scattered changes degrade to fewer, larger rects and finally to one.
pub(crate) fn coalesce(mut rects: Vec<Rect>) -> Vec<Rect> {
    if single_rect_forced() {
        return bounds(&rects).filter(|r| r.2 > 0.0 && r.3 > 0.0).into_iter().collect();
    }
    rects.retain(|r| r.2 > 0.0 && r.3 > 0.0 && r.0.is_finite() && r.1.is_finite() && r.2.is_finite() && r.3.is_finite());
    loop {
        let mut merged = None;
        'search: for i in 0..rects.len() {
            for j in i + 1..rects.len() {
                let (a, b) = (rects[i], rects[j]);
                let u = union(a, b);
                let together = area(a) + area(b);
                let cheap = area(u) <= together * MERGE_WASTE || (area(a) < TINY_AREA && area(b) < TINY_AREA);
                if overlaps(a, b) || cheap {
                    merged = Some((i, j, u));
                    break 'search;
                }
            }
        }
        match merged {
            Some((i, j, u)) => { rects[i] = u; rects.swap_remove(j); }
            None => break,
        }
    }
    if rects.len() > MAX_RECTS {
        let mut best = (0, 1, f64::INFINITY);
        for i in 0..rects.len() {
            for j in i + 1..rects.len() {
                let waste = area(union(rects[i], rects[j])) - area(rects[i]) - area(rects[j]);
                if waste < best.2 { best = (i, j, waste); }
            }
        }
        rects[best.0] = union(rects[best.0], rects[best.1]);
        rects.swap_remove(best.1);
        // The bigger box may now overlap another; keep the list disjoint.
        return coalesce(rects);
    }
    rects
}

#[cfg(test)]
mod tests {
    use super::*;

    fn disjoint(rs: &[Rect]) -> bool {
        (0..rs.len()).all(|i| (i + 1..rs.len()).all(|j| !overlaps(rs[i], rs[j])))
    }

    #[test]
    fn nothing_in_nothing_out_and_empty_rects_are_dropped() {
        assert!(coalesce(vec![]).is_empty());
        assert!(coalesce(vec![(5.0, 5.0, 0.0, 10.0), (1.0, 1.0, 10.0, -2.0), (f64::NAN, 0.0, 4.0, 4.0)]).is_empty());
    }

    #[test]
    fn overlapping_rects_become_one() {
        let out = coalesce(vec![(0.0, 0.0, 100.0, 100.0), (50.0, 50.0, 100.0, 100.0)]);
        assert_eq!(out, vec![(0.0, 0.0, 150.0, 150.0)]);
    }

    #[test]
    fn far_apart_rects_stay_apart() {
        // A narrow strip and a card well away from it: the box around both would
        // repaint ~10x more than they cover.
        let strip = (400.0, 0.0, 16.0, 200.0);
        let card = (40.0, 20.0, 120.0, 90.0);
        let out = coalesce(vec![strip, card]);
        assert_eq!(out.len(), 2);
        assert!(out.contains(&strip) && out.contains(&card));
        assert!(total_area(&out) < area(union(strip, card)) / 3.0);
    }

    #[test]
    fn rects_that_nearly_fill_their_box_merge() {
        // Side by side: the box around them is exactly their area.
        let out = coalesce(vec![(0.0, 0.0, 100.0, 100.0), (100.0, 0.0, 100.0, 100.0)]);
        assert_eq!(out, vec![(0.0, 0.0, 200.0, 100.0)]);
    }

    #[test]
    fn tiny_neighbours_merge_even_when_the_box_is_mostly_empty() {
        let out = coalesce(vec![(0.0, 0.0, 10.0, 10.0), (200.0, 0.0, 10.0, 10.0)]);
        assert_eq!(out.len(), 1);
    }

    #[test]
    fn many_scattered_rects_are_capped_and_stay_disjoint() {
        let rects: Vec<Rect> = (0..30).map(|i| ((i * 97 % 900) as f64, (i * 53 % 600) as f64, 60.0, 60.0)).collect();
        let out = coalesce(rects.clone());
        assert!(out.len() <= MAX_RECTS, "{} rects", out.len());
        assert!(disjoint(&out));
        // Every input is still covered.
        for r in rects {
            assert!(out.iter().any(|o| o.0 <= r.0 && o.1 <= r.1 && o.0 + o.2 >= r.0 + r.2 && o.1 + o.3 >= r.1 + r.3), "{r:?} lost");
        }
    }

    #[test]
    fn the_result_always_covers_the_input_and_never_overlaps() {
        // A small deterministic property test over random-ish layouts.
        let mut s = 12345u64;
        let mut next = move |m: u64| { s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); (s >> 33) % m };
        for _ in 0..300 {
            let n = 1 + next(12) as usize;
            let rects: Vec<Rect> = (0..n)
                .map(|_| (next(800) as f64, next(500) as f64, 1.0 + next(250) as f64, 1.0 + next(200) as f64))
                .collect();
            let out = coalesce(rects.clone());
            assert!(out.len() <= MAX_RECTS && disjoint(&out));
            for r in &rects {
                // Covered by the union of the output: sample the corners and centre.
                for (px, py) in [(r.0 + 0.01, r.1 + 0.01), (r.0 + r.2 - 0.01, r.1 + r.3 - 0.01), (r.0 + r.2 / 2.0, r.1 + r.3 / 2.0)] {
                    assert!(out.iter().any(|o| px >= o.0 && px <= o.0 + o.2 && py >= o.1 && py <= o.1 + o.3), "{r:?} not covered");
                }
            }
        }
    }

    #[test]
    fn bounds_is_the_box_around_everything() {
        assert_eq!(bounds(&[(10.0, 10.0, 5.0, 5.0), (100.0, 50.0, 10.0, 10.0)]), Some((10.0, 10.0, 100.0, 50.0)));
        assert_eq!(bounds(&[]), None);
    }
}
