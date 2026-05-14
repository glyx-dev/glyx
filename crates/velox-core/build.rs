use std::{env, fs, path::PathBuf};

fn main() {
    println!("cargo:rerun-if-env-changed=VELOX_APP_SNAPSHOT");
    println!("cargo:rerun-if-env-changed=VELOX_APP_JS");
    println!("cargo:rerun-if-env-changed=VELOX_APP_CONFIG");

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR not set"));
    let generated = out_dir.join("embedded_snapshot.rs");

    let snapshot_const = embed_bytes("VELOX_APP_SNAPSHOT", "EMBEDDED_SNAPSHOT");
    let app_js_const   = embed_str("VELOX_APP_JS", "EMBEDDED_APP_JS");
    let config_const   = embed_str("VELOX_APP_CONFIG", "EMBEDDED_CONFIG");

    fs::write(generated, format!("{}{}{}", snapshot_const, app_js_const, config_const))
        .expect("write embedded build metadata");
}

fn clean_path(p: PathBuf) -> String {
    let canonical = p.canonicalize().unwrap_or(p);
    let s = canonical.to_string_lossy();
    // Strip Windows extended-length UNC prefix (\\?\) which breaks include_bytes!/include_str!
    let stripped = s.strip_prefix(r"\\?\").unwrap_or(&s);
    // Forward slashes work on Windows and avoid any escaping issues in raw string literals
    stripped.replace('\\', "/")
}

fn embed_bytes(env_var: &str, const_name: &str) -> String {
    match env::var(env_var) {
        Ok(path) if !path.trim().is_empty() => {
            let p = PathBuf::from(&path);
            println!("cargo:rerun-if-changed={}", p.display());
            let p = clean_path(p);
            format!("pub const {const_name}: Option<&[u8]> = Some(include_bytes!(r#\"{p}\"#));\n")
        }
        _ => format!("pub const {const_name}: Option<&[u8]> = None;\n"),
    }
}

fn embed_str(env_var: &str, const_name: &str) -> String {
    match env::var(env_var) {
        Ok(path) if !path.trim().is_empty() => {
            let p = PathBuf::from(&path);
            println!("cargo:rerun-if-changed={}", p.display());
            let p = clean_path(p);
            format!("pub const {const_name}: Option<&str> = Some(include_str!(r#\"{p}\"#));\n")
        }
        _ => format!("pub const {const_name}: Option<&str> = None;\n"),
    }
}
