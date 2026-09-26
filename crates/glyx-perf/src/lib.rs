//! glyx-perf — lightweight performance ring buffer.
//!
//! Tracks the last `RING_SIZE` frames worth of timing data and exposes helpers
//! for computing averages, P99, and checking against a frame-budget threshold.
//! Intentionally has no external dependencies — just std collections.

use std::collections::VecDeque;

/// How many frames to keep in the ring buffer (5 s at 60 fps).
pub const RING_SIZE: usize = 300;

/// Per-frame timing sample (all values in milliseconds).
#[derive(Debug, Clone, Copy, Default)]
pub struct PerfFrame {
    /// Wall-clock time from one RedrawRequested to the next: the gap since the
    /// previous frame started, including any idle time before this frame.
    /// Right for rates (fps while rendering continuously); not a measure of
    /// this frame's cost — see `work_ms`.
    pub frame_time_ms:  f64,
    /// This frame's own cost: from its start until it was presented, the
    /// software path's pacing sleep excluded. What budgets are checked
    /// against (an idle pause before a frame isn't slowness). `0.0` when not
    /// measured, in which case `frame_time_ms` is used.
    pub work_ms: f64,
    /// Time spent inside `runtime.frame_tick()` (JS execution).
    pub js_time_ms:     f64,
    /// Time spent inside `recompute_layout()`.
    pub layout_time_ms: f64,
    /// Wall-clock time around render_frame() + present() (GPU approximation).
    /// Note: this is CPU-side timing of GPU submit + presentation, not a true
    /// hardware timestamp query. Useful for detecting GPU bottlenecks but not
    /// accurate enough for sub-millisecond GPU profiling.
    pub gpu_time_ms:    f64,
    /// Number of JS scene nodes at frame time.
    pub node_count:     usize,
    /// JS heap used bytes at frame time.
    pub heap_used_bytes: usize,
    /// V8 total heap capacity in bytes (used + free committed pages).
    /// `heap_used_bytes / heap_total_bytes` gives heap utilisation ratio.
    pub heap_total_bytes: usize,
    /// Process working-set / RSS in bytes (from sysinfo).
    /// Includes V8 heap, wgpu allocations, and all native memory.
    /// On iGPU systems this is inflated because GPU memory is shared with RAM.
    pub process_rss_bytes: u64,
    /// wgpu GPU buffer memory in bytes (from HalCounters).
    /// On iGPU this IS system RAM.  Zero if the backend does not report counters.
    pub gpu_buffer_bytes: u64,
    /// wgpu GPU texture memory in bytes (from HalCounters).
    pub gpu_texture_bytes: u64,
    /// Total bytes wgpu's heap allocator has reserved (includes fragmentation
    /// and partially-used blocks).  This is what DX12/Vulkan actually committed.
    /// `gpu_reserved_bytes - (gpu_buffer_bytes + gpu_texture_bytes)` = heap waste.
    pub gpu_reserved_bytes: u64,
    /// Number of live wgpu GPU buffers.  Divide `gpu_buffer_bytes` by this to
    /// get the average buffer size — useful for spotting a few huge allocations.
    pub gpu_buffer_count: u32,
    /// Number of live wgpu GPU textures.
    pub gpu_texture_count: u32,
    /// Building and rasterizing the frame (draw calls through the renderer's
    /// finish step), excluding present.
    pub render_ms: f64,
    /// Handing the frame to the OS (swap-chain present / software blit),
    /// excluding the software path's frame-pacing sleep: waiting isn't work.
    pub present_ms: f64,
    /// Redrawn area in physical pixels (the whole window on a full frame).
    pub damage_px: u64,
    /// Only part of the window was redrawn (partial redraw worked).
    pub partial: bool,
    /// Transitions and keyframe animations running this frame.
    pub animating: u32,
}

impl PerfFrame {
    /// The frame's own cost (`work_ms`), or `frame_time_ms` when that wasn't
    /// measured.
    pub fn cost_ms(&self) -> f64 {
        if self.work_ms > 0.0 { self.work_ms } else { self.frame_time_ms }
    }
}

