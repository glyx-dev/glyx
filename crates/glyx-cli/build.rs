// Embeds the Glyx DevTools UI (tools/glyx-devtools-ui/dist) into the CLI so
// `glyx inspect` works offline with nothing to install. When the UI hasn't
// been built, the CLI serves a page explaining how to build it instead, so a
// plain `cargo build` never fails on it.

use std::path::{Path, PathBuf};

fn collect(root: &Path, dir: &Path, out: &mut Vec<(String, PathBuf)>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for e in entries.flatten() {
        let p = e.path();
        if p.is_dir() {
            collect(root, &p, out);
        } else if let Ok(rel) = p.strip_prefix(root) {
            out.push((rel.to_string_lossy().replace('\\', "/"), p));
        }
    }
}

fn main() {
    let manifest = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let ui = manifest.join("../../tools/glyx-devtools-ui");
    let dist = ui.join("dist");
    println!("cargo:rerun-if-changed={}", dist.display());
    println!("cargo:rerun-if-changed={}", ui.display());

    let mut files = Vec::new();
    collect(&dist, &dist, &mut files);
    files.sort();
    for (_, p) in &files {
        println!("cargo:rerun-if-changed={}", p.display());
    }

    let mut src = String::from("/// The DevTools UI build, embedded: (path, bytes).\npub static FILES: &[(&str, &[u8])] = &[\n");
    for (name, path) in &files {
        let abs = path.canonicalize().unwrap_or_else(|_| path.clone());
        src.push_str(&format!("    ({:?}, include_bytes!({:?})),\n", name, abs.to_string_lossy()));
    }
    src.push_str("];\n");
    let out = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("devtools_ui.rs");
    std::fs::write(out, src).unwrap();
}
