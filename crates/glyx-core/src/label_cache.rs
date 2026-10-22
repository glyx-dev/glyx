//! The shaped-label cache, which sizes itself.
//!
//! Every `Text` node and every canvas `fillText` string is shaped once (about 7 us for a short string) and kept
//! here. A view that shows more distinct strings than the cache holds (a big table, a canvas grid, a spreadsheet)
//! misses on every frame and re-shapes them all, so the right size depends on the app, and a fixed default is
//! either too small for some or wasted memory for the rest.
//!
//! So unless the developer pins a size (the `render.labelCache` setting: `labelCacheEntries` in `glyx.config`, or `GLYX_LABEL_CACHE`), the cache
//! **starts small and grows only while it is thrashing**, up to a byte budget, and **shrinks back** when the
//! working set has been small for a while. Memory is the priority: a quiet app keeps the small default.
//!
//! The policy runs once per [`WINDOW_FRAMES`] rendered frames over what happened in that window:
//! - *grow* (double, up to the budget) when entries were evicted and more than a quarter of the lookups missed;
//! - *shrink* (to twice what is held, never below the default) after [`CALM_WINDOWS`] windows in a row without
//!   evictions in which the cache was less than a quarter full.

use crate::{CachedLabel, LabelKey};

/// Entries the cache starts with and never shrinks below.
pub(crate) const DEFAULT_ENTRIES: usize = 256;
/// Smallest and largest size a developer can pin.
pub(crate) const MIN_ENTRIES: usize = 16;
pub(crate) const MAX_ENTRIES: usize = 1_000_000;

/// Rendered frames per policy decision (about a second and a half at 60 fps).
const WINDOW_FRAMES: u32 = 90;
/// Quiet windows in a row before the cache gives memory back (about twelve seconds).
const CALM_WINDOWS: u32 = 8;

/// Memory the automatic size may use at most, in bytes (estimated: entries x [`BYTES_PER_LABEL`]).
pub(crate) const AUTO_BUDGET_BYTES: usize = 8 * 1024 * 1024;
/// What one shaped label costs, rounded up from `bench_label_memory` (about 2.2 KB for a 13-character string, 1.2 KB for
/// a 45-character one in that run: the first batch includes one-off allocator growth).
pub(crate) const BYTES_PER_LABEL: usize = 2048;

/// The most entries the automatic policy may reach.
pub(crate) const fn auto_max_entries() -> usize { AUTO_BUDGET_BYTES / BYTES_PER_LABEL }

/// How the size is decided.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Sizing {
    /// Grows and shrinks by itself.
    Auto,
    /// Pinned by the developer (or a live `set`): never changes by itself.
    Fixed,
}

/// The pinned size from the `render.labelCache` setting (whose sources are resolved by `glyx-settings`): the number of entries if it is
/// in range, `None` (size itself) for 0 and for anything below the smallest size a developer can pin.
pub(crate) fn pinned_entries(setting: i64) -> Option<usize> {
    usize::try_from(setting).ok().filter(|n| (MIN_ENTRIES..=MAX_ENTRIES).contains(n))
}

pub(crate) struct LabelCache {
    lru: lru::LruCache<LabelKey, CachedLabel>,
    sizing: Sizing,
    // What happened since the last policy decision.
    lookups: u32,
    misses: u32,
    evictions: u32,
    frames: u32,
    calm: u32,
    /// Totals since start, for the overlay and DevTools.
    pub(crate) total_lookups: u64,
    pub(crate) total_misses: u64,
    pub(crate) total_evictions: u64,
}

impl LabelCache {
    /// `pinned`: a size fixed by the developer; `None` starts the automatic policy at the default.
    pub(crate) fn new(pinned: Option<usize>) -> Self {
        let (entries, sizing) = match pinned {
            Some(n) => (n, Sizing::Fixed),
            None => (DEFAULT_ENTRIES, Sizing::Auto),
        };
        Self {
            lru: lru::LruCache::new(std::num::NonZeroUsize::new(entries.max(1)).unwrap()),
            sizing, lookups: 0, misses: 0, evictions: 0, frames: 0, calm: 0,
            total_lookups: 0, total_misses: 0, total_evictions: 0,
        }
    }

    #[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools only
    pub(crate) fn sizing(&self) -> Sizing { self.sizing }
    pub(crate) fn len(&self) -> usize { self.lru.len() }
    pub(crate) fn cap(&self) -> usize { self.lru.cap().get() }
    #[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools only
    pub(crate) fn clear(&mut self) { self.lru.clear(); }

    /// Looks a label up without touching its recency or the counters (accessibility, tests).
    pub(crate) fn peek(&self, key: &LabelKey) -> Option<&CachedLabel> { self.lru.peek(key) }

    /// Fetches a label the caller has just made sure is present (the shape-on-miss sites all call `peek`, then
    /// `put` on a miss, then `get`), so this is one lookup.
    pub(crate) fn get(&mut self, key: &LabelKey) -> Option<&CachedLabel> {
        self.lookups += 1;
        self.total_lookups += 1;
        self.lru.get(key)
    }

    /// Stores a label that was not there: a miss, and an eviction when the cache was full.
    pub(crate) fn put(&mut self, key: LabelKey, label: CachedLabel) {
        self.misses += 1;
        self.total_misses += 1;
        if self.lru.len() == self.lru.cap().get() && !self.lru.contains(&key) {
            self.evictions += 1;
            self.total_evictions += 1;
        }
        self.lru.put(key, label);
    }

    /// Pins the size (a live setting, or DevTools): the cache stops sizing itself. Clamped to the allowed range.
    #[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools only
    pub(crate) fn set_fixed(&mut self, entries: usize) {
        self.sizing = Sizing::Fixed;
        self.resize(entries.clamp(MIN_ENTRIES, MAX_ENTRIES));
    }

