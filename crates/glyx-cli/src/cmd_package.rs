use anyhow::{bail, Context, Result};
use std::path::{Path, PathBuf};
use std::process::Command;

/// Verify the SHA-256 hex digest of `path` matches `expected`.
/// Deletes the file on mismatch so a retry will re-download cleanly.
fn verify_sha256(path: &Path, expected: &str) -> Result<()> {
    use std::io::Read;
    use sha2::Digest as _;
    let mut file = std::fs::File::open(path)
        .with_context(|| format!("cannot open {} for hash verification", path.display()))?;
    let mut hasher = sha2::Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    let actual = format!("{:x}", hasher.finalize());
    if actual != expected {
        let _ = std::fs::remove_file(path);
        bail!("SHA-256 mismatch for {}:\n  expected: {}\n  actual:   {}\nFile deleted -- retry will re-download.", path.display(), expected, actual);
    }
    Ok(())
}

use super::{
    read_project_name, host_os, platform_to_rust_target, binary_name,
    find_workspace_root, read_app_metadata, read_icon_path, read_deeplink_scheme,
    copy_runtime_files, copy_media_dll_if_needed, install_license_files,
    write_file,
    png_to_ico, png_to_icns,
    DEFAULT_ICON_PNG,
};

pub(super) fn cmd_package(target: Option<&str>, installer: bool) -> Result<()> {
    let project_name = read_project_name()
        .context("Run `glyx package` from the project root")?;
    let os = target.unwrap_or(host_os());
    let rust_target = platform_to_rust_target(os)?;
    let bin_src = resolve_packaged_binary(&project_name, &rust_target, target.is_some())?;
    std::fs::create_dir_all("target/glyx/dist")?;
    if installer {
        match os {
            "windows" => installer_windows(&project_name, &bin_src)?,
            "macos"   => installer_macos(&project_name, &bin_src)?,
            "linux"   => installer_linux(&project_name, &bin_src)?,
            other     => bail!("Unknown target OS: {other}. Use: windows, macos, linux"),
        }
    } else {
        match os {
            "windows" => package_windows(&project_name, &bin_src)?,
            "macos"   => package_macos(&project_name, &bin_src)?,
            "linux"   => package_linux(&project_name, &bin_src)?,
            other     => bail!("Unknown target OS: {other}. Use: windows, macos, linux"),
        }
    }
    Ok(())
}

pub(super) fn resolve_packaged_binary(project_name: &str, rust_target: &str, _cross_target: bool) -> Result<PathBuf> {
    let bin = binary_name(project_name);
    // Always check both the native path (host build without --target) and the
    // cross-target path (explicit --target triple). `glyx build` without a
    // --target flag writes to target/release/, so `glyx package windows` must
    // find it there even though the OS argument implies a cross-target path.
    let rels = [
        PathBuf::from(format!("target/release/{bin}")),
        PathBuf::from(format!("target/{rust_target}/release/{bin}")),
    ];
    let cwd = std::env::current_dir()?;
    let ws_root = find_workspace_root()?;
    let mut candidates = vec![];
    for rel in &rels {
        let p = cwd.join(rel);
        if !candidates.contains(&p) { candidates.push(p); }
        if let Some(ref root) = ws_root {
            let p = root.join(rel);
            if !candidates.contains(&p) { candidates.push(p); }
        }
    }
    for candidate in &candidates {
        if candidate.exists() { return Ok(candidate.clone()); }
    }
    let searched = candidates.iter().map(|p| p.display().to_string()).collect::<Vec<_>>().join(", ");
    bail!("Binary not found. Run `glyx build` first. Searched: {searched}");
}

