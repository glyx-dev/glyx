//! cli-test — tests the AppConfig::from_config() path used by `velox create`.
//!
//! This is exactly what `velox create my-app` generates.
//! No hardcoded paths, no include_str! — everything is read from velox.config.json at runtime.
//!
//! Run from this folder:
//!   cd examples/cli-test
//!   bun install            (first time only)
//!   bun build js/app.jsx --outfile js/app.js --target browser --format iife --define "process.env.NODE_ENV='production'"
//!   RUST_LOG=info cargo run -p cli-test
//!
//! Or use the CLI (from the project root, once velox is built):
//!   cd examples/cli-test
//!   velox dev

fn main() {
    velox_core::run(velox_core::AppConfig::from_config());
}