    /// Back to sizing itself, from the default.
    #[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools only
    pub(crate) fn set_auto(&mut self) {
        self.sizing = Sizing::Auto;
        self.calm = 0;
        self.resize(DEFAULT_ENTRIES);
    }

    /// What DevTools shows: the size, how full it is, how it is sized, and totals since start.
    #[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools only
    pub(crate) fn stats_json(&self) -> serde_json::Value {
        let hit_rate = if self.total_lookups == 0 { serde_json::Value::Null }
            else { serde_json::json!(1.0 - self.total_misses as f64 / self.total_lookups as f64) };
        serde_json::json!({
            "capacity": self.cap(),
            "held": self.len(),
            "mode": if self.sizing == Sizing::Auto { "auto" } else { "pinned" },
            "autoMaxEntries": auto_max_entries(),
            "approxBytes": self.len() * BYTES_PER_LABEL,
            "lookups": self.total_lookups,
            "misses": self.total_misses,
            "evictions": self.total_evictions,
            "hitRate": hit_rate,
        })
    }

    fn resize(&mut self, entries: usize) {
        self.lru.resize(std::num::NonZeroUsize::new(entries.max(1)).unwrap());
    }

    /// Call once per rendered frame: every window it decides whether to grow or shrink.
    pub(crate) fn end_frame(&mut self) {
        self.frames += 1;
        if self.frames < WINDOW_FRAMES { return; }
        let (lookups, misses, evictions) = (self.lookups, self.misses, self.evictions);
        self.frames = 0; self.lookups = 0; self.misses = 0; self.evictions = 0;
        if self.sizing != Sizing::Auto { return; }
        if let Some(target) = self.decide(lookups, misses, evictions) {
            self.resize(target);
        }
    }

    /// The policy: the size to change to after a window, or `None` to stay.
    fn decide(&mut self, lookups: u32, misses: u32, evictions: u32) -> Option<usize> {
        let (len, cap) = (self.len(), self.cap());
        if evictions > 0 && lookups > 0 && misses * 4 > lookups {
            self.calm = 0;
            let target = (cap * 2).min(auto_max_entries());
            return (target > cap).then_some(target);
        }
        if evictions == 0 && cap > DEFAULT_ENTRIES && len * 4 < cap {
            self.calm += 1;
            if self.calm >= CALM_WINDOWS {
                self.calm = 0;
                return Some((len * 2).max(DEFAULT_ENTRIES));
            }
        } else {
            self.calm = 0;
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pinned_size_is_a_number_in_range_and_anything_smaller_means_automatic() {
        // The setting's default is 0: the cache sizes itself.
        assert_eq!(pinned_entries(glyx_settings::global().int("render.labelCache")), None);
        assert_eq!(pinned_entries(4096), Some(4096));
        assert_eq!(pinned_entries(16), Some(16));
        for auto in [0, 3, 15, -5, 1_000_001] {
            assert_eq!(pinned_entries(auto), None, "{auto}");
        }
    }

    /// The policy alone, without real labels: counters are set by hand.
    fn auto_cache() -> LabelCache { LabelCache::new(None) }

    #[test]
    fn it_starts_small_and_grows_only_while_thrashing() {
        let mut c = auto_cache();
        assert_eq!((c.cap(), c.sizing()), (DEFAULT_ENTRIES, Sizing::Auto));
        // Misses but no evictions (the cache is simply filling): stay.
        assert_eq!(c.decide(1000, 900, 0), None);
        // Evictions with few misses (a hot working set slightly too big): stay, it is mostly hitting.
        assert_eq!(c.decide(1000, 100, 50), None);
        // Evictions and a high miss rate: double.
        assert_eq!(c.decide(1000, 600, 300), Some(DEFAULT_ENTRIES * 2));
    }

    #[test]
    fn growth_stops_at_the_byte_budget() {
        let mut c = auto_cache();
        c.resize(auto_max_entries());
        assert_eq!(c.decide(1000, 900, 500), None, "already at the budget");
        c.resize(auto_max_entries() - 10);
        assert_eq!(c.decide(1000, 900, 500), Some(auto_max_entries()), "the last step is clamped to the budget");
    }

    #[test]
    fn it_gives_memory_back_after_a_long_quiet_stretch() {
        let mut c = auto_cache();
        c.resize(4096);
        // Nearly empty and calm: nothing until CALM_WINDOWS windows have passed.
        for _ in 0..CALM_WINDOWS - 1 { assert_eq!(c.decide(100, 0, 0), None); }
        assert_eq!(c.decide(100, 0, 0), Some(DEFAULT_ENTRIES), "an empty cache shrinks to the default, not below");
        // A single busy window resets the count.
        c.resize(4096);
        for _ in 0..CALM_WINDOWS - 1 { c.decide(100, 0, 0); }
        c.decide(1000, 600, 300); // thrashing again
        assert_eq!(c.decide(100, 0, 0), None);
    }

    #[test]
    fn a_pinned_or_live_set_size_never_changes_by_itself() {
        let mut c = LabelCache::new(Some(512));
        assert_eq!((c.cap(), c.sizing()), (512, Sizing::Fixed));
        for _ in 0..WINDOW_FRAMES * 3 { c.end_frame(); }
        assert_eq!(c.cap(), 512);
        c.set_fixed(10);
        assert_eq!(c.cap(), MIN_ENTRIES, "clamped");
        c.set_fixed(5_000_000);
        assert_eq!(c.cap(), MAX_ENTRIES, "clamped");
        c.set_auto();
        assert_eq!((c.cap(), c.sizing()), (DEFAULT_ENTRIES, Sizing::Auto));
    }
}
