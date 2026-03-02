//! velox-shell — winit window creation and raw input event forwarding.
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
//! When future subsystems need continuous rendering (animations, 3D, AI
//! progress) they will call `request_redraw()` from their update callbacks.
//! For games, switch to `ControlFlow::Poll` via the shell config.

use std::sync::Arc;
use winit::{
    application::ApplicationHandler,
    dpi::PhysicalSize,
    event::{ElementState, KeyEvent, MouseButton, WindowEvent},
    event_loop::{ActiveEventLoop, ControlFlow, EventLoop},
    keyboard::PhysicalKey,
    window::{Window, WindowAttributes, WindowId},
};

// ── Public event type ────────────────────────────────────────────────────────

/// Platform-agnostic events emitted by the shell.
#[derive(Debug, Clone)]
pub enum ShellEvent {
    /// Window is ready; GPU context can now be created.
    WindowReady { window: Arc<Window> },
    /// Window was resized to these physical pixel dimensions.
    Resized { width: u32, height: u32 },
    /// A frame should be rendered.
    RedrawRequested,
    /// User/OS requested the window to close.
    CloseRequested,
    /// Keyboard input.
    KeyInput { key: PhysicalKey, state: ElementState },
    /// Mouse button.
    MouseInput { button: MouseButton, state: ElementState },
    /// Cursor moved to physical pixel position.
    CursorMoved { x: f64, y: f64 },
}

// ── Shell config ─────────────────────────────────────────────────────────────

pub struct ShellConfig {
    pub title:       String,
    pub width:       u32,
    pub height:      u32,
    /// Use Poll (games/continuous rendering) instead of Wait (UI/battery).
    pub continuous:  bool,
}

impl Default for ShellConfig {
    fn default() -> Self {
        Self {
            title:      "Velox".into(),
            width:      1280,
            height:     800,
            continuous: false,
        }
    }
}

/// Run the shell event loop, calling `handler` for every `ShellEvent`.
///
/// Blocks until the window is closed. Must be called from the main thread.
pub fn run<F>(config: ShellConfig, mut handler: F)
where
    F: FnMut(ShellEvent) + 'static,
{
    let event_loop = EventLoop::new().expect("Failed to create EventLoop");

    // Wait   — sleeps when idle. Best for productivity/UI apps. Near-zero idle CPU.
    // Poll   — runs as fast as possible. Best for games and continuous animation.
    let control_flow = if config.continuous {
        ControlFlow::Poll
    } else {
        ControlFlow::Wait
    };
    event_loop.set_control_flow(control_flow);
    log::debug!("velox-shell: ControlFlow = {:?}", control_flow);

    let mut app = ShellApp {
        config,
        window:  None,
        handler: Box::new(move |ev| handler(ev)),
    };

    event_loop.run_app(&mut app).expect("Event loop error");
}

// ── Internal ApplicationHandler ──────────────────────────────────────────────

struct ShellApp {
    config:  ShellConfig,
    window:  Option<Arc<Window>>,
    handler: Box<dyn FnMut(ShellEvent)>,
}

impl ApplicationHandler for ShellApp {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        let attrs = WindowAttributes::default()
            .with_title(&self.config.title)
            .with_inner_size(PhysicalSize::new(self.config.width, self.config.height))
            .with_visible(true);

        let window = Arc::new(
            event_loop
                .create_window(attrs)
                .expect("Failed to create window"),
        );

        self.window = Some(window.clone());
        (self.handler)(ShellEvent::WindowReady { window });
    }

    fn window_event(
        &mut self,
        event_loop: &ActiveEventLoop,
        _window_id: WindowId,
        event:      WindowEvent,
    ) {
        match event {
            WindowEvent::CloseRequested => {
                (self.handler)(ShellEvent::CloseRequested);
                event_loop.exit();
            }

            WindowEvent::Resized(size) => {
                (self.handler)(ShellEvent::Resized {
                    width:  size.width,
                    height: size.height,
                });
                // Request a redraw after resize so the frame updates immediately.
                if let Some(w) = &self.window {
                    w.request_redraw();
                }
            }

            WindowEvent::RedrawRequested => {
                (self.handler)(ShellEvent::RedrawRequested);

                // In Poll mode the OS drives continuous redraws automatically.
                // In Wait mode we only redraw when explicitly asked — so we do
                // NOT re-request here.  The app requests a new frame when its
                // state changes (animation tick, async completion, etc.).
                if self.config.continuous {
                    if let Some(w) = &self.window {
                        w.request_redraw();
                    }
                }
            }

            WindowEvent::KeyboardInput {
                event: KeyEvent { physical_key, state, .. }, ..
            } => {
                (self.handler)(ShellEvent::KeyInput { key: physical_key, state });
                // Key input might change app state — request a redraw.
                if let Some(w) = &self.window {
                    w.request_redraw();
                }
            }

            WindowEvent::MouseInput { button, state, .. } => {
                (self.handler)(ShellEvent::MouseInput { button, state });
                if let Some(w) = &self.window {
                    w.request_redraw();
                }
            }

            WindowEvent::CursorMoved { position, .. } => {
                (self.handler)(ShellEvent::CursorMoved { x: position.x, y: position.y });
                // Cursor moves do not necessarily need a redraw — only request
                // one when hover states are implemented.
                // if let Some(w) = &self.window { w.request_redraw(); }
            }

            _ => {}
        }
    }
}