pub(super) fn package_windows(name: &str, bin: &Path) -> Result<()> {
    let dist_root = PathBuf::from("target/glyx/dist");
    let app_dir = dist_root.join(format!("{name}-windows"));
    if app_dir.exists() { std::fs::remove_dir_all(&app_dir).with_context(|| format!("remove {}", app_dir.display()))?; }
    std::fs::create_dir_all(&app_dir)?;
    let exe_name = binary_name(name);
    let exe_dest = app_dir.join(&exe_name);
    std::fs::copy(bin, &exe_dest).with_context(|| format!("copy {}", bin.display()))?;
    copy_runtime_files(&app_dir)?;
    copy_media_dll_if_needed(&app_dir)?;
    let win_meta = read_app_metadata();
    install_license_files(&app_dir.join("LICENSES"), win_meta.license.as_deref())?;

    // Generate icon.ico — use the app's configured icon, or fall back to the
    // embedded Glyx logo so every package always has a proper icon.
    let ico_dest = app_dir.join("icon.ico");
    let icon_result = if let Some(icon_png) = read_icon_path() {
        png_to_ico(&icon_png, &ico_dest)
    } else {
        // Write default icon to a temp file then convert
        let tmp = std::env::temp_dir().join("glyx_default_icon.png");
        std::fs::write(&tmp, DEFAULT_ICON_PNG)
            .context("write default icon temp file")?;
        png_to_ico(tmp.to_str().unwrap_or(""), &ico_dest)
    };
    match icon_result {
        Ok(()) => {
            println!("  Icon: {}", ico_dest.display());
            // Embed the icon resource into the exe so Task Manager shows it.
            // rcedit patches the PE header — no recompile needed.
            match ensure_rcedit() {
                Ok(rcedit) => {
                    let out = Command::new(&rcedit)
                        .args([
                            exe_dest.to_str().unwrap_or(""),
                            "--set-icon",
                            ico_dest.to_str().unwrap_or(""),
                        ])
                        .output();
                    match out {
                        Ok(o) if o.status.success() => println!("  Exe icon embedded (Task Manager ready)"),
                        Ok(o) => println!("  Warning: rcedit failed: {}", String::from_utf8_lossy(&o.stderr).trim()),
                        Err(e) => println!("  Warning: rcedit not run: {e}"),
                    }
                }
                Err(e) => println!("  Warning: exe icon not embedded ({e})"),
            }
        }
        Err(e) => println!("  Warning: icon.ico not generated: {e}"),
    }

    if let Some(scheme) = read_deeplink_scheme() {
        let exe_abs = exe_dest.canonicalize()
            .unwrap_or(exe_dest.clone())
            .to_string_lossy()
            .replace('/', "\\");
        let reg_key = format!("HKCU\\Software\\Classes\\{scheme}");
        let open_key = format!("{reg_key}\\shell\\open\\command");
        let reg_content = format!(
            "Windows Registry Editor Version 5.00\r\n\r\n\
             [{reg_key}]\r\n\
             @=\"URL:{scheme} Protocol\"\r\n\
             \"URL Protocol\"=\"\"\r\n\r\n\
             [{open_key}]\r\n\
             @=\"\\\"{exe_abs}\\\" \\\"%1\\\"\"\r\n"
        );
        let reg_path = app_dir.join("register-scheme.reg");
        std::fs::write(&reg_path, reg_content)?;
        println!("  Deep-link scheme '{scheme}://' → auto-registered on first launch (register-scheme.reg included as fallback)");
    }

    let zip_path = format!("target/glyx/dist/{name}-{}-windows.zip", win_meta.version);
    println!("Packaging for Windows: {zip_path}");
    let status = Command::new("powershell")
        .args(["-Command", &format!("Compress-Archive -Path '{}/*' -DestinationPath '{}' -Force", app_dir.display(), zip_path)])
        .status();
    match status {
        Ok(s) if s.success() => {
            println!("✓ Package: {zip_path}");
            println!("  Unzip and run {exe_name} from the extracted folder");
        }
        _ => { println!("✓ Folder: {}", app_dir.display()); }
    }
    Ok(())
}

