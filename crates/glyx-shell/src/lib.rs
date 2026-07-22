//! glyx-shell — winit window creation and raw input event forwarding.
//!
//! ## Multi-window support
//!
//! The shell manages N windows identified by opaque `u32` handles.
//! Handle 0 is always the main window (created on startup).
//! Additional windows are created by sending `GlyxUserEvent::CreateWindow`
//! through the `EventLoopProxy` received in `ShellEvent::WindowReady`.
//!
//! ## ControlFlow strategy
//!
//! We use `ControlFlow::Wait` so the event loop sleeps until an OS event
//! (user input, resize, focus change, system redraw request) wakes it.
//! When the app needs to render a new frame it calls `window.request_redraw()`
//! which posts a synthetic `RedrawRequested` event and wakes the loop.
//!
//! This keeps idle CPU at ~0% on a static UI, which is critical for both
//! battery life and thermal behaviour on laptops.
//!
//! ## API surface
//!
//! `ShellEvent` deliberately uses only primitive Rust types so that upstream
//! crates (glyx-core, glyx-runtime) have no dependency on winit.

use std::collections::HashMap;
use std::sync::Arc;
use winit::{
    application::ApplicationHandler,
    dpi::PhysicalSize,
    event::{ElementState, KeyEvent, MouseButton, MouseScrollDelta, WindowEvent},
    event_loop::{ActiveEventLoop, ControlFlow, EventLoop},
    keyboard::{Key, NamedKey, PhysicalKey},
    window::{CursorIcon, ResizeDirection, Window, WindowAttributes, WindowId},
};

pub use winit::event_loop::EventLoopProxy;

// ── User events (sent from Rust side to the event loop) ───────────────────────

/// Events that non-event-loop threads can send to the event loop.
///
/// NOTE: not `Clone` — the `Accesskit` variant wraps `accesskit_winit::Event`,
/// which isn't `Clone`. Nothing in the codebase clones `GlyxUserEvent`.
#[derive(Debug)]
pub enum GlyxUserEvent {
    /// Request creation of a secondary window with a pre-assigned handle.
    CreateWindow { id: u32, title: String, width: u32, height: u32 },
    /// Quit the application — closes all windows and exits the event loop.
    Quit,
    /// Quit then re-launch the same executable (for OTA apply / settings reload).
    Restart,
    /// Routed from `accesskit_winit::Adapter` (created with `with_event_loop_proxy`)
    /// — initial-tree requests, AT action requests, and deactivation.
    #[cfg(feature = "a11y")]
    Accesskit(accesskit_winit::Event),
}

#[cfg(feature = "a11y")]
impl From<accesskit_winit::Event> for GlyxUserEvent {
    fn from(e: accesskit_winit::Event) -> Self { GlyxUserEvent::Accesskit(e) }
}

/// Wraps the accessibility tree-update callback so `ShellEvent` can keep
/// deriving `Debug`/`Clone` (an `Arc<dyn Fn>` doesn't derive `Debug` itself).
/// Call this whenever the scene graph changes; it's cheap when no assistive
/// technology is actually running (`accesskit_winit::Adapter::update_if_active`
/// no-ops in that case) so callers don't need to gate calls on AT presence.
#[cfg(feature = "a11y")]
#[derive(Clone)]
pub struct A11yUpdateFn(pub Arc<dyn Fn(accesskit::TreeUpdate) + Send + Sync>);
#[cfg(feature = "a11y")]
impl std::fmt::Debug for A11yUpdateFn {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "A11yUpdateFn(..)")
    }
}

// ── Public event type ────────────────────────────────────────────────────────

