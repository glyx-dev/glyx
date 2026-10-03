// Glyx patch: adaptive sizing of the bump-allocated GPU buffers.
// SPDX-License-Identifier: Apache-2.0 OR MIT

//! Adaptive sizing of Vello's bump-allocated scratch buffers.
//!
//! Upstream sizes the buffers that hold flattened lines, tiles, segments and
//! per-tile command lists with constants "hand picked to accommodate the vello test
//! scenes as well as paris-30k" (a map of 30,000 paths): about 165 MiB whatever is
//! drawn, which on an integrated GPU is real system memory. It has no way to notice
//! a scene that outgrows them either; the content is silently dropped.
//!
//! Here the capacities start small, are read back after the coarse pass (the GPU
//! reports how much each stage needed), and a pass that did not fit is discarded
//! before anything is drawn and run again with larger buffers. Capacities shrink
//! again when demand stays low for a while. All of this is plain arithmetic, kept
//! apart from the GPU code so it can be tested without a device.

use vello_encoding::{BufferSize, BumpAllocators, Layout, RenderConfig};

/// Element counts for the bump-allocated buffers.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct BumpCapacity {
    pub lines: u32,
    pub tiles: u32,
    pub seg_counts: u32,
    pub segments: u32,
    pub blend: u32,
    pub ptcl: u32,
    /// Binning data, not counting the per-scene prefix (`Layout::bin_data_start`).
    pub binning: u32,
}

impl BumpCapacity {
    /// Where every capacity starts: ~5 MiB in all. Enough for a plain window; busier
    /// scenes grow on their first frames.
    pub const FLOOR: Self = Self {
        lines: 1 << 16,
        tiles: 1 << 16,
        seg_counts: 1 << 16,
        segments: 1 << 16,
        blend: 1 << 12,
        ptcl: 1 << 18,
        binning: 1 << 15,
    };

    /// The most any buffer grows to. Twice what upstream always allocated, and
    /// still under wgpu's default 128 MiB limit for one storage binding
    /// (`lines` and `segments` are 24 bytes an element).
    pub const CEILING: Self = Self {
        lines: 1 << 22,
        tiles: 1 << 22,
        seg_counts: 1 << 22,
        segments: 1 << 22,
        blend: 1 << 21,
        ptcl: 1 << 24,
        binning: 1 << 20,
    };

    /// What upstream allocates for every scene (kept to report the saving).
    pub const UPSTREAM: Self = Self {
        lines: 1 << 21,
        tiles: 1 << 21,
        seg_counts: 1 << 21,
        segments: 1 << 21,
        blend: 1 << 20,
        ptcl: 1 << 23,
        binning: 1 << 18,
    };

    /// Bytes the buffers take at these capacities.
    pub fn bytes(&self) -> u64 {
        // Element sizes of the GPU structs: LineSoup 24, Tile 8, SegmentCount 8,
        // PathSegment 24, the rest u32.
        self.lines as u64 * 24
            + self.tiles as u64 * 8
            + self.seg_counts as u64 * 8
            + self.segments as u64 * 24
            + self.blend as u64 * 4
            + self.ptcl as u64 * 4
            + self.binning as u64 * 4
    }

    /// Write these capacities into a render configuration, both the buffer sizes
    /// the host allocates and the sizes the shaders check their allocations against
    /// (they must agree, or a stage would believe it has room it doesn't).
    pub fn apply(&self, cfg: &mut RenderConfig, layout: &Layout) {
        let sizes = &mut cfg.buffer_sizes;
        sizes.lines = BufferSize::new(self.lines);
        sizes.tiles = BufferSize::new(self.tiles);
        sizes.seg_counts = BufferSize::new(self.seg_counts);
        sizes.segments = BufferSize::new(self.segments);
        sizes.blend_spill = BufferSize::new(self.blend);
        sizes.ptcl = BufferSize::new(self.ptcl);
        sizes.bin_data = BufferSize::new(layout.bin_data_start + self.binning);
        let gpu = &mut cfg.gpu;
        gpu.lines_size = sizes.lines.len();
        gpu.tiles_size = sizes.tiles.len();
        gpu.seg_counts_size = sizes.seg_counts.len();
        gpu.segments_size = sizes.segments.len();
        gpu.blend_size = sizes.blend_spill.len();
        gpu.ptcl_size = sizes.ptcl.len();
        gpu.binning_size = sizes.bin_data.len() - layout.bin_data_start;
    }

