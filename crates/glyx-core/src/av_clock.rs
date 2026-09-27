//! Audio-master clock for video playback.
//!
//! Video and audio are decoded on separate threads. The audio output plays
//! at its own steady rate, so the audio position (samples handed to the
//! output, plus where playback started) is the clock video follows: a frame
//! is shown when the audio reaches its timestamp, and frames that are
//! already late are dropped so a slow decoder catches up instead of drifting.
//! With no audio (no track, a network stream, no output device) the video
//! thread keeps its wall-clock pacing.
//!
//! Each audio thread gets a generation. Seeking starts a new one, so an old
//! thread still winding down can't move the clock.

use std::sync::atomic::{AtomicU64, AtomicU8, Ordering};

const PENDING: u8 = 0;
const PLAYING: u8 = 1;
const NONE: u8 = 2;

#[derive(Default)]
pub(crate) struct AvClock {
    generation: AtomicU64,
    state: AtomicU8,
    /// Seconds at which the current audio started (f64 bits).
    base_bits: AtomicU64,
    /// Samples per second, all channels.
    per_sec: AtomicU64,
    /// Samples handed to the output since `base`.
    samples: AtomicU64,
}

impl AvClock {
    /// A new audio stream is being set up: video waits for it. Returns its generation.
    pub(crate) fn restart(&self) -> u64 {
        let g = self.generation.fetch_add(1, Ordering::AcqRel) + 1;
        self.samples.store(0, Ordering::Release);
        self.state.store(PENDING, Ordering::Release);
        g
    }

    pub(crate) fn generation(&self) -> u64 { self.generation.load(Ordering::Acquire) }

    /// Audio `gen` started playing from `base_secs`, at `per_sec` samples per second.
    #[cfg_attr(not(feature = "audio"), allow(dead_code))] // audio thread only
    pub(crate) fn start(&self, gen: u64, base_secs: f64, per_sec: u64) {
        if gen != self.generation() || per_sec == 0 { return; }
        self.base_bits.store(base_secs.to_bits(), Ordering::Release);
        self.per_sec.store(per_sec, Ordering::Release);
        self.samples.store(0, Ordering::Release);
        self.state.store(PLAYING, Ordering::Release);
    }

    /// `n` more samples went to the output (called from the audio thread).
    #[cfg_attr(not(feature = "audio"), allow(dead_code))] // audio thread only
    #[inline]
    pub(crate) fn advance(&self, gen: u64, n: u64) {
        if gen == self.generation.load(Ordering::Relaxed) {
            self.samples.fetch_add(n, Ordering::Relaxed);
        }
    }

    /// Audio `gen` isn't coming, or has ended: video paces itself.
    pub(crate) fn no_audio(&self, gen: u64) {
        if gen == self.generation() { self.state.store(NONE, Ordering::Release); }
    }

    pub(crate) fn is_pending(&self) -> bool { self.state.load(Ordering::Acquire) == PENDING }

    /// The audio position in seconds, while audio is playing.
    pub(crate) fn position(&self) -> Option<f64> {
        if self.state.load(Ordering::Acquire) != PLAYING { return None; }
        let per_sec = self.per_sec.load(Ordering::Acquire).max(1);
        let base = f64::from_bits(self.base_bits.load(Ordering::Acquire));
        Some(base + self.samples.load(Ordering::Relaxed) as f64 / per_sec as f64)
    }
}

/// How the video thread should treat a decoded frame, given the audio clock.
#[derive(Debug, PartialEq)]
pub(crate) enum FrameTiming {
    /// Show it, then wait this long (it's early).
    ShowAfter(f64),
    /// Show it now.
    ShowNow,
    /// It's late: skip it to catch up.
    Drop,
}

/// Frames later than this behind the audio are dropped…
pub(crate) const LATE_DROP_SECS: f64 = 0.08;
/// …unless nothing has been shown for this long (keep the picture moving).
pub(crate) const MAX_FRAME_GAP_SECS: f64 = 0.25;

pub(crate) fn frame_timing(pts: f64, audio_pos: f64, since_last_shown: f64) -> FrameTiming {
    let ahead = pts - audio_pos;
    if ahead > 0.001 {
        FrameTiming::ShowAfter(ahead.min(1.0))
    } else if -ahead > LATE_DROP_SECS && since_last_shown < MAX_FRAME_GAP_SECS {
        FrameTiming::Drop
    } else {
        FrameTiming::ShowNow
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn position_follows_samples_from_the_start_point() {
        let c = AvClock::default();
        let g = c.restart();
        assert!(c.is_pending() && c.position().is_none());
        c.start(g, 10.0, 48_000 * 2);
        c.advance(g, 48_000); // half a second of stereo
        assert!((c.position().unwrap() - 10.5).abs() < 1e-9);
    }

    #[test]
    fn an_old_audio_thread_cannot_move_the_clock() {
        let c = AvClock::default();
        let old = c.restart();
        c.start(old, 0.0, 1000);
        let new = c.restart(); // seek
        c.advance(old, 5000);
        c.no_audio(old);
        assert!(c.is_pending(), "the old thread's end doesn't cancel the new audio");
        c.start(new, 30.0, 1000);
        c.advance(new, 500);
        assert!((c.position().unwrap() - 30.5).abs() < 1e-9);
        c.no_audio(new);
        assert!(c.position().is_none() && !c.is_pending());
    }

    #[test]
    fn frames_wait_show_or_drop() {
        assert!(matches!(frame_timing(1.05, 1.0, 0.0), FrameTiming::ShowAfter(s) if (s - 0.05).abs() < 1e-9));
        assert_eq!(frame_timing(1.0, 1.02, 0.0), FrameTiming::ShowNow);
        assert_eq!(frame_timing(1.0, 1.2, 0.05), FrameTiming::Drop);
        // Late, but nothing shown for a while: show it anyway.
        assert_eq!(frame_timing(1.0, 1.2, 0.3), FrameTiming::ShowNow);
    }
}
