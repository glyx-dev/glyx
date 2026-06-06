//! Velox hello-world example with V8 snapshot.
//!
//! This example demonstrates using a pre-executed snapshot blob for fast startup.
//! First, create the snapshot:
//!
//!   cargo run -p velox-snapshot -- \
//!     examples/hello-world/js/polyfills.js \
//!     /tmp/framework.js \
//!     examples/hello-world/js/app.js \
//!     /tmp/hello-world.snapshot
//!
//! Then run this example:
//!
//!   VELOX_SNAPSHOT_PATH=/tmp/hello-world.snapshot cargo run -p hello-world-snapshot
//!

fn main() {
    // Load snapshot blob from environment variable or default path
    let snapshot_path = std::env::var("VELOX_SNAPSHOT_PATH")
        .unwrap_or_else(|_| "/tmp/hello-world.snapshot".to_string());

    let snapshot_blob = match std::fs::read(&snapshot_path) {
        Ok(blob) => {
            eprintln!("📦 Loaded snapshot from: {}", snapshot_path);
            eprintln!("   Size: {} KB", blob.len() / 1024);
            Some(blob)
        }
        Err(e) => {
            eprintln!("⚠️  Could not load snapshot ({}), falling back to eval mode", e);
            None
        }
    };

    velox_core::run(velox_core::AppConfig {
        window: velox_core::WindowConfig {
            title:  "Velox — Hello World (Snapshot)".into(),
            width:  1280,
            height: 800,
            ..Default::default()
        },
        js_src: Some(include_str!("../../../examples/hello-world/js/app.js").to_string()),
        snapshot_blob,
        extensions: vec![],
        js_plugins: vec![],
        dev_mode: Some(velox_core::DevModeConfig::new(
            std::path::PathBuf::from("examples/hello-world"),
            std::path::PathBuf::from("examples/hello-world/js/app.jsx"),
            std::path::PathBuf::from("examples/hello-world/js/app.js"),
            vec![
                std::path::PathBuf::from("examples/hello-world/js"),
                std::path::PathBuf::from("js/packages/@velox/react/src"),
            ],
        )),
    });
}
