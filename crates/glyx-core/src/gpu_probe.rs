//! The GPU adapter probe `RenderMode::Auto` runs at startup, remembered between launches.
//!
//! Choosing a renderer needs one answer: what class of GPU is this machine (`glyx_gpu::GpuTier`)? Asking wgpu for it creates a graphics
//! instance, loads the DX12 and Vulkan drivers and enumerates adapters: 65 to 85 ms at every launch on an Intel UHD 620 (measured with
//! `GLYX_STARTUP_TRACE=1`), for an app that then draws on the CPU and never uses any of it. The answer only changes with the hardware, so it
//! is kept in `~/.glyx/cache/gpu-probe.txt`, keyed by the machine's adapter list (on Windows, read from DXGI, which is a few milliseconds
//! and loads no GPU driver) and by this Glyx's version (the tier rules may change). A different adapter set, a different version or an
//! unreadable file means the real probe runs and the answer is stored again. `GLYX_GPU_PROBE_CACHE=0` always probes.

use glyx_gpu::GpuTier;

/// The probe result: cached when this machine's adapters and this Glyx version match what was stored, otherwise asked of wgpu and stored.
pub(crate) fn probe() -> (GpuTier, String) {
    let key = if std::env::var("GLYX_GPU_PROBE_CACHE").as_deref() == Ok("0") { None } else { adapters_key() };
    let path = cache_path();
    if let (Some(key), Some(path)) = (&key, &path) {
        if let Some(hit) = std::fs::read_to_string(path).ok().and_then(|t| decode(&t, key)) {
            return hit;
        }
    }
    let result = pollster::block_on(glyx_gpu::probe_adapter_info()).unwrap_or((GpuTier::None, "no adapter".into()));
    if let (Some(key), Some(path)) = (&key, &path) {
        if let Some(dir) = path.parent() { let _ = std::fs::create_dir_all(dir); }
        let _ = std::fs::write(path, encode(key, result.0, &result.1));
    }
    result
}

fn cache_path() -> Option<std::path::PathBuf> {
    let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
    Some(std::path::PathBuf::from(home).join(".glyx").join("cache").join("gpu-probe.txt"))
}

fn tier_name(t: GpuTier) -> &'static str {
    match t {
        GpuTier::None => "none",
        GpuTier::Integrated => "integrated",
        GpuTier::DiscreteIntel => "discrete-intel",
        GpuTier::Discrete => "discrete",
    }
}

fn tier_from_name(s: &str) -> Option<GpuTier> {
    Some(match s {
        "none" => GpuTier::None,
        "integrated" => GpuTier::Integrated,
        "discrete-intel" => GpuTier::DiscreteIntel,
        "discrete" => GpuTier::Discrete,
        _ => return None,
    })
}

/// Three lines: the key, the tier, the adapter's name.
fn encode(key: &str, tier: GpuTier, name: &str) -> String {
    format!("{key}\n{}\n{}\n", tier_name(tier), name.replace(['\n', '\r'], " "))
}

/// The stored result, if it was made for exactly this `key`.
fn decode(text: &str, key: &str) -> Option<(GpuTier, String)> {
    let mut lines = text.lines();
    if lines.next()? != key { return None; }
    let tier = tier_from_name(lines.next()?)?;
    let name = lines.next()?.to_string();
    Some((tier, name))
}

/// Identifies this machine's graphics hardware and this Glyx's tier rules. Windows: every DXGI adapter's ids, memory, flags and name.
/// Elsewhere no cheap equivalent is read, so there is no key and the probe runs each time.
#[cfg(target_os = "windows")]
fn adapters_key() -> Option<String> {
    use windows::Win32::Graphics::Dxgi::{CreateDXGIFactory1, IDXGIFactory1};
    // SAFETY: plain COM calls on interfaces this function owns; nothing is retained after it returns.
    unsafe {
        let factory: IDXGIFactory1 = CreateDXGIFactory1().ok()?;
        let mut parts = vec![format!("glyx-{}", env!("CARGO_PKG_VERSION"))];
        let mut i = 0;
        while let Ok(adapter) = factory.EnumAdapters1(i) {
            let d = adapter.GetDesc1().ok()?;
            let len = d.Description.iter().position(|&c| c == 0).unwrap_or(d.Description.len());
            parts.push(format!(
                "{:04x}:{:04x}:{:x}:{}:{}:{}:{}",
                d.VendorId, d.DeviceId, d.Revision, d.DedicatedVideoMemory, d.SharedSystemMemory, d.Flags,
                String::from_utf16_lossy(&d.Description[..len]),
            ));
            i += 1;
        }
        (i > 0).then(|| parts.join("|"))
    }
}

#[cfg(not(target_os = "windows"))]
fn adapters_key() -> Option<String> { None }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_stored_probe_is_returned_only_for_the_same_adapters_and_version() {
        let key = "glyx-0.2.0|8086:5917:7:134217728:2147483648:0:Intel(R) UHD Graphics 620";
        let text = encode(key, GpuTier::Integrated, "Intel(R) UHD Graphics 620 (IntegratedGpu)");
        let (tier, name) = decode(&text, key).expect("same key");
        assert_eq!(tier, GpuTier::Integrated);
        assert_eq!(name, "Intel(R) UHD Graphics 620 (IntegratedGpu)");
        // Another adapter set, another Glyx version, or a damaged file: probe again.
        assert!(decode(&text, "glyx-0.2.0|10de:2204:a1:25769803776:0:0:NVIDIA GeForce RTX 3090").is_none());
        assert!(decode(&text, &key.replace("0.2.0", "0.3.0")).is_none());
        assert!(decode("", key).is_none());
        assert!(decode(&format!("{key}\nnot-a-tier\nname\n"), key).is_none());
        assert!(decode(&format!("{key}\nintegrated\n"), key).is_none(), "the name line is missing");
    }

    #[test]
    fn every_tier_survives_the_round_trip() {
        for t in [GpuTier::None, GpuTier::Integrated, GpuTier::DiscreteIntel, GpuTier::Discrete] {
            assert_eq!(decode(&encode("k", t, "n"), "k").map(|(t, _)| t), Some(t));
        }
        assert_eq!(decode(&encode("k", GpuTier::None, "two\nlines"), "k").map(|(_, n)| n), Some("two lines".to_string()));
    }
}
