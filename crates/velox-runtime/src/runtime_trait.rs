//! `JsRuntime` — backend-agnostic trait for the embedded JS engine.
//!
//! The V8 backend (`V8Runtime`) implements this trait. Future backends
//! (JavaScriptCore for iOS, QuickJS for embedded) will implement it without
//! requiring changes to `velox-core`.
//!
//! ## Migration path
//!
//! Currently `velox-core` uses `pub type VeloxRuntime = V8Runtime`, so all
//! field access and method calls work unchanged. When a second backend is
//! added, change `PerWindowState.runtime` from the concrete type to
//! `Box<dyn JsRuntime>` and use the accessor methods below for field access.

use std::sync::Arc;
use std::collections::VecDeque;

use crate::{
    bindings::{EventQueue, LayoutCache, InputEvent, SceneCommand, DbPools},
    RuntimeError, HeapStats, VeloxExtension,
};

/// A JavaScript runtime that Velox can drive.
///
/// Not required to be `Send` — V8 isolates are bound to the thread that
/// created them. velox-core keeps each runtime on its event-loop thread.
pub trait JsRuntime {
    // ── Extensions ────────────────────────────────────────────────────────

    /// Register custom native (Rust) bindings. Called once at startup.
    fn register_extensions(&mut self, extensions: &[Box<dyn VeloxExtension>]);

    // ── Script execution ──────────────────────────────────────────────────

    /// Evaluate a JS source string, returning the result as a string.
    fn eval(&mut self, source: &str) -> Result<String, RuntimeError>;

    // ── Async tick ────────────────────────────────────────────────────────

    /// Drain the completion queue and resolve any pending JS Promises.
    /// Must be called from the same thread that created the runtime.
    fn tick(&mut self);

    // ── Frame tick ────────────────────────────────────────────────────────

    /// Call the JS `__velox_frameCallback()` once per render frame.
    /// Returns `Some(error)` if a JS exception was thrown, `None` on success.
    fn frame_tick(&mut self) -> Option<String>;

    // ── Input events ──────────────────────────────────────────────────────

    /// Push an input event so JS can poll it via `__velox_pollEvents()`.
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

    // ── Shared-state accessors ────────────────────────────────────────────
    // These Arc clones let `Box<dyn JsRuntime>` consumers read shared state
    // without downcasting. velox-core currently uses the concrete type alias
    // so these are unused there; they exist for future backends.

    fn layout_cache(&self) -> LayoutCache;
    fn events(&self) -> EventQueue;
    fn perf_state(&self) -> Arc<parking_lot::Mutex<velox_perf::PerfState>>;
    fn deeplink_url_queue(&self) -> Arc<parking_lot::Mutex<VecDeque<String>>>;
    fn db_pools(&self) -> DbPools;
}
