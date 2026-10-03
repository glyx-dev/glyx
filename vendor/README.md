# Vendored crates

These directories contain **patched forks** of upstream crates. They are not
published to crates.io; the workspace `[patch.crates-io]` table in the root
`Cargo.toml` points consumers to these paths.

---

## vendor/vello

| | |
|---|---|
| **Upstream** | <https://github.com/linebender/vello> |
| **License** | Apache-2.0 OR MIT (files unchanged; see `vendor/vello/LICENSE-APACHE` and `vendor/vello/LICENSE-MIT`) |
| **Patch** | **Adaptive scratch buffers** (`src/adaptive.rs`, `Renderer::render_to_texture_adaptive`). Upstream sizes the bump-allocated buffers (lines, tiles, segments, per-tile command lists, ...) with constants "hand picked to accommodate the vello test scenes as well as paris-30k": about 165 MiB for every scene, and no recovery when a scene outgrows them (the counter readback exists only with `debug_layers`). Here the buffers start at ~5 MiB and grow on demand up to a 2x-upstream ceiling (still one 128 MiB storage binding), and shrink when demand stays 4x lower for 240 frames. A frame draws in one pass like upstream and its allocation counters are read back a frame later without waiting (about +0.2 ms/frame on an integrated GPU). A frame waits for its counters before drawing, and re-runs a pass that did not fit before anything is drawn, only when overflow is likely (`adaptive::SyncPolicy`): the first frame, a new output size, a scene whose path count or tile coverage (`Scene::tile_estimate`, a sum of shape bounding boxes, plus glyph counts) is above the last measured scene by more than its allowed growth, or right after a late check found an overflow. The allowed growth is 25% when the buffers had room and shrinks to nothing as they approach 90% full. The estimate is not exact, so a scene that grows in a way neither number sees can still draw one frame with content missing before the late check grows the buffers; tests cover a jump in paths, a jump in area, and a card scaling up 18% a frame (no wrong frames). A first version that waited every frame cost 4-8 ms/frame and was dropped. `GLYX_VELLO_FIXED_BUFFERS=1` (read in glyx-renderer) restores upstream's fixed sizes; `Renderer::set_adaptive_buffers(false)` does the same in code. The CPU pipeline (`use_cpu`) keeps upstream sizes. Tests: `adaptive::tests` (sizing and wait policy) and `crates/glyx-renderer/tests/vello_adaptive.rs` (pixel-identical to the fixed-size render for light, heavy, jump, more-area and gradual-scaling scenes; needs a GPU, skips without one). Candidate for an upstream PR.<br><br>Also: Added `ResourcePool::trim()` → `WgpuEngine::trim_pool()` → `Renderer::trim_resources()`. Caps the GPU buffer pool to 4 buffers per size-class (`MAX_POOL_BUFS_PER_CLASS = 4`) so the pool stays bounded instead of growing without limit across frames. Called on focus-loss and occlusion.<br><br>Also: `Scene::append` keeps the target scene's pending `FORCE_NEXT_TRANSFORM` / `FORCE_NEXT_STYLE` flags. Upstream `vello_encoding` 0.9's `Encoding::append` overwrites them with the appended scene's. After text, appending a scene that encodes no transform (an empty cached fragment) made the next identity-transform draw inherit the text's transform, so it was drawn displaced. Candidate for an upstream fix. |

---

## vendor/libmimalloc-sys

| | |
|---|---|
| **Upstream** | <https://github.com/purpleprotocol/mimalloc_rust> (`libmimalloc-sys` crate) |
| **License** | MIT (see `vendor/libmimalloc-sys/LICENSE.txt`) |
| **Patch** | Added `.static_crt(true)` to the MSVC branch of `build.rs`. Required because `rusty_v8` and other workspace crates link `/MT` (static CRT); the upstream crate defaults to `/MD`, causing `LNK2038` on Windows. No logic change — purely a build-flag addition. |

---

If you are contributing a patch that touches any of these crates, please note
the change here and, where appropriate, open a PR upstream so the patch can
eventually be dropped.