/// Platform-agnostic events emitted by the shell.
///
/// Every variant carries a `window_handle` identifying which window the event
/// belongs to.  Handle 0 is always the main (first) window.
///
/// All fields use primitive Rust types — no winit types leak through.
#[derive(Debug, Clone)]
pub enum ShellEvent {
    /// Window is ready; GPU context can now be created.
    ///
    /// `proxy` can be cloned and used from any thread to request new windows
    /// via `proxy.send_event(GlyxUserEvent::CreateWindow { ... })`.
    WindowReady {
        window_handle: u32,
        window: Arc<Window>,
        proxy:  EventLoopProxy<GlyxUserEvent>,
        /// Push an accessibility tree update for this window. `None` when
        /// built without the `a11y` feature.
        #[cfg(feature = "a11y")]
        a11y_update: A11yUpdateFn,
    },
    /// Window was resized to these physical pixel dimensions.
    Resized { window_handle: u32, width: u32, height: u32 },
    /// A frame should be rendered.
    RedrawRequested { window_handle: u32 },
    /// User/OS requested the window to close.
    CloseRequested  { window_handle: u32 },
    /// Keyboard key pressed or released.
    KeyInput  { window_handle: u32, key: String, text: Option<String>, pressed: bool },
    /// Mouse button pressed or released.
    MouseInput { window_handle: u32, button: u8, pressed: bool },
    /// Cursor moved to physical pixel position.
    CursorMoved { window_handle: u32, x: f64, y: f64 },
    /// Vertical scroll (positive = scroll down).
    Scroll { window_handle: u32, delta_y: f32 },
    /// Window became occluded (hidden/minimised) or visible again.
    /// `occluded = true` means the window is no longer visible on screen.
    Occluded { window_handle: u32, occluded: bool },
    /// Window gained or lost OS focus.
    /// `focused = false` is a good time to release allocator memory.
    FocusChanged { window_handle: u32, focused: bool },
    /// IME (Input Method Editor) composition event — CJK/etc text input.
    /// `kind` is one of "enabled" / "preedit" / "commit" / "disabled".
    /// `text` carries the in-progress composition string for "preedit" or
    /// the final composed string for "commit"; `None` for enabled/disabled.
    /// `cursor` is a (start, end) BYTE offset range within `text`, selecting
    /// the portion of the preedit string currently being edited by the IME
    /// (e.g. the actively-converted clause) — only meaningful for "preedit".
    Ime {
        window_handle: u32,
        kind: String,
        text: Option<String>,
        cursor: Option<(u32, u32)>,
    },
    /// An assistive technology (screen reader, etc.) requested an action on
    /// a node — e.g. VoiceOver/Narrator's user pressing Enter on a focused
    /// button, or Tab-focusing into a field. `target` is the glyx node id
    /// (accesskit's `NodeId` is just our u32 id widened to u64).
    /// `action` is one of "focus" / "click" / "increment" / "decrement" /
    /// "setValue". `numeric_value` is only set for "setValue" (from
    /// `ActionData::NumericValue` — string `ActionData::Value` isn't wired,
    /// only sliders/numeric controls are operable this way for now).
    #[cfg(feature = "a11y")]
    AccessibilityAction {
        window_handle: u32,
        target: u32,
        action: String,
        numeric_value: Option<f64>,
    },
}

// ── Shell config ─────────────────────────────────────────────────────────────

/// How the window should appear on first launch.
///
/// The three modes are mutually exclusive — using an enum eliminates any
/// ambiguity that arises from combining boolean flags.
#[derive(Debug, Clone, Default, PartialEq)]
pub enum StartupMode {
    /// Fixed-size window.  `width` and `height` from `ShellConfig` are used.
    #[default]
    Windowed,
    /// Maximised window — taskbar remains visible.
    Maximized,
    /// Borderless fullscreen — covers the taskbar.
    Fullscreen,
}

/// Selects the 2D rendering backend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RenderMode {
    /// Vello GPU compute via wgpu. Best AA quality, highest RAM on iGPU.
    Gpu,
    /// Vello CPU path (Cranelift JIT). No discrete GPU required.
    Cpu,
    /// tiny-skia CPU rasterizer. Minimal RAM, pure Rust, no GPU pool.
    TinySkia,
    /// Direct2D (Windows only, experimental). OS/driver-managed GPU-accelerated
    /// 2D — measured to stay near TinySkia's flat memory profile instead of
    /// Vello's persistent scene-buffer pool, since D2D's caches are shared at
    /// the OS/driver level rather than privately allocated per app. Falls back
    /// to TinySkia with a warning on non-Windows targets. Never auto-selected —
    /// must be requested explicitly via `renderMode: 'direct2d'`.
    Direct2D,
    /// Auto-detect: discrete GPU → Gpu, no GPU → TinySkia.
    #[default]
    Auto,
}

