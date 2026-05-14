//! velox-perf — lightweight performance ring buffer.
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
    /// Wall-clock time from one RedrawRequested to the next.
    pub frame_time_ms:  f64,
    /// Time spent inside `runtime.frame_tick()` (JS execution).
    pub js_time_ms:     f64,
    /// Time spent inside `recompute_layout()`.
    pub layout_time_ms: f64,
    /// Number of JS scene nodes at frame time.
    pub node_count:     usize,
    /// JS heap used bytes at frame time.
    pub heap_used_bytes: usize,
}

/// Rolling performance state kept in each `PerWindowState`.
pub struct PerfState {
    /// Ring buffer of recent frames.
    pub ring:       VecDeque<PerfFrame>,
    /// Frame budget in ms; violations are pushed to `violations`.  Default 16.667 (60 fps).
    pub budget_ms:  f64,
    /// JSON-serialised violation objects waiting to be polled by JS.
    pub violations: VecDeque<String>,
    /// Timestamp of the last frame start (for wall-clock measurement).
    pub last_frame_at: Option<std::time::Instant>,
}

impl Default for PerfState {
    fn default() -> Self {
        Self {
            ring:          VecDeque::with_capacity(RING_SIZE),
            budget_ms:     16.667,
            violations:    VecDeque::new(),
            last_frame_at: None,
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
        if frame.frame_time_ms > self.budget_ms {
            self.violations.push_back(format!(
                "{{\"budget\":{:.3},\"actual\":{:.3},\"jsTime\":{:.3},\"layoutTime\":{:.3}}}",
                self.budget_ms,
                frame.frame_time_ms,
                frame.js_time_ms,
                frame.layout_time_ms,
            ));
            // Cap violation queue to avoid memory growth when continuously over budget.
            if self.violations.len() > 60 {
                self.violations.pop_front();
            }
        }
        self.ring.push_back(frame);
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
