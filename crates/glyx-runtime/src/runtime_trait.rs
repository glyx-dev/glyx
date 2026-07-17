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
