# @glyx-dev/react

React renderer for the Glyx runtime — the host config, reconciler wiring, core primitives (`View`, `Text`, `Image`, `Pressable`, …), form controls, canvas/3D/video/webview components, and the native-capability APIs (fs, db, ipc, windows, backend, perf, etc). Every Glyx app is built on this package.

Full framework documentation lives at the separate docs site; this README covers the package's public exports only.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/react
# or npm install @glyx-dev/react
```

## Usage

```jsx
import { render, View, Text, Pressable } from '@glyx-dev/react';
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Text>{count}</Text>
      <Pressable onPress={() => setCount((c) => c + 1)}>
        <Text>+</Text>
      </Pressable>
    </View>
  );
}

render(<Counter />);
```

`render(element)` mounts the app's single scene root, wrapping it in a full-window flex column plus an auto-injected `PopoverHost` so `openPopover`/floating UI works anywhere without manual mounting.

## API

### Rendering
- `render(element)` — mounts the app's React tree to the Glyx scene root.

### Core primitives (`core.js`)
- `View`, `RepaintBoundary`, `Text`, `Image`, `Pressable` — base layout/content/interaction primitives.
- `useDraggable(handlers)` — low-level drag gesture hook used by higher-level packages (`@glyx-dev/drag-drop`, `@glyx-dev/split-pane`, `@glyx-dev/table`, …).
- `ScrollView`, `VirtualizedList` — scrollable and virtualized-list containers. `ScrollView` scrolls smoothly by default (`smoothScroll={false}` opts out).
- `useWindowSize()`, `useScreenSize()`, `useMediaQuery(minWidth)` — layout/responsive hooks.
- `getEnv(name)`, `measureText(text, fontSize, maxWidth)` — environment and text-measurement utilities.
- `SelectionArea`, `SelectableText`, `SelectColorsContext`, `SelectColorsProvider`, `SELECT_COLORS_DARK` — text-selection support.
- `WindowControls` — minimize/maximize/close controls for frameless windows.
- Form controls: `TextInput`, `PasswordInput`, `NumericInput`, `Checkbox`, `Switch`, `RadioGroup`, `Radio`, `FileInput`, `Slider`, `Select`, `DatePicker`, `TimePicker`, `DateTimePicker` (from `controls.js`).

### Canvas / 3D (`canvas.js`)
- `Canvas` — 2D canvas component (path/fill/stroke/text drawing API).
- `Canvas3D` — 3D canvas surface (consumed by `@glyx-dev/three`).

### Media (`media.js`)
- `Camera`, `Video` — camera preview and video playback components.

### WebView (`webview.js`)
- `WebView` — native OS-embedded webview component (WebView2/WKWebView/WebKitGTK).

### Popovers (`popover.js`)
- `PopoverHost`, `openPopover(opts)`, `closePopover(id)` — floating/overlay UI primitives, auto-mounted by `render()`.

### Native capability APIs (`api.js`)
Namespaced objects/functions wrapping native bindings, each gated by the matching `glyx.config.json` capability:
`fs`, `db`, `vectorDb`, `dialog`, `clipboard`, `tray`, `notification`, `shell`, `mdns`, `ws`, `ipc`, `glyxWindow`, `crash`, `backend`, `perf`, `battery`, `system`, `power`, `storage`, `credentials`, `audio`, `ai`, `camera`, `microphone`, `hid`, `updater`, `video`, `webview`, `input`, `deeplink`.
- `hasAccessibility()` — capability query for whether a11y support is available.

### Event-registry helpers
Used internally by companion packages (`@glyx-dev/context-menu`, `@glyx-dev/rich-text`, `@glyx-dev/drag-drop`, …): `addGlobalClickListener`, `removeGlobalClickListener`, `addKeyListener`, `removeKeyListener`, `registerInput`, `unregisterInput`, `registerScrollView`, `unregisterScrollView`, `registerDraggable`, `unregisterDraggable`, `registerWheel`, `unregisterWheel`.
