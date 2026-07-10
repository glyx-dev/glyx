use super::*;
pub fn write_file_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let path = v8_arg_to_string(scope, &args, 0);
    if !glyx_security::get().can_write_path(&path) {
        rv.set(reject_promise_with_error(scope, &fs_denied_msg("write", &path)).into());
        return;
    }
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
    if !glyx_security::get().can_write_path(&path) {
        rv.set(reject_promise_with_error(scope, &fs_denied_msg("write", &path)).into());
        return;
    }
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
    if !glyx_security::get().can_read_path(&path) {
        rv.set(reject_promise_with_error(scope, &fs_denied_msg("read", &path)).into());
        return;
    }
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
    if !glyx_security::get().can_write_path(&path) {
        rv.set(reject_promise_with_error(scope, &fs_denied_msg("write", &path)).into());
        return;
    }
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
    if !glyx_security::get().can_write_path(&path) {
        rv.set(reject_promise_with_error(scope, &fs_denied_msg("write", &path)).into());
        return;
    }
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
    if !glyx_security::get().can_read_path(&path) {
        rv.set(reject_promise_with_error(scope, &fs_denied_msg("read", &path)).into());
        return;
    }
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
    let sec = glyx_security::get();
    if !sec.can_read_path(&src) {
        rv.set(reject_promise_with_error(scope, &fs_denied_msg("read", &src)).into());
        return;
    }
    if !sec.can_write_path(&dst) {
        rv.set(reject_promise_with_error(scope, &fs_denied_msg("write", &dst)).into());
        return;
    }
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
    let sec = glyx_security::get();
    if !sec.can_read_path(&src) {
        rv.set(reject_promise_with_error(scope, &fs_denied_msg("read", &src)).into());
        return;
    }
    if !sec.can_write_path(&dst) {
        rv.set(reject_promise_with_error(scope, &fs_denied_msg("write", &dst)).into());
        return;
    }
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
