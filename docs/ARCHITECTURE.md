# Glyx Architecture

Glyx is a Rust framework for building desktop applications with React and TypeScript. The rendering stack, layout engine, text shaper, and JavaScript runtime are all written in Rust. The application logic and UI are written in React+TypeScript and bundled by Bun. There is no Electron, no Chromium, no DOM.

This document describes how the pieces fit together.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Crate Map](#2-crate-map)
3. [Startup Sequence](#3-startup-sequence)
4. [Shell: winit Event Loop](#4-shell-winit-event-loop)
5. [Frame Loop Sequence](#5-frame-loop-sequence)
6. [JavaScript Runtime](#6-javascript-runtime)
7. [Binding Pattern](#7-binding-pattern)
8. [Async Bridge](#8-async-bridge)
9. [Scene Command System](#9-scene-command-system)
10. [Layout Engine](#10-layout-engine)
11. [Rendering Pipeline](#11-rendering-pipeline)
12. [Text System](#12-text-system)
13. [3D Rendering](#13-3d-rendering)
14. [Security and Capabilities](#14-security-and-capabilities)
15. [Hot Reload (HMR)](#15-hot-reload-hmr)
16. [Multi-Window Architecture](#16-multi-window-architecture)
17. [Media Architecture](#17-media-architecture)
18. [Snapshot Pipeline and Distribution](#18-snapshot-pipeline-and-distribution)
19. [Database Layer](#19-database-layer)
20. [Local AI](#20-local-ai)
21. [JS Package Ecosystem](#21-js-package-ecosystem)
22. [Key Design Decisions](#22-key-design-decisions)

---

## 1. High-Level Overview

```
  App Developer writes:           Glyx Rust runtime provides:

  js/app.jsx                      winit  (OS window, input events)
      |                           wgpu   (GPU context, swapchain)
  React component tree            Vello  (2D vector rendering)
      |                           Taffy  (CSS flexbox layout)
  @glyx/react bindings           Parley (text shaping)
      |                           V8     (JavaScript engine)
  native bindings (~120)          Tokio  (async runtime)
      |
  Rust subsystems
  (db, fs, net, audio, video, AI, camera, ...)
```

The app developer writes React components. Glyx's React reconciler (built on `react-reconciler`) translates component tree mutations into `SceneCommand` messages. The Rust side processes those commands, computes layout via Taffy, and draws the result via Vello onto a wgpu texture, which is then blitted to the OS window surface.

There is no DOM. There is no WebView. JS runs in an embedded V8 isolate. All I/O goes through the native binding layer. Rust enforces capability-based access control at each binding.

---

## 2. Crate Map

All crates live under `crates/`.

| Crate | Binary/Lib | Purpose |
|-------|-----------|---------|
| `glyx-shell` | lib | winit window creation and raw input event forwarding. Translates winit types into primitive Rust types so no winit types leak to glyx-core. Multi-window handle mapping. |
| `glyx-core` | lib | Main application coordinator. Wires all subsystems together. Owns the per-frame loop, state management, HMR in dev mode, and the JS-to-Vello rendering path. |
| `glyx-runtime` | lib | V8 embedding. Registers all native bindings (~120 functions). Manages the async completion queue. Exposes `GlyxRuntime` which owns the V8 Isolate, Context, and the global `AsyncState`. |
| `glyx-renderer` | lib | Vello-based 2D rendering. `FrameBuilder` accumulates draw calls. `GlyxRenderer::render_frame()` rasterizes via Vello and blits to the swapchain surface. |
| `glyx-text` | lib | Text shaping and layout via Parley. Font discovery per platform. Cursor position measurement for `TextInput`. |
| `glyx-layout` | lib | Taffy flex-layout integration. Converts `NodeProps` to `taffy::Style`. `LayoutTree` owns all Taffy node IDs. |
| `glyx-gpu` | lib | wgpu context creation and surface management. Surface resize. `GpuContext` owns `Device`, `Queue`, `Surface`. |
| `glyx-security` | lib | Capability model. Parses `glyx.config.json` into `Capabilities`. Global singleton via `OnceLock`. Binding layer queries it before every privileged operation. |
| `glyx-db` | lib | SQLx + libsqlite3-sys. Connection pool per database file. Graceful shutdown drains pools before process exit. |
| `glyx-sysapi` | lib | OS-level APIs: battery status, system info, dark mode detection, OS keychain via `keyring`, audio recording via CPAL, camera list/capture. |
| `glyx-3d` | lib | wgpu 3D rendering pass. Phong lighting pipeline in WGSL. Off-screen RGBA8 target composited over the Vello scene. glTF mesh loading via `gltf` crate. |
| `glyx-ai` | lib | Local ML inference via Candle. MiniLM-L6-v2 embeddings, Phi-2 Q4_K_M generation, Whisper-tiny transcription. HF Hub model downloads. |
| `glyx-media` | lib | Thin loader for the glyx-media DLL. `OnceLock` singleton. Ed25519 manifest verification. Exposes ffmpeg decode/encode API through raw function pointers. |
| `glyx-perf` | lib | Frame timing metrics. FPS, P99 latency, JS execution time, layout time. Values displayed in the dev overlay. |
| `glyx-runner` | bin | Prebuilt binary for JS-only projects. Reads binary trailer (snapshot + app.js + config) from its own executable. Enables zero-Cargo deployment. |
| `glyx-cli` | bin | `glyx create/dev/build/runtime` CLI. Project scaffolding, runner caching, snapshot build, Bun invocation. |

Each crate has a narrow, well-defined responsibility. `glyx-core` is the coordinator but contains no rendering or layout logic itself — it calls into `glyx-renderer` and `glyx-layout`.

---

## 3. Startup Sequence

```
glyx-runner::main()  (or notes-app::main() for native projects)
  |
  AppConfig::from_config()          read glyx.config.json, parse capabilities
  |                                 OR
  AppConfig::from_trailer()         read binary trailer from own exe
  |
glyx-core::run(config)
  |
  glyx_security::init(caps)        set global capability singleton
  glyx_gpu::GpuContext::new()      init wgpu adapter/device/queue
  glyx_renderer::GlyxRenderer::new()
  glyx_text::TextSystem::new()     discover platform fonts
  GlyxRuntime::new_with_ipc()      create V8 Isolate + Context
    -> eval(snapshot_blob)          OR eval(app_js) if no snapshot
    -> register_all()               register ~120 native bindings
    -> runtime.eval(app_js)         execute app bundle
    -> flush_microtasks()           commit Promise-deferred React work
    -> drain_scene_commands()       initial React render
  |
  #[cfg(feature = "dev")]
  init_dev_mode()                   start notify file watcher + bun rebuild thread
  |
  glyx_shell::run(app_state, handler)
    -> EventLoop::build()
    -> event_loop.run_app(ShellApp)  ← main thread blocks here
```

After startup, all application logic runs inside the winit event loop on the main thread. Async operations (network, file I/O, DB queries) execute on Tokio worker threads and communicate back via the completion queue.

---

## 4. Shell: winit Event Loop

**File**: `crates/glyx-shell/src/lib.rs`

The shell uses winit 0.30.12. The event loop runs with `ControlFlow::Wait`, which means the process sleeps when no events arrive. On a static UI with no animations this results in 0% CPU usage.

`ShellApp` implements winit's `ApplicationHandler` trait and owns:

```
ShellApp {
    windows:      HashMap<WindowId, u32>           winit ID -> glyx handle
    window_arcs:  HashMap<u32, Arc<Window>>        glyx handle -> winit Window
    cursor_pos:   HashMap<u32, (f64, f64)>         per-window cursor tracking
    frameless:    HashMap<u32, bool>               frameless window flags
    handler:      Box<dyn FnMut(ShellEvent, &EventLoopProxy)>
}
```

**Input processing**:

| winit Event | Conversion |
|-------------|------------|
| `RedrawRequested` | `ShellEvent::RedrawRequested { window_handle }` |
| `KeyboardInput` | `ShellEvent::KeyboardInput { key, text, pressed, ctrl, shift, alt }` |
| `MouseInput` | `ShellEvent::MouseInput { button, pressed, x, y }` |
| `CursorMoved` | Updates `cursor_pos`. On frameless windows, updates edge-resize cursor icon |
| `MouseWheel` | `ShellEvent::Scroll { delta_y }` — LineDelta * 40 or PixelDelta.y |
| `CloseRequested` | Remove window from maps. If last window: `EventLoop::exit()` |
| `Resized` | `ShellEvent::Resize { width, height }`, then request redraw |

**Frameless windows** (custom title bar):

When `ShellConfig::decorations = false`, the shell enables edge resize detection. On any `MouseInput` event, the shell checks whether the cursor is within 8px of a window edge using `edge_resize_direction(x, y, w, h)`. If it is, `window.drag_resize_window(direction)` is called and the event is not forwarded to glyx-core.

On left-button-press on a node with `glyxDraggable: true`, glyx-core calls `window.drag_window()` to initiate OS-level window drag.

**User events** (cross-thread, via `EventLoopProxy<GlyxUserEvent>`):

```rust
enum GlyxUserEvent {
    CreateWindow { id: u32, title: String, width: u32, height: u32 },
    Quit,
    Restart,   // for OTA auto-updater: re-exec the binary after update
}
```

These are posted from Tokio threads to the main thread event loop.

---

## 5. Frame Loop Sequence

**File**: `crates/glyx-core/src/lib.rs`

Every frame, glyx-core executes this sequence on the main thread:

```
1. runtime.tick()
   - Drain CompletionQueue (async Promise results from Tokio threads)
   - For each Completion: reconstruct Global<PromiseResolver>, call resolve() or reject()
   - Call perform_microtask_checkpoint() to flush queued microtasks

2. drain_scene_commands() + apply_scene_commands()
   - Consume SceneCommands from the queue populated by step 1's JS side effects
   - Update js_nodes HashMap (create / update / remove nodes)
   - Mark layout dirty if layout-affecting props changed

3. runtime.frame_tick()
   - Call JS __glyx_frameCallback(timestamp)
   - _pollWebSockets(), _pollIpc(), _pollVideo(), _pollAudio() etc. run inside
   - React processes events, runs effects, calls setState
   - More SceneCommands are pushed by React's reconciler
   - Catch JS exceptions, store in DevModeState for error overlay

4. drain_scene_commands() + apply_scene_commands()
   - Consume the React re-render SceneCommands from step 3
   - Update js_nodes for the new component tree

5. Pull live frames (camera and video)
   - frame_buf.lock().take() -> Some((w, h, rgba)) for active video handles
   - Update corresponding peniko::Image in images HashMap

6. recompute_layout()
   - Only runs if layout_dirty == true
   - If structure changed: full Taffy tree rebuild
   - Else: incremental mark_dirty on changed nodes only
   - compute() runs Taffy flex algorithm
   - update_scroll_positions() applies ScrollView offsets to layout cache

7. Acquire GPU swapchain texture (surface.get_current_texture())

8. Cursor blink phase
   - Toggle every 500ms (based on Instant::elapsed)
   - Drives the cursor visibility state for the focused TextInput

9. render_subtree(root_id, builder, state)
   - Recursive depth-first walk of js_nodes
   - Draw into FrameBuilder using Taffy-computed positions

10. renderer.render_frame(gpu, surface_texture, frame_builder)
    - Vello rasterize -> off-screen RGBA8 texture
    - Blit off-screen -> swapchain texture
    - submit + present

11. #[cfg(feature = "dev")]
    - draw_dev_overlay() if error or perf overlay active
    - handle_dev_build_events() checks HMR channel (try_recv, non-blocking)
```

**Dirty tracking**: Glyx distinguishes between layout-affecting and visual-only property changes.

Layout-affecting: `width`, `height`, `flex`, `flex_direction`, `justify_content`, `align_items`, `padding`, `gap`, `text`, `font_size` — trigger Taffy recompute.

Visual-only: `color`, `background_color`, `border_color`, `border_width`, `border_radius`, `opacity`, `clip`, `scroll_offset_y` — applied directly without Taffy involvement, skipping the most expensive step in the frame.

---

## 6. JavaScript Runtime

**File**: `crates/glyx-runtime/src/lib.rs`

`GlyxRuntime` owns a V8 `OwnedIsolate` and a `Global<Context>`. V8 is initialized once per process via `v8::Platform::new()`.

**Memory configuration** (production builds):

```rust
params.set_flags_from_string("--lite-mode --optimize-for-size --no-expose-wasm");
params.heap_limits(2 * 1024 * 1024, 256 * 1024 * 1024);  // 2MB initial, 256MB max
```

`--lite-mode` disables Turbofan (the optimizing JIT compiler). This trades peak throughput for ~60-80% less code-space memory. Desktop UI code rarely benefits from Turbofan anyway — hot paths are in Rust, not JS.

**Evaluation**:

```
GlyxRuntime::eval(js: &str) -> Result<(), String>
  scope.execute_script(source)
  scope.perform_microtask_checkpoint()   <- flush Promise queues
  low_memory_notification()              <- hint V8 to GC
```

`perform_microtask_checkpoint()` must be called after eval to flush any `Promise.resolve().then()` or `queueMicrotask()` callbacks that React schedules during initial render. Without this, the first frame arrives with an empty scene.

**ReactDOM render model**:

The app bundle calls `render(<App />)` which calls `react-reconciler`'s `createRoot().render()`. Glyx's HostConfig (in `js/packages/@glyx/react/src/hostConfig.js`) maps reconciler calls to native bindings:

```
createInstance(type, props)     -> __glyx_createNode(id, type, props_json)
appendChildToContainer(p, c)   -> __glyx_appendChild(parent_id, child_id)
commitUpdate(inst, diff)       -> __glyx_updateNode(id, changed_props_json)
removeChild(parent, child)     -> __glyx_removeNode(child_id)
```

These run synchronously in V8. The SceneCommand queue is effectively a synchronous channel between JS and Rust — JS pushes to it during the reconciler commit phase, Rust drains it immediately after `frame_tick()` returns.

---

## 7. Binding Pattern

**File**: `crates/glyx-runtime/src/bindings.rs`

All native bindings are registered in `register_all()` during runtime initialization. A `register!` macro attaches each callback to the V8 global object:

```rust
macro_rules! register {
    ($name:literal, $cb:ident) => {
        let tmpl = v8::FunctionTemplate::builder($cb)
            .data(ext.into())   // raw ptr to AsyncState, passed to every callback
            .build(scope);
        let func = tmpl.get_function(scope).unwrap();
        let key  = v8::String::new(scope, $name).unwrap();
        global.set(scope, key.into(), func.into());
    };
}
```

Every callback function has the signature:

```rust
fn my_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let state = unsafe { &*(args.data().unwrap()
        .cast::<v8::External>().value() as *const AsyncState) };
    // ... work ...
}
```

`AsyncState` is allocated once as a `Box<AsyncState>` and leaked (via `Box::into_raw`) before registration. Its address never changes for the lifetime of the runtime. The raw pointer is safe to use because:
- V8 callbacks only run on the main thread
- V8 callbacks only run while the runtime is alive
- `AsyncState` is !Send so the borrow checker prevents accidental sharing

`AsyncState` contains:
- `queue: Arc<Mutex<VecDeque<Completion>>>` — async Promise results
- `tokio: tokio::runtime::Handle` — spawn async tasks
- `scene: Arc<Mutex<VecDeque<SceneCommand>>>` — scene mutation queue
- `request_redraw: Option<Arc<dyn Fn() + Send + Sync>>` — wake the winit event loop
- 20+ optional fields for audio sinks, camera handles, video decoders, AI model state, etc.

---

## 8. Async Bridge

The async bridge allows Rust Tokio tasks to resolve V8 Promises without holding the V8 lock.

**Producing a Promise** (in a callback):

```rust
fn fetch_callback(scope, args, mut rv) {
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());   // return Promise immediately

    state.tokio.spawn(async move {
        let result = do_async_work().await;
        enqueue_completion(&queue, redraw.as_ref(), Completion {
            resolver_ptr,
            result: Ok(json_string),  // or Err(error_string)
        });
    });
}
```

`make_promise`:
1. Creates `v8::PromiseResolver::new(scope)`
2. Wraps in `v8::Global<PromiseResolver>` (escapes current HandleScope)
3. Boxes the Global, takes raw pointer (`Box::into_raw` → usize)
4. Returns the raw pointer, the Promise, the queue, and the redraw callback

The raw pointer is the only way to send a V8 handle across the Tokio thread boundary without holding the V8 lock.

**Consuming completions** (in `runtime.tick()`):

```rust
fn tick(&mut self) {
    let scope = &mut v8::HandleScope::new(&mut self.isolate);
    let ctx = v8::Local::new(scope, &self.context);
    let scope = &mut v8::ContextScope::new(scope, ctx);

    let completions: Vec<Completion> = self.queue.lock().unwrap().drain(..).collect();
    for c in completions {
        // Reconstruct Global<PromiseResolver> from raw pointer
        let global_res = unsafe { Box::from_raw(c.resolver_ptr as *mut v8::Global<v8::PromiseResolver>) };
        let resolver = v8::Local::new(scope, *global_res);
        match c.result {
            Ok(s)  => { let v = v8::String::new(scope, &s).unwrap(); resolver.resolve(scope, v.into()); }
            Err(s) => { let v = v8::String::new(scope, &s).unwrap(); resolver.reject(scope, v.into()); }
        }
    }
    scope.perform_microtask_checkpoint();
}
```

`perform_microtask_checkpoint()` is critical: it runs the `.then()` handlers attached to just-resolved Promises. Without it, React state updates triggered by `await` calls would not propagate until the next frame.

**Capability rejection**:

Privileged bindings check capabilities before making a Promise. If the capability is absent, they return a pre-rejected Promise synchronously:

```rust
if !glyx_security::get().network {
    rv.set(reject_cap_promise(scope, "network").into());
    return;
}
```

`reject_cap_promise` creates a `PromiseResolver`, rejects it immediately with an error string, and returns the already-rejected Promise. The JS `.catch()` handler runs on the next microtask checkpoint.

---

## 9. Scene Command System

**File**: `crates/glyx-runtime/src/bindings.rs`, `crates/glyx-core/src/scene.rs`

The scene command queue is the interface between JS and the Rust UI tree. It is an `Arc<Mutex<VecDeque<SceneCommand>>>`.

**SceneCommand variants**:

```rust
pub enum SceneCommand {
    CreateNode   { id: u32, node_type: NodeType, props: NodeProps },
    AppendChild  { parent_id: u32, child_id: u32 },
    UpdateNode   { id: u32, props: NodeProps },
    RemoveNode   { id: u32 },
    SetRoot      { id: u32 },
    CreateImage  { id: u32, path: String },
    CanvasUpdate { id: u32, cmds: Vec<CanvasCmd> },
    Canvas3DUpdate { id: u32, scene: Scene3D },
    OpenCamera   { handle_id: u32, device_index: u32 },
    CloseCamera  { handle_id: u32 },
    CaptureCamera { handle_id: u32, tx: OneshotSender<...> },
    StartCameraRecord { handle_id: u32, output_path: String },
    StopCameraRecord  { handle_id: u32, tx: OneshotSender<...> },
    OpenVideo    { handle_id: u32, url: String },
    SeekVideo    { handle_id: u32, seconds: f64 },
    CloseVideo   { handle_id: u32 },
}
```

**Node types**:

```rust
pub enum NodeType {
    View,     // flex container (most elements)
    Text,     // text leaf rendered by Parley
    Image,    // raster image (PNG/JPEG/WebP/BMP) loaded by image crate
    Canvas,   // 2D imperative canvas (Vello primitives)
    Canvas3D, // 3D scene overlay (wgpu pass)
    Camera,   // live camera preview (peniko::Image updated each frame)
    Video,    // video player (peniko::Image updated per PTS)
}
```

**NodeProps** contains all possible visual and layout properties:

```
width, height, flex, flex_direction, justify_content, align_items,
padding, gap, text, font_size, font_weight, color, background_color,
border_width, border_color, border_radius, opacity,
image_path, image_mode (cover/contain/stretch/fill/center),
clip, scroll_offset_y, z_index,
draggable, glyx_draggable,
video_handle, camera_handle, camera_mirror
```

**apply_scene_commands** (`crates/glyx-core/src/scene.rs`):

Processes each command in order:

- `CreateNode`: inserts into `js_nodes: HashMap<u32, JsNode>`; marks layout dirty
- `AppendChild`: adds child_id to parent's `children` Vec; marks layout dirty
- `UpdateNode`: diffs old and new props; marks layout dirty only if layout props changed
- `RemoveNode`: removes from `js_nodes`; scans all remaining nodes to remove stale child refs
- `SetRoot`: sets `js_root = Some(id)`
- `CreateImage`: loads image bytes via `image` crate, decodes to `peniko::Image`, stores in LRU cache (64 entries)
- `CanvasUpdate`: stores `Vec<CanvasCmd>` in `canvas_cmds: HashMap<u32, Vec<CanvasCmd>>`
- `Canvas3DUpdate`: stores `Scene3D` in `canvas3d_scenes: HashMap<u32, Scene3D>`
- `OpenVideo`: spawns decode thread (glyx-media DLL); spawns audio thread (rodio)
- `OpenCamera`: spawns nokhwa camera capture thread

**Image LRU cache**:

Images decoded from disk are stored in `images_by_path: LruCache<String, peniko::Image>` with capacity 64. On cache eviction, `peniko::Image`'s internal Arc drops and the pixel data is freed. Images are re-decoded on access if evicted.

---

## 10. Layout Engine

**Files**: `crates/glyx-layout/`, `crates/glyx-core/src/layout.rs`

Glyx uses Taffy for CSS flexbox layout. Taffy is driven on the main thread, synchronously, during the frame loop.

**Node style conversion** (`to_taffy_style`):

For `NodeType::View`:
```
display:           Flex
flex_direction:    Row | Column  (default Column)
justify_content:   FlexStart | FlexEnd | Center | SpaceBetween | SpaceAround
align_items:       FlexStart | FlexEnd | Center | Stretch  (default Stretch)
size.width:        Auto | Length(px) | Percent(%)
size.height:       Auto | Length(px) | Percent(%)
padding:           Rect { all: px }  or individual sides
gap:               Size { width: px, height: px }
flex_grow:         f32  (from props.flex)
```

For leaf nodes (`Text`, `Image`, `Canvas`, `Camera`, `Video`):
```
size.width:   Length(px)   (explicit width required)
size.height:  Length(px)
```

Text nodes register a measure function with Taffy. When Taffy needs to know a text node's size, it calls back into `glyx-text`'s `TextSystem::measure()` which returns `(shaped_width, shaped_height)` based on the text content, font size, and available width. This is how text wrapping integrates with flex layout.

**Incremental layout**:

Glyx distinguishes two types of layout changes:

1. **Structure change** (nodes added/removed, children reordered): full Taffy tree rebuild. `rebuild_layout_from_scene()` reconstructs all Taffy nodes from the current `js_nodes` map. This is the expensive path.

2. **Style change** (width/height/flex changed on an existing node): incremental update. `set_style(taffy_node, new_style)` + `mark_dirty(taffy_node)` on the changed node only. Taffy propagates dirtiness upward and recomputes only the affected subtree.

3. **Visual-only change** (color, border, clip, scroll_offset_y): no Taffy involvement. `layout_dirty` is not set. The renderer re-reads the same layout cache positions with updated visual props.

**Post-layout: scroll positions**

After `compute()`, `update_scroll_positions()` walks the JS tree and, for each `ScrollView` node, adds `scroll_offset_y` to the layout positions of all its children. This is a post-processing step because Taffy positions children absolutely relative to their parent's top-left, ignoring scroll state.

The hit-test binding `__glyx_getLayout(id)` returns scroll-adjusted positions, so JS-side event dispatch always uses the correct visual coordinates.

---

## 11. Rendering Pipeline

**File**: `crates/glyx-renderer/src/lib.rs`

**Structure**:

```
GlyxRenderer {
    renderer:    vello::Renderer         // Vello CPU/GPU rasterizer
    blit:        BlitPipeline            // wgpu pipeline: off-screen -> swapchain
    target:      RenderTarget            // off-screen RGBA8 wgpu texture
    scene:       vello::Scene            // accumulates Vello draw commands
}
```

**FrameBuilder pattern**:

The `scene` field is moved out of `GlyxRenderer` at the start of each frame and moved into `FrameBuilder`:

```rust
pub fn begin_frame(&mut self) -> FrameBuilder {
    self.scene.reset();
    FrameBuilder { scene: mem::replace(&mut self.scene, vello::Scene::new()) }
}
```

`FrameBuilder` is passed to `render_subtree()` which draws into it. After drawing is complete, `render_frame()` takes the FrameBuilder back:

```rust
pub fn render_frame(&mut self, gpu, surface_texture, frame: FrameBuilder) {
    self.scene = frame.scene;   // reclaim
    // Vello rasterize
    self.renderer.render_to_texture(&gpu.device, &gpu.queue, &self.scene, &self.target.view, params);
    // Blit to swapchain
    self.blit.blit(gpu, &self.target.view, &surface_view);
}
```

This ownership transfer pattern avoids a two-mutable-borrow conflict: if FrameBuilder borrowed `&mut self.scene` from `GlyxRenderer`, the borrow would prevent calling `render_frame(&mut self)`.

**render_subtree** (glyx-core, iterates `js_nodes`):

For each node in z-index sorted order:

| Node type | Action |
|-----------|--------|
| `View` (normal) | `fill_rounded_rect` for background; `stroke_rounded_rect` for border |
| `View` (ScrollView with `clip: true`) | `push_layer(x, y, w, h)` before children, `pop_layer()` after |
| `Text` | `shape_text()` -> `TextLayout`; `frame.draw_text(layout, x, y, color)` |
| `Image` | Lookup in LRU cache; `frame.draw_image(image, x, y, w, h)` with `image_mode` transform |
| `Canvas` | Iterate `canvas_cmds[id]`; call `fill_rect/stroke_line/fill_circle/fill_text/...` |
| `Canvas3D` | Record `(id, x, y, w, h)` in `canvas3d_overlays` for post-Vello 3D pass |
| `Camera` | Lookup frame in `camera_frames[handle_id]`; `frame.draw_image(...)` |
| `Video` | Lookup frame in `video_frames[handle_id]`; `frame.draw_image(...)` |

**Z-index sorting**:

Before rendering children of a node, the children list is sorted by `z_index` (stable sort, default 0). Higher z-index renders on top. This is how `Select` and `DatePicker` dropdowns appear above adjacent content.

**3D overlay pass** (post-Vello):

After `render_frame()` composites the Vello scene onto the off-screen texture, `glyx-3d`'s `Renderer3D::render()` is called for each entry in `canvas3d_overlays`. The 3D pass renders into a separate off-screen RGBA8+depth target and then composites the result over the Vello texture at the recorded (x, y, w, h) bounds.

**Blit pipeline**:

The off-screen Vello texture is not the swapchain surface directly — this allows Vello to always render at a stable format (`rgba8unorm`) regardless of the swapchain's preferred format. The blit pipeline is a single-quad wgpu render pass that samples the off-screen texture and writes to the swapchain surface.

---

## 12. Text System

**File**: `crates/glyx-text/src/lib.rs`

Text rendering uses Parley (a text layout library built on Fontique for font discovery and Swash for shaping/rasterization).

**Font discovery** (platform-specific):

- **Windows**: Load only Segoe UI variants from `C:\Windows\Fonts`. The full Windows font directory is >500 MB and scanning it delays startup by seconds. Only `segoeui.ttf`, `segoeuib.ttf`, `seguisb.ttf` are registered plus a fallback emoji font.
- **macOS**: Scan `/System/Library/Fonts` and `/Library/Fonts`.
- **Linux**: Scan `/usr/share/fonts`, `/usr/local/share/fonts`, `~/.local/share/fonts`.

**Text shaping** (`TextSystem::shape()`):

```
FontContext + LayoutContext:
  builder.push_default(FontSize(size))
  builder.push_default(FontStack("Segoe UI, Helvetica Neue, DejaVu Sans, sans-serif"))
  builder.push_default(FontWeight(weight))
  builder.push_default(Brush(color))
  layout = builder.build(text)
  layout.break_all_lines(Some(max_width))   <- word-wrap
  layout.align(Some(max_width), Alignment::Start)
```

The returned `TextLayout` wraps a Parley `Layout<Color>`. Its dimensions are:
- `width()`: shaped advance (can exceed max_width if a single word is very wide)
- `height()`: total line-box height including leading

**Drawing text** (`FrameBuilder::draw_text()`):

Iterates Parley `GlyphRun`s and calls `scene.draw_glyphs(&font).font_size(px).transform(Affine).draw(mode, &glyphs)`. Vello rasterizes the glyphs as SDF outlines on the GPU.

**Cursor measurement** (`TextSystem::measure_to_cursor()`):

For TextInput, Glyx needs to know the pixel position of the cursor at character index N. Parley provides `hit_test_point()` and `line_metrics()`. For trailing whitespace, a sentinel character `"x"` is appended and its width subtracted — Parley ignores trailing whitespace in advance measurements.

---

## 13. 3D Rendering

**File**: `crates/glyx-3d/src/lib.rs`

The 3D rendering system is a separate wgpu render pass that runs after Vello completes.

**Scene description** (JSON from JS, deserialized by serde):

```rust
struct Scene3D {
    background: Option<[f32; 4]>,   // clear color RGBA
    camera:     Camera3D,
    lights:     Vec<Light3D>,       // Ambient and/or Directional
    meshes:     Vec<Mesh3DInstance>,
}

struct Camera3D {
    position: [f32; 3],
    target:   [f32; 3],
    up:       [f32; 3],   // default [0, 1, 0]
    fov_deg:  f32,        // default 60
    near:     f32,        // default 0.1
    far:      f32,        // default 1000
}

enum Light3D {
    Ambient     { color: [f32; 3], intensity: f32 },
    Directional { direction: [f32; 3], color: [f32; 3], intensity: f32 },
}

struct Mesh3DInstance {
    geometry:  Geometry3D,      // Box{}, Sphere{}, Plane{}, Gltf{path}
    transform: [f32; 16],       // column-major 4x4 model matrix
    color:     [f32; 4],        // RGBA
}
```

**Transform convention**: matrices are column-major (matching glam's `Mat4::from_cols_array`). Column 0 occupies indices [0..4], column 1 occupies [4..8], etc.

**Phong lighting shader** (WGSL):

```
For each mesh:
  model_matrix = Mat4::from_cols_array(&mesh.transform)
  normal_matrix = transpose(inverse(model_matrix))

  For each fragment:
    ambient  = ambient_color * ambient_intensity
    N = normalize(normal_matrix * vertex_normal)
    L = normalize(light_direction)
    diffuse  = max(dot(N, L), 0) * dir_color * dir_intensity
    color = mesh_color.rgb * (ambient + diffuse)
```

**glTF loading** (`Renderer3D::load_gltf()`):

Loaded via the `gltf` crate. Vertex positions, normals, and UV coordinates are extracted. Materials use base color factor as mesh color. The loaded geometry is stored in `gltf_cache: HashMap<String, Geometry>`. If a `Gltf { path }` mesh is referenced before the cache is populated, it falls back to the box geometry silently.

**Capacity limits**: MAX_MESHES = 64 per scene.

**@glyx/three** (JS layer):

`@glyx/three` provides a declarative React API over the imperative `GlyxCanvas3DContext.updateScene()` call. `<Scene>` collects child component data synchronously during React's render phase (Glyx uses synchronous LegacyRoot rendering), assembles the scene JSON, and commits it via `useLayoutEffect`. Child components (`<PerspectiveCamera>`, `<AmbientLight>`, `<DirectionalLight>`, `<Mesh>`, `<Model>`) call a `register(type, data)` function obtained from React context. No custom reconciler is needed.

---

## 14. Security and Capabilities

**File**: `crates/glyx-security/src/lib.rs`

Glyx uses Android/iOS-style capability declarations rather than Electron-style process isolation. The threat model is: the developer ships a known-good JS bundle. The JS bundle is not arbitrary web content. The security layer prevents accidental capability use and documents app requirements for distribution.

**Capability declaration** (in `glyx.config.json`):

```json
{
  "capabilities": {
    "fs": { "read": ["**"], "write": ["data/**"] },
    "network": { "allow": ["api.example.com", "cdn.example.com"] },
    "db": true,
    "credentials": true,
    "audio": true,
    "video": true
  }
}
```

**Enforcement** (at every privileged binding):

```rust
fn fetch_callback(scope, args, rv) {
    if !glyx_security::get().network_allowed(&url) {
        rv.set(reject_cap_promise(scope, "network").into());
        return;
    }
    // ... proceed
}
```

The global `Capabilities` singleton is set once at startup via `glyx_security::init(caps)` and never mutated. `glyx_security::get()` returns `&'static Capabilities` with zero cost.

**Filesystem capability matching**:

`fs.read` and `fs.write` accept glob patterns. The `glob` crate matches requested paths against declared patterns. `**` matches any path under a directory. Absolute paths outside the app directory are blocked unless explicitly declared.

**Network capability matching**:

Allowed hosts are checked against the requested URL's hostname. The special value `"*"` allows all hosts. Matching is exact hostname comparison (no wildcard subdomains unless `"*"` is used).

**Env capability matching**:

Patterns support trailing `*` for prefix matching: `"MY_APP_*"` matches `"MY_APP_DEBUG"`. Exact matching otherwise.

---

## 15. Hot Reload (HMR)

**File**: `crates/glyx-core/src/lib.rs` (feature-gated `#[cfg(feature = "dev")]`)

HMR (Hot Module Replacement) in Glyx is full-page reload of the JS bundle with state reset, not React component-level fast refresh. This is appropriate because Glyx's IPC-format bundle (IIFE) is incompatible with the per-component transforms that React Fast Refresh requires.

**Architecture**:

```
File watcher thread:
  notify::recommended_watcher() watching js/ directory
  Debounce 180ms after last event
  Filter: skip events for the output file (app.js) to avoid loop
  On change: bun build js/app.jsx -> js/app.js
  Send BuildOk(new_js) or BuildErr(message) to channel

Main thread (handle_dev_build_events, called each frame):
  try_recv() — non-blocking
  On BuildOk(js):
    Clear: js_nodes, js_root, label_cache, canvas_cmds, canvas3d_scenes
    runtime.eval(js)
    runtime.flush_microtasks()
    drain_scene_commands()   <- immediate; don't wait for next frame
    layout_dirty = true
  On BuildErr(msg):
    DevModeState.last_js_error = Some(msg)
    draw_error_overlay()
```

**Windows Bun invocation**: Bun installed via winget or scoop creates a `.cmd` shim rather than a native `.exe`. `Command::new("bun")` fails because Windows does not run `.cmd` files without a shell. Glyx first tries `bun` directly, then falls back to `cmd /C bun ...` if the first attempt fails.

**Error overlay**: When a JS exception occurs (from `frame_tick`) or a build error (from HMR), a 140px red panel is drawn at the bottom of the window using `FrameBuilder` directly (bypassing the JS scene tree). It shows the exception message and stack trace with line wrapping.

**Dev feature gate**: HMR code is compiled only when the `dev` Cargo feature is enabled. The production glyx-runner binary is built with `--no-default-features`, which excludes `notify`, the file watcher, the error overlay, and the dev overlay. This removes ~2MB from the production binary.

---

## 16. Multi-Window Architecture

**Files**: `crates/glyx-shell/src/lib.rs`, `crates/glyx-core/src/lib.rs`, `crates/glyx-runtime/src/lib.rs`

Glyx supports multiple windows from a single process. All windows share the JS isolate and the V8 context — there is one JS runtime per process.

**Window state isolation**:

Each window has its own `PerWindowState`:
```
PerWindowState {
    js_nodes:        HashMap<u32, JsNode>
    js_root:         Option<u32>
    runtime:         GlyxRuntime    // separate V8 Isolate per window
    renderer:        GlyxRenderer
    layout:          LayoutTree
    images_by_path:  LruCache<...>
    canvas_cmds:     HashMap<u32, Vec<CanvasCmd>>
    video_decoders:  HashMap<u32, VideoState>
    camera_handles:  HashMap<u32, CameraState>
    ...
}
```

Each secondary window gets its own `GlyxRuntime` (separate V8 Isolate). The JS bundle is re-evaluated in each window's isolate. Windows do not share JS state — communication is via IPC.

**IPC bus**:

```rust
type IpcInbox = Arc<Mutex<VecDeque<String>>>;
type IpcBus   = Arc<Mutex<HashMap<u32, IpcInbox>>>;
```

`__glyx_ipc_send(target_handle, message)` pushes a JSON string to the target window's inbox. `__glyx_ipc_poll()` returns all pending messages for the current window. Polling happens inside `__glyx_frameCallback`, so messages are delivered once per frame.

**Window creation**:

`__glyx_window_create({ title, width, height })` resolves with the new window's handle. The binding posts a `GlyxUserEvent::CreateWindow` to the winit event loop via `EventLoopProxy`. The main thread creates the window, initializes `PerWindowState`, evaluates the same JS bundle, and begins driving the new window's frame loop.

**Dev mode**: HMR only applies to window handle 0. Secondary windows are not hot-reloaded independently.

---

## 17. Media Architecture

**File**: `crates/glyx-media/src/lib.rs`, `crates/glyx-core/src/scene.rs`

The glyx-media DLL provides ffmpeg decode/encode capabilities without statically linking ffmpeg into the application binary.

**DLL singleton**:

```rust
static GLYX_MEDIA: OnceLock<Option<Arc<GlyxMedia>>> = OnceLock::new();

pub fn get_media() -> Option<Arc<GlyxMedia>> {
    GLYX_MEDIA.get_or_init(|| {
        let path = find_cached_media()?;
        GlyxMedia::load(&path).ok().map(Arc::new)
    }).clone()
}
```

The `OnceLock` ensures the DLL is loaded at most once per process. If loading fails (DLL not found, symbol missing, integrity check failed), `get_media()` returns `None` for the entire process lifetime. Retrying is not supported — callers must handle `None` gracefully.

**Dynamic loading** (`GlyxMedia::load()`):

```rust
let lib = unsafe { Library::new(path) }?;
// sym! macro: load function pointer by name
let decoder_open  = sym!(lib, b"vm_decoder_open\0",  FnDecoderOpen);
let decoder_frame = sym!(lib, b"vm_decoder_next_frame\0", FnDecoderNextFrame);
// ...
GlyxMedia { decoder_open, decoder_frame, ..., _lib: lib }
```

`_lib: Library` is stored last in the struct so it is dropped last. Dropping `Library` closes the OS handle. All function pointers become dangling after this drop — keeping `_lib` alive for the entire `GlyxMedia` lifetime prevents use-after-free.

**Video playback** (`OpenVideo` scene command):

```
spawn thread A (video decode):
  VmDecoder::open(url) via glyx-media DLL
  loop:
    next_frame() -> (w, h, rgba_bytes, pts_seconds)
    lock frame_buf, store Some((w, h, rgba))
    PTS-based wall-clock sleep:
      sleep_duration = (pts - pts_start) - elapsed
      if sleep_duration > 1ms: thread::sleep(sleep_duration)

spawn thread B (audio decode):
  VmAudioDecoder::open(url) via glyx-media DLL
  FfmpegAudioSource wraps VmAudioDecoder as rodio::Source
  rodio Sink::append(FfmpegAudioSource)
  Audio plays via WASAPI/CoreAudio/ALSA

Main thread render:
  frame_buf.lock().take() -> Some((w, h, rgba))
  -> decode into peniko::Image
  -> store in video_frames[handle_id]
  -> render_subtree draws it at Video node's layout position
```

A/V sync is achieved by PTS-based wall-clock timing in the video decode thread. The first frame anchors `wall_start = Instant::now()` and `pts_start = first_pts`. Each subsequent frame sleeps for `(pts - pts_start) - wall_start.elapsed()` before pushing to `frame_buf`. On seek, `wall_start` is reset to None.

**Audio format**: `VmAudioDecoder` uses `libswresample` to convert any audio stream to interleaved signed 16-bit PCM at the stream's native sample rate. `FfmpegAudioSource` implements `rodio::Source` by filling 4096-sample chunks on demand.

**Camera** (`OpenCamera` scene command):

Camera capture uses `nokhwa` with the MSMF backend on Windows, AVFoundation on macOS, and V4L2 on Linux. A dedicated thread captures frames and stores them in `camera_frames[handle_id]`. The main thread reads the latest frame each render cycle.

**Integrity verification**:

The glyx-media DLL ships with a sidecar `glyx-media.manifest.json` (SHA-256 hash, version, CDN URL) and `glyx-media.manifest.sig` (Ed25519 signature over the manifest). The signing private key is held by CI — locally-built DLLs have invalid signatures. In debug builds (`cfg!(debug_assertions)`), signature verification is skipped automatically. In release builds, `GLYX_MEDIA_SKIP_VERIFY=1` can be set explicitly, but this is not recommended for production.

---

## 18. Snapshot Pipeline and Distribution

**File**: `crates/glyx-runner/src/main.rs`, `crates/glyx-cli/src/main.rs`

Glyx supports three distribution models:

**1. JS-only portable** (`glyx build --target portable`)

Copies the pre-built `glyx-runner` binary alongside `app.js` and `glyx.config.json`. Requires the runner binary to be present. The runner reads `app.js` from disk at startup.

**2. JS-only bundle** (`glyx build --target bundle`)

Produces a single executable by appending a binary trailer to the glyx-runner binary.

**Binary trailer format** (last 72 bytes of the executable):

```
Offset  Size  Field
  0       8   snap_offset    u64 LE  (0 if no snapshot)
  8       8   snap_len       u64 LE
 16       8   js_offset      u64 LE
 24       8   js_len         u64 LE
 32       8   cfg_offset     u64 LE
 40       8   cfg_len        u64 LE
 48       4   version        u32 LE = 1
 52       4   flags          u32 LE = 0 (reserved)
 56       4   crc32          u32 LE  (over snap+js+cfg payload)
 60       4   reserved       u32 LE = 0
 64       8   magic          u64 LE = 0x4C52_5458_4F4C_4556  ("GLYXTRL")
```

`read_trailer()` seeks to the last 72 bytes, validates magic and CRC32, then seeks to each payload section offset.

The snapshot section is currently zero-length (no V8 snapshot in the CLI flow). The JS section contains the minified app bundle. The config section contains the `glyx.config.json` content.

**3. Native** (apps with custom Rust extensions)

Native projects have a `Cargo.toml` and implement a `GlyxExtension` trait. These are built with `cargo build --release` directly. No runner binary is involved.

**Runner caching**:

The glyx-cli caches pre-built runner binaries in `~/.glyx/runners/{dev|prod}/glyx-runner[.exe]`. On first use, the runner is compiled from the glyx source tree and cached. Subsequent `glyx build` and `glyx dev` invocations use the cached binary, requiring no Rust toolchain.

**glyx dev** (JS-only project):

```
glyx dev
  is_native_project()? (Cargo.toml exists)
    yes -> cargo run -p {project_name}
    no  -> find_or_build_runner(dev=true)
           cmd.env("GLYX_MEDIA_SKIP_VERIFY", "1")
           runner js/app.js glyx.config.json --dev
```

---

## 19. Database Layer

**Files**: `crates/glyx-db/`, `crates/glyx-runtime/src/bindings.rs`

Glyx wraps SQLx with SQLite as the database engine.

**Connection pooling**:

```rust
DbPools = Arc<Mutex<HashMap<u32, SqlitePool>>>
```

Each `db.open(path)` call creates a new `SqlitePool` and assigns it a `u32` handle. The `_defaultHandle` in JS is the first handle opened (auto-set). Explicit handles allow multiple database files open simultaneously.

**Binding signatures** (all overloaded — handle optional):

```
db.query(sql, params?)          -> Promise<rows[]>
db.query(handle, sql, params?)  -> Promise<rows[]>
db.run(sql, params?)            -> Promise<{ rowsAffected, lastInsertId }>
db.transaction(statements[])   -> Promise<void>
db.close(handle)               -> Promise<void>
```

**Vector store** (`@glyx/react` `vectorDb` API):

Built on SQLite with a custom BLOB column for storing float32 vectors. Cosine similarity search is computed in Rust (no sqlite-vss). This is a simple approximate search suitable for a few thousand vectors — not a production vector database.

**Graceful shutdown**:

On `CloseRequested`, glyx-core calls `runtime.shutdown_db_pools()` which drains all open connections and calls `SqlitePool::close()` on each. This ensures WAL journal files are flushed before process exit.

---

## 20. Local AI

**File**: `crates/glyx-ai/src/lib.rs`

Local inference uses the Candle framework (pure Rust, no Python).

**Models**:

| Model | Use | Size | Path |
|-------|-----|------|------|
| MiniLM-L6-v2 | Text embeddings (384 dim) | ~22 MB | `~/.cache/huggingface/` |
| Phi-2 Q4_K_M GGUF | Text generation | ~1.7 GB | `~/.cache/huggingface/` |
| Whisper-tiny | Audio transcription | ~75 MB | `~/.cache/huggingface/` |

Models are downloaded from HuggingFace Hub on first use via `hf_hub::api::sync::Api`. Subsequent runs use the local cache.

**Lazy initialization**:

Models are wrapped in `Arc<Mutex<Option<Model>>>`. The first call to `ai.embed/generate/transcribe` initializes the model, subsequent calls reuse it. Model loading is done in `spawn_blocking` so it does not block the Tokio executor.

**Battery awareness**:

Before `ai.generate()`, `glyx_sysapi::battery_status()` is checked. If discharging, a warning is logged. Actual throttling (reducing model precision, cancelling inference) is deferred to a future phase.

---

## 21. JS Package Ecosystem

All packages live under `js/packages/@glyx/`. All are pure ESM with `"type": "module"`. Bun resolves imports from workspace symlinks — no build step is needed for the packages themselves.

| Package | Entry | Description |
|---------|-------|-------------|
| `@glyx/react` | `src/index.js` | React reconciler, HostConfig, all native bindings exposed as JS APIs. The runtime. |
| `@glyx/router` | `src/index.js` | Named-route history stack. `<Router>`, `<Route>`, `useNavigate`, `useRoute`. |
| `@glyx/drizzle` | `src/index.js` | Drizzle ORM sqlite-proxy adapter. Translates Drizzle's SQL+params into `db.run`/`db.query` calls. |
| `@glyx/keychain` | `src/index.js` | Typed, namespace-scoped OS keychain wrapper. `createKeychain`, `createTypedKeychain`. |
| `@glyx/store` | `src/index.js` | Persistent reactive Zustand-style store backed by SQLite. `initStore`, `createStore`. |
| `@glyx/three` | `src/index.js` | Declarative R3F-style 3D API over `Canvas3D`. `<Scene>`, `<Mesh>`, `<Model>`, math utilities. |

**Package conventions**:

- No build step — Bun resolves ESM directly from `src/index.js`
- Peer dependencies declared in `package.json` (never bundled)
- Packages import from `@glyx/react` for access to native bindings; they do not call `__glyx_*` bindings directly
- New packages are added to root `package.json` workspaces array and `bun install` is run

**React reconciler** (`@glyx/react`):

The reconciler is built on `react-reconciler@0.29` in `legacy` mode (synchronous rendering). All React state updates and effects execute synchronously within the V8 call initiated by `__glyx_frameCallback`. There is no concurrent mode, no scheduler, no time-slicing. The simplicity trades concurrency for predictability — every frame, React processes all pending work before Rust proceeds to layout and render.

---

## 22. Key Design Decisions

**Synchronous rendering (LegacyRoot)**

React runs synchronously. This means every `setState` call made inside an event handler takes effect in the same frame. It also means long-running JS (>8ms) will drop frames. The tradeoff was made deliberately: desktop UI code is rarely CPU-bound in JS, and the synchronous model eliminates an entire category of React Concurrent Mode bugs and complexity.

**One JS isolate per window**

Each window has its own V8 Isolate rather than sharing one. This means JS state is not shared between windows — IPC is the only communication channel. The benefit is isolation: a JS error or slow operation in one window does not affect others. The cost is doubled memory for JS heap when two windows are open.

**Vello for 2D, wgpu for 3D**

Vello is a GPU-accelerated vector renderer well-suited for UI primitives (rectangles, text, paths). wgpu gives direct GPU access for 3D scenes. They coexist in the same render pass: Vello renders to an off-screen texture; the 3D pass composites its result over that texture; the final blit combines both.

**No DOM, no CSS**

Glyx uses Taffy (CSS flexbox subset) not a full CSS engine. There are no classes, no selectors, no cascade. All styles are inline on each node. This is the same model as React Native. The absence of CSS cascade eliminates a large category of bugs and makes layout predictable.

**Capability model not process isolation**

Glyx does not sandbox the renderer process from the main process (there is only one process). The security model is appropriate for desktop apps where the developer ships the code — it prevents accidental capability use and creates a formal declaration of what APIs the app needs. Electron's two-process model exists partly because Chromium can render untrusted web content; Glyx does not.

**glyx-media as a separate DLL**

Statically linking ffmpeg adds ~30 MB to the binary. By loading it as a DLL at runtime, glyx-runner stays small and the DLL is shared across app versions. Apps that do not use video or camera do not need the DLL at all. The DLL is downloaded once and cached in `~/.glyx/cache/media/`.

**Binary trailer for single-file distribution**

Appending a trailer to the runner binary avoids ZIP or resource section formats that require platform-specific tooling. The CRC32 detects accidental corruption. Ed25519 signing (Phase 16K) will add tamper detection. The format is simple enough to implement in 100 lines of Rust and easy to inspect with a hex editor.

**Taffy incremental layout**

The most expensive part of a UI framework is layout. Glyx distinguishes three dirtiness levels (no-op, incremental, full rebuild) and only runs Taffy when necessary. On a typical user interaction (button press → color change), the layout engine does zero work — only the renderer re-reads cached positions with updated colors.

**ControlFlow::Wait**

winit's `Wait` mode puts the process to sleep when no events are pending. A static Glyx app consumes 0% CPU. An animated app (Canvas, rotating 3D scene) must call `window.request_redraw()` each frame to keep the loop alive. This is a deliberate energy-efficiency tradeoff.