pub(super) fn package_macos(name: &str, bin: &Path) -> Result<()> {
    let bundle_root = PathBuf::from(format!("target/glyx/dist/{name}.app"));
    let app_dir = bundle_root.join("Contents/MacOS");
    let res_dir = bundle_root.join("Contents/Resources");
    std::fs::create_dir_all(&app_dir)?;
    std::fs::create_dir_all(&res_dir)?;
    std::fs::copy(bin, app_dir.join(name))?;

    let scheme_xml = if let Some(scheme) = read_deeplink_scheme() {
        println!("  Deep-link scheme '{scheme}://' → CFBundleURLTypes in Info.plist");
        format!(r#"
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key><string>com.glyx.{name}.{scheme}</string>
            <key>CFBundleURLSchemes</key>
            <array><string>{scheme}</string></array>
        </dict>
    </array>"#)
    } else {
        String::new()
    };

    // Generate icon.icns from app icon PNG if on macOS.
    let icon_xml = if let Some(icon_png) = read_icon_path() {
        match png_to_icns(&icon_png, &res_dir) {
            Ok(icns_path) => {
                println!("  Icon: {}", icns_path.display());
                "\n    <key>CFBundleIconFile</key><string>icon</string>".to_string()
            }
            Err(e) => {
                println!("  Warning: icon.icns not generated: {e}");
                String::new()
            }
        }
    } else {
        String::new()
    };

    let plist = format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key><string>{name}</string>
    <key>CFBundleIdentifier</key><string>com.glyx.{name}</string>
    <key>CFBundleName</key><string>{name}</string>
    <key>CFBundleVersion</key><string>1.0</string>{icon_xml}{scheme_xml}
</dict>
</plist>"#);
    write_file(bundle_root.join("Contents/Info.plist"), &plist)?;
    copy_media_dll_if_needed(&app_dir)?;
    let macos_meta = read_app_metadata();
    install_license_files(&res_dir.join("LICENSES"), macos_meta.license.as_deref())?;
    println!("✓ Package: {}", bundle_root.display());
    Ok(())
}

pub(super) fn package_linux(name: &str, bin: &Path) -> Result<()> {
    std::fs::create_dir_all("target/glyx/dist")?;

    // Copy icon PNG alongside binary so xdg-icon-resource / AppImage can use it.
    let icon_field = if let Some(icon_png) = read_icon_path() {
        let icon_dest = format!("target/glyx/dist/{name}.png");
        if let Err(e) = std::fs::copy(&icon_png, &icon_dest) {
            println!("  Warning: could not copy icon: {e}");
            name.to_string()
        } else {
            println!("  Icon: {icon_dest}");
            format!("target/glyx/dist/{name}")
        }
    } else {
        name.to_string()
    };

    if let Some(scheme) = read_deeplink_scheme() {
        let mime_type = format!("x-scheme-handler/{scheme}");
        let desktop = format!(
            "[Desktop Entry]\nType=Application\nName={name}\n\
             Exec={name} %u\nIcon={icon_field}\nMimeType={mime_type};\n\
             NoDisplay=false\nCategories=Application;\n"
        );
        let desktop_path = format!("target/glyx/dist/{name}.desktop");
        std::fs::write(&desktop_path, desktop)?;
        println!("  Deep-link scheme '{scheme}://' → {desktop_path}");
        println!("  To activate: xdg-desktop-menu install --novendor {name}.desktop");
    }

    let archive = format!("target/glyx/dist/{name}-linux.tar.gz");
    println!("Packaging for Linux: {archive}");
    let status = Command::new("tar")
        .args(["-czf", &archive, "-C", bin.parent().unwrap().to_str().unwrap(), &binary_name(name)])
        .status();
    match status {
        Ok(s) if s.success() => { println!("✓ Package: {archive}"); }
        _ => {
            let dest = format!("target/glyx/dist/{name}");
            std::fs::copy(bin, &dest)?;
            println!("✓ Binary: {dest}");
        }
    }
    copy_media_dll_if_needed(&PathBuf::from("target/glyx/dist"))?;
    let linux_meta = read_app_metadata();
    install_license_files(&PathBuf::from("target/glyx/dist/LICENSES"), linux_meta.license.as_deref())?;
    Ok(())
}

// ── Installer builders ────────────────────────────────────────────────────────

/// Windows installer via NSIS (downloaded and cached automatically on first run).
/// No manual tool installation required — works like electron-builder.
pub(super) fn installer_windows(name: &str, bin: &Path) -> Result<()> {
    package_windows(name, bin)?;

    let version = read_app_metadata().version;

    // Use absolute paths — NSIS resolves relative paths relative to the .nsi
    // file's own directory, not the working directory, so relative paths break.
    let cwd     = std::env::current_dir()?;
    let app_dir = cwd.join(format!("target/glyx/dist/{name}-windows"));
    let out_dir = cwd.join("target/glyx/dist");

    let nsis_dir  = ensure_nsis()?;
    let makensis  = nsis_dir.join("makensis.exe");
    let nsi_path  = out_dir.join(format!("{name}.nsi"));
    let setup_exe = out_dir.join(format!("{name}-{version}-Setup.exe"));

    std::fs::write(&nsi_path, generate_nsi_script(name, &app_dir, &out_dir))?;
    println!("  Script: {}", nsi_path.display());
    println!("Compiling installer…");

    let status = Command::new(&makensis)
        .arg(nsi_path.to_str().unwrap())
        .status()
        .with_context(|| format!("failed to run {}", makensis.display()))?;
    if !status.success() {
        bail!("makensis failed. Review {}", nsi_path.display());
    }
    println!("✓ Installer: {}", setup_exe.display());
    Ok(())
}

/// Ensure NSIS is cached at `~/.glyx/tools/nsis/`, downloading on first use.
pub(super) fn ensure_nsis() -> Result<PathBuf> {
    let home     = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .context("cannot resolve home directory")?;
    let nsis_dir = home.join(".glyx").join("tools").join("nsis");
    let makensis = nsis_dir.join("makensis.exe");
    if makensis.exists() {
        return Ok(nsis_dir);
    }

    const URL: &str = "https://downloads.sourceforge.net/project/nsis/NSIS%203/3.10/nsis-3.10.zip";
    // SHA-256 of the canonical nsis-3.10.zip from SourceForge.
    const SHA256: &str = "2735f04e5d1686b8aeecb8a9a56a80ae08c5e37f0dfa78ba9a7bf7f90a397c81";
    let zip_tmp = home.join(".glyx").join("tools").join("nsis-download.zip");
    std::fs::create_dir_all(zip_tmp.parent().unwrap())?;

    println!("Downloading NSIS (one-time, ~5 MB)...");
    // curl is built into Windows 10+, macOS, and every Linux distro.
    let ok = Command::new("curl")
        .args(["-fsSL", "-o", zip_tmp.to_str().unwrap(), URL])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if !ok {
        bail!(
            "Failed to download NSIS.\n\
             Check your internet connection or download manually:\n  {URL}\n\
             Extract to: {}", nsis_dir.display()
        );
    }

    // Verify SHA-256 before extracting — guards against supply-chain tampering.
    verify_sha256(&zip_tmp, SHA256)
        .context("NSIS download integrity check failed")?;

    println!("Extracting NSIS...");
    extract_zip_strip_top(&zip_tmp, &nsis_dir)
        .context("failed to extract NSIS zip")?;
    let _ = std::fs::remove_file(&zip_tmp);

    if !makensis.exists() {
        bail!(
            "NSIS extracted but makensis.exe not found at {}.\n\
             Delete {} and retry.", makensis.display(), nsis_dir.display()
        );
    }
    println!("✓ NSIS cached: {}", nsis_dir.display());
    Ok(nsis_dir)
}

/// Ensure rcedit is cached at `~/.glyx/tools/rcedit.exe`, downloading on first use.
/// rcedit patches Windows PE resources (icon, version info) without rebuilding.
pub(super) fn ensure_rcedit() -> Result<PathBuf> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .context("cannot resolve home directory")?;
    let tools_dir = home.join(".glyx").join("tools");
    std::fs::create_dir_all(&tools_dir)?;
    let rcedit = tools_dir.join("rcedit-x64.exe");
    if rcedit.exists() { return Ok(rcedit); }

    const URL: &str = "https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe";
    // SHA-256 of rcedit-x64.exe v2.0.0 from the official GitHub release.
    const SHA256: &str = "4088d04409b4db9c35acdb01b0e1a9a27f64b3e62562c7dc6e37b8a6b7be75f7";
    println!("Downloading rcedit (icon patcher, ~200 KB)...");
    let ok = Command::new("curl")
        .args(["-fsSL", "-o", rcedit.to_str().unwrap(), URL])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if !ok {
        bail!(
            "Failed to download rcedit.\n\
             Download manually from: {URL}\n\
             Save to: {}", rcedit.display()
        );
    }
    // Verify SHA-256 before caching — guards against supply-chain tampering.
    verify_sha256(&rcedit, SHA256)
        .context("rcedit download integrity check failed")?;
    println!("rcedit cached: {}", rcedit.display());
    Ok(rcedit)
}

