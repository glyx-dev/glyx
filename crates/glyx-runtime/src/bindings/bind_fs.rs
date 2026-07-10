use super::*;
use notify::{RecursiveMode, Watcher};

// ── fs.watch / unwatch / poll ─────────────────────────────────────────────────

/// `__glyx_fs_watch(path) → Promise<watchId: number>`
///
/// Starts watching `path` for any changes.  Requires `fs.read` capability.
/// Returns a watchId you pass to `__glyx_fs_unwatch` to stop.
/// Deliver events via `__glyx_fs_watch_poll()` each frame.
pub fn fs_watch_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let path = v8_arg_to_string(scope, &args, 0);
    // M1: canonicalize+check before open -- closes TOCTOU window.
    let path = match glyx_security::resolve_and_check_read(std::path::Path::new(&path)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { rv.set(reject_promise_with_error(scope, &format!("fs.watch denied: {e}")).into()); return; }
    };
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let watch_id = state.next_fs_watch_id
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    let events_clone = Arc::clone(&state.fs_watch_events);

    let watcher_result = notify::recommended_watcher(
        move |res: notify::Result<notify::Event>| {
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
        }
    );

    let mut watcher = match watcher_result {
        Ok(w)  => w,
        Err(e) => {
            let msg = format!("fs.watch: failed to create watcher: {e}");
            rv.set(reject_promise_with_error(scope, &msg).into());
            return;
        }
    };

    let watch_path = std::path::Path::new(&path);
    let mode = if watch_path.is_dir() {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };

    if let Err(e) = watcher.watch(watch_path, mode) {
        let msg = format!("fs.watch: {e}");
        rv.set(reject_promise_with_error(scope, &msg).into());
        return;
    }

    state.fs_watchers.borrow_mut().insert(watch_id, watcher);

    // Resolve immediately with the watchId via the completion queue.
    let (resolver_ptr, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());
    let id_json = format!("{watch_id}");
    enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr, result: Ok(id_json) });
}

/// `__glyx_fs_unwatch(watchId: number) → undefined`
///
/// Stops the watcher registered under `watchId`.
pub fn fs_unwatch_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id = args.get(0).uint32_value(scope).unwrap_or(0);
    state.fs_watchers.borrow_mut().remove(&id);
    // Also clean up any pending events for this id.
    state.fs_watch_events.lock().retain(|(wid, _, _)| *wid != id);
}

/// `__glyx_fs_watch_poll() → string` — JSON array of `{id, path, type}` events.
///
/// Called every frame from `_pollFsWatch()` in JS.
pub fn fs_watch_poll_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let mut q = state.fs_watch_events.lock();
    if q.is_empty() {
        rv.set(v8::String::new(scope, "[]").unwrap().into());
        return;
    }
    let items: Vec<String> = q.drain(..)
        .map(|(id, path, kind)| {
            let path_escaped = path.replace('\\', "\\\\").replace('"', "\\\"");
            format!(r#"{{"id":{id},"path":"{path_escaped}","type":"{kind}"}}"#)
        })
        .collect();
    let json = format!("[{}]", items.join(","));
    rv.set(v8::String::new(scope, &json).unwrap().into());
}

pub fn write_file_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let path = v8_arg_to_string(scope, &args, 0);
    // M1: canonicalize+check before open -- closes TOCTOU window.
    let path = match glyx_security::resolve_and_check_write(std::path::Path::new(&path)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { rv.set(reject_promise_with_error(scope, &format!("fs.write denied: {e}")).into()); return; }
    };
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let content = v8_arg_to_string(scope, &args, 1);

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::fs::write(&path, content)
            .await
            .map(|_| String::new())
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_appendFile(path, content) -> Promise<void>`
pub fn append_file_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let path = v8_arg_to_string(scope, &args, 0);
    // M1: canonicalize+check before open -- closes TOCTOU window.
    let path = match glyx_security::resolve_and_check_write(std::path::Path::new(&path)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { rv.set(reject_promise_with_error(scope, &format!("fs.write denied: {e}")).into()); return; }
    };
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let content = v8_arg_to_string(scope, &args, 1);

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        use tokio::io::AsyncWriteExt;
        let result = async {
            let mut file = tokio::fs::OpenOptions::new()
                .create(true).append(true).open(&path).await?;
            file.write_all(content.as_bytes()).await?;
            Ok::<_, std::io::Error>(())
        }
        .await
        .map(|_| String::new())
        .map_err(|e| e.to_string());

        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_listDir(path) -> Promise<string>` â€” JSON array of `{ name, isDir }` objects.
