//! Velox hello-world example.
//!
//! The scene is defined in `js/app.js` and embedded at compile time via
//! `include_str!`. The Rust side only declares window settings and hands
//! the JS source to the framework — no scene logic lives here.
//!
//! Run:
//!   RUST_LOG=info cargo run -p hello-world

fn main() {
    velox_core::run(velox_core::AppConfig {
        window: velox_core::WindowConfig {
            title:  "Velox — Hello World".into(),
            width:  1280,
            height: 800,
            // continuous: false (default) — Wait mode, near-zero idle CPU.
            // Set to true when animations or a game loop are needed.
            ..Default::default()
        },
        js_src: Some(include_str!("../js/app.js").to_string()),
        snapshot_blob: None,
        extensions: vec![],
        js_plugins: vec![],
        dev_mode: Some(velox_core::DevModeConfig::new(
            std::path::PathBuf::from("."),
            std::path::PathBuf::from("js/app.jsx"),
            std::path::PathBuf::from("js/app.js"),
            vec![
                std::path::PathBuf::from("js"),
                std::path::PathBuf::from("../../js/packages/@velox/react/src"),
            ],
        )),
    });
}