/// Extract a zip, stripping the single top-level directory (e.g. `nsis-3.10/`).
pub(super) fn extract_zip_strip_top(zip_path: &Path, dest: &Path) -> Result<()> {
    let file    = std::fs::File::open(zip_path)?;
    let mut arc = zip::ZipArchive::new(file)?;
    std::fs::create_dir_all(dest)?;
    for i in 0..arc.len() {
        let mut entry = arc.by_index(i)?;
        let raw = match entry.enclosed_name() { Some(p) => p, None => continue };
        // Skip the top-level folder itself; strip it from every path.
        let stripped: PathBuf = raw.components().skip(1).collect();
        if stripped.as_os_str().is_empty() { continue; }
        let out = dest.join(&stripped);
        if entry.is_dir() {
            std::fs::create_dir_all(&out)?;
        } else {
            if let Some(p) = out.parent() { std::fs::create_dir_all(p)?; }
            let mut f = std::fs::File::create(&out)?;
            std::io::copy(&mut entry, &mut f)?;
        }
    }
    Ok(())
}

/// Generate an NSIS installer script (.nsi) for the given app folder.
pub(super) fn generate_nsi_script(name: &str, app_dir: &Path, out_dir: &Path) -> String {
    let meta      = read_app_metadata();
    let exe_name  = binary_name(name);
    let scheme    = read_deeplink_scheme();
    let publisher = if meta.publisher.is_empty() { name.to_string() } else { meta.publisher.clone() };
    let desc      = if meta.description.is_empty() { name.to_string() } else { meta.description.clone() };

    // NSIS VIProductVersion needs exactly 4 numbers (1.0.0 → 1.0.0.0)
    let vi_version = {
        let parts: Vec<&str> = meta.version.splitn(4, '.').collect();
        let mut v = parts.join(".");
        for _ in parts.len()..4 { v.push_str(".0"); }
        v
    };

    let ico_path = app_dir.join("icon.ico");
    let icon_line = if ico_path.exists() {
        format!(
            "!define MUI_ICON \"{ico}\"\n!define MUI_UNICON \"{ico}\"",
            ico = ico_path.display()
        )
    } else { String::new() };

    // NSIS CreateShortcut: 4th arg = icon file, 5th = icon index (0 = first)
    let shortcut_icon_arg = if ico_path.exists() {
        r#" "" "$INSTDIR\icon.ico" 0"#.to_string()
    } else {
        String::new()
    };

    let lic_line = {
        let app_lic   = app_dir.join("LICENSES").join("app.txt");
        let glyx_lic = app_dir.join("LICENSES").join("glyx.txt");
        let lic = if app_lic.exists() { Some(app_lic) } else if glyx_lic.exists() { Some(glyx_lic) } else { None };
        match lic {
            Some(p) => format!("!insertmacro MUI_PAGE_LICENSE \"{}\"", p.display()),
            None    => String::new(),
        }
    };

    let setup_exe = out_dir.join(format!("{name}-{}-Setup.exe", meta.version));

    // Deep-link scheme registry blocks (empty strings when no scheme configured)
    let (scheme_install, scheme_uninstall) = match &scheme {
        Some(s) => {
            let install = format!(
                "  ; Deep-link URL scheme: {s}://\n\
                   WriteRegStr HKCU \"Software\\Classes\\{s}\" \"\" \"URL:{s} Protocol\"\n\
                   WriteRegStr HKCU \"Software\\Classes\\{s}\" \"URL Protocol\" \"\"\n\
                   WriteRegStr HKCU \"Software\\Classes\\{s}\\shell\\open\\command\" \"\" '\"$INSTDIR\\{exe}\" \"%1\"'\n",
                s = s, exe = exe_name
            );
            let uninstall = format!(
                "  DeleteRegKey HKCU \"Software\\Classes\\{s}\"\n",
                s = s
            );
            (install, uninstall)
        }
        None => (String::new(), String::new()),
    };

    format!(
r#"!include "MUI2.nsh"
Unicode true

Name "{name}"
OutFile "{output}"
InstallDir "$PROGRAMFILES64\{name}"
InstallDirRegKey HKCU "Software\{name}" "InstallDir"
RequestExecutionLevel admin

{icon_line}

!insertmacro MUI_PAGE_WELCOME
{lic_line}
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\{exe}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch {name}"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

VIProductVersion "{vi_ver}"
VIAddVersionKey "ProductName"    "{name}"
VIAddVersionKey "CompanyName"    "{publisher}"
VIAddVersionKey "FileDescription" "{desc}"
VIAddVersionKey "FileVersion"    "{version}"
VIAddVersionKey "LegalCopyright" "© {publisher}"

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  File /r "{app_dir}\*.*"
  WriteRegStr HKCU "Software\{name}" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  ; Add/Remove Programs (Control Panel) entry
  WriteRegStr   HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{name}" "DisplayName"     "{name}"
  WriteRegStr   HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{name}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr   HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{name}" "DisplayVersion"  "{version}"
  WriteRegStr   HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{name}" "Publisher"       "{publisher}"
  WriteRegStr   HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{name}" "DisplayIcon"     '"$INSTDIR\{exe}"'
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{name}" "NoModify"        1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{name}" "NoRepair"        1
  CreateDirectory "$SMPROGRAMS\{name}"
  CreateShortcut "$SMPROGRAMS\{name}\{name}.lnk" "$INSTDIR\{exe}"{shortcut_icon_arg}
  CreateShortcut "$DESKTOP\{name}.lnk"           "$INSTDIR\{exe}"{shortcut_icon_arg}
{scheme_install}SectionEnd

Section "Uninstall"
  RMDir /r "$INSTDIR"
  Delete "$SMPROGRAMS\{name}\{name}.lnk"
  RMDir  "$SMPROGRAMS\{name}"
  Delete "$DESKTOP\{name}.lnk"
  DeleteRegKey HKCU "Software\{name}"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{name}"
{scheme_uninstall}SectionEnd
"#,
        name              = name,
        output            = setup_exe.display(),
        exe               = exe_name,
        app_dir           = app_dir.display(),
        icon_line         = icon_line,
        lic_line          = lic_line,
        vi_ver            = vi_version,
        version           = meta.version,
        publisher         = publisher,
        desc              = desc,
        shortcut_icon_arg = shortcut_icon_arg,
        scheme_install    = scheme_install,
        scheme_uninstall  = scheme_uninstall,
    )
}