pub struct ShellConfig {
    pub title:        String,
    /// Width in physical pixels. Only used when `startup_mode` is `Windowed`.
    pub width:        u32,
    /// Height in physical pixels. Only used when `startup_mode` is `Windowed`.
    pub height:       u32,
    /// Use Poll (games/continuous rendering) instead of Wait (UI/battery).
    pub continuous:   bool,
    /// How the window appears on first launch.
    pub startup_mode: StartupMode,
    /// `true` = OS title bar + borders (default). `false` = frameless; Glyx
    /// renders its own title bar and handles resize/drag hit zones.
    pub decorations:  bool,
    /// `true` (default) = user can resize the window (drag edges, maximize).
    /// `false` = fixed size, locked to `width`×`height`. Controlled by
    /// `resizable` in `glyx.config.json` / `glyx.config.ts`.
    pub resizable:    bool,
    /// Raw RGBA icon pixels + dimensions decoded from the app's icon PNG.
    /// Used to set the window icon (taskbar on Windows/Linux, Dock on macOS).
    /// `None` = no icon set (system default).
    pub icon_rgba:    Option<(Vec<u8>, u32, u32)>,
    /// RGBA background color set as the GPU clear color before the first JS frame.
    /// Eliminates the blank-white-window flash during JS startup.
    /// Defaults to the Glyx dark background `[0x14, 0x14, 0x1A, 0xFF]`.
    pub background_color: [u8; 4],
    /// Rendering backend.  Defaults to `RenderMode::Auto` (heuristic picks the best backend for the detected GPU tier).
    /// Controlled by `renderMode` in `glyx.config.json` or `GLYX_CPU_RENDER=1`.
    pub render_mode: RenderMode,
    /// Optional explicit V8 heap cap in MB.  `None` = auto-calculated from bundle size.
    /// Controlled by `maxJsHeapMb` in `glyx.config.json`.
    pub max_js_heap_mb: Option<u32>,
    /// Canvas2D transport: `"binary"` (default) or `"json"`. Controlled by
    /// `canvas.protocol` in `glyx.config.json`.
    pub canvas_protocol: String,
    /// Canvas2D binary command-buffer size in KiB. Controlled by
    /// `canvas.bufferKB`; `None` = default (256).
    pub canvas_buffer_kb: Option<u32>,
    /// ICU locale set for `Intl.*` / `.toLocaleString()` support. The first
    /// entry is used as the default ICU locale. Controlled by `locales` in
    /// `glyx.config.json` / `glyx.config.ts`. Defaults to `["en"]`.
    pub locales: Vec<String>,
}

impl Default for ShellConfig {
    fn default() -> Self {
        Self {
            title:        "Glyx".into(),
            width:        1280,
            height:       800,
            continuous:   false,
            startup_mode: StartupMode::Windowed,
            decorations:  true,
            resizable:    true,
            icon_rgba:    None,
            background_color: [0x14, 0x14, 0x1A, 0xFF],
            render_mode:  RenderMode::Auto,
            max_js_heap_mb: None,
            canvas_protocol: "binary".into(),
            canvas_buffer_kb: None,
            locales:         vec!["en".to_string()],
        }
    }
}

