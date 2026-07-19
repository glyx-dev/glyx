//! `__glyx_readFile`/`writeFile`/`listDir`/etc — the filesystem binding
//! surface, ported from `bind_core.rs`/`bind_fs.rs`'s V8 implementations.
//!
//! Every function here follows the exact same shape as
//! `quickjs_runtime.rs`'s `battery_get_status`: a plain fn item with a
//! named `'js` lifetime (not a closure — `Promise<'js>` is invariant, see
//! that file's module doc for why), capability-checked via the same
//! `glyx_security` functions V8 uses, then either `QuickJsRuntime::reject_now`
//! (capability denial) or `QuickJsRuntime::spawn_async` (real Tokio work).

use std::cell::RefCell;
use std::collections::{HashMap, VecDeque};
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::AtomicU32;
use notify::{RecursiveMode, Watcher};
use parking_lot::Mutex;
use rquickjs::Ctx;
use tokio::runtime::Handle;

use crate::bindings::{CompletionQueue, RedrawRequest};
use crate::quickjs_runtime::QuickJsRuntime;

pub(crate) type FsWatchers = Arc<RefCell<HashMap<u32, notify::RecommendedWatcher>>>;
pub(crate) type FsWatchEvents = Arc<Mutex<VecDeque<(u32, String, String)>>>;

fn fs_denied(kind: &str, path: &str, e: impl std::fmt::Display) -> String {
    format!("fs.{kind} denied for {path:?}: {e}")
}

pub(crate) fn read_file<'js>(
    ctx: Ctx<'js>, path: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let path = match glyx_security::resolve_and_check_read(Path::new(&path)) {
        Ok(c) => c.to_string_lossy().into_owned(),
        Err(e) => return QuickJsRuntime::reject_now(&ctx, fs_denied("read", &path, e)),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())
    })
}

pub(crate) fn read_file_bytes<'js>(
    ctx: Ctx<'js>, path: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let path = match glyx_security::resolve_and_check_read(Path::new(&path)) {
        Ok(c) => c.to_string_lossy().into_owned(),
        Err(e) => return QuickJsRuntime::reject_now(&ctx, fs_denied("read", &path, e)),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        use base64::Engine;
        tokio::fs::read(&path).await
            .map(|bytes| base64::engine::general_purpose::STANDARD.encode(&bytes))
            .map_err(|e| e.to_string())
    })
}

pub(crate) fn write_file<'js>(
    ctx: Ctx<'js>, path: String, content: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let path = match glyx_security::resolve_and_check_write(Path::new(&path)) {
        Ok(c) => c.to_string_lossy().into_owned(),
        Err(e) => return QuickJsRuntime::reject_now(&ctx, fs_denied("write", &path, e)),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::fs::write(&path, content).await.map(|_| String::new()).map_err(|e| e.to_string())
    })
}

pub(crate) fn append_file<'js>(
    ctx: Ctx<'js>, path: String, content: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let path = match glyx_security::resolve_and_check_write(Path::new(&path)) {
        Ok(c) => c.to_string_lossy().into_owned(),
        Err(e) => return QuickJsRuntime::reject_now(&ctx, fs_denied("write", &path, e)),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        use tokio::io::AsyncWriteExt;
        async {
            let mut file = tokio::fs::OpenOptions::new().create(true).append(true).open(&path).await?;
            file.write_all(content.as_bytes()).await?;
            Ok::<_, std::io::Error>(())
        }.await.map(|_| String::new()).map_err(|e| e.to_string())
    })
}

pub(crate) fn list_dir<'js>(
    ctx: Ctx<'js>, path: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let path = match glyx_security::resolve_and_check_read(Path::new(&path)) {
        Ok(c) => c.to_string_lossy().into_owned(),
        Err(e) => return QuickJsRuntime::reject_now(&ctx, fs_denied("read", &path, e)),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        let mut entries_json = Vec::new();
        let mut rd = tokio::fs::read_dir(&path).await.map_err(|e| e.to_string())?;
        while let Some(entry) = rd.next_entry().await.map_err(|e| e.to_string())? {
            let meta   = entry.metadata().await.map_err(|e| e.to_string())?;
            let name   = entry.file_name().to_string_lossy().into_owned();
            entries_json.push(serde_json::json!({ "name": name, "isDir": meta.is_dir() }));
        }
        serde_json::to_string(&entries_json).map_err(|e| e.to_string())
    })
}

pub(crate) fn delete_file<'js>(
    ctx: Ctx<'js>, path: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let path = match Path::new(&path).canonicalize() {
        Ok(c) => {
            let cs = c.to_string_lossy().into_owned();
            if !glyx_security::get().can_delete_path(&cs) {
                return QuickJsRuntime::reject_now(&ctx, fs_denied("delete", &cs, "not permitted"));
            }
            cs
        }
        Err(e) => return QuickJsRuntime::reject_now(&ctx, format!("fs.delete: cannot resolve path: {e}")),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::fs::remove_file(&path).await.map(|_| String::new()).map_err(|e| e.to_string())
    })
}

