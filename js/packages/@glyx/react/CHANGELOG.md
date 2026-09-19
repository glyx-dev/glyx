# Changelog

## [Unreleased]

### Changed
- `ipc.on('message', ...)` listeners now receive messages without an internal JSON round trip on the native side — no behavior change, but inter-window IPC polling is cheaper per frame.
- The internal host config (`hostConfig.js`) now batches append/insertBefore/update/remove/setRoot operations from one React commit into a single native call instead of one call per operation, encoded as one flat array instead of nested per-op arrays. No API or behavior change — purely a native-bridge efficiency change (see the project performance changelog for the numbers).
- Click and hover hit-testing (`findTopmostSolid` in `events.js`) is no longer computed in JS at all — it's resolved natively when an input event is captured and attached to the event before JS ever sees it, instead of JS calling a native layout query once per candidate element on every click and every cursor move. As a result, the JS-side bookkeeping that only existed to support that lookup (the solid-node registry and the per-node z-index map, along with `registerSolid`/`unregisterSolid`/`setNodeZIndex`) has been removed entirely — one fewer Map write on every node's creation, update, and removal. (An earlier point release in this same cycle had fixed an O(n²) bug in that registry's removal path; this change removes the registry altogether, superseding that fix.) No public API changed — these were internal to `hostConfig.js`/`events.js`, never re-exported.
- `TextInput`'s multiline auto-height calculation is now memoized (`useMemo`) instead of running unconditionally in the render body on every render, including ones triggered by unrelated parent/context changes. It now only re-measures when text, font size, field width, or the min/max line props actually change. No behavior change.

## [0.1.0] - 2026-08-07

- Initial public release.
