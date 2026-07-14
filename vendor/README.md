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
| **Patch** | Added `ResourcePool::trim()` → `WgpuEngine::trim_pool()` → `Renderer::trim_resources()`. Caps the GPU buffer pool to 4 buffers per size-class (`MAX_POOL_BUFS_PER_CLASS = 4`) so the pool stays bounded instead of growing without limit across frames. Called on focus-loss and occlusion. |

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
