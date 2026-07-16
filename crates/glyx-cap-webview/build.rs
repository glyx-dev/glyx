fn main() {
    // webview2-com-sys calls registry + ETW functions (RegOpenKeyExW, EventRegister,
    // ...) that glyx-runtime picks up transitively from its other deps, but this
    // crate's standalone cdylib build (glyx-cli's build_cap_dlls) needs it explicit.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        println!("cargo:rustc-link-lib=dylib=advapi32");
    }
}