    /// Whether a pass that reported `bump` did not fit in these buffers.
    pub fn overflowed(&self, bump: &BumpAllocators) -> bool {
        bump.failed != 0
            || bump.lines > self.lines
            || bump.tile > self.tiles
            || bump.seg_counts > self.seg_counts
            || bump.segments > self.segments
            || bump.blend > self.blend
            || bump.ptcl > self.ptcl
            || bump.binning > self.binning
    }

    /// Grow what `bump` shows did not fit (with 25% to spare, rounded up to a
    /// quarter step, never past `CEILING`). Returns whether anything grew, i.e.
    /// whether running the pass again can help.
    ///
    /// A stage that failed stops later stages from allocating, so their counts can
    /// under-report; running again with the earlier stage fixed reveals them, which
    /// is why the caller loops.
    pub fn grow_to_fit(&mut self, bump: &BumpAllocators) -> bool {
        self.grow_to_fit_with_headroom(bump, 25)
    }

    /// `grow_to_fit` with `headroom_percent` to spare instead of 25. A frame that
    /// was found to have overflowed only after it was drawn gets more, so the
    /// next frames do not cross the new limit straight away.
    pub fn grow_to_fit_with_headroom(&mut self, bump: &BumpAllocators, headroom_percent: u64) -> bool {
        let before = *self;
        let h = headroom_percent;
        self.lines = grow(self.lines, bump.lines, Self::CEILING.lines, h);
        self.tiles = grow(self.tiles, bump.tile, Self::CEILING.tiles, h);
        self.seg_counts = grow(self.seg_counts, bump.seg_counts, Self::CEILING.seg_counts, h);
        self.segments = grow(self.segments, bump.segments, Self::CEILING.segments, h);
        self.blend = grow(self.blend, bump.blend, Self::CEILING.blend, h);
        self.ptcl = grow(self.ptcl, bump.ptcl, Self::CEILING.ptcl, h);
        self.binning = grow(self.binning, bump.binning, Self::CEILING.binning, h);
        if *self == before && bump.failed != 0 {
            // Something failed without any count saying which: double everything.
            self.lines = (self.lines * 2).min(Self::CEILING.lines);
            self.tiles = (self.tiles * 2).min(Self::CEILING.tiles);
            self.seg_counts = (self.seg_counts * 2).min(Self::CEILING.seg_counts);
            self.segments = (self.segments * 2).min(Self::CEILING.segments);
            self.blend = (self.blend * 2).min(Self::CEILING.blend);
            self.ptcl = (self.ptcl * 2).min(Self::CEILING.ptcl);
            self.binning = (self.binning * 2).min(Self::CEILING.binning);
        }
        *self != before
    }

    /// Capacities that would hold `peak` with room to spare, never below `FLOOR`.
    fn fitting(peak: &Self) -> Self {
        let f = |p: u32, floor: u32, ceil: u32| grow(floor, p, ceil, 25);
        Self {
            lines: f(peak.lines, Self::FLOOR.lines, Self::CEILING.lines),
            tiles: f(peak.tiles, Self::FLOOR.tiles, Self::CEILING.tiles),
            seg_counts: f(peak.seg_counts, Self::FLOOR.seg_counts, Self::CEILING.seg_counts),
            segments: f(peak.segments, Self::FLOOR.segments, Self::CEILING.segments),
            blend: f(peak.blend, Self::FLOOR.blend, Self::CEILING.blend),
            ptcl: f(peak.ptcl, Self::FLOOR.ptcl, Self::CEILING.ptcl),
            binning: f(peak.binning, Self::FLOOR.binning, Self::CEILING.binning),
        }
    }
}

/// `x` rounded up to the next quarter step of its power-of-two range
/// (1, 1.25, 1.5, 1.75, 2 times the power below it): at most 25% over, where
/// rounding to a power of two can be nearly 100% over.
fn round_up_quarter(x: u64) -> u64 {
    if x <= 4 {
        return x;
    }
    let step = ((x.next_power_of_two() / 2) / 4).max(1);
    x.div_ceil(step) * step
}

