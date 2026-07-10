use super::*;
pub fn resolve_db_path(path: String) -> String {
    if path == ":memory:" || std::path::Path::new(&path).is_absolute() {
        return path;
    }

    // Use a stable, user-writable app-data directory so the DB ends up in the
    // same place regardless of how or from where the app is launched.
    //
    // The subdirectory name comes from the running executable's file stem
    // (e.g. "notes-app"), which is the same as the app's binary name.
    //
    //   Windows:  %APPDATA%\{exe}\data\
    //   macOS:    ~/Library/Application Support/{exe}/data/
    //   Linux:    ~/.local/share/{exe}/data/  (or $XDG_DATA_HOME/{exe}/data/)
    let exe_stem = std::env::current_exe()
        .ok()
        .and_then(|p| p.file_stem().map(|s| s.to_string_lossy().into_owned()))
        .unwrap_or_else(|| "glyx".to_string());

    #[cfg(target_os = "windows")]
    let base = std::env::var("APPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::var("USERPROFILE")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| std::path::PathBuf::from(".")));

    #[cfg(target_os = "macos")]
    let base = std::env::var("HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("Library").join("Application Support");

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let base = std::env::var("XDG_DATA_HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::var("HOME")
            .map(|h| std::path::PathBuf::from(h).join(".local").join("share"))
            .unwrap_or_else(|_| std::path::PathBuf::from(".")));

    let data_dir = base.join(&exe_stem).join("data");
    let _ = std::fs::create_dir_all(&data_dir);
    data_dir.join(&path).to_string_lossy().into_owned()
}

/// `__glyx_db_open(path) -> Promise<string>` â€” handle number.
pub fn db_open_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !glyx_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path      = resolve_db_path(v8_arg_to_string(scope, &args, 0));
    let handle    = state.next_db_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let pools     = Arc::clone(&state.db_pools);
    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = glyx_db::open(&path).await
            .map(|pool| {
                pools.lock().insert(handle, pool);
                handle.to_string()
            })
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_db_query(handle, sql, paramsJson) -> Promise<string>` â€” JSON rows.
pub fn db_query_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !glyx_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle      = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let sql         = v8_arg_to_string(scope, &args, 1);
    let params_json = v8_arg_to_string(scope, &args, 2);

    // Resolve the pool before spawning â€” fail fast if handle is invalid.
    let pool = match state.db_pools.lock().get(&handle).cloned() {
        Some(p) => p,
        None => {
            throw_js_error(scope, &format!("db: unknown handle {handle}"));
            return;
        }
    };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let params: Vec<serde_json::Value> =
                serde_json::from_str(&params_json).unwrap_or_default();
            let rows = glyx_db::query(&pool, &sql, params).await
                .map_err(|e| e.to_string())?;
            serde_json::to_string(&rows).map_err(|e| e.to_string())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_db_run(handle, sql, paramsJson) -> Promise<string>` â€” JSON `{ rowsAffected, lastInsertId }`.
pub fn db_run_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !glyx_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle      = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let sql         = v8_arg_to_string(scope, &args, 1);
    let params_json = v8_arg_to_string(scope, &args, 2);

    let pool = match state.db_pools.lock().get(&handle).cloned() {
        Some(p) => p,
        None => {
            throw_js_error(scope, &format!("db: unknown handle {handle}"));
            return;
        }
    };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let params: Vec<serde_json::Value> =
                serde_json::from_str(&params_json).unwrap_or_default();
            let (rows_affected, last_insert_id) = glyx_db::run(&pool, &sql, params).await
                .map_err(|e| e.to_string())?;
            serde_json::to_string(&serde_json::json!({
                "rowsAffected":  rows_affected,
                "lastInsertId":  last_insert_id,
            }))
            .map_err(|e| e.to_string())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_db_close(handle) -> Promise<void>`
///
/// Removes the pool from the handle map and drains all connections gracefully.
/// Idempotent: closing an unknown handle resolves immediately without error.
pub fn db_close_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !glyx_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    // Remove synchronously so no new queries can grab this pool.
    let pool = state.db_pools.lock().remove(&handle);

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        if let Some(pool) = pool {
            pool.close().await;
        }
        enqueue_completion(
            &queue_clone,
            redraw.as_ref(),
            Completion { resolver_ptr: resolver, result: Ok(String::new()) },
        );
    });
}

/// `__glyx_db_transaction(handle, statementsJson) -> Promise<void>`
///
/// `statementsJson` is a JSON array of `{ sql: string, params: any[] }` objects.
/// All statements execute in a single SQLite transaction; any failure rolls back.
pub fn db_transaction_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !glyx_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle     = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let stmts_json = v8_arg_to_string(scope, &args, 1);

    let pool = match state.db_pools.lock().get(&handle).cloned() {
        Some(p) => p,
        None => {
            throw_js_error(scope, &format!("db: unknown handle {handle}"));
            return;
        }
    };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let raw: Vec<serde_json::Value> = serde_json::from_str(&stmts_json)
                .map_err(|e| format!("db.transaction: invalid JSON: {e}"))?;
            let stmts: Vec<glyx_db::TxStmt> = raw.into_iter().map(|s| glyx_db::TxStmt {
                sql:    s["sql"].as_str().unwrap_or("").to_owned(),
                params: s["params"].as_array().cloned().unwrap_or_default(),
            }).collect();
            glyx_db::transaction(&pool, stmts).await.map_err(|e| e.to_string())?;
            Ok(String::new())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_db_backup(handle, destPath) â†’ Promise<void>`
///
/// Creates an atomic online backup of the database at `destPath` using
/// SQLite's `VACUUM INTO` pragma.  Works correctly with WAL mode and
/// does not block reads/writes on the source database.
/// The destination file is created if it does not exist; any existing file
/// is overwritten atomically (VACUUM INTO writes a temp file then renames).
pub fn db_backup_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !glyx_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle   = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let dest_path = v8_arg_to_string(scope, &args, 1);

    let pool = match state.db_pools.lock().get(&handle).cloned() {
        Some(p) => p,
        None    => {
            rv.set(reject_promise_with_error(scope, "db.backup: unknown handle").into());
            return;
        }
    };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = async {
            // Ensure the destination directory exists.
            if let Some(parent) = std::path::Path::new(&dest_path).parent() {
                if !parent.as_os_str().is_empty() {
                    tokio::fs::create_dir_all(parent).await
                        .map_err(|e| format!("db.backup: mkdir '{dest_path}': {e}"))?;
                }
            }
            // VACUUM INTO creates an atomic, defragmented copy of the database.
            // It works with WAL mode and doesn't block the source.
            let escaped = dest_path.replace('\'', "''");
            let sql = format!("VACUUM INTO '{escaped}'");
            glyx_db::run(&pool, &sql, vec![])
                .await
                .map_err(|e| format!("db.backup: {e}"))?;
            Ok(String::new())
        }.await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// â”€â”€ Window extra callbacks (sync) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// `__glyx_setAlwaysOnTop(on: boolean) -> void`
pub fn vectordb_open_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !glyx_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data   = args.data().unwrap();
    let ext    = v8::Local::<v8::External>::try_from(data).unwrap();
    let state  = unsafe { &*(ext.value() as *const AsyncState) };

    let path   = resolve_db_path(v8_arg_to_string(scope, &args, 0));
    let handle = state.next_vdb_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let stores = Arc::clone(&state.vector_stores);
    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = glyx_db::open_vector_store(&path).await
            .map(|store| {
                stores.lock().insert(handle, store);
                handle.to_string()
            })
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_vectorDb_upsert(handle, table, id, vectorJson, metadataJson) -> Promise<string>`
///
/// `vectorJson`   â€” JSON array of f32 numbers (the embedding).
/// `metadataJson` â€” JSON string for the metadata payload, or `""` for none.
pub fn vectordb_upsert_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !glyx_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle      = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let table       = v8_arg_to_string(scope, &args, 1);
    let id          = v8_arg_to_string(scope, &args, 2);
    let vector_json = v8_arg_to_string(scope, &args, 3);
    let meta_json   = v8_arg_to_string(scope, &args, 4);

    let store = match state.vector_stores.lock().get(&handle).cloned() {
        Some(s) => s,
        None => {
            throw_js_error(scope, &format!("vectorDb: unknown handle {handle}"));
            return;
        }
    };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let vector: Vec<f64> = serde_json::from_str(&vector_json)
                .map_err(|e| format!("vectorDb.upsert: invalid vector JSON: {e}"))?;
            let vec_f32: Vec<f32> = vector.iter().map(|&v| v as f32).collect();
            let meta = if meta_json.is_empty() { None } else { Some(meta_json.as_str()) };
            glyx_db::vector_upsert(&store, &table, &id, &vec_f32, meta).await
                .map(|_| String::new())
                .map_err(|e| e.to_string())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_vectorDb_search(handle, table, queryJson, limit) -> Promise<string>` â€” JSON results.
///
/// `queryJson` â€” JSON array of f32 numbers (the query embedding).
/// Resolves with a JSON array of `{id, score, metadata}` objects.
pub fn vectordb_search_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !glyx_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle     = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let table      = v8_arg_to_string(scope, &args, 1);
    let query_json = v8_arg_to_string(scope, &args, 2);
    let limit      = args.get(3).number_value(scope).unwrap_or(10.0) as usize;

    let store = match state.vector_stores.lock().get(&handle).cloned() {
        Some(s) => s,
        None => {
            throw_js_error(scope, &format!("vectorDb: unknown handle {handle}"));
            return;
        }
    };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let query: Vec<f64> = serde_json::from_str(&query_json)
                .map_err(|e| format!("vectorDb.search: invalid query JSON: {e}"))?;
            let query_f32: Vec<f32> = query.iter().map(|&v| v as f32).collect();
            let hits = glyx_db::vector_search(&store, &table, &query_f32, limit).await
                .map_err(|e| e.to_string())?;

            let json_hits: Vec<serde_json::Value> = hits.into_iter().map(|(id, score, meta)| {
                let metadata = meta
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                    .unwrap_or(serde_json::Value::Null);
                serde_json::json!({ "id": id, "score": score, "metadata": metadata })
            }).collect();
            serde_json::to_string(&json_hits).map_err(|e| e.to_string())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_vectorDb_close(handle) -> Promise<string>`
///
/// Removes the store from the handle map and closes the underlying pool.
/// Idempotent: closing an unknown handle resolves immediately without error.
pub fn vectordb_close_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !glyx_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let store  = state.vector_stores.lock().remove(&handle);

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        if let Some(s) = store {
            s.pool.close().await;
        }
        enqueue_completion(
            &queue_clone,
            redraw.as_ref(),
            Completion { resolver_ptr: resolver, result: Ok(String::new()) },
        );
    });
}
