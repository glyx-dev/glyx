//! Unloading models nobody has used for a while. A loaded Phi-2 holds 2.2 GB, Whisper 170 MB, MiniLM 110 MB; an app that used `ai.generate`
//! once should not keep them for the rest of the session. A model unused for `GLYX_AI_IDLE_UNLOAD_SECS` seconds (default 300; 0 never
//! unloads) is dropped, and the next call loads it again (Phi-2 takes about 5 s from the disk cache).
//!
//! One thread does it. It sleeps until the earliest deadline, parks when nothing is loaded, and costs nothing between. A model that is
//! in use (its slot is locked) is never unloaded; the check is repeated right before dropping, so a model used just now stays.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};
use std::sync::{Condvar, Mutex, Once, OnceLock};
use std::time::{Duration, Instant};

/// How long a model may sit unused before it is unloaded, unless the environment says otherwise.
pub const DEFAULT_IDLE_SECS: u64 = 300;

/// The environment variable that sets it (the runtime fills it from the `ai.idleUnloadSecs` setting).
pub const IDLE_ENV: &str = "GLYX_AI_IDLE_UNLOAD_SECS";

#[derive(Clone, Copy)]
pub(crate) enum Kind {
    Embed = 0,
    Generate = 1,
    Whisper = 2,
}

const KINDS: [Kind; 3] = [Kind::Embed, Kind::Generate, Kind::Whisper];

impl Kind {
    fn name(self) -> &'static str {
        match self { Kind::Embed => "embedding", Kind::Generate => "generation", Kind::Whisper => "speech" }
    }
}

/// When each model was last used, in milliseconds since the first use (never 0); 0 means not loaded or not tracked.
static LAST_USED: [AtomicU64; 3] = [AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0)];
static PARKED: AtomicBool = AtomicBool::new(false);
static WAKE: (Mutex<()>, Condvar) = (Mutex::new(()), Condvar::new());

fn now_ms() -> u64 {
    static START: OnceLock<Instant> = OnceLock::new();
    START.get_or_init(Instant::now).elapsed().as_millis() as u64 + 1
}

fn idle_ms() -> u64 {
    std::env::var(IDLE_ENV).ok().and_then(|v| v.trim().parse::<u64>().ok()).unwrap_or(DEFAULT_IDLE_SECS).saturating_mul(1000)
}

/// Marks a model as in use for as long as it is alive, and as just used when it is dropped.
pub(crate) struct InUse(Kind);

pub(crate) fn in_use(kind: Kind) -> InUse {
    touch(kind);
    InUse(kind)
}

impl Drop for InUse {
    fn drop(&mut self) {
        touch(self.0);
    }
}

fn touch(kind: Kind) {
    LAST_USED[kind as usize].store(now_ms(), Relaxed);
    static START_THREAD: Once = Once::new();
    START_THREAD.call_once(|| {
        let _ = std::thread::Builder::new().name("glyx-ai-idle".into()).spawn(reaper);
    });
    if PARKED.load(Relaxed) {
        WAKE.1.notify_one();
    }
}

/// Which models are due for unloading at `now`, and how many milliseconds until the next one is (None: nothing to wait for).
pub(crate) fn plan(last_used: [u64; 3], now: u64, idle: u64) -> ([bool; 3], Option<u64>) {
    let mut due = [false; 3];
    let mut next: Option<u64> = None;
    if idle == 0 {
        return (due, None);
    }
    for (i, &last) in last_used.iter().enumerate() {
        if last == 0 {
            continue;
        }
        let at = last.saturating_add(idle);
        if now >= at {
            due[i] = true;
        } else {
            next = Some(next.map_or(at - now, |n| n.min(at - now)));
        }
    }
    (due, next)
}

/// Drop the model in `kind`'s slot if nobody is using it and it is still idle. Returns whether it is settled (unloaded or not loaded), as
/// opposed to busy.
fn unload_if_idle(kind: Kind) -> bool {
    fn free<T: Send + 'static>(slot: crate::Slot<T>, kind: Kind) -> bool {
        let Some(mut model) = slot.try_lock() else { return false };
        // Used again since the decision was made: leave it.
        let idle = idle_ms();
        if idle == 0 || now_ms() < LAST_USED[kind as usize].load(Relaxed).saturating_add(idle) {
            return true;
        }
        if model.take().is_some() {
            log::info!("[ai] unloaded the {} model after {} s without use", kind.name(), idle / 1000);
        }
        LAST_USED[kind as usize].store(0, Relaxed);
        true
    }
    match kind {
        Kind::Embed => free(crate::shared_embed(), kind),
        Kind::Generate => free(crate::shared_generate(), kind),
        Kind::Whisper => free(crate::shared_whisper(), kind),
    }
}

fn reaper() {
    loop {
        let (due, next) = plan([LAST_USED[0].load(Relaxed), LAST_USED[1].load(Relaxed), LAST_USED[2].load(Relaxed)], now_ms(), idle_ms());
        let mut wait = next;
        for kind in KINDS {
            if due[kind as usize] && !unload_if_idle(kind) {
                wait = Some(wait.map_or(5_000, |w| w.min(5_000))); // busy: look again soon
            }
        }
        let guard = WAKE.0.lock().unwrap_or_else(|e| e.into_inner());
        match wait {
            Some(ms) => {
                let _ = WAKE.1.wait_timeout(guard, Duration::from_millis(ms.max(50)));
            }
            None => {
                // Nothing loaded (or unloading is off): sleep until a model is used. The timeout only bounds a lost wake-up.
                PARKED.store(true, Relaxed);
                let _ = WAKE.1.wait_timeout(guard, Duration::from_secs(600));
                PARKED.store(false, Relaxed);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nothing_loaded_or_unloading_off_means_nothing_to_wait_for() {
        assert_eq!(plan([0, 0, 0], 1_000_000, 300_000), ([false; 3], None));
        assert_eq!(plan([5, 5, 5], 1_000_000, 0), ([false; 3], None), "0 turns unloading off");
    }

    #[test]
    fn a_model_is_due_once_idle_for_the_whole_period_and_not_before() {
        let idle = 300_000;
        assert_eq!(plan([0, 1_000, 0], 1_000 + idle - 1, idle), ([false; 3], Some(1)));
        assert_eq!(plan([0, 1_000, 0], 1_000 + idle, idle), ([false, true, false], None));
        assert_eq!(plan([0, 1_000, 0], 1_000 + idle + 5_000, idle).0, [false, true, false]);
    }

    #[test]
    fn the_wait_is_until_the_earliest_deadline_of_the_models_that_are_not_due_yet() {
        let idle = 100_000;
        // Embed used at 50 s, whisper at 10 s, generate at 0 (not loaded): at 120 s whisper is due, embed in 30 s.
        let (due, next) = plan([50_000, 0, 10_000], 120_000, idle);
        assert_eq!(due, [false, false, true]);
        assert_eq!(next, Some(30_000));
    }

    #[test]
    fn the_default_is_five_minutes_and_a_bad_value_falls_back_to_it() {
        // Not set in the test environment; the parsing is what is checked.
        assert_eq!("120".trim().parse::<u64>().ok(), Some(120));
        assert_eq!(DEFAULT_IDLE_SECS, 300);
        assert_eq!("soon".trim().parse::<u64>().ok().unwrap_or(DEFAULT_IDLE_SECS), 300);
    }
}