/// Run the shell event loop, calling `handler` for every `ShellEvent`.
///
/// Blocks until all windows are closed. Must be called from the main thread.
///
/// Returns `true` if the app should restart (caller is responsible for re-exec).
pub fn run<F>(config: ShellConfig, handler: F) -> bool
where
    F: FnMut(ShellEvent) + 'static,
{
    let event_loop = EventLoop::<GlyxUserEvent>::with_user_event()
        .build()
        .expect("Failed to create EventLoop");

    let control_flow = if config.continuous {
        ControlFlow::Poll
    } else {
        ControlFlow::Wait
    };
    event_loop.set_control_flow(control_flow);
    log::debug!("glyx-shell: ControlFlow = {:?}", control_flow);

    let proxy = event_loop.create_proxy();
    #[cfg(feature = "a11y")]
    let (a11y_tx, a11y_rx) = std::sync::mpsc::channel();

    let mut app = ShellApp {
        config,
        handler:          Box::new(handler),
        proxy,
        next_handle:      0,
        windows:          HashMap::new(),
        window_arcs:      HashMap::new(),
        restart_requested: false,
        cursor_pos:        HashMap::new(),
        frameless:         HashMap::new(),
        #[cfg(feature = "a11y")]
        a11y_adapters:     HashMap::new(),
        #[cfg(feature = "a11y")]
        a11y_rx,
        #[cfg(feature = "a11y")]
        a11y_tx,
    };

    event_loop.run_app(&mut app).expect("Event loop error");
    app.restart_requested
}

// ── Internal ApplicationHandler ──────────────────────────────────────────────

// ── Frameless window helpers ─────────────────────────────────────────────────

/// Edge size in physical pixels for resize hit zones.
const EDGE: f64 = 8.0;

/// Returns the resize direction if `(x, y)` is within `EDGE` pixels of the
/// window border, or `None` if the cursor is in the interior.
fn edge_resize_direction(x: f64, y: f64, w: f64, h: f64) -> Option<ResizeDirection> {
    let left  = x < EDGE;
    let right = x > w - EDGE;
    let top   = y < EDGE;
    let bot   = y > h - EDGE;
    match (left, right, top, bot) {
        (true,  false, true,  false) => Some(ResizeDirection::NorthWest),
        (false, true,  true,  false) => Some(ResizeDirection::NorthEast),
        (true,  false, false, true ) => Some(ResizeDirection::SouthWest),
        (false, true,  false, true ) => Some(ResizeDirection::SouthEast),
        (true,  false, false, false) => Some(ResizeDirection::West),
        (false, true,  false, false) => Some(ResizeDirection::East),
        (false, false, true,  false) => Some(ResizeDirection::North),
        (false, false, false, true ) => Some(ResizeDirection::South),
        _ => None,
    }
}

fn edge_cursor_icon(dir: ResizeDirection) -> CursorIcon {
    match dir {
        ResizeDirection::NorthWest => CursorIcon::NwResize,
        ResizeDirection::NorthEast => CursorIcon::NeResize,
        ResizeDirection::SouthWest => CursorIcon::SwResize,
        ResizeDirection::SouthEast => CursorIcon::SeResize,
        ResizeDirection::West      => CursorIcon::WResize,
        ResizeDirection::East      => CursorIcon::EResize,
        ResizeDirection::North     => CursorIcon::NResize,
        ResizeDirection::South     => CursorIcon::SResize,
    }
}

struct ShellApp {
    config:            ShellConfig,
    handler:           Box<dyn FnMut(ShellEvent)>,
    proxy:             EventLoopProxy<GlyxUserEvent>,
    /// Next glyx handle to assign to a newly created window.
    next_handle:       u32,
    /// winit WindowId → glyx handle
    windows:           HashMap<WindowId, u32>,
    /// glyx handle → Arc<Window> (for request_redraw)
    window_arcs:       HashMap<u32, Arc<Window>>,
    /// Set to true when a Restart event is received; checked after run() returns.
    restart_requested: bool,
    /// Per-window last known cursor position (physical pixels).
    cursor_pos:        HashMap<u32, (f64, f64)>,
    /// Per-window: true when the window is frameless (decorations=false).
    frameless:         HashMap<u32, bool>,
    /// glyx handle → accesskit adapter. One per window, created before the
    /// window is first shown (accesskit_winit's requirement).
    #[cfg(feature = "a11y")]
    a11y_adapters:     HashMap<u32, accesskit_winit::Adapter>,
    /// Tree updates pushed by glyx-core (via the `A11yUpdateFn` closure
    /// handed out in `ShellEvent::WindowReady`), drained each `about_to_wait`.
    #[cfg(feature = "a11y")]
    a11y_rx:           std::sync::mpsc::Receiver<(u32, accesskit::TreeUpdate)>,
    /// Kept alive so cloning it into new `WindowReady` closures is cheap;
    /// the receiver end lives on `a11y_rx` above.
    #[cfg(feature = "a11y")]
    a11y_tx:           std::sync::mpsc::Sender<(u32, accesskit::TreeUpdate)>,
}

