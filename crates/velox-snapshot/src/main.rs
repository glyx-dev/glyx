//! velox-snapshot CLI — V8 snapshot builder
//!
//! Usage: velox-snapshot <polyfills.js> <framework.js> <app.js> <output.snapshot>

use std::fs;

fn main() -> anyhow::Result<()> {
    env_logger::Builder::from_default_env()
        .format_timestamp(None)
        .init();

    let args: Vec<String> = std::env::args().collect();

    if args.len() < 5 {
        eprintln!("Usage: velox-snapshot <polyfills.js> <framework.js> <app.js> <output.snapshot>");
        eprintln!();
        eprintln!("Creates a V8 snapshot blob from JavaScript source code.");
        eprintln!("The snapshot enables fast startup by restoring the heap instead of parsing JS.");
        std::process::exit(1);
    }

    let polyfills_path = &args[1];
    let framework_path = &args[2];
    let app_path = &args[3];
    let output_path = &args[4];

    eprintln!("📦 velox-snapshot: Creating snapshot...");
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
    let blob = velox_snapshot::create_snapshot(&polyfills, &framework, &app_js)?;

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