/// Recent budget violations and leak warnings, numbered so a reader that
/// isn't the app (devtools) can fetch "everything since #n" without draining
/// the app's own queues.
pub const HISTORY_SIZE: usize = 200;

/// Rolling performance state kept in each `PerWindowState`.
pub struct PerfState {
    /// Ring buffer of recent frames.
    pub ring:       VecDeque<PerfFrame>,
    /// Frame budget in ms; violations are pushed to `violations`.  Default 16.667 (60 fps).
    pub budget_ms:  f64,
    /// JSON-serialised violation objects waiting to be polled by JS.
    pub violations: VecDeque<String>,
    /// Leak-detection warnings waiting to be polled by JS (dev mode).
    pub leak_warnings: VecDeque<String>,
    /// Timestamp of the last frame start (for wall-clock measurement).
    pub last_frame_at: Option<std::time::Instant>,
    /// Node count samples for monotonic-growth leak heuristic (dev mode).
    pub _node_history: VecDeque<usize>,
    /// Frames since last node-count decrease (for leak heuristic).
    pub _monotonic_frames: u32,
    /// `(seq, kind, json)`, kind `"violation"` or `"leak"`; see `HISTORY_SIZE`.
    pub history: VecDeque<(u64, &'static str, String)>,
    /// Sequence number of the last `history` entry (0 = none yet).
    pub history_seq: u64,
    /// Frames pushed so far; the newest ring entry is frame `frame_seq`.
    pub frame_seq: u64,
}

impl Default for PerfState {
    fn default() -> Self {
        Self {
            ring:              VecDeque::with_capacity(RING_SIZE),
            budget_ms:         16.667,
            violations:        VecDeque::new(),
            leak_warnings:     VecDeque::new(),
            last_frame_at:     None,
            _node_history:     VecDeque::with_capacity(300),
            history:           VecDeque::new(),
            history_seq:       0,
            frame_seq:         0,
            _monotonic_frames: 0,
        }
    }
}

impl PerfState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Push a completed frame sample, evict oldest if at capacity, check budget.
    pub fn push(&mut self, frame: PerfFrame) {
        if self.ring.len() == RING_SIZE {
            self.ring.pop_front();
        }
        // Check budget before inserting so the violation message can reference
        // the frame we are about to push.
        let cost = frame.cost_ms();
        if cost > self.budget_ms {
            let v = format!(
                "{{\"budget\":{:.3},\"actual\":{:.3},\"interval\":{:.3},\"jsTime\":{:.3},\"layoutTime\":{:.3},\"renderTime\":{:.3},\"presentTime\":{:.3}}}",
                self.budget_ms,
                cost,
                frame.frame_time_ms,
                frame.js_time_ms,
                frame.layout_time_ms,
                frame.render_ms,
                frame.present_ms,
            );
            self.record("violation", v.clone());
            self.violations.push_back(v);
            // Cap violation queue to avoid memory growth when continuously over budget.
            if self.violations.len() > 60 {
                self.violations.pop_front();
            }
        }
        self.ring.push_back(frame);
        self.frame_seq += 1;
    }

    /// Mean frame time over all samples in the ring buffer (ms).
    pub fn avg_frame_time(&self) -> f64 {
        if self.ring.is_empty() { return 0.0; }
        let sum: f64 = self.ring.iter().map(|f| f.frame_time_ms).sum();
        sum / self.ring.len() as f64
    }

    /// Mean JS time over all samples in the ring buffer (ms).
    pub fn avg_js_time(&self) -> f64 {
        if self.ring.is_empty() { return 0.0; }
        let sum: f64 = self.ring.iter().map(|f| f.js_time_ms).sum();
        sum / self.ring.len() as f64
    }

    /// Mean layout time over all samples (ms).
    pub fn avg_layout_time(&self) -> f64 {
        if self.ring.is_empty() { return 0.0; }
        let sum: f64 = self.ring.iter().map(|f| f.layout_time_ms).sum();
        sum / self.ring.len() as f64
    }

    /// Mean GPU time (wall-clock approximation) over all samples (ms).
    pub fn avg_gpu_time(&self) -> f64 {
        if self.ring.is_empty() { return 0.0; }
        let sum: f64 = self.ring.iter().map(|f| f.gpu_time_ms).sum();
        sum / self.ring.len() as f64
    }

