# Changelog

## [Unreleased]

### Added
- Canvas 2D:
  - `createLinearGradient()` / `addColorStop()` as a `fillStyle` for `fill()` and `fillRect()`.
  - `pushClip(x, y, w, h)` / `popClip()`.
  - `textAlign`, `textBaseline` and `fontWeight` for `fillText`.
  - `measureText(text, fontSize)`, measured by the same text engine that draws it, and cached.
- `Pressable`:
  - `onPointerMove({ x, y, locationX, locationY })` fires continuously while the pointer is over it, once per frame.
  - `onKeyDown({ key, ctrl, shift })` receives key presses while it has keyboard focus (from Tab or a click). Until now, keys only reached text inputs.
- Accessibility props:
  - `focusable` makes any node a Tab stop, or removes one.
  - `accessibilityLiveRegion` (`'polite'` / `'assertive'`) announces label changes as they happen.
  - `accessibilityRoleDescription` (e.g. `"line chart"`).
  - A `figure` role.
- `transition` can now animate more than opacity. `transition={{ duration, properties, easing }}`:
  - `properties` picks what animates: any of `'opacity'`, `'transform'`, `'backgroundColor'`, `'borderColor'`, `'borderRadius'` and `'boxShadow'`, or `'all'`. It defaults to `['opacity']`, so existing `transition={{ duration }}` code behaves exactly as before.
  - `easing` takes the CSS curves: `linear`, `ease`, `ease-in`, `ease-out` (the default) and `ease-in-out`, or `cubic-bezier(x1, y1, x2, y2)`.
  - All of it runs natively with no JS work per frame, and a change mid-animation continues from the current on-screen value.
- Keyframe animations: `animation={{ keyframes, duration, easing, iterations, direction, fill }}`, the equivalent of CSS `@keyframes`, for motion that isn't triggered by a style change (spinners, pulses, entrances).
  - `keyframes` is an object keyed by `from`/`to`/`'50%'`/percentage numbers, or an array of frames spaced evenly (each can set its own `offset`).
  - `iterations` can be `Infinity`. `direction: 'alternate'` plays every other iteration backwards, and `fill: 'forwards'` holds the last frame.
  - It animates the same properties as `transition`, runs natively, and doesn't restart when the component re-renders with the same settings.
- Screen readers can now read and select text inside `TextInput`, in builds with the `a11y` feature. The field exposes its text in a way a screen reader can navigate by character, word and line. It reports its selection, and a selection the screen reader makes applies to the field just like a mouse drag. Multiline fields are announced as multiline. While the field is empty, its placeholder is announced as a placeholder, not as typed content.
- `TextInput` accepts `textAlign` (`'left'` | `'center'` | `'right'`), applied to rendering and hit-testing alike.

### Fixed
- Changing a `Text`'s `fontWeight`, `fontStyle`, `lineHeight` or `textScrollX` now re-measures it. Before, only a text or size change did, so restyling text in place kept its old width.
- Single-line text (`textScrollX` set, as in inputs and rich-text spans) now counts trailing spaces in its width.
- `Text` with `numberOfLines={1}` now ends in an ellipsis (…) when it doesn't fit, instead of wrapping. The limit can also be set in the style, as `numberOfLines`, or the web way with `textOverflow: 'ellipsis'` (usually alongside `whiteSpace: 'nowrap'`).
- Numeric `fontWeight` values of 600 and up (`'600'`, `'700'`, `700`) now draw bold. Before, only `'bold'` did.
- A finished `animation` replayed every time its component re-rendered with the same settings. In a live dashboard, every chart re-faded every few seconds. Finished animations now stay finished until their settings change.
- `borderWidth: 0` drew a 1-pixel hairline border instead of no border.
- **`transform` now draws on every renderer.** It was silently ignored on the CPU renderer (`renderMode: "skia"`) and on Direct2D; only the GPU renderer applied it.
- **Chained transforms apply in CSS order.** `translate(100, 0) rotate(45)` now moves the element and rotates it in place. Previously the rotation also rotated the offset. This only affects transforms with more than one function.
- **Transforms accept CSS units:** `px`, `deg`, `rad`, `turn` and `grad`. A value like `rotate(180deg)` used to be dropped entirely, and `@glyx-dev/design`'s navigation chevron uses exactly that.
- **Clicks in text now land on the character drawn under the pointer.** `TextInput` and `SelectableText` hit-test through a single native call that shapes and places the text exactly as the renderer does, using the Text node's own props. Previously each component re-derived placement itself and got different parts wrong:
  - Center/right-aligned text resolved clicks as if it were left-aligned.
  - `lineHeight` was ignored when resolving the clicked line in multiline fields.
  - Vertically centered text (`SelectableText` in a taller box) was hit-tested as if top-aligned.
  - The wrap width differed from the renderer's by 1px, so a word that fit at render time could wrap at hit-test time.
  - Clicking to the right of a line ending in a newline put the caret at the start of the *next* line.
- `SelectableText`: drag-selection now works across wrapped lines. Its drag/press handlers also register at all now; they were attached through a leftover pre-rename prop name (`_veloxOnMount`) that the host config never read.
- Element-relative coordinates (`Pressable`'s `locationX/Y`, text-input click/drag offsets) are measured from the element's real origin. For an element partly scrolled out of a `ScrollView`, they used to be measured from the clip edge, so they were off by the scrolled-away amount.
- `ScrollView` and multiline `TextInput` scroll limits use the element's full viewport height. A partly clipped scroller could previously scroll past its content.
- Multiline `TextInput` PageUp/PageDown keeps the caret's column instead of jumping to the start of the line.

### Changed
- `ipc.on('message', ...)` listeners now receive messages without an internal JSON round trip on the native side — no behavior change, but inter-window IPC polling is cheaper per frame.
- The internal host config (`hostConfig.js`) now batches append/insertBefore/update/remove/setRoot operations from one React commit into a single native call instead of one call per operation, encoded as one flat array instead of nested per-op arrays. No API or behavior change — purely a native-bridge efficiency change (see the project performance changelog for the numbers).
- Click and hover hit-testing (`findTopmostSolid` in `events.js`) is no longer computed in JS at all — it's resolved natively when an input event is captured and attached to the event before JS ever sees it, instead of JS calling a native layout query once per candidate element on every click and every cursor move. As a result, the JS-side bookkeeping that only existed to support that lookup (the solid-node registry and the per-node z-index map, along with `registerSolid`/`unregisterSolid`/`setNodeZIndex`) has been removed entirely — one fewer Map write on every node's creation, update, and removal. (An earlier point release in this same cycle had fixed an O(n²) bug in that registry's removal path; this change removes the registry altogether, superseding that fix.) No public API changed — these were internal to `hostConfig.js`/`events.js`, never re-exported.
- `TextInput`'s multiline auto-height calculation is now memoized (`useMemo`) instead of running unconditionally in the render body on every render, including ones triggered by unrelated parent/context changes. It now only re-measures when text, font size, field width, or the min/max line props actually change. No behavior change.


## [0.1.0] - 2026-08-07

- Initial public release.