pub(crate) fn mkdirp<'js>(
    ctx: Ctx<'js>, path: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let path = match glyx_security::resolve_and_check_write(Path::new(&path)) {
        Ok(c) => c.to_string_lossy().into_owned(),
        Err(e) => return QuickJsRuntime::reject_now(&ctx, fs_denied("write", &path, e)),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::fs::create_dir_all(&path).await.map(|_| String::new()).map_err(|e| e.to_string())
    })
}

pub(crate) fn stat<'js>(
    ctx: Ctx<'js>, path: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let path = match glyx_security::resolve_and_check_read(Path::new(&path)) {
        Ok(c) => c.to_string_lossy().into_owned(),
        Err(e) => return QuickJsRuntime::reject_now(&ctx, fs_denied("read", &path, e)),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        let meta  = tokio::fs::metadata(&path).await.map_err(|e| e.to_string())?;
        let mtime = meta.modified().ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64).unwrap_or(0);
        serde_json::to_string(&serde_json::json!({
            "size": meta.len(), "mtime": mtime, "isDir": meta.is_dir(), "isFile": meta.is_file(),
        })).map_err(|e| e.to_string())
    })
}

pub(crate) fn rename<'js>(
    ctx: Ctx<'js>, src: String, dst: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let src = match glyx_security::resolve_and_check_read(Path::new(&src)) {
        Ok(c) => c.to_string_lossy().into_owned(),
        Err(e) => return QuickJsRuntime::reject_now(&ctx, fs_denied("rename src", &src, e)),
    };
    let dst = match glyx_security::resolve_and_check_write(Path::new(&dst)) {
        Ok(c) => c.to_string_lossy().into_owned(),
        Err(e) => return QuickJsRuntime::reject_now(&ctx, fs_denied("rename dst", &dst, e)),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::fs::rename(&src, &dst).await.map(|_| String::new()).map_err(|e| e.to_string())
    })
}

pub(crate) fn copy_file<'js>(
    ctx: Ctx<'js>, src: String, dst: String, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let src = match glyx_security::resolve_and_check_read(Path::new(&src)) {
        Ok(c) => c.to_string_lossy().into_owned(),
        Err(e) => return QuickJsRuntime::reject_now(&ctx, fs_denied("copy src", &src, e)),
    };
    let dst = match glyx_security::resolve_and_check_write(Path::new(&dst)) {
        Ok(c) => c.to_string_lossy().into_owned(),
        Err(e) => return QuickJsRuntime::reject_now(&ctx, fs_denied("copy dst", &dst, e)),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::fs::copy(&src, &dst).await.map(|_| String::new()).map_err(|e| e.to_string())
    })
}

pub(crate) fn fs_watch<'js>(
    ctx: Ctx<'js>, path: String, watchers: FsWatchers, events: FsWatchEvents, next_id: Arc<AtomicU32>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let path = match glyx_security::resolve_and_check_read(Path::new(&path)) {
        Ok(c) => c.to_string_lossy().into_owned(),
        Err(e) => return QuickJsRuntime::reject_now(&ctx, fs_denied("watch", &path, e)),
    };

    let watch_id = next_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let events_clone = Arc::clone(&events);

    let watcher_result = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            let kind_str = match event.kind {
                notify::EventKind::Modify(_) => "modified",
                notify::EventKind::Create(_) => "created",
                notify::EventKind::Remove(_) => "removed",
                notify::EventKind::Access(_) => "accessed",
                _ => "other",
            };
            let mut q = events_clone.lock();
            for p in &event.paths {
                q.push_back((watch_id, p.to_string_lossy().into_owned(), kind_str.to_string()));
            }
        }
    });
    let mut watcher = match watcher_result {
        Ok(w) => w,
        Err(e) => return QuickJsRuntime::reject_now(&ctx, format!("fs.watch: failed to create watcher: {e}")),
    };

    let watch_path = Path::new(&path);
    let mode = if watch_path.is_dir() { RecursiveMode::Recursive } else { RecursiveMode::NonRecursive };
    if let Err(e) = watcher.watch(watch_path, mode) {
        return QuickJsRuntime::reject_now(&ctx, format!("fs.watch: {e}"));
    }

    watchers.borrow_mut().insert(watch_id, watcher);
    let (handle, promise) = QuickJsRuntime::make_promise(&ctx)?;
    QuickJsRuntime::settle(&ctx, handle, Ok(watch_id.to_string()));
    Ok(promise)
}

pub(crate) fn fs_unwatch(watchers: &FsWatchers, events: &FsWatchEvents, id: u32) {
    watchers.borrow_mut().remove(&id);
    events.lock().retain(|(wid, _, _)| *wid != id);
}

pub(crate) fn fs_watch_poll(events: &FsWatchEvents) -> String {
    let mut q = events.lock();
    if q.is_empty() { return "[]".to_string(); }
    let items: Vec<String> = q.drain(..)
        .map(|(id, path, kind)| {
            let path_escaped = path.replace('\\', "\\\\").replace('"', "\\\"");
            format!(r#"{{"id":{id},"path":"{path_escaped}","type":"{kind}"}}"#)
        })
        .collect();
    format!("[{}]", items.join(","))
}
