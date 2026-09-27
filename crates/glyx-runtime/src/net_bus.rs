//! Process-wide network activity bus, for the DevTools Network panel.
//!
//! The JS networking layer (fetch, WebSocket, IPC and backend commands in
//! `@glyx/react`) reports each step as one JSON event through
//! `__glyx_devNet`, but only when the app runs with devtools on. Events are
//! tagged with the window whose runtime sent them. With no listener,
//! publishing is one atomic load. Listeners get a bounded queue, like the
//! console bus.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{sync_channel, Receiver, SyncSender, TrySendError};
use std::sync::{Arc, Mutex};

/// Events a listener can fall behind by before new ones are dropped.
const QUEUE_LEN: usize = 4096;

#[derive(Debug, Clone, PartialEq)]
pub struct NetEvent {
    /// The window whose runtime sent it.
    pub window_id: Option<u32>,
    /// The event as JSON, exactly as JS sent it.
    pub json: String,
}

static SUBSCRIBERS: Mutex<Vec<SyncSender<NetEvent>>> = Mutex::new(Vec::new());
static COUNT: AtomicUsize = AtomicUsize::new(0);
/// Called after a publish so the listener drains promptly, even in an idle
/// app. Once per drain: `WAKE_PENDING` stays set until `drained()`.
static WAKER: Mutex<Option<Arc<dyn Fn() + Send + Sync>>> = Mutex::new(None);
static WAKE_PENDING: AtomicBool = AtomicBool::new(false);

/// Wake the listener when events arrive (e.g. post an event-loop wake-up).
pub fn set_waker(waker: Arc<dyn Fn() + Send + Sync>) {
    *WAKER.lock().unwrap_or_else(|e| e.into_inner()) = Some(waker);
}

/// The listener has read the queue; the next publish wakes it again.
pub fn drained() {
    WAKE_PENDING.store(false, Ordering::Release);
}

/// Start receiving network events. Drop the receiver to unsubscribe.
pub fn subscribe() -> Receiver<NetEvent> {
    let (tx, rx) = sync_channel(QUEUE_LEN);
    let mut subs = SUBSCRIBERS.lock().unwrap_or_else(|e| e.into_inner());
    subs.push(tx);
    COUNT.store(subs.len(), Ordering::Release);
    rx
}

pub fn publish(window_id: Option<u32>, json: String) {
    if COUNT.load(Ordering::Acquire) == 0 { return; }
    let event = NetEvent { window_id, json };
    let mut subs = SUBSCRIBERS.lock().unwrap_or_else(|e| e.into_inner());
    subs.retain(|tx| !matches!(tx.try_send(event.clone()), Err(TrySendError::Disconnected(_))));
    COUNT.store(subs.len(), Ordering::Release);
    drop(subs);
    if !WAKE_PENDING.swap(true, Ordering::AcqRel) {
        let waker = WAKER.lock().unwrap_or_else(|e| e.into_inner()).clone();
        if let Some(w) = waker { w(); }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subscribers_get_events_tagged_with_their_window() {
        let rx = subscribe();
        publish(Some(2), r#"{"t":"request","id":1}"#.into());
        let e = rx.try_recv().unwrap();
        assert_eq!(e.window_id, Some(2));
        assert_eq!(e.json, r#"{"t":"request","id":1}"#);
    }
}