impl ShellApp {
    fn open_window(&mut self, event_loop: &ActiveEventLoop, handle: u32, attrs: WindowAttributes) {
        // accesskit_winit requires the adapter to be created BEFORE the window
        // is ever shown, so under the `a11y` feature we force the window
        // invisible at creation, wire up the adapter, then reveal it —
        // otherwise `Adapter::with_event_loop_proxy` panics.
        #[cfg(feature = "a11y")]
        let requested_visible = attrs.visible;
        #[cfg(feature = "a11y")]
        let attrs = attrs.with_visible(false);

        match event_loop.create_window(attrs) {
            Ok(w) => {
                let window = Arc::new(w);
                self.windows.insert(window.id(), handle);
                self.window_arcs.insert(handle, Arc::clone(&window));

                #[cfg(feature = "a11y")]
                {
                    let adapter = accesskit_winit::Adapter::with_event_loop_proxy(
                        event_loop, &window, self.proxy.clone(),
                    );
                    self.a11y_adapters.insert(handle, adapter);
                    if requested_visible {
                        window.set_visible(true);
                    }
                }

                #[cfg(feature = "a11y")]
                let a11y_update = {
                    let tx = self.a11y_tx.clone();
                    A11yUpdateFn(Arc::new(move |update| { let _ = tx.send((handle, update)); }))
                };

                (self.handler)(ShellEvent::WindowReady {
                    window_handle: handle,
                    window,
                    proxy: self.proxy.clone(),
                    #[cfg(feature = "a11y")]
                    a11y_update,
                });
            }
            Err(e) => log::error!("glyx-shell: failed to create window (handle {}): {}", handle, e),
        }
    }
}

impl ApplicationHandler<GlyxUserEvent> for ShellApp {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        // Only create the main window on the first resume.
        if !self.windows.is_empty() { return; }

        let handle = self.next_handle;
        self.next_handle += 1;

        let mut attrs = WindowAttributes::default()
            .with_title(&self.config.title)
            .with_visible(true)
            .with_decorations(self.config.decorations)
            .with_resizable(self.config.resizable);

        if let Some((ref rgba, w, h)) = self.config.icon_rgba {
            if let Ok(icon) = winit::window::Icon::from_rgba(rgba.clone(), w, h) {
                attrs = attrs.with_window_icon(Some(icon));
            }
        }

        match self.config.startup_mode {
            StartupMode::Fullscreen => {
                attrs = attrs.with_fullscreen(Some(winit::window::Fullscreen::Borderless(None)));
            }
            StartupMode::Maximized => {
                attrs = attrs.with_maximized(true);
            }
            StartupMode::Windowed => {
                attrs = attrs.with_inner_size(PhysicalSize::new(
                    self.config.width,
                    self.config.height,
                ));
            }
        }