pub fn list_dir_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let path = v8_arg_to_string(scope, &args, 0);
    // M1: canonicalize+check before open -- closes TOCTOU window.
    let path = match glyx_security::resolve_and_check_read(std::path::Path::new(&path)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { rv.set(reject_promise_with_error(scope, &format!("fs.watch denied: {e}")).into()); return; }
    };
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let mut entries_json = Vec::new();
            let mut rd = tokio::fs::read_dir(&path).await
                .map_err(|e| e.to_string())?;
            while let Some(entry) = rd.next_entry().await.map_err(|e| e.to_string())? {
                let meta   = entry.metadata().await.map_err(|e| e.to_string())?;
                let name   = entry.file_name().to_string_lossy().into_owned();
                let is_dir = meta.is_dir();
                entries_json.push(serde_json::json!({ "name": name, "isDir": is_dir }));
            }
            serde_json::to_string(&entries_json).map_err(|e| e.to_string())
        }
        .await;

        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_deleteFile(path) -> Promise<void>`
pub fn delete_file_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let path = v8_arg_to_string(scope, &args, 0);
    // M1: canonicalize+check before delete -- closes TOCTOU window.
    let path = match path.as_str() {
        p => match std::path::Path::new(p).canonicalize() {
            Ok(c) => {
                let cs = c.to_string_lossy();
                if !glyx_security::get().can_delete_path(&cs) {
                    rv.set(reject_promise_with_error(scope, &fs_denied_msg("delete", &cs)).into());
                    return;
                }
                c.to_string_lossy().into_owned()
            }
            Err(e) => {
                rv.set(reject_promise_with_error(scope, &format!("fs.delete: cannot resolve path: {e}")).into());
                return;
            }
        }
    };
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::fs::remove_file(&path)
            .await
            .map(|_| String::new())
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_mkdirp(path) -> Promise<void>` â€” creates the directory and all parents.
pub fn mkdirp_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let path = v8_arg_to_string(scope, &args, 0);
    // M1: canonicalize+check before open -- closes TOCTOU window.
    let path = match glyx_security::resolve_and_check_write(std::path::Path::new(&path)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { rv.set(reject_promise_with_error(scope, &format!("fs.write denied: {e}")).into()); return; }
    };
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::fs::create_dir_all(&path)
            .await
            .map(|_| String::new())
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_stat(path) -> Promise<string>` â€” JSON `{ size, mtime, isDir, isFile }`.
pub fn stat_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let path = v8_arg_to_string(scope, &args, 0);
    // M1: canonicalize+check before open -- closes TOCTOU window.
    let path = match glyx_security::resolve_and_check_read(std::path::Path::new(&path)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { rv.set(reject_promise_with_error(scope, &format!("fs.watch denied: {e}")).into()); return; }
    };
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let meta  = tokio::fs::metadata(&path).await.map_err(|e| e.to_string())?;
            let mtime = meta.modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            serde_json::to_string(&serde_json::json!({
                "size":   meta.len(),
                "mtime":  mtime,
                "isDir":  meta.is_dir(),
                "isFile": meta.is_file(),
            })).map_err(|e| e.to_string())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_rename(src, dst) -> Promise<void>`
pub fn rename_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let src = v8_arg_to_string(scope, &args, 0);
    let dst = v8_arg_to_string(scope, &args, 1);
    // M1: canonicalize+check src (read) and dst (write).
    let src = match glyx_security::resolve_and_check_read(std::path::Path::new(&src)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { rv.set(reject_promise_with_error(scope, &format!("fs.rename src denied: {e}")).into()); return; }
    };
    let dst = match glyx_security::resolve_and_check_write(std::path::Path::new(&dst)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { rv.set(reject_promise_with_error(scope, &format!("fs.rename dst denied: {e}")).into()); return; }
    };
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::fs::rename(&src, &dst)
            .await
            .map(|_| String::new())
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_copyFile(src, dst) -> Promise<void>`
pub fn copy_file_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let src = v8_arg_to_string(scope, &args, 0);
    let dst = v8_arg_to_string(scope, &args, 1);
    // M1: canonicalize+check src (read) and dst (write).
    let src = match glyx_security::resolve_and_check_read(std::path::Path::new(&src)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { rv.set(reject_promise_with_error(scope, &format!("fs.rename src denied: {e}")).into()); return; }
    };
    let dst = match glyx_security::resolve_and_check_write(std::path::Path::new(&dst)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { rv.set(reject_promise_with_error(scope, &format!("fs.rename dst denied: {e}")).into()); return; }
    };
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::fs::copy(&src, &dst)
            .await
            .map(|_| String::new())
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}