    /// Push a dev-mode leak warning. Capped at 32 to avoid unbounded growth.
    fn record(&mut self, kind: &'static str, json: String) {
        self.history_seq += 1;
        if self.history.len() == HISTORY_SIZE { self.history.pop_front(); }
        self.history.push_back((self.history_seq, kind, json));
    }

    /// History entries after `seq`, oldest first.
    pub fn history_since(&self, seq: u64) -> impl Iterator<Item = &(u64, &'static str, String)> {
        self.history.iter().filter(move |(n, _, _)| *n > seq)
    }

    /// Frames in the ring whose own cost exceeded `budget_ms`.
    pub fn over_budget(&self) -> usize {
        self.ring.iter().filter(|f| f.cost_ms() > self.budget_ms).count()
    }

    pub fn push_leak_warning(&mut self, msg: String) {
        self.record("leak", msg.clone());
        self.leak_warnings.push_back(msg);
        if self.leak_warnings.len() > 32 {
            self.leak_warnings.pop_front();
        }
    }

    /// 99th-percentile frame time over the ring buffer (ms).
    pub fn p99_frame_time(&self) -> f64 {
        if self.ring.is_empty() { return 0.0; }
        let mut sorted: Vec<f64> = self.ring.iter().map(|f| f.frame_time_ms).collect();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let idx = ((sorted.len() as f64 * 0.99) as usize).saturating_sub(1);
        sorted[idx.min(sorted.len() - 1)]
    }

    /// Instantaneous FPS derived from the average frame time.
    pub fn fps(&self) -> f64 {
        let avg = self.avg_frame_time();
        if avg > 0.0 { 1000.0 / avg } else { 0.0 }
    }

    /// Most-recent frame sample, or a zeroed sample if the buffer is empty.
    pub fn last_frame(&self) -> PerfFrame {
        self.ring.back().copied().unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(ms: f64) -> PerfFrame { PerfFrame { frame_time_ms: ms, ..Default::default() } }

    #[test]
    fn violations_are_numbered_for_readers_that_do_not_drain() {
        let mut p = PerfState::new();
        p.budget_ms = 10.0;
        p.push(frame(5.0));
        p.push(frame(20.0));
        p.push_leak_warning("{\"type\":\"nodeCount\"}".into());
        p.push(frame(30.0));
        let all: Vec<_> = p.history_since(0).map(|(n, k, _)| (*n, *k)).collect();
        assert_eq!(all, vec![(1, "violation"), (2, "leak"), (3, "violation")]);
        assert_eq!(p.history_since(2).count(), 1);
        assert!(p.history_since(0).next().unwrap().2.contains("\"renderTime\""));
        // The app's own queue is untouched by devtools reads.
        assert_eq!(p.violations.len(), 2);
        assert_eq!(p.over_budget(), 2);
    }

    #[test]
    fn budgets_use_the_frame_cost_not_the_idle_gap_before_it() {
        let mut p = PerfState::new();
        p.budget_ms = 16.0;
        // 5 s idle, then a 4 ms frame: not a slow frame.
        p.push(PerfFrame { frame_time_ms: 5000.0, work_ms: 4.0, ..Default::default() });
        assert!(p.violations.is_empty());
        // A 30 ms frame right after: slow, whatever the gap.
        p.push(PerfFrame { frame_time_ms: 8.0, work_ms: 30.0, ..Default::default() });
        assert_eq!(p.over_budget(), 1);
        assert!(p.violations[0].contains("\"actual\":30.000") && p.violations[0].contains("\"interval\":8.000"));
    }

    #[test]
    fn history_keeps_the_newest_entries() {
        let mut p = PerfState::new();
        p.budget_ms = 1.0;
        for _ in 0..HISTORY_SIZE + 5 { p.push(frame(2.0)); }
        assert_eq!(p.history.len(), HISTORY_SIZE);
        assert_eq!(p.history.front().unwrap().0, 6);
        assert_eq!(p.history_seq, (HISTORY_SIZE + 5) as u64);
    }
}
