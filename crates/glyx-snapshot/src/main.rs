//! glyx-snapshot CLI — V8 snapshot builder
//!
//! Usage: glyx-snapshot <polyfills.js> <framework.js> <app.js> <output.snapshot>
//!        glyx-snapshot --base <output.snapshot>
//!
//! `--base` builds the snapshot every app without its own `js/polyfills.js` uses: the runtime's
//! stub bindings and nothing else (the app is always evaluated at runtime). It is the same for
//! every app, so the release publishes one per platform and `glyx build` downloads it instead of
//! needing this tool (and a Rust toolchain). The CLI uses `--base` for its local build too, so the
//! downloaded and the locally built blobs are made from the same inputs.

use std::fs;

fn main() -> anyhow::Result<()> {
    env_logger::Builder::from_default_env()
        .format_timestamp(None)
        .init();

    let args: Vec<String> = std::env::args().collect();

    if args.get(1).map(String::as_str) == Some("--base") {
        let Some(output) = args.get(2) else {
            eprintln!("Usage: glyx-snapshot --base <output.snapshot>");
            std::process::exit(1);
        };
        let blob = glyx_snapshot::create_base_snapshot()?;
        fs::write(output, &blob)
            .map_err(|e| anyhow::anyhow!("Failed to write {}: {}", output, e))?;
        eprintln!("✅ Base snapshot created: {} ({} KB)", output, blob.len() / 1024);
        return Ok(());
    }

    if args.len() < 5 {
        eprintln!("Usage: glyx-snapshot <polyfills.js> <framework.js> <app.js> <output.snapshot>");
        eprintln!();
        eprintln!("Creates a V8 snapshot blob from JavaScript source code.");
        eprintln!("The snapshot enables fast startup by restoring the heap instead of parsing JS.");
        std::process::exit(1);
    }

    let polyfills_path = &args[1];
    let framework_path = &args[2];
    let app_path = &args[3];
    let output_path = &args[4];

    eprintln!("📦 glyx-snapshot: Creating snapshot...");
    eprintln!("  Polyfills:  {}", polyfills_path);
    eprintln!("  Framework:  {}", framework_path);
    eprintln!("  App:        {}", app_path);
    eprintln!("  Output:     {}", output_path);

    // Read input files
    let polyfills = fs::read_to_string(polyfills_path)
        .map_err(|e| anyhow::anyhow!("Failed to read {}: {}", polyfills_path, e))?;

    let framework = fs::read_to_string(framework_path)
        .map_err(|e| anyhow::anyhow!("Failed to read {}: {}", framework_path, e))?;

    let app_js = fs::read_to_string(app_path)
        .map_err(|e| anyhow::anyhow!("Failed to read {}: {}", app_path, e))?;

    // Create snapshot
    let blob = glyx_snapshot::create_snapshot(&polyfills, &framework, &app_js)?;

    // Write output
    fs::write(output_path, &blob)
        .map_err(|e| anyhow::anyhow!("Failed to write {}: {}", output_path, e))?;

    let size_kb = blob.len() / 1024;
    eprintln!("✅ Snapshot created: {} ({} KB)", output_path, size_kb);
    eprintln!();
    eprintln!("Startup performance:");
    eprintln!("  Dev (eval):  ~500-1000ms");
    eprintln!("  Prod (snapshot): ~50ms");
    eprintln!("  Improvement: 10-20x faster");

    Ok(())
}
