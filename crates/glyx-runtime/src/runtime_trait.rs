//! `JsRuntime` — backend-agnostic trait for the embedded JS engine.
//!
//! The V8 backend (`V8Runtime`) implements this trait. A QuickJS backend
//! (see glyx_rough_docs/QUICKJS_PERFORMANCE_PLAN.md) implements it too,
//! without requiring changes to `glyx-core`.
//!
//! `glyx-core`'s `PerWindowState.runtime` is `Box<dyn JsRuntime>` — see
//! `state.rs`. Field/method access goes through this trait's methods below,
//! not through either backend's own inherent methods.

use std::sync::Arc;
use std::collections::VecDeque;

use crate::{
    bindings::{EventQueue, LayoutCache, InputEvent, SceneCommand, DbPools},
    RuntimeError, GlyxExtension,
};

/// Heap/memory usage snapshot — engine-neutral shape (defined here, not in
/// `runtime.rs`, since it's this trait's own return type and must exist
/// regardless of which engine backend is actually compiled in).
pub struct HeapStats {
    pub used_heap_size: usize,
    pub total_heap_size: usize,
}

/// A JavaScript runtime that Glyx can drive.
///
/// Not required to be `Send` — V8 isolates are bound to the thread that
/// created them. glyx-core keeps each runtime on its event-loop thread.
pub trait JsRuntime {
    // ── Extensions ────────────────────────────────────────────────────────

    /// Register custom native (Rust) bindings. Called once at startup.
    fn register_extensions(&mut self, extensions: &[Box<dyn GlyxExtension>]);

    // ── Script execution ──────────────────────────────────────────────────

    /// Evaluate a JS source string, returning the result as a string.
    fn eval(&mut self, source: &str) -> Result<String, RuntimeError>;

    /// Set up the Canvas2D binary command buffer (or mark json mode).
    /// Default: no-op — canvas bindings are V8-only for now (not yet ported
    /// to the QuickJS backend, see memory/quickjs-milestone0-progress.md).
    fn init_canvas_buffers(&mut self, _protocol: &str, _buffer_kb: usize) {}

    // ── Async tick ────────────────────────────────────────────────────────

    /// Drain the completion queue and resolve any pending JS Promises.
    /// Must be called from the same thread that created the runtime.
    fn tick(&mut self);

    // ── Frame tick ────────────────────────────────────────────────────────

    /// Call the JS `__glyx_frameCallback()` once per render frame.
    /// Returns `Some(error)` if a JS exception was thrown, `None` on success.
    fn frame_tick(&mut self) -> Option<String>;

    // ── Input events ──────────────────────────────────────────────────────

    /// Push an input event so JS can poll it via `__glyx_pollEvents()`.
    fn push_event(&self, event: InputEvent);

    /// Push a `CursorMoved` event, coalescing with an already-queued
    /// `CursorMoved` at the TAIL of the queue by overwriting it in place,
    /// instead of appending a new one. A fast mouse move (especially on a
    /// high-poll-rate mouse) can generate many `CursorMoved` events within
    /// a single rendered frame; only the LATEST position/target matters to
    /// anything that consumes it (hover state, drag routing), so forwarding
    /// every intermediate one across the native/JS boundary — building a JS
    /// object for each, on both engines — was pure waste. Only coalesces
    /// with the tail specifically: if something else (a click, a key) was
    /// queued in between two cursor moves, that event sits between them and
    /// this correctly appends a fresh entry instead of clobbering it.
    ///
    /// Default (not per-engine) implementation — both backends share the
    /// same `EventQueue` shape via `events()`, so there's nothing engine-
    /// specific to override here. Delegates to `coalesce_cursor_moved`
    /// (a free function, not a trait method) so the actual logic is
    /// unit-testable without a full `JsRuntime` mock.
    fn push_cursor_moved(&self, x: f32, y: f32, target: Option<u32>) {
        let events = self.events();
        let mut q = events.lock();
        coalesce_cursor_moved(&mut q, x, y, target);
    }

    // ── Layout cache ──────────────────────────────────────────────────────

    /// Store a node's resolved layout rectangle for JS hit-testing.
    fn update_layout(&self, js_id: u32, x: f32, y: f32, width: f32, height: f32);

    // ── Scene commands ────────────────────────────────────────────────────

    /// Drain all pending scene commands produced by the last JS execution.
    fn drain_scene_commands(&mut self) -> Vec<SceneCommand>;

    /// Flush the microtask queue (Promise continuations, queueMicrotask).
    /// Call after `eval()` to commit any React work deferred via microtasks.
    fn flush_microtasks(&mut self);

    // ── System ────────────────────────────────────────────────────────────

    /// Close all open SQLite pools. Call when the window is closing.
    fn shutdown_db_pools(&self);

    /// Read V8 heap statistics.
    fn heap_stats(&mut self) -> HeapStats;

    // ── Plugin hot-reload (dev mode) ────────────────────────────────────────

    /// Re-eval a plugin IIFE and refresh its exported commands. Called by
    /// glyx-core's dev-mode file-change handler.
    fn reload_plugin(&mut self, global_name: &str, prefix: Option<&str>, bundled_js: &str);

    // ── GC pressure relief ───────────────────────────────────────────────────

    /// Hint the engine to run a full GC pass. Call periodically during
    /// high-frequency animation loops to counteract heap growth from
    /// short-lived React render objects outpacing incremental GC.
    fn gc_hint(&mut self);

