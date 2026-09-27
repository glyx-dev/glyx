# Glyx DevTools Protocol (GDP)

GDP lets a program inspect and drive a running Glyx app: read the element
tree, find elements, click and type, take screenshots, wait for the UI to
change, run JavaScript inside the app, and watch console output, frame
timings and animations. Test scripts, editors and AI agents all use the same
protocol.

It is a development tool: it exists only in `dev` builds and only while the
app is started with devtools on. Release builds contain none of it.

- [Quick start](#quick-start)
- [Security](#security)
- [Messages](#messages)
- [Choosing an element](#choosing-an-element)
- [Methods](#methods): [Runtime](#runtime) · [Console](#console) · [Inspector](#inspector) · [Automation](#automation) · [Performance](#performance) · [Animation](#animation)
- [Events](#events)
- [Errors](#errors)
- [Element IDs](#element-ids)
- [Measuring performance](#measuring-performance)
- [Limitations](#limitations)
- [Tests](#tests)

---

## The DevTools UI

`glyx inspect` opens Glyx DevTools in the browser (or run **Glyx: Open
DevTools** in VS Code; `glyx dev --devtools --open` starts an app and opens it
attached). It lists the dev apps running in this project and attaches by
itself when there's one.

- **Overview**: engine, process, Glyx version, round-trip time, windows and
  what the app supports.
- **Inspector**: the element tree with component names (`Btn › Pressable "7"`),
  "My components" to hide Glyx's own wrappers, search by element ID,
  component, text or testID; hover a row to outline the element in the app,
  or use the arrow button and click an element in the app. The details pane
  shows the element ID (copy it, or copy a `{ id }` selector for tests), the
  box model, rects and props; edit props live, with reset. The Accessibility
  tab lists audit issues; click one to go to the element.
- **Console**: the app's console (including what it logged before you opened
  DevTools, and uncaught errors with their stack), level filters, search,
  "Preserve log" across restarts. The prompt at the bottom runs JavaScript
  in the app; objects expand in place, ↑/↓ walk the history, and `$0` is the
  element selected in the Inspector (`$0.owner.props`, `$0.owner.hooks`,
  `$0.props.onPress()`).
- **Performance**: a live frame chart (each bar a frame's cost: JS, layout,
  render, present; slow frames outlined; a dot marks full redraws), fps and
  p50/p90/p99, over-budget and partial-redraw rates, a budget picker. Click a
  bar for its breakdown and **why it rendered** (the elements that changed;
  hover one to outline it). Record, stop, export and import sessions; turn
  on **paint flashing** to see what each frame redraws, in the app.
- **Animations**: a lane per running transition or keyframe animation: the
  element, what it animates, progress, iteration and its easing curve.
  Pause, slow motion (0.5× / 0.25× / 0.1×), and ±100 ms steps while paused;
  finished runs fade out after a few seconds. The app returns to normal speed
  when you leave the panel.
- Memory, Layout, Network and CPU profiler panels are on the way (see the
  rail).

The UI talks to a small server in the CLI (`glyx inspect`, port 9227) that
finds apps from their discovery files, does the token handshake itself and
reattaches when an app restarts. Scripts and agents keep talking to the app's
GDP port directly, as below.

## Quick start

Start the app with devtools on:

```sh
glyx dev --devtools          # port 9228
glyx dev --devtools 9300     # another port
```

The app writes its address and a per-session token to
`target/glyx/devtools.json` in the project:

```json
{
  "protocolVersion": 1,
  "url": "ws://127.0.0.1:9228/",
  "port": 9228,
  "token": "5f0c…",
  "pid": 12408,
  "engine": "V8"
}
```

Connect, send the handshake with the token, then call methods. With the small
client in `scripts/devtools/gdp-client.mjs` (Bun or Node 22+):

```js
import { readFileSync } from 'node:fs';
import { connect } from './scripts/devtools/gdp-client.mjs';

const info = JSON.parse(readFileSync('target/glyx/devtools.json', 'utf8'));
const gdp = await connect(info);
await gdp.call('Runtime.handshake', { token: info.token });

// Find the "Save" button by its label and click it.
const [label] = (await gdp.call('Automation.findNodes', { text: 'Save', type: 'Text' })).result.nodes;
await gdp.call('Automation.click', { id: label.id });

// Wait until the app shows "Saved".
await gdp.call('Automation.waitFor', { text: 'Saved', condition: 'visible', timeoutMs: 3000 });
```

`scripts/devtools/gdp-smoke.mjs` checks any running app end to end:

```sh
bun scripts/devtools/gdp-smoke.mjs target/glyx/devtools.json
```

Without `glyx dev` (a built dev binary, CI): set `GLYX_DEVTOOLS_PORT`
(`0` picks a free port) and optionally `GLYX_DEVTOOLS_FILE` for where the
discovery file goes. Without `GLYX_DEVTOOLS_FILE` it is written to
`<temp>/glyx-devtools/<pid>.json`.

## Security

A connected client can run any JavaScript in the app, so the server is locked
down:

- **This machine only.** It listens on `127.0.0.1`, never another interface.
- **No web pages.** A connection whose `Origin` header isn't a loopback host
  (`localhost`, `127.0.0.1`, `::1`) is refused, so a website open in your
  browser can't reach it. Clients without an `Origin` (scripts, editors) are
  fine.
- **Token first.** Until `Runtime.handshake` carries the session's token,
  nothing else is answered. A wrong token closes the connection. The token is
  new every launch unless `GLYX_DEVTOOLS_TOKEN` (16+ characters) sets one.
- **Dev builds only.** The server is compiled in with the `dev` feature and
  started only when `GLYX_DEVTOOLS_PORT` is set.

## Messages

JSON over WebSocket, one message per frame.

Request:

```json
{ "id": 7, "domain": "Automation", "method": "click", "params": { "id": "App#0 › Btn#0 › Pressable#0" }, "windowId": 0 }
```

- `id`: any JSON value; the response echoes it.
- `windowId` (optional): which window. Default: the main (first-opened) window.

Response, one of:

```json
{ "id": 7, "result": { "x": 56, "y": 164 } }
{ "id": 7, "error": { "code": -32004, "message": "no element with id \"…\"" } }
```

Event (after subscribing to it):

```json
{ "event": "Console.messageAdded", "windowId": 0, "params": { "level": "log", "text": "hi", "timestamp": 1790423931057 } }
```

Requests are answered on the app's UI thread between frames. An idle app wakes
up for each request, so responses come back in a few milliseconds.

## Choosing an element

Methods that act on one element accept any of:

| Param | Meaning |
|---|---|
| `id` | The element's [ID](#element-ids): automatic (`App#0 › Btn#0 › Pressable#0`), or a `testID` it was pinned with. Stable across launches. **Prefer this.** |
| `testID` | An explicit `testID` prop. |
| `nodeId` | The native node number. Changes every launch and whenever React remounts the element. Fine within one session. |

`Automation.findNodes` and `Automation.waitFor` also match by content; every
field given must match:

| Param | Matches |
|---|---|
| `text` | Exact text |
| `textContains` | Case-insensitive substring of the text |
| `role` | Accessibility role (`button`, `checkbox`, …) |
| `label` | Accessibility label (`ariaLabel`) |
| `type` | Node type: `View`, `Text`, `Image`, … |

Every element in a response carries `nodeId`, `id`, `component` (for example
`Btn › Pressable`: its app component and the Glyx component that drew it) and,
when the ID comes from a `testID`, `"pinned": true`.

## Methods

### Runtime

| Method | Params | Result |
|---|---|---|
| `handshake` | `token` | `protocolVersion`, `engine` (`V8` / `QuickJS`), `pid`, `windows`, `methods`, `events`. Must be the first call. |
| `ping` | | `{ pong: true }` |
| `version` | | `protocolVersion`, `glyx`, `engine` |
| `windows` | | `windows`: `[{ windowId, title, width, height, main }]` |
| `evaluate` | `expression` (string; statements allowed), `selectedNodeId?` | `{ type, value?, description, preview }`. `value` when the result is JSON-serializable; `preview` is a structured, depth-limited view of any value (objects, arrays, Maps, Sets, functions, Errors, cycles). With `selectedNodeId`, `$0` is that element's React side: `{ props, component, type, key, owner: { name, props, hooks } }`. Promise continuations and React updates run before the reply. |

### Console

| Method | Params | Result |
|---|---|---|
| `enable` | | Starts `Console.messageAdded` events for every window. |
| `disable` | | Stops them. |
| `getMessages` | `since?` | The last 1,000 messages (`{ seq, level, text, timestamp, windowId }`), including those logged before anyone connected, and `lastSeq`. Uncaught JS errors are there too, as `error`. |
| `clear` | | Empties that backlog. |

### Inspector

| Method | Params | Result |
|---|---|---|
| `getTree` | `depth?`, element? | `root` (nested `{ nodeId, id, component, type, rect, childCount, testID?, text?, role?, label?, children? }`), `nodeCount`. Cut-off nodes keep `childCount`, so you can fetch them later. |
| `getNode` | element | `type`, `parentId`, `children`, `rect`, `unclippedRect`, `layoutRect`, `focused`, `props` (camelCase, unset ones left out), `path` (node ids from the root). |
| `getLayout` | element | `rect` (on screen, clipped by scroll views: what clicks use), `unclippedRect`, `layoutRect` (the layout engine's result), `contentHeight` (scroll views). All `[x, y, width, height]` in window pixels. |
| `selectElement` | `x`, `y` | The topmost solid element at that point: `nodeId`, `node`, `path`. Often the `Pressable` over a label rather than the label itself. |
| `getAccessibilityTree` | | What screen readers see: nested `{ nodeId, role, label?, value?, description?, placeholder?, toggled?, numericValue?, disabled?, bounds?, children? }` plus `focus`. Needs the app built with the `a11y` feature; otherwise error `-32006`. |
| `highlightNode` | element, or `nodeId: null` to clear | Outlines the element in the live window with its type, id and size. |
| `setNodeProp` | element, `name`, `value` | Changes one prop in the running app (`null` unsets it), until React next updates that element. Props: `text`, `testID`, `backgroundColor`, `color`, `borderColor` (hex), `borderWidth`, `borderRadius`, `opacity`, `fontSize`, `fontWeight`, `width`, `height`, `padding`, `margin`, `gap` (px number or `"50%"`), `flex`, `zIndex`. |
| `enableDamage` / `disableDamage` | | Starts / stops `Inspector.frameDamage` events. |
| `setInspectMode` | `enabled` | Select mode: the app outlines the element under the pointer, a left click picks it (the app doesn't get the click) and ends select mode, Escape cancels. Picks arrive as `Inspector.nodePicked`. If the client that turned it on disconnects, select mode switches off. |
| `enableTreeEvents` / `disableTreeEvents` | | Starts / stops `Inspector.treeChanged` (at most one per frame, only when the tree changed). |
| `setOverlay` | `paintFlashing` | Paint flashing: each redrawn area flashes amber in the app for ~400 ms. While flashes are up, frames render in full (so the numbers aren't representative meanwhile). Off when the client that turned it on disconnects. |
| `auditAccessibility` | | `issues: [{ nodeId, id, component, rule, severity, message }]`, `errors`, `warnings`. Rules: `pressable-name` (pressable with no text or `ariaLabel`), `image-name`, `contrast` (WCAG AA: 4.5:1, 3:1 for large text, measured against the nearest opaque background), `focusable-role`. Works without the `a11y` feature. |

### Automation

Input goes through the app's event loop into the same handlers as real input.

| Method | Params | Result |
|---|---|---|
| `findNodes` | element or content fields (at least one) | `nodes`: matching elements in tree order, each with `visible`. |
| `click` | element, or `x` + `y`; `button?` (`left` / `right` / `middle`) | Moves the pointer to the element's centre (or the point), presses and releases. `{ x, y }`. The element must be on screen. |
| `type` | `text` | A key press and release per character; `\n` is Enter, `\t` is Tab. Goes to the focused element. |
| `press` | `key` (`Enter`, `Backspace`, `ArrowLeft`, `KeyS`, …), `modifiers?` (`Control`, `Shift`, `Alt`, `Super`) | Presses a key, with modifiers held around it. |
| `scroll` | `deltaY` (negative scrolls down), element or `x` + `y`? | Moves the pointer there first when given, then scrolls. |
| `dispatchInput` | `type`: `pointerMove` (`x`, `y`) · `pointerDown` / `pointerUp` (`button?`) · `scroll` (`deltaY`) · `keyDown` / `keyUp` (`key`, `text?`) | One raw event. |
| `screenshot` | element? | `{ format: "png", width, height, data }` (base64): the window, or cropped to the element. CPU renderer only for now, see [Limitations](#limitations). |
| `waitFor` | element or content fields, `condition?` (`exists`, the default · `visible` · `gone`), `timeoutMs?` (default 5000, max 60000) | Replies when the condition holds: `{ nodeIds }`. Error `-32005` on timeout. With `id`, the ID is looked up again on every check, so it works for elements that don't exist yet. |

### Performance

| Method | Params | Result |
|---|---|---|
| `snapshot` | | Over the last ~5 s of frames: `fps`, `budgetMs`, `overBudget`, `p99FrameTime`, `p99WorkTime`, `average` (`frameTime`, `workTime`, `jsTime`, `layoutTime`, `renderTime`, `presentTime`, `damagePx`), `partialFrames`, `memory` (`heapUsed`, `heapTotal`, `processRss`, `gpuBuffers`, `gpuTextures`), `last` (the newest frame). |
| `getBudget` | | `{ budgetMs }` |
| `setBudget` | `ms` | Frame budget used for violations (default 16.667). |
| `getViolations` | `since?` | Frames whose own cost went over budget: `entries: [{ seq, data: { budget, actual, interval, jsTime, layoutTime, renderTime, presentTime } }]` (`actual` = the frame's cost, `interval` = time since the previous frame), `lastSeq`. Pass the last `lastSeq` as `since` to get only new ones. Reading doesn't consume them: the app's own `perf.onBudgetExceeded` still sees every one. |
| `getLeakWarnings` | `since?` | Same shape, for the dev-mode leak heuristics (for example node count growing for 600 frames in a row). |
| `enableFrames` / `disableFrames` | `detail?` | Starts / stops `Performance.frame` events. With `detail: true` the app also keeps, for the last 300 frames, which elements changed. |
| `getFrameDetail` | `seq` | Why frame `seq` rendered: `dirty` (the changed elements, with `id` / `component`), `dirtyCount`, `damage` (the area they add up to), `removedSince`. Needs `enableFrames { detail: true }`. |

### Animation

Covers CSS-style `transition`s and keyframe `animation`s.

| Method | Params | Result |
|---|---|---|
| `list` | | `running: [{ nodeId, id, component, kind: "transition" / "animation", durationMs, iterations, elapsedMs, progress, easing, properties? (transitions), keyframes?, alternate?, iteration? }]` (times on the motion clock; `iterations` is `"infinite"` for endless ones), `rate`. |
| `setPlaybackRate` | `rate` (0–4) | The motion clock's speed for every window: `1` normal, `0.25` slow motion, `0` paused (paused animations stop requesting frames). Changing it never makes an animation jump. Back to `1` when the client that changed it disconnects. |
| `seek` | `byMs` | Move the motion clock (negative = back), e.g. to step through a paused animation. Finished transitions are gone and don't come back. |
| `getPlayback` | | `{ rate, paused }` |
| `enable` / `disable` | | Starts / stops the `Animation.*` events. |
| `waitForSettled` | `timeoutMs?` | Replies `{ settled: true }` once nothing animates in the window. Error `-32005` if it still animates at the timeout (it never settles while an infinite animation runs). Use it instead of sleeping in tests. |

## Events

| Event | Subscribe with | Params |
|---|---|---|
| `Console.messageAdded` | `Console.enable` | `level` (`log`, `warn`, `error`, `debug`), `text`, `timestamp`; `windowId` on the message. |
| `Inspector.frameDamage` | `Inspector.enableDamage` | Per rendered frame: `partial`, `rect` (redrawn area, `null` for the whole window), `dirtyCount`, `timestamp`. |
| `Inspector.nodePicked` | `Inspector.setInspectMode` | The picked element (`nodeId`, `id`, `component`, `type`, `rect`, `path`, …). |
| `Inspector.inspectModeChanged` | `Inspector.setInspectMode` | `enabled`, `reason` (`picked` / `cancelled`). |
| `Inspector.treeChanged` | `Inspector.enableTreeEvents` | `version`: the element tree changed; re-read what you show. |
| `Performance.frame` | `Performance.enableFrames` | Per frame: `seq`, `workTime` (the frame's own cost: start to presented, pacing excluded), `frameTime` (time since the previous frame started, idle included), `jsTime`, `layoutTime`, `renderTime`, `presentTime`, `damagePx`, `partial`, `animating`, `nodeCount`, `heapUsed`. |
| `Animation.started` | `Animation.enable` | `nodeId`, `kind`, `durationMs`, `iterations`. A restart is an `ended` then a `started`. |
| `Animation.ended` | `Animation.enable` | `nodeId`, `kind` (finished, cancelled or replaced). |
| `Animation.settled` | `Animation.enable` | The window just went from animating to still. |

Events are only produced while someone listens, so an unwatched app pays
nothing for them.

## Errors

| Code | Meaning |
|---|---|
| `-32700` | Not valid JSON |
| `-32600` | Not a valid request |
| `-32601` | No such method |
| `-32602` | Bad or missing params (the message says which) |
| `-32603` | Internal error |
| `-32001` | Not authorized: send `Runtime.handshake` with the right token first |
| `-32002` | No such window |
| `-32003` | The evaluated JavaScript threw |
| `-32004` | No such element |
| `-32005` | Timed out (`waitFor`, `waitForSettled`) |
| `-32006` | Not available in this build or on this renderer |

## Element IDs

Every element gets an ID automatically, built from where it sits in your
code, never from its text or screen position:

```
App#0 › NoteList#0 › NoteCard[42] › Pressable#0
└── your components ─┘  └ React key ┘  └ Glyx component + slot ┘
```

- Your components form the path. Each is `Name[key]` when it has a React
  `key`, otherwise `Name#n`: the n-th component of that name inside its parent.
- The last part is the Glyx component that drew the element (`Pressable#0`,
  `TextInput#1`), numbered per name inside your component. More native nodes
  inside that component add a suffix: `TextInput#0/text#0`.
- An ID stays the same across relaunches, re-renders, text and translation
  changes, restyling and layout changes. It changes when you change that
  component's JSX structure, rename the component, or move the element to
  another component.
- Collisions are rare (keyless list items, duplicate keys); they get `~2`,
  `~3` so every ID is unique in its window.

**You don't need to add `testID`s.** Use one only as a pin: when a test must
survive refactors, or for a release-build end-to-end test. A `testID` becomes
that element's ID and is reported as `pinned`.

`glyx build` removes `testID` props from release bundles. To keep them for
end-to-end tests against the release binary, set in `glyx.config.json`:

```json
{ "keepTestIds": true }
```

IDs are computed only when devtools asks, in one pass over the React tree
(about 20 ms for 8,000 elements in a dev build). Above a node count they're
cached until the tree's structure changes:

```json
{ "devtools": { "autoIdCacheThreshold": 2000 } }
```

## Measuring performance

- **Use in-process frame timing** (`Performance.snapshot`, `Performance.frame`),
  not OS CPU%. On Windows, `GetProcessTimes` charges whole scheduler ticks,
  which overstates a bursty 120 Hz render thread several-fold.
- **Measure release builds.** The dev profile is `opt-level = 1`, and devtools
  itself adds work while you query it.
- **Cost vs interval.** `workTime` is what a frame cost; budgets, slow-frame
  marking and percentiles use it. `frameTime` is the time since the previous
  frame started, idle included: after a 5 s pause it's 5,000 ms, which isn't
  a slow frame. (Budget violations used `frameTime` before 2026-09-26, so a
  pause counted as jank.)
- **Read the split.** A frame's cost is JS (`jsTime`), layout (`layoutTime`),
  building and rasterizing (`renderTime`), handing it to the OS
  (`presentTime`, the CPU renderer's pacing sleep excluded) and a little
  other work (events, scene commands).
- **Check partial redraw.** `partial` and `damagePx` show how much each frame
  redrew. A keystroke that redraws the whole window usually means a component
  re-renders more than it needs to.
- **Wait, don't sleep.** In tests, use `Animation.waitForSettled` and
  `Automation.waitFor` instead of fixed delays.

## Limitations

- **Screenshots need the CPU renderer**: start the app with
  `GLYX_CPU_RENDER=1`. GPU renderers return `-32006` until a readback path
  exists.
- **The accessibility tree needs the `a11y` feature** in the app's build.
- **`component` names include `@file:line`** only when the bundle is built with
  development JSX (React's `_debugSource`). The examples aren't.
- **Conditional siblings** (`{open && <Menu/>}`) can shift the `#n` of later
  same-name siblings in the same component. A `key` or a pinned `testID`
  avoids it.
- **`setNodeProp` is temporary**: the next React update of that element puts
  its own props back.

## Tests

| File | What it checks |
|---|---|
| `scripts/devtools/gdp-smoke.mjs` | Protocol basics on any app: security rules, handshake, evaluate, console. |
| `tests/devtools/gdp-calculator.mjs` | Calculator (QuickJS): clicking keys, waiting for the result, tree, selection, screenshots. |
| `tests/devtools/gdp-notes.mjs` | notes-app (V8): driving by element ID, names, layout, highlight, live prop edits, damage, accessibility tree. |
| `tests/devtools/gdp-motion.mjs` | motion-demo: frame stream, snapshot, budget violations, animation events, `waitForSettled`. |
| `tests/devtools/gdp-inspector.mjs` | calculator: select mode (pick, Escape, disconnect safety), tree events, accessibility audit. |
| `tests/devtools-ui/d0.mjs` … `d4.mjs` | The DevTools UI in a headless browser (`tests/devtools-ui/browser.mjs`, Chrome DevTools Protocol): connection, Overview, theme, keyboard; Inspector tree, details, live edit + reset, select mode, search, audit. |
| `tests/devtools/run-calculator.sh` | Launches the calculator with devtools and runs the smoke and calculator tests; CI runs it under Xvfb (`devtools-e2e` job). |

Each test script prints how to start its app in its header.
