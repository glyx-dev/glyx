//! Small process and path helpers shared by the backends.

use std::path::PathBuf;
use std::process::Command;

/// A command that never opens a console window, so it is safe to start from a
/// Windows GUI app (the packaged runner rebuilding in dev).
pub(crate) fn command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    #[allow(unused_mut)]
    let mut c = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    c
}

/// `~/.glyx` (Windows: `%USERPROFILE%\.glyx`).
pub(crate) fn glyx_home() -> PathBuf {
    let var = |k: &str| std::env::var(k).ok().filter(|v| !v.is_empty()).map(PathBuf::from);
    let home = if cfg!(windows) {
        var("USERPROFILE").or_else(|| var("HOME"))
    } else {
        var("HOME").or_else(|| var("USERPROFILE"))
    };
    home.unwrap_or_else(|| PathBuf::from(".")).join(".glyx")
}

fn candidates(name: &str) -> Vec<String> {
    if cfg!(windows) { vec![format!("{name}.exe"), name.to_string()] } else { vec![name.to_string()] }
}

/// The first file called `name` (`name.exe` on Windows) in `dirs`.
pub(crate) fn find_in<I: IntoIterator<Item = PathBuf>>(dirs: I, name: &str) -> Option<PathBuf> {
    for dir in dirs {
        for candidate in candidates(name) {
            let path = dir.join(candidate);
            if path.is_file() {
                return Some(path);
            }
        }
    }
    None
}

/// `name` on the PATH.
pub(crate) fn find_on_path(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    find_in(std::env::split_paths(&path), name)
}