/// macOS DMG via hdiutil (built-in system tool — no installation required).
pub(super) fn installer_macos(name: &str, bin: &Path) -> Result<()> {
    package_macos(name, bin)?;

    let version  = read_app_metadata().version;
    let app_path = format!("target/glyx/dist/{name}.app");
    let dmg_path = format!("target/glyx/dist/{name}-{version}.dmg");

    println!("Creating DMG: {dmg_path}");
    let status = Command::new("hdiutil")
        .args(["create", "-volname", name, "-srcfolder", &app_path, "-ov", "-format", "UDZO", &dmg_path])
        .status();

    match status {
        Ok(s) if s.success() => println!("✓ Installer: {dmg_path}"),
        Ok(_)  => bail!("hdiutil create failed"),
        Err(e) => bail!("hdiutil not available ({e}). Run this on macOS."),
    }
    Ok(())
}

/// Linux `.deb` package — generated entirely in Rust, no external tools needed.
pub(super) fn installer_linux(name: &str, bin: &Path) -> Result<()> {
    let meta = read_app_metadata();
    let dist = PathBuf::from("target/glyx/dist");
    std::fs::create_dir_all(&dist)?;

    // Build staging tree: /usr/bin/<name>, /usr/share/applications/<name>.desktop, icon
    let stage   = dist.join(format!(".{name}-deb-stage"));
    if stage.exists() { std::fs::remove_dir_all(&stage)?; }
    let usr_bin = stage.join("usr").join("bin");
    std::fs::create_dir_all(&usr_bin)?;

    // Binary (executable bit set below on Unix)
    let bin_dest = usr_bin.join(name);
    std::fs::copy(bin, &bin_dest)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&bin_dest, std::fs::Permissions::from_mode(0o755))?;
    }

    // .desktop entry
    let apps_dir = stage.join("usr").join("share").join("applications");
    std::fs::create_dir_all(&apps_dir)?;
    let desc = if meta.description.is_empty() { name.to_string() } else { meta.description.clone() };
    std::fs::write(
        apps_dir.join(format!("{name}.desktop")),
        format!("[Desktop Entry]\nType=Application\nName={name}\nExec={name}\nIcon={name}\nComment={desc}\nCategories=Utility;\n"),
    )?;

    // Icon
    if let Some(icon_png) = read_icon_path() {
        let icons_dir = stage.join("usr").join("share").join("icons")
            .join("hicolor").join("256x256").join("apps");
        std::fs::create_dir_all(&icons_dir)?;
        let _ = std::fs::copy(&icon_png, icons_dir.join(format!("{name}.png")));
    }

    // Control file
    let publisher    = if meta.publisher.is_empty() { name.to_string() } else { meta.publisher.clone() };
    let installed_kb = dir_size_kb(&stage);
    let control = format!(
        "Package: {name}\nVersion: {ver}\nArchitecture: amd64\n\
         Maintainer: {pub}\nInstalled-Size: {kb}\nDescription: {desc}\n",
        ver = meta.version, pub = publisher, kb = installed_kb,
    );

    let deb_path = dist.join(format!("{name}_{}_amd64.deb", meta.version));
    println!("Building .deb: {}", deb_path.display());
    write_deb(&deb_path, &control, &stage)?;
    let _ = std::fs::remove_dir_all(&stage);

    println!("✓ Installer: {}", deb_path.display());
    println!("  Install:   sudo dpkg -i {}", deb_path.file_name().unwrap().to_string_lossy());
    Ok(())
}

