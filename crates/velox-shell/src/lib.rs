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
//! ## API surface
//!
//! `ShellEvent` deliberately uses only primitive Rust types so that upstream
//! crates (velox-core, velox-runtime) have no dependency on winit.

use std::sync::Arc;
use winit::{
    application::ApplicationHandler,
    dpi::PhysicalSize,
    event::{ElementState, KeyEvent, MouseButton, MouseScrollDelta, WindowEvent},
    event_loop::{ActiveEventLoop, ControlFlow, EventLoop},
    keyboard::{Key, NamedKey, PhysicalKey},
    window::{Window, WindowAttributes, WindowId},
};

// ── Public event type ────────────────────────────────────────────────────────

/// Platform-agnostic events emitted by the shell.
///
/// All fields use primitive Rust types — no winit types leak through.
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
    /// Keyboard key pressed or released.
    ///
    /// - `key`:     a stable name string, e.g. `"KeyA"`, `"Enter"`, `"Backspace"`.
    /// - `text`:    the Unicode character produced (only on press, for printable keys).
    /// - `pressed`: true on key-down, false on key-up.
    KeyInput { key: String, text: Option<String>, pressed: bool },
    /// Mouse button pressed or released at the current cursor position.
    ///
    /// - `button`: 0 = left, 1 = right, 2 = middle.
    /// - `pressed`: true on button-down, false on button-up.
    MouseInput { button: u8, pressed: bool },
    /// Cursor moved to physical pixel position.
    CursorMoved { x: f64, y: f64 },
    /// Vertical scroll (positive = scroll down).
    Scroll { delta_y: f32 },
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
/// Blocks until the window is closed. Must be called from the main thread.
pub fn run<F>(config: ShellConfig, handler: F)
where
    F: FnMut(ShellEvent) + 'static,
{
    let event_loop = EventLoop::new().expect("Failed to create EventLoop");

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
        handler: Box::new(handler),
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
                attrs = attrs.with_inner_size(PhysicalSize::new(self.config.width, self.config.height));
            }
        }

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
                if let Some(w) = &self.window {
                    w.request_redraw();
                }
            }

            WindowEvent::RedrawRequested => {
                (self.handler)(ShellEvent::RedrawRequested);
                if self.config.continuous {
                    if let Some(w) = &self.window {
                        w.request_redraw();
                    }
                }
            }

            WindowEvent::KeyboardInput {
                event: KeyEvent { physical_key, logical_key, state, .. }, ..
            } => {
                // Convert PhysicalKey to a stable name string.
                let key_name = match physical_key {
                    PhysicalKey::Code(code) => format!("{:?}", code),
                    PhysicalKey::Unidentified(_) => "Unidentified".into(),
                };

                // Extract printable text from the logical key (press only).
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

                (self.handler)(ShellEvent::KeyInput { key: key_name, text, pressed });
                if let Some(w) = &self.window {
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
                (self.handler)(ShellEvent::MouseInput { button: btn, pressed });
                if let Some(w) = &self.window {
                    w.request_redraw();
                }
            }

            WindowEvent::CursorMoved { position, .. } => {
                (self.handler)(ShellEvent::CursorMoved { x: position.x, y: position.y });
                // Hover-state redraws are triggered by the cursor-moved handler in
                // velox-core when needed. No unconditional redraw here.
            }

            WindowEvent::MouseWheel { delta, .. } => {
                let delta_y = match delta {
                    MouseScrollDelta::LineDelta(_, y)   => y * 40.0,
                    MouseScrollDelta::PixelDelta(pos)   => pos.y as f32,
                };
                (self.handler)(ShellEvent::Scroll { delta_y });
                if let Some(w) = &self.window {
                    w.request_redraw();
                }
            }

            _ => {}
        }
    }
}