/// `current`, or what `needed` requires with `headroom_percent` more, rounded up to
/// a quarter step, capped at `ceiling`.
fn grow(current: u32, needed: u32, ceiling: u32, headroom_percent: u64) -> u32 {
    if needed <= current {
        return current;
    }
    let want = round_up_quarter(needed as u64 * (100 + headroom_percent) / 100 + 1).min(ceiling as u64) as u32;
    want.max(current)
}

/// Frames between looks at whether the buffers are bigger than recent frames need.
const REVIEW_FRAMES: u32 = 240;
/// Shrink only when a buffer is at least this many times larger than the peak
/// demand over the window needs, so a scene that hovers near a size does not make
/// the buffers shrink and grow again.
const SHRINK_FACTOR: u32 = 4;

/// Remembers the largest demand over a window of frames, to shrink buffers a
/// busy scene grew once it has gone away.
#[derive(Default)]
pub struct DemandTracker {
    peak: Option<BumpCapacity>,
    frames: u32,
}

impl DemandTracker {
    /// Record one frame's demand (the counts of the pass that was drawn).
    pub fn record(&mut self, bump: &BumpAllocators) {
        let p = self.peak.get_or_insert(BumpCapacity {
            lines: 0, tiles: 0, seg_counts: 0, segments: 0, blend: 0, ptcl: 0, binning: 0,
        });
        p.lines = p.lines.max(bump.lines);
        p.tiles = p.tiles.max(bump.tile);
        p.seg_counts = p.seg_counts.max(bump.seg_counts);
        p.segments = p.segments.max(bump.segments);
        p.blend = p.blend.max(bump.blend);
        p.ptcl = p.ptcl.max(bump.ptcl);
        p.binning = p.binning.max(bump.binning);
        self.frames += 1;
    }

    /// At the end of each window: smaller capacities if the buffers are much
    /// larger than the window's peak demand needed, else `None`. Starts a new window.
    pub fn review(&mut self, current: &BumpCapacity) -> Option<BumpCapacity> {
        if self.frames < REVIEW_FRAMES {
            return None;
        }
        let peak = self.peak.take()?;
        self.frames = 0;
        let fit = BumpCapacity::fitting(&peak);
        let oversized = |cur: u32, fit: u32| cur / SHRINK_FACTOR >= fit;
        if !(oversized(current.lines, fit.lines)
            || oversized(current.tiles, fit.tiles)
            || oversized(current.seg_counts, fit.seg_counts)
            || oversized(current.segments, fit.segments)
            || oversized(current.blend, fit.blend)
            || oversized(current.ptcl, fit.ptcl)
            || oversized(current.binning, fit.binning))
        {
            return None;
        }
        // Shrink every buffer to what the window needed (they only ever go down here).
        Some(BumpCapacity {
            lines: current.lines.min(fit.lines),
            tiles: current.tiles.min(fit.tiles),
            seg_counts: current.seg_counts.min(fit.seg_counts),
            segments: current.segments.min(fit.segments),
            blend: current.blend.min(fit.blend),
            ptcl: current.ptcl.min(fit.ptcl),
            binning: current.binning.min(fit.binning),
        })
    }
}

/// A cheap measure of how much a scene asks of the GPU, from what the encoding
/// already counts: path segments (the flattened lines and tile segments follow
/// from them), paths, and clips. Not exact (the area a path covers is not in it),
/// which is why the counters are still read back.
pub fn scene_signature(e: &vello_encoding::Encoding) -> u64 {
    e.n_path_segments as u64 + 4 * e.n_paths as u64 + 4 * e.n_clips as u64
}

/// When a frame has to wait for its allocation counters before drawing.
///
/// Reading them back between the coarse and fine passes makes the CPU wait for the
/// GPU and costs several milliseconds a frame (measured: 7 -> 11-15 ms for a
/// dashboard on an integrated GPU). So a frame normally draws in one pass, and its
/// counters are checked one frame later without waiting. A frame waits only when
/// overflowing is likely: the first one, a new output size, a scene noticeably bigger
/// than the last whose counters were seen, or right after a late check found a
/// frame that did not fit.
#[derive(Default)]
pub struct SyncPolicy {
    /// Signature of the largest scene whose counters have been seen this window.
    anchor: u64,
    last_size: Option<(u32, u32)>,
    force: bool,
    frames: u32,
}

