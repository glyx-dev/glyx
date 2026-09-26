# Changelog

## [Unreleased]

### Changed
- `__glyx_text_pos_at` stub follows the new native signature `(text, x, y, opts)`, where `opts` is the Text node's own props plus `boxWidth`/`boxHeight`.
- Added a `__glyx_text_caret_at(text, offset, opts)` stub (inverse of `__glyx_text_pos_at`).
- `__glyx_getLayout` stub returns the new `boxX`/`boxY`/`boxWidth`/`boxHeight` fields.


### Changed
- The `__glyx_ipc_poll` test stub now returns a real array (`[]`) instead of a JSON string (`'[]'`), matching the real native binding's return shape after a recent native-side change.
- Added a `__glyx_flushSceneOps` stub that replays a batched, flat-encoded array of scene operations through the existing individual node-tree stubs (`__glyx_appendChild`, `__glyx_updateNode`, etc.), so the simulated node tree stays accurate now that `@glyx-dev/react`'s host config batches these operations into one call per commit instead of calling each binding directly.

## [0.1.0] - 2026-08-07

- Initial public release.