/// Write a Debian `.deb` package (ar archive of debian-binary + control.tar.gz + data.tar.gz).
pub(super) fn write_deb(deb_path: &Path, control: &str, data_dir: &Path) -> Result<()> {
    use flate2::{write::GzEncoder, Compression};

    // 1. control.tar.gz
    let mut ctrl_tgz: Vec<u8> = Vec::new();
    {
        let gz = GzEncoder::new(&mut ctrl_tgz, Compression::best());
        let mut tb = tar::Builder::new(gz);
        let bytes = control.as_bytes();
        let mut hdr = tar::Header::new_gnu();
        hdr.set_path("./control")?;
        hdr.set_size(bytes.len() as u64);
        hdr.set_mode(0o644);
        hdr.set_mtime(0);
        hdr.set_cksum();
        tb.append(&hdr, bytes)?;
        tb.into_inner()?.finish()?;
    }

    // 2. data.tar.gz
    let mut data_tgz: Vec<u8> = Vec::new();
    {
        let gz = GzEncoder::new(&mut data_tgz, Compression::best());
        let mut tb = tar::Builder::new(gz);
        tb.follow_symlinks(false);
        append_dir_to_tar(&mut tb, data_dir, data_dir)?;
        tb.into_inner()?.finish()?;
    }

    // 3. ar archive  (debian-binary + control.tar.gz + data.tar.gz)
    let mut out = std::fs::File::create(deb_path)?;
    write_ar_archive(&mut out, &[
        ("debian-binary",  b"2.0\n" as &[u8]),
        ("control.tar.gz", &ctrl_tgz),
        ("data.tar.gz",    &data_tgz),
    ])?;
    Ok(())
}