/// A scene may be this much bigger (in percent) than the one last measured before
/// a frame waits for its counters.
const SYNC_GROWTH_PERCENT: u64 = 25;

impl SyncPolicy {
    /// Whether the frame with this scene signature and output size must read its
    /// counters before drawing.
    pub fn needs_sync(&mut self, sig: u64, size: (u32, u32)) -> bool {
        let resized = self.last_size != Some(size);
        self.last_size = Some(size);
        self.force
            || resized
            || self.anchor == 0
            || sig > self.anchor + self.anchor * SYNC_GROWTH_PERCENT / 100
    }

    /// The counters of a frame with signature `sig` have been seen (while waiting
    /// for them, or a frame late).
    pub fn measured(&mut self, sig: u64) {
        self.anchor = self.anchor.max(sig);
    }

    /// Call once per frame drawn. `waited` says the frame waited for its counters,
    /// which settles a forced wait. Once a window of frames has passed the anchor
    /// is forgotten, so it follows a scene that got smaller.
    pub fn frame_drawn(&mut self, sig: u64, waited: bool) {
        if waited {
            self.force = false;
        }
        self.frames += 1;
        if self.frames >= REVIEW_FRAMES {
            self.frames = 0;
            self.anchor = sig;
        }
    }

    /// A late check found the buffers too small: the next frame waits.
    pub fn force_next_sync(&mut self) {
        self.force = true;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use peniko::Color;

    fn bump(lines: u32, tile: u32, seg_counts: u32, segments: u32, blend: u32, ptcl: u32, binning: u32) -> BumpAllocators {
        BumpAllocators { failed: 0, binning, ptcl, tile, seg_counts, segments, blend, lines }
    }

    #[test]
    fn the_floor_is_a_small_fraction_of_what_upstream_always_allocated() {
        let (floor, upstream) = (BumpCapacity::FLOOR.bytes(), BumpCapacity::UPSTREAM.bytes());
        assert!(floor < 6 * 1024 * 1024, "{floor} bytes");
        assert!(upstream > 160 * 1024 * 1024, "{upstream} bytes");
        assert!(floor * 25 < upstream);
    }

    #[test]
    fn the_ceiling_fits_one_storage_binding_and_stays_above_what_upstream_had() {
        const LIMIT: u64 = 128 * 1024 * 1024; // wgpu's default max_storage_buffer_binding_size
        let c = BumpCapacity::CEILING;
        for (name, bytes) in [("lines", c.lines as u64 * 24), ("segments", c.segments as u64 * 24), ("ptcl", c.ptcl as u64 * 4), ("tiles", c.tiles as u64 * 8)] {
            assert!(bytes <= LIMIT, "{name} is {bytes} bytes");
        }
        let u = BumpCapacity::UPSTREAM;
        assert!(c.lines >= u.lines && c.segments >= u.segments && c.ptcl >= u.ptcl && c.tiles >= u.tiles);
    }

    #[test]
    fn applying_a_capacity_keeps_the_host_buffers_and_the_shader_limits_in_agreement() {
        let layout = Layout::new();
        let mut cfg = RenderConfig::new(&layout, 1280, 800, &Color::BLACK);
        let cap = BumpCapacity { lines: 100_000, tiles: 70_000, seg_counts: 80_000, segments: 90_000, blend: 5000, ptcl: 300_000, binning: 40_000 };
        cap.apply(&mut cfg, &layout);
        assert_eq!(cfg.buffer_sizes.lines.len(), 100_000);
        assert_eq!(cfg.gpu.lines_size, 100_000);
        assert_eq!(cfg.gpu.tiles_size, 70_000);
        assert_eq!(cfg.gpu.seg_counts_size, 80_000);
        assert_eq!(cfg.gpu.segments_size, 90_000);
        assert_eq!(cfg.gpu.blend_size, 5000);
        assert_eq!(cfg.gpu.ptcl_size, 300_000);
        assert_eq!(cfg.gpu.binning_size, 40_000);
        // The binning buffer holds the scene's prefix and then the binning data.
        assert_eq!(cfg.buffer_sizes.bin_data.len(), layout.bin_data_start + 40_000);
    }

    #[test]
    fn a_pass_that_fits_is_left_alone() {
        let c = BumpCapacity::FLOOR;
        let b = bump(1000, 500, 800, 900, 10, 5000, 300);
        assert!(!c.overflowed(&b));
        let mut c2 = c;
        assert!(!c2.grow_to_fit(&b));
        assert_eq!(c2, c);
    }

    #[test]
    fn an_overflow_is_detected_from_a_count_or_from_the_failed_flag() {
        let c = BumpCapacity::FLOOR;
        assert!(c.overflowed(&bump(c.lines + 1, 0, 0, 0, 0, 0, 0)));
        assert!(c.overflowed(&bump(0, 0, 0, 0, 0, c.ptcl + 1, 0)));
        let mut failed = bump(0, 0, 0, 0, 0, 0, 0);
        failed.failed = 4;
        assert!(c.overflowed(&failed));
    }

    #[test]
    fn growing_makes_room_with_headroom_and_only_where_needed() {
        let mut c = BumpCapacity::FLOOR;
        let b = bump(100_000, 10, 10, 10, 10, 10, 10);
        assert!(c.grow_to_fit(&b));
        // 25% headroom (125,000), rounded up by at most another 25%.
        assert!(c.lines >= 125_000 && c.lines <= 125_000 * 5 / 4 + 1, "{}", c.lines);
        assert_eq!(c.tiles, BumpCapacity::FLOOR.tiles, "untouched buffers stay small");
        assert!(!c.overflowed(&b));
    }

    #[test]
    fn rounding_up_never_overshoots_by_more_than_a_quarter() {
        for x in [5u64, 100, 4097, 65_537, 100_000, 524_289, 3_000_001, u32::MAX as u64 / 2] {
            let r = round_up_quarter(x);
            assert!(r >= x && r * 4 <= x * 5 + 4, "{x} -> {r}");
        }
        assert_eq!(round_up_quarter(1 << 20), 1 << 20, "a power of two stays put");
        assert_eq!(round_up_quarter((1 << 20) + 1), (1 << 20) + (1 << 18));
    }

    #[test]
    fn growth_stops_at_the_ceiling() {
        let mut c = BumpCapacity::FLOOR;
        let huge = bump(u32::MAX / 2, u32::MAX / 2, u32::MAX / 2, u32::MAX / 2, u32::MAX / 2, u32::MAX / 2, u32::MAX / 2);
        assert!(c.grow_to_fit(&huge));
        assert_eq!(c, BumpCapacity::CEILING);
        // Nothing more to give: the caller must stop retrying.
        assert!(!c.grow_to_fit(&huge));
    }

    #[test]
    fn a_failure_with_no_count_to_blame_doubles_everything() {
        let mut c = BumpCapacity::FLOOR;
        let mut b = bump(0, 0, 0, 0, 0, 0, 0);
        b.failed = 1;
        assert!(c.grow_to_fit(&b));
        assert_eq!(c.lines, BumpCapacity::FLOOR.lines * 2);
        assert_eq!(c.ptcl, BumpCapacity::FLOOR.ptcl * 2);
    }

    #[test]
    fn buffers_shrink_after_a_window_of_low_demand_and_not_before() {
        let big = BumpCapacity { lines: 1 << 20, tiles: 1 << 20, seg_counts: 1 << 20, segments: 1 << 20, blend: 1 << 16, ptcl: 1 << 22, binning: 1 << 18 };
        let mut t = DemandTracker::default();
        let small = bump(2000, 1000, 1000, 1500, 10, 8000, 400);
        for _ in 0..REVIEW_FRAMES - 1 {
            t.record(&small);
            assert!(t.review(&big).is_none(), "the window is not over");
        }
        t.record(&small);
        let shrunk = t.review(&big).expect("the window is over and demand was far below capacity");
        assert!(shrunk.lines < big.lines && shrunk.ptcl < big.ptcl);
        assert!(shrunk.lines >= BumpCapacity::FLOOR.lines, "never below the floor");
        assert!(!shrunk.overflowed(&small));
    }

    #[test]
    fn a_busy_moment_in_the_window_keeps_the_buffers_large() {
        let big = BumpCapacity { lines: 1 << 20, tiles: 1 << 20, seg_counts: 1 << 20, segments: 1 << 20, blend: 1 << 16, ptcl: 1 << 22, binning: 1 << 18 };
        let mut t = DemandTracker::default();
        let busy = bump(900_000, 900_000, 900_000, 900_000, 60_000, 4_000_000, 250_000);
        t.record(&busy);
        for _ in 0..REVIEW_FRAMES {
            t.record(&bump(10, 10, 10, 10, 1, 10, 10));
        }
        assert!(t.review(&big).is_none(), "one near-capacity frame in the window means no shrinking");
    }

    #[test]
    fn a_scene_hovering_near_a_size_does_not_make_the_buffers_thrash() {
        // Within 4x of the capacity: not oversized.
        let cap = BumpCapacity { lines: 1 << 18, ..BumpCapacity::FLOOR };
        let mut t = DemandTracker::default();
        for _ in 0..REVIEW_FRAMES { t.record(&bump(100_000, 10, 10, 10, 1, 10, 10)); }
        assert!(t.review(&cap).is_none());
    }

    #[test]
    fn the_first_frame_waits_then_a_steady_scene_never_does() {
        let mut p = SyncPolicy::default();
        assert!(p.needs_sync(1000, (1280, 800)), "nothing measured yet");
        p.measured(1000);
        p.frame_drawn(1000, true);
        for _ in 0..100 {
            assert!(!p.needs_sync(1000, (1280, 800)));
            p.frame_drawn(1000, false);
        }
    }

    #[test]
    fn a_new_size_or_a_bigger_scene_waits() {
        let mut p = SyncPolicy::default();
        p.needs_sync(1000, (1280, 800));
        p.measured(1000);
        assert!(!p.needs_sync(1100, (1280, 800)), "10% bigger is within the margin");
        assert!(p.needs_sync(1100, (1920, 1080)), "a resize waits");
        assert!(!p.needs_sync(1100, (1920, 1080)), "and only once");
        assert!(p.needs_sync(1300, (1920, 1080)), "30% bigger than the last measured scene waits");
    }

    #[test]
    fn a_scene_cannot_creep_past_the_margin_without_ever_waiting() {
        // Each frame is only 20% bigger than the last, but nothing has been measured
        // since the first: the comparison is with the measured scene, not the last frame.
        let mut p = SyncPolicy::default();
        p.needs_sync(1000, (1, 1));
        p.measured(1000);
        let mut waited = false;
        let mut sig = 1000u64;
        for _ in 0..4 {
            sig = sig * 12 / 10;
            if p.needs_sync(sig, (1, 1)) { waited = true; break; }
            p.frame_drawn(sig, false);
        }
        assert!(waited, "four 20% steps is 2x the measured scene; some frame must have waited");
    }

    #[test]
    fn a_late_overflow_makes_the_next_frame_wait_once() {
        let mut p = SyncPolicy::default();
        p.needs_sync(1000, (1, 1));
        p.measured(1000);
        assert!(!p.needs_sync(1000, (1, 1)));
        p.force_next_sync();
        assert!(p.needs_sync(1000, (1, 1)));
        p.frame_drawn(1000, true);
        assert!(!p.needs_sync(1000, (1, 1)));
    }

    #[test]
    fn the_anchor_follows_a_scene_that_got_smaller() {
        let mut p = SyncPolicy::default();
        p.needs_sync(10_000, (1, 1));
        p.measured(10_000);
        for _ in 0..REVIEW_FRAMES { p.frame_drawn(500, false); }
        // After a window of small scenes, a scene of 700 is a jump from 500, not a drop from 10,000.
        assert!(p.needs_sync(700, (1, 1)));
    }

    #[test]
    fn a_late_overflow_gets_extra_headroom() {
        let b = bump(100_000, 10, 10, 10, 10, 10, 10);
        let (mut a, mut d) = (BumpCapacity::FLOOR, BumpCapacity::FLOOR);
        a.grow_to_fit(&b);
        d.grow_to_fit_with_headroom(&b, 100);
        assert!(d.lines > a.lines);
        assert!(d.lines >= 200_000);
    }
}
