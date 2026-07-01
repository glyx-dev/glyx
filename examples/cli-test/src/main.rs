//! cli-test — tests the AppConfig::from_config() path used by `glyx create`.
//!
//! This is exactly what `glyx create my-app` generates.
//! No hardcoded paths, no include_str! — everything is read from glyx.config.json at runtime.
//!
//! Run from this folder:
//!   cd examples/cli-test
//!   bun install            (first time only)
//!   bun build js/app.jsx --outfile js/app.js --target browser --format iife --define "process.env.NODE_ENV='production'"
//!   RUST_LOG=info cargo run -p cli-test
//!
//! Or use the CLI (from the project root, once glyx is built):
//!   cd examples/cli-test
//!   glyx dev

fn main() {
    glyx_core::run(glyx_core::AppConfig::from_config());
}