        self.frameless.insert(handle, !self.config.decorations);
        self.open_window(event_loop, handle, attrs);
    }

    fn user_event(&mut self, event_loop: &ActiveEventLoop, event: GlyxUserEvent) {
        match event {
            GlyxUserEvent::CreateWindow { id, title, width, height } => {
                let attrs = WindowAttributes::default()
                    .with_title(title)
                    .with_inner_size(PhysicalSize::new(width, height))
                    .with_visible(true);
                self.open_window(event_loop, id, attrs);
            }
            GlyxUserEvent::Quit => {
                event_loop.exit();
            }
            GlyxUserEvent::Restart => {
                self.restart_requested = true;
                event_loop.exit();
            }
            #[cfg(feature = "a11y")]
            GlyxUserEvent::Accesskit(accesskit_winit::Event { window_id, window_event }) => {
                let Some(&handle) = self.windows.get(&window_id) else { return };
                match window_event {
                    accesskit_winit::WindowEvent::InitialTreeRequested => {
                        // WinitActivationHandler::request_initial_tree always
                        // returns None (see accesskit_winit source) — the
                        // platform adapter shows a placeholder until glyx-core's
                        // next per-frame tree push arrives via `a11y_rx`. No
                        // action needed here beyond letting that happen.
                    }
                    accesskit_winit::WindowEvent::ActionRequested(req) => {
                        // Focus/Click/Increment/Decrement/SetValue(numeric) are
                        // wired — Expand/Collapse/ScrollIntoView/text-selection
                        // actions are not (see glyx-core/src/a11y.rs's module
                        // doc comment for the full scope-limit list).
                        let action = match req.action {
                            accesskit::Action::Focus => Some("focus"),
                            accesskit::Action::Click => Some("click"),
                            accesskit::Action::Increment => Some("increment"),
                            accesskit::Action::Decrement => Some("decrement"),
                            accesskit::Action::SetValue => Some("setValue"),
                            _ => None,
                        };
                        if let Some(action) = action {
                            let numeric_value = match req.data {
                                Some(accesskit::ActionData::NumericValue(v)) => Some(v),
                                _ => None,
                            };
                            (self.handler)(ShellEvent::AccessibilityAction {
                                window_handle: handle,
                                target: req.target.0 as u32,
                                action: action.to_string(),
                                numeric_value,
                            });
                        }
                    }
                    accesskit_winit::WindowEvent::AccessibilityDeactivated => {}
                }
            }
        }
    }

    fn about_to_wait(&mut self, _event_loop: &ActiveEventLoop) {
        #[cfg(feature = "a11y")]
        while let Ok((handle, update)) = self.a11y_rx.try_recv() {
            if let Some(adapter) = self.a11y_adapters.get_mut(&handle) {
                adapter.update_if_active(move || update);
            }
        }
    }

    fn window_event(
        &mut self,
        event_loop: &ActiveEventLoop,
        window_id:  WindowId,
        event:      WindowEvent,
    ) {
        let handle = match self.windows.get(&window_id) {
            Some(&h) => h,
            None => return, // unknown window — ignore
        };

        // AccessKit must see every window event before (or regardless of)
        // our own handling, so its platform adapter can track window state.
        #[cfg(feature = "a11y")]
        if let Some(adapter) = self.a11y_adapters.get_mut(&handle) {
            if let Some(window) = self.window_arcs.get(&handle) {
                adapter.process_event(window, &event);
            }
        }

        match event {
            WindowEvent::CloseRequested => {
                (self.handler)(ShellEvent::CloseRequested { window_handle: handle });
                // Remove the closed window from our maps.
                self.windows.remove(&window_id);
                self.window_arcs.remove(&handle);
                // Exit only when ALL windows are closed.
                if self.windows.is_empty() {
                    event_loop.exit();
                }
            }

            WindowEvent::Resized(size) => {
                (self.handler)(ShellEvent::Resized {
                    window_handle: handle,
                    width:  size.width,
                    height: size.height,
                });
                if let Some(w) = self.window_arcs.get(&handle) {
                    w.request_redraw();
                }
            }

            WindowEvent::RedrawRequested => {
                (self.handler)(ShellEvent::RedrawRequested { window_handle: handle });
                if self.config.continuous {
                    if let Some(w) = self.window_arcs.get(&handle) {
                        w.request_redraw();
                    }
                }
            }

            WindowEvent::KeyboardInput {
                event: KeyEvent { physical_key, logical_key, state, .. }, ..
            } => {
                let key_name = match physical_key {
                    PhysicalKey::Code(code) => format!("{:?}", code),
                    PhysicalKey::Unidentified(_) => "Unidentified".into(),
                };
                let text = if state == ElementState::Pressed {
                    match &logical_key {
                        Key::Character(s) if s.len() == 1 => Some(s.to_string()),
                        Key::Named(NamedKey::Space) => Some(" ".to_string()),
                        _ => None,
                    }
                } else {
                    None
                };
                let pressed = state == ElementState::Pressed;
                (self.handler)(ShellEvent::KeyInput {
                    window_handle: handle,
                    key: key_name,
                    text,
                    pressed,
                });
                if let Some(w) = self.window_arcs.get(&handle) {
                    w.request_redraw();
                }
            }

            WindowEvent::MouseInput { button, state, .. } => {
                let btn = match button {
                    MouseButton::Left   => 0u8,
                    MouseButton::Right  => 1,
                    MouseButton::Middle => 2,
                    _                   => 3,
                };
                let pressed = state == ElementState::Pressed;
                // When frameless and left mouse pressed: check resize edge zones.
                // If the cursor is on an 8px border, initiate OS resize and swallow
                // the event (don't forward to glyx-core / JS).
                // `resizable: false` must also disable THIS path — it's a separate
                // mechanism from winit's own resizable flag (which only governs the
                // OS-native border on a decorated window), so a frameless window
                // could otherwise still be resized by dragging its edge even with
                // resizable:false set.
                if btn == 0 && pressed
                    && self.config.resizable
                    && self.frameless.get(&handle).copied().unwrap_or(false)
                {
                    if let Some(w) = self.window_arcs.get(&handle) {
                        let (cx, cy) = self.cursor_pos.get(&handle).copied().unwrap_or((0.0, 0.0));
                        let s = w.inner_size();
                        if let Some(dir) = edge_resize_direction(cx, cy, s.width as f64, s.height as f64) {
                            w.drag_resize_window(dir).ok();
                            w.request_redraw();
                            return; // swallow — do not forward to glyx-core
                        }
                    }
                }
                (self.handler)(ShellEvent::MouseInput {
                    window_handle: handle,
                    button: btn,
                    pressed,
                });
                if let Some(w) = self.window_arcs.get(&handle) {
                    w.request_redraw();
                }
            }

            WindowEvent::CursorMoved { position, .. } => {
                self.cursor_pos.insert(handle, (position.x, position.y));
                (self.handler)(ShellEvent::CursorMoved {
                    window_handle: handle,
                    x: position.x,
                    y: position.y,
                });
                // When frameless, update cursor icon at resize border zones.
                if self.config.resizable && self.frameless.get(&handle).copied().unwrap_or(false) {
                    if let Some(w) = self.window_arcs.get(&handle) {
                        let s = w.inner_size();
                        let icon = edge_resize_direction(
                            position.x, position.y,
                            s.width as f64, s.height as f64,
                        )
                        .map(edge_cursor_icon)
                        .unwrap_or(CursorIcon::Default);
                        w.set_cursor(icon);
                    }
                }
            }

            WindowEvent::MouseWheel { delta, .. } => {
                let delta_y = match delta {
                    MouseScrollDelta::LineDelta(_, y)   => y * 40.0,
                    MouseScrollDelta::PixelDelta(pos)   => pos.y as f32,
                };
                (self.handler)(ShellEvent::Scroll { window_handle: handle, delta_y });
                if let Some(w) = self.window_arcs.get(&handle) {
                    w.request_redraw();
                }
            }

            WindowEvent::Occluded(occluded) => {
                (self.handler)(ShellEvent::Occluded { window_handle: handle, occluded });
            }

            WindowEvent::Focused(focused) => {
                (self.handler)(ShellEvent::FocusChanged { window_handle: handle, focused });
            }

            WindowEvent::Ime(ime) => {
                let (kind, text, cursor) = match ime {
                    winit::event::Ime::Enabled => ("enabled", None, None),
                    winit::event::Ime::Preedit(s, cursor) => (
                        "preedit",
                        Some(s),
                        cursor.map(|(a, b)| (a as u32, b as u32)),
                    ),
                    winit::event::Ime::Commit(s) => ("commit", Some(s), None),
                    winit::event::Ime::Disabled => ("disabled", None, None),
                };
                (self.handler)(ShellEvent::Ime {
                    window_handle: handle,
                    kind: kind.to_string(),
                    text,
                    cursor,
                });
                if let Some(w) = self.window_arcs.get(&handle) {
                    w.request_redraw();
                }
            }

            _ => {}
        }
    }
}