    // ── CPU profiling (DevTools, dev builds) ─────────────────────────────────

    /// Start sampling the JS stack every `interval_us`. Engines without a
    /// sampling profiler (QuickJS) say so.
    fn profile_start(&mut self, _interval_us: u32) -> Result<(), String> {
        Err("CPU profiling needs the V8 engine; this app runs on QuickJS".into())
    }

    /// Stop sampling and return the profile, in Chrome's `cpuProfile` format.
    fn profile_stop(&mut self) -> Result<serde_json::Value, String> {
        Err("not recording".into())
    }

    // ── Shared-state accessors ────────────────────────────────────────────
    // These Arc clones let `Box<dyn JsRuntime>` consumers read shared state
    // without downcasting. glyx-core currently uses the concrete type alias
    // so these are unused there; they exist for future backends.

    fn layout_cache(&self) -> LayoutCache;
    fn events(&self) -> EventQueue;
    fn perf_state(&self) -> Arc<parking_lot::Mutex<glyx_perf::PerfState>>;
    fn deeplink_url_queue(&self) -> Arc<parking_lot::Mutex<VecDeque<String>>>;
    fn db_pools(&self) -> DbPools;
    fn webview_events(&self) -> crate::bindings::WebviewEvents;
    fn video_events(&self) -> crate::bindings::VideoEvents;
    fn raycast_requests(&self) -> crate::bindings::RaycastRequestQueue;
    fn raycast_results(&self) -> crate::bindings::RaycastResults;
}

/// Overwrites a `CursorMoved` at the tail of `q` in place, or appends a new
/// one if the tail isn't a `CursorMoved` (queue empty, or the last queued
/// event is something else — a click, a key, etc. — that must not be
/// clobbered). Extracted from `JsRuntime::push_cursor_moved` as a free
/// function so this logic is unit-testable directly, without a full
/// `JsRuntime` mock.
pub fn coalesce_cursor_moved(q: &mut VecDeque<InputEvent>, x: f32, y: f32, target: Option<u32>) {
    if let Some(InputEvent::CursorMoved { x: lx, y: ly, target: lt }) = q.back_mut() {
        *lx = x;
        *ly = y;
        *lt = target;
        return;
    }
    q.push_back(InputEvent::CursorMoved { x, y, target });
}

#[cfg(test)]
mod tests {
    use super::*;

    // Rust warns on matching float literals directly in patterns, so pull
    // the fields out via `if let` and compare with `assert_eq!` instead.
    fn as_cursor_moved(ev: &InputEvent) -> (f32, f32, Option<u32>) {
        match ev {
            InputEvent::CursorMoved { x, y, target } => (*x, *y, *target),
            other => panic!("expected CursorMoved, got {other:?}"),
        }
    }

    #[test]
    fn appends_when_queue_is_empty() {
        let mut q: VecDeque<InputEvent> = VecDeque::new();
        coalesce_cursor_moved(&mut q, 1.0, 2.0, Some(5));
        assert_eq!(q.len(), 1);
        assert_eq!(as_cursor_moved(&q[0]), (1.0, 2.0, Some(5)));
    }

    #[test]
    fn coalesces_consecutive_cursor_moves_into_one() {
        let mut q: VecDeque<InputEvent> = VecDeque::new();
        coalesce_cursor_moved(&mut q, 1.0, 1.0, None);
        coalesce_cursor_moved(&mut q, 2.0, 2.0, Some(7));
        coalesce_cursor_moved(&mut q, 3.0, 3.0, Some(9));
        // Three moves in a row within one frame collapse to a single
        // queued event holding only the LATEST position/target.
        assert_eq!(q.len(), 1);
        assert_eq!(as_cursor_moved(&q[0]), (3.0, 3.0, Some(9)));
    }

    #[test]
    fn does_not_clobber_a_different_event_queued_in_between() {
        let mut q: VecDeque<InputEvent> = VecDeque::new();
        coalesce_cursor_moved(&mut q, 1.0, 1.0, None);
        q.push_back(InputEvent::MouseButton { x: 1.0, y: 1.0, button: 0, pressed: true, target: None });
        coalesce_cursor_moved(&mut q, 2.0, 2.0, None);
        // The click sitting between the two moves must survive untouched,
        // and the second move must append rather than overwrite it.
        assert_eq!(q.len(), 3);
        assert_eq!(as_cursor_moved(&q[0]), (1.0, 1.0, None));
        assert!(matches!(q[1], InputEvent::MouseButton { .. }));
        assert_eq!(as_cursor_moved(&q[2]), (2.0, 2.0, None));
    }

    #[test]
    fn preserves_events_queued_before_an_unrelated_cursor_moved_run() {
        // A scroll event queued first, then a burst of cursor moves — the
        // scroll must stay put; only the moves after it coalesce together.
        let mut q: VecDeque<InputEvent> = VecDeque::new();
        q.push_back(InputEvent::Scroll { delta_y: 10.0 });
        coalesce_cursor_moved(&mut q, 1.0, 1.0, None);
        coalesce_cursor_moved(&mut q, 2.0, 2.0, None);
        assert_eq!(q.len(), 2);
        assert!(matches!(q[0], InputEvent::Scroll { .. }));
        assert_eq!(as_cursor_moved(&q[1]), (2.0, 2.0, None));
    }
}
