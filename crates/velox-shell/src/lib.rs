//! velox-shell — winit window creation and raw input event forwarding.
//!
//! ## Multi-window support
//!
//! The shell manages N windows identified by opaque `u32` handles.
//! Handle 0 is always the main window (created on startup).
//! Additional windows are created by sending `VeloxUserEvent::CreateWindow`
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
//! crates (velox-core, velox-runtime) have no dependency on winit.

use std::collections::HashMap;
use std::sync::Arc;
use winit::{
    application::ApplicationHandler,
    dpi::PhysicalSize,
    event::{ElementState, KeyEvent, MouseButton, MouseScrollDelta, WindowEvent},
    event_loop::{ActiveEventLoop, ControlFlow, EventLoop},
    keyboard::{Key, NamedKey, PhysicalKey},
    window::{Window, WindowAttributes, WindowId},
};

pub use winit::event_loop::EventLoopProxy;

// ── User events (sent from Rust side to the event loop) ───────────────────────

/// Events that non-event-loop threads can send to the event loop.
#[derive(Debug, Clone)]
pub enum VeloxUserEvent {
    /// Request creation of a secondary window with a pre-assigned handle.
    CreateWindow { id: u32, title: String, width: u32, height: u32 },
    /// Quit the application — closes all windows and exits the event loop.
    Quit,
    /// Quit then re-launch the same executable (for OTA apply / settings reload).
    Restart,
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
    /// via `proxy.send_event(VeloxUserEvent::CreateWindow { ... })`.
    WindowReady {
        window_handle: u32,
        window: Arc<Window>,
        proxy:  EventLoopProxy<VeloxUserEvent>,
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
}

impl Default for ShellConfig {
    fn default() -> Self {
        Self {
            title:        "Velox".into(),
            width:        1280,
            height:       800,
            continuous:   false,
            startup_mode: StartupMode::Windowed,
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
    let event_loop = EventLoop::<VeloxUserEvent>::with_user_event()
        .build()
        .expect("Failed to create EventLoop");

    let control_flow = if config.continuous {
        ControlFlow::Poll
    } else {
        ControlFlow::Wait
    };
    event_loop.set_control_flow(control_flow);
    log::debug!("velox-shell: ControlFlow = {:?}", control_flow);

    let proxy = event_loop.create_proxy();

    let mut app = ShellApp {
        config,
        handler:          Box::new(handler),
        proxy,
        next_handle:      0,
        windows:          HashMap::new(),
        window_arcs:      HashMap::new(),
        restart_requested: false,
    };

    event_loop.run_app(&mut app).expect("Event loop error");
    app.restart_requested
}

// ── Internal ApplicationHandler ──────────────────────────────────────────────

struct ShellApp {
    config:            ShellConfig,
    handler:           Box<dyn FnMut(ShellEvent)>,
    proxy:             EventLoopProxy<VeloxUserEvent>,
    /// Next velox handle to assign to a newly created window.
    next_handle:       u32,
    /// winit WindowId → velox handle
    windows:           HashMap<WindowId, u32>,
    /// velox handle → Arc<Window> (for request_redraw)
    window_arcs:       HashMap<u32, Arc<Window>>,
    /// Set to true when a Restart event is received; checked after run() returns.
    restart_requested: bool,
}

impl ShellApp {
    fn open_window(&mut self, event_loop: &ActiveEventLoop, handle: u32, attrs: WindowAttributes) {
        match event_loop.create_window(attrs) {
            Ok(w) => {
                let window = Arc::new(w);
                self.windows.insert(window.id(), handle);
                self.window_arcs.insert(handle, Arc::clone(&window));
                (self.handler)(ShellEvent::WindowReady {
                    window_handle: handle,
                    window,
                    proxy: self.proxy.clone(),
                });
            }
            Err(e) => log::error!("velox-shell: failed to create window (handle {}): {}", handle, e),
        }
    }
}

impl ApplicationHandler<VeloxUserEvent> for ShellApp {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        // Only create the main window on the first resume.
        if !self.windows.is_empty() { return; }

        let handle = self.next_handle;
        self.next_handle += 1;

        let mut attrs = WindowAttributes::default()
            .with_title(&self.config.title)
            .with_visible(true);

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

        self.open_window(event_loop, handle, attrs);
    }

    fn user_event(&mut self, event_loop: &ActiveEventLoop, event: VeloxUserEvent) {
        match event {
            VeloxUserEvent::CreateWindow { id, title, width, height } => {
                let attrs = WindowAttributes::default()
                    .with_title(title)
                    .with_inner_size(PhysicalSize::new(width, height))
                    .with_visible(true);
                self.open_window(event_loop, id, attrs);
            }
            VeloxUserEvent::Quit => {
                event_loop.exit();
            }
            VeloxUserEvent::Restart => {
                self.restart_requested = true;
                event_loop.exit();
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
                (self.handler)(ShellEvent::CursorMoved {
                    window_handle: handle,
                    x: position.x,
                    y: position.y,
                });
                // Hover-state redraws are triggered by the cursor-moved handler in
                // velox-core when needed. No unconditional redraw here.
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

            _ => {}
        }
    }
}