/// Recursively append a directory tree to a tar builder, paths relative to `root`.
pub(super) fn append_dir_to_tar<W: std::io::Write>(
    builder: &mut tar::Builder<W>,
    root:    &Path,
    dir:     &Path,
) -> Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path  = entry.path();
        let rel   = path.strip_prefix(root).unwrap();
        if path.is_dir() {
            append_dir_to_tar(builder, root, &path)?;
        } else {
            let mut hdr = tar::Header::new_gnu();
            let meta = std::fs::metadata(&path)?;
            hdr.set_path(format!("./{}", rel.display()))?;
            hdr.set_size(meta.len());
            #[cfg(unix)]
            { use std::os::unix::fs::MetadataExt; hdr.set_mode(meta.mode()); }
            #[cfg(not(unix))]
            hdr.set_mode(0o755);
            hdr.set_mtime(0);
            hdr.set_cksum();
            let mut file = std::fs::File::open(&path)?;
            builder.append(&hdr, &mut file)?;
        }
    }
    Ok(())
}

/// Write a BSD `ar` archive. Used to build `.deb` files.
pub(super) fn write_ar_archive(w: &mut impl std::io::Write, entries: &[(&str, &[u8])]) -> Result<()> {
    w.write_all(b"!<arch>\n")?;
    for (name, data) in entries {
        // 60-byte ar header
        let mut hdr = [b' '; 60];
        let id = format!("{name}/");
        let id_b = id.as_bytes();
        hdr[..id_b.len().min(16)].copy_from_slice(&id_b[..id_b.len().min(16)]);
        // mtime, uid, gid (all zero / space-padded)
        for (dst, src) in [
            (16usize..28usize, b"0           " as &[u8]),
            (28..34,           b"0     "),
            (34..40,           b"0     "),
            (40..48,           b"100644  "),
        ] {
            hdr[dst].copy_from_slice(src);
        }
        let size_str = format!("{:<10}", data.len());
        hdr[48..58].copy_from_slice(size_str.as_bytes());
        hdr[58] = b'`';
        hdr[59] = b'\n';
        w.write_all(&hdr)?;
        w.write_all(data)?;
        if data.len() % 2 != 0 { w.write_all(b"\n")?; } // even-byte padding
    }
    Ok(())
}

/// Recursively sum file sizes in `path`, returning kilobytes.
pub(super) fn dir_size_kb(path: &Path) -> u64 {
    fn bytes(p: &Path) -> u64 {
        std::fs::read_dir(p).map(|rd| rd.flatten().map(|e| {
            let ep = e.path();
            if ep.is_file() { std::fs::metadata(&ep).map(|m| m.len()).unwrap_or(0) }
            else            { bytes(&ep) }
        }).sum()).unwrap_or(0)
    }
    bytes(path) / 1024
}
