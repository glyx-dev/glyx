//! Writing files only the current user can read: the discovery file holds
//! the GDP token, which is full control of the app.

use std::io::Write;
use std::path::Path;

/// Write `contents` to `path`, readable and writable by the owner only.
/// The file is created empty and locked down before the contents go in, so
/// the token is never readable by others, even briefly. Replaces any old
/// file. Creates missing parent directories (owner-only on Unix, since the
/// temp-dir fallback may be shared).
pub fn write_private(path: &Path, contents: &str) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        if !dir.as_os_str().is_empty() && !dir.exists() {
            std::fs::create_dir_all(dir)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))?;
            }
        }
    }
    // A leftover file may have looser permissions; start over.
    let _ = std::fs::remove_file(path);
    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    let mut f = opts.open(path)?;
    #[cfg(windows)]
    restrict_to_owner(path)?;
    f.write_all(contents.as_bytes())?;
    f.sync_all()
}

/// Replace the file's access list with: its owner and SYSTEM, full control;
/// nothing inherited (a protected DACL).
#[cfg(windows)]
fn restrict_to_owner(path: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Authorization::{ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1};
    use windows_sys::Win32::Security::{SetFileSecurityW, DACL_SECURITY_INFORMATION, PROTECTED_DACL_SECURITY_INFORMATION, PSECURITY_DESCRIPTOR};

    let wide = |s: &std::ffi::OsStr| s.encode_wide().chain(Some(0)).collect::<Vec<u16>>();
    // P: protected (no inheritance). OW: the object's owner. SY: SYSTEM.
    let sddl = wide(std::ffi::OsStr::new("D:P(A;;FA;;;OW)(A;;FA;;;SY)"));
    let file = wide(path.as_os_str());
    let mut sd: PSECURITY_DESCRIPTOR = std::ptr::null_mut();
    // SAFETY: valid NUL-terminated strings; `sd` is freed with LocalFree below.
    unsafe {
        if ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.as_ptr(), SDDL_REVISION_1, &mut sd, std::ptr::null_mut()) == 0 {
            return Err(std::io::Error::last_os_error());
        }
        let ok = SetFileSecurityW(file.as_ptr(), DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION, sd);
        let err = std::io::Error::last_os_error();
        LocalFree(sd as _);
        if ok == 0 { return Err(err); }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_and_replaces_the_file() {
        let dir = std::env::temp_dir().join(format!("glyx-private-{}", std::process::id()));
        let file = dir.join("sub").join("devtools.json");
        write_private(&file, "one").unwrap();
        write_private(&file, "two").unwrap();
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "two");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(std::fs::metadata(&file).unwrap().permissions().mode() & 0o777, 0o600);
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Only the owner (and SYSTEM) are on the access list, none inherited.
    #[cfg(windows)]
    #[test]
    fn windows_access_list_is_owner_only() {
        let dir = std::env::temp_dir().join(format!("glyx-private-acl-{}", std::process::id()));
        let file = dir.join("devtools.json");
        write_private(&file, "secret").unwrap();
        let out = std::process::Command::new("icacls").arg(&file).output().unwrap();
        let text = String::from_utf8_lossy(&out.stdout).to_string();
        let entries: Vec<&str> = text.lines().filter(|l| l.contains(":(")).collect();
        assert!(entries.len() <= 2, "{text}");
        assert!(!text.contains("(I)"), "no inherited entries: {text}");
        assert!(!text.contains("Users:") && !text.contains("Everyone:"), "{text}");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
