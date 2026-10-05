# Changelog

Changes to the native runtime and renderer (`glyx-core`, and the crates it drives: `glyx-renderer`, `glyx-gpu`, `glyx-sysapi`, the vendored `vello`). JS-facing API changes are in `@glyx-dev/react`'s changelog.

## [Unreleased]

### Added
- **The app icon is available to the tray.** The window icon decoded at startup is registered with `glyx-tray`, so a tray icon created without pixels uses it, on both JS engines.
- **Native menu bar (Windows and macOS).** A `menubar` capability and `__glyx_menubar_*` bindings on both JS engines (shared logic in `glyx-runtime`'s `menubar_api`), built on `muda` in `glyx-tray`. On Windows the menu attaches to the window; on macOS it becomes the app menu with a standard application menu (About, Services, Hide, Quit) in front. The tray and the menu bar share one `muda` event handler, which routes a click to the menu bar when its id belongs there and to the tray otherwise, and cannot panic out of the window procedure. A click is pushed into the window's JS event queue (`InputEvent::MenuBar`) and wakes the frame loop, so nothing polls. The macOS path compiles but has not run on a Mac; elsewhere a native menu bar is reported as unavailable.
- **Tray events are pushed too.** `__glyx_tray_listen(true)` points tray events at the window's JS queue (`InputEvent::Tray`) instead of the polled queue. Without a listener they queue for `__glyx_tray_poll_events` as before.
- **Menu roles for assistive technology.** `menubar`, `menu`, `menuitem` and `menuitemcheckbox` map to AccessKit's `MenuBar`, `Menu`, `MenuItem` and `MenuItemCheckBox`; menu items are focusable like buttons.
- **Native keyboard focus.** Tab and Shift+Tab move focus across every focusable element (this works without the `a11y` feature), focus scrolls into view when it lands outside its nearest scroll container, and focus moves to the next valid node when the focused element is removed. The logic lives in its own `focus.rs`.
- **Accessibility hints and disclosure state.** `accessibilityHint` adds a supplementary description beyond the label, and `expanded` exposes Expand and Collapse actions for accordions and tree items.
- **`window.maxFps`** caps the frame rate of animations and drags, mainly for software renderers.
- **A motion engine owned by the frame loop.** Property transitions (timed, or on a critically damped spring that keeps its momentum when interrupted), keyframe animations, smooth-scroll springs and canvas tweens all advance in Rust, so no JavaScript runs per frame. Canvas tweens line up consecutive drawings command by command, so a chart that gains an axis tick still eases its data, and a canvas redrawn faster than its spring can settle glides linearly over the update gap instead of trailing a live stream. See ARCHITECTURE.md §24.
- **Reduced motion.** `GLYX_REDUCE_MOTION=1`, or the OS's animation-effects setting on Windows, makes transitions, smooth scroll and canvas tweens jump to their end state. Keyframe animations keep running.
- **Partial canvas redraw (CPU renderer).** A redrawn canvas is diffed against what it drew last frame and only the changed region is repainted, so a moving crosshair repaints a strip, not the chart. `GLYX_FULL_CANVAS_DAMAGE=1` turns it off.
- **Several damage rects.** A frame repaints a short list of rectangles (at most 8, merged when the box around two would waste little) instead of one box around everything that changed; the software present pushes each. `GLYX_SINGLE_DAMAGE_RECT=1` restores one box.
- **Vello scratch buffers sized from the scene.** Upstream allocates about 165 MiB of scratch buffers for every scene, sized for a 30,000-path map, and cannot recover when a scene outgrows them. They now start near 5 MiB, grow on demand and shrink when demand stays low; a frame that doesn't fit is detected from Vello's allocation counters and drawn again larger. Packaged dashboard in `renderMode: 'gpu'` on an integrated GPU: 182 MB, down from 484 MB steady and 676 MB at startup, at about +0.2 ms per frame. A scene that grows in a way the estimate doesn't see can, rarely, draw one frame with content missing before the buffers grow. `GLYX_VELLO_FIXED_BUFFERS=1` restores the fixed sizes. The Vello CPU pipeline (`renderMode: 'cpu'`) is unchanged. See `vendor/README.md`.
- **Devtools.** An Animations panel and motion-clock controls (pause, slow motion, step), GPU-renderer screenshots, and a full native DevTools suite with an MCP server (see `glyx-cli`'s changelog and `docs/DEVTOOLS.md`). `Animation.list` also reports canvas tweens and flags springs, `Automation.scroll` takes `smooth`, and `Memory.sample` includes wgpu's buffer, texture and reserved counts.

### Changed
- Consecutive cursor-move events are coalesced before they reach JS, which cuts native-to-JS traffic during fast pointer movement.
- **CPU renderer cost no longer scales with the size of the shapes drawn.** Large filled paths and long strokes are cut to the damaged region before rasterizing (tiny-skia scans a whole path before the clip mask trims it), rectangular clips stay lazy and narrow an existing mask in place instead of rebuilding a window-sized one, and glyphs, vertical gradients and large rounded rectangles have cheaper paths. A hover on the dashboard example went from about 22 ms to about 8 ms of render time.
- `glyx-sysapi` links `nokhwa` (camera) only with its `camera` feature, forwarded from `glyx-runtime`'s existing one. Builds without it no longer carry camera code. The microphone helpers are unchanged and remain in every build.
- wgpu's `counters` feature is enabled by `glyx-core`'s `dev` feature only (through `glyx-gpu`'s `counters`), since only the devtools memory panel reads it.

### Fixed
- Windows single-instance IPC used an invalid pipe path and failed with OS error 123. The pipe name now comes from one helper that builds a valid Windows named-pipe path.
- Text is measured again when its style changes, and trailing whitespace no longer leaves a line the wrong width. The text-layout cache key now includes `line_height`, so measurement matches what is drawn.
- Vello's `Scene::append` kept the wrong pending-render flags after text draws, which could skip a repaint.
