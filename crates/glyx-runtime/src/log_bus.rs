//! Process-wide console bus.
//!
//! Every `console.*` call (V8 and QuickJS) is published here, tagged with
//! the window whose runtime produced it. Any number of listeners subscribe
//! (the GDP Console domain today); with none, publishing is one atomic load.
//!
//! Listeners get a bounded queue: a listener that stops reading loses
//! messages instead of growing memory or slowing JS down.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{sync_channel, Receiver, SyncSender, TrySendError};
use std::sync::Mutex;

/// Messages a listener can fall behind by before new ones are dropped.
const QUEUE_LEN: usize = 4096;

#[derive(Debug, Clone, PartialEq)]
pub struct LogEntry {
    /// The window whose runtime logged it (`None` before one is assigned).
    pub window_id: Option<u32>,
    /// `"log"`, `"warn"`, `"error"` or `"debug"` (`console.info` is `"log"`).
    pub level: &'static str,
    pub text: String,
    /// Milliseconds since the Unix epoch.
    pub timestamp_ms: u64,
}

static SUBSCRIBERS: Mutex<Vec<SyncSender<LogEntry>>> = Mutex::new(Vec::new());
static COUNT: AtomicUsize = AtomicUsize::new(0);

/// Start receiving console messages. Drop the receiver to unsubscribe.
pub fn subscribe() -> Receiver<LogEntry> {
    let (tx, rx) = sync_channel(QUEUE_LEN);
    let mut subs = SUBSCRIBERS.lock().unwrap_or_else(|e| e.into_inner());
    subs.push(tx);
    COUNT.store(subs.len(), Ordering::Release);
    rx
}

/// Publish one console line as the JS console polyfills format it: level
/// encoded as a `"[warn] "` / `"[error] "` / `"[debug] "` prefix.
pub fn publish(window_id: Option<u32>, raw: &str) {
    if COUNT.load(Ordering::Acquire) == 0 { return; }
    let (level, text) = split_level(raw);
    let entry = LogEntry {
        window_id,
        level,
        text: text.to_string(),
        timestamp_ms: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
    };
    let mut subs = SUBSCRIBERS.lock().unwrap_or_else(|e| e.into_inner());
    subs.retain(|tx| !matches!(tx.try_send(entry.clone()), Err(TrySendError::Disconnected(_))));
    COUNT.store(subs.len(), Ordering::Release);
}

/// Split the polyfills' level prefix off a console line.
pub fn split_level(raw: &str) -> (&'static str, &str) {
    for (prefix, level) in [("[warn] ", "warn"), ("[error] ", "error"), ("[debug] ", "debug")] {
        if let Some(rest) = raw.strip_prefix(prefix) { return (level, rest); }
    }
    ("log", raw)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn levels_come_from_the_console_prefix() {
        assert_eq!(split_level("hello"), ("log", "hello"));
        assert_eq!(split_level("[warn] careful"), ("warn", "careful"));
        assert_eq!(split_level("[error] boom"), ("error", "boom"));
        assert_eq!(split_level("[debug] x"), ("debug", "x"));
        assert_eq!(split_level("[warning] not a level"), ("log", "[warning] not a level"));
    }

    #[test]
    fn every_subscriber_gets_each_message_and_dropped_ones_are_forgotten() {
        let a = subscribe();
        let b = subscribe();
        publish(Some(3), "[error] boom");
        let got = a.try_recv().unwrap();
        assert_eq!((got.window_id, got.level, got.text.as_str()), (Some(3), "error", "boom"));
        assert_eq!(b.try_recv().unwrap().text, "boom");

        drop(b);
        publish(None, "after");
        assert_eq!(a.try_recv().unwrap().text, "after");
        // `b` was pruned on that publish; `a` (and any other test's
        // subscriber) remain.
        assert!(COUNT.load(Ordering::Acquire) >= 1);
    }
}
