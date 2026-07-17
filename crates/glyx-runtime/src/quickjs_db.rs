//! `__glyx_db_*`/`__glyx_vectorDb_*` — SQLite + vector-store bindings,
//! ported from `bind_db.rs`'s V8 implementations. Same shape as
//! `quickjs_fs.rs`: named-`'js`-lifetime free functions, capability-gated
//! via `glyx_security::get().db`, real work via `QuickJsRuntime::spawn_async`.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, Ordering};
use rquickjs::Ctx;
use tokio::runtime::Handle;

use crate::bindings::{resolve_db_path_checked, CompletionQueue, DbPools, RedrawRequest};
use crate::quickjs_runtime::QuickJsRuntime;

pub(crate) type VectorStores = Arc<parking_lot::Mutex<HashMap<u32, glyx_db::VectorStore>>>;

fn cap_denied<'js>(ctx: &Ctx<'js>) -> rquickjs::Result<rquickjs::Promise<'js>> {
    QuickJsRuntime::reject_now(ctx, "Capability required: db — add it to glyx.config.json under \"capabilities\"".to_string())
}

pub(crate) fn db_open<'js>(
    ctx: Ctx<'js>, path: String, pools: DbPools, next_id: Arc<AtomicU32>,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().db { return cap_denied(&ctx); }
    let path = match resolve_db_path_checked(&path) {
        Ok(p) => p,
        Err(e) => return QuickJsRuntime::reject_now(&ctx, e),
    };
    let handle = next_id.fetch_add(1, Ordering::Relaxed);
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        glyx_db::open(&path).await
            .map(|pool| { pools.lock().insert(handle, pool); handle.to_string() })
            .map_err(|e| e.to_string())
    })
}

pub(crate) fn db_query<'js>(
    ctx: Ctx<'js>, handle: u32, sql: String, params_json: String, pools: DbPools,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().db { return cap_denied(&ctx); }
    let pool = match pools.lock().get(&handle).cloned() {
        Some(p) => p,
        None => return QuickJsRuntime::reject_now(&ctx, format!("db: unknown handle {handle}")),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        let params: Vec<serde_json::Value> = serde_json::from_str(&params_json).unwrap_or_default();
        let rows = glyx_db::query(&pool, &sql, params).await.map_err(|e| e.to_string())?;
        serde_json::to_string(&rows).map_err(|e| e.to_string())
    })
}

pub(crate) fn db_run<'js>(
    ctx: Ctx<'js>, handle: u32, sql: String, params_json: String, pools: DbPools,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().db { return cap_denied(&ctx); }
    let pool = match pools.lock().get(&handle).cloned() {
        Some(p) => p,
        None => return QuickJsRuntime::reject_now(&ctx, format!("db: unknown handle {handle}")),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        let params: Vec<serde_json::Value> = serde_json::from_str(&params_json).unwrap_or_default();
        let (rows_affected, last_insert_id) = glyx_db::run(&pool, &sql, params).await.map_err(|e| e.to_string())?;
        serde_json::to_string(&serde_json::json!({
            "rowsAffected": rows_affected, "lastInsertId": last_insert_id,
        })).map_err(|e| e.to_string())
    })
}

pub(crate) fn db_close<'js>(
    ctx: Ctx<'js>, handle: u32, pools: DbPools,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().db { return cap_denied(&ctx); }
    let pool = pools.lock().remove(&handle);
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        if let Some(pool) = pool { pool.close().await; }
        Ok(String::new())
    })
}

pub(crate) fn db_transaction<'js>(
    ctx: Ctx<'js>, handle: u32, stmts_json: String, pools: DbPools,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().db { return cap_denied(&ctx); }
    let pool = match pools.lock().get(&handle).cloned() {
        Some(p) => p,
        None => return QuickJsRuntime::reject_now(&ctx, format!("db: unknown handle {handle}")),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        let raw: Vec<serde_json::Value> = serde_json::from_str(&stmts_json)
            .map_err(|e| format!("db.transaction: invalid JSON: {e}"))?;
        let stmts: Vec<glyx_db::TxStmt> = raw.into_iter().map(|s| glyx_db::TxStmt {
            sql: s["sql"].as_str().unwrap_or("").to_owned(),
            params: s["params"].as_array().cloned().unwrap_or_default(),
        }).collect();
        glyx_db::transaction(&pool, stmts).await.map_err(|e| e.to_string())?;
        Ok(String::new())
    })
}

pub(crate) fn db_backup<'js>(
    ctx: Ctx<'js>, handle: u32, dest_path: String, pools: DbPools,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().db { return cap_denied(&ctx); }
    let dest_path = match resolve_db_path_checked(&dest_path) {
        Ok(p) => p,
        Err(e) => return QuickJsRuntime::reject_now(&ctx, e),
    };
    let pool = match pools.lock().get(&handle).cloned() {
        Some(p) => p,
        None => return QuickJsRuntime::reject_now(&ctx, "db.backup: unknown handle".to_string()),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        if let Some(parent) = std::path::Path::new(&dest_path).parent() {
            if !parent.as_os_str().is_empty() {
                tokio::fs::create_dir_all(parent).await.map_err(|e| format!("db.backup: mkdir: {e}"))?;
            }
        }
        let escaped = dest_path.replace('\'', "''");
        let sql = format!("VACUUM INTO '{escaped}'");
        glyx_db::run(&pool, &sql, vec![]).await.map_err(|e| format!("db.backup: {e}"))?;
        Ok(String::new())
    })
}

pub(crate) fn vectordb_open<'js>(
    ctx: Ctx<'js>, path: String, stores: VectorStores, next_id: Arc<AtomicU32>,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().db { return cap_denied(&ctx); }
    let path = match resolve_db_path_checked(&path) {
        Ok(p) => p,
        Err(e) => return QuickJsRuntime::reject_now(&ctx, e),
    };
    let handle = next_id.fetch_add(1, Ordering::Relaxed);
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        glyx_db::open_vector_store(&path).await
            .map(|store| { stores.lock().insert(handle, store); handle.to_string() })
            .map_err(|e| e.to_string())
    })
}

pub(crate) fn vectordb_upsert<'js>(
    ctx: Ctx<'js>, handle: u32, table: String, id: String, vector_json: String, meta_json: String,
    stores: VectorStores, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().db { return cap_denied(&ctx); }
    let store = match stores.lock().get(&handle).cloned() {
        Some(s) => s,
        None => return QuickJsRuntime::reject_now(&ctx, format!("vectorDb: unknown handle {handle}")),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        let vector: Vec<f64> = serde_json::from_str(&vector_json)
            .map_err(|e| format!("vectorDb.upsert: invalid vector JSON: {e}"))?;
        let vec_f32: Vec<f32> = vector.iter().map(|&v| v as f32).collect();
        let meta = if meta_json.is_empty() { None } else { Some(meta_json.as_str()) };
        glyx_db::vector_upsert(&store, &table, &id, &vec_f32, meta).await
            .map(|_| String::new()).map_err(|e| e.to_string())
    })
}

pub(crate) fn vectordb_search<'js>(
    ctx: Ctx<'js>, handle: u32, table: String, query_json: String, limit: u32,
    stores: VectorStores, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().db { return cap_denied(&ctx); }
    let store = match stores.lock().get(&handle).cloned() {
        Some(s) => s,
        None => return QuickJsRuntime::reject_now(&ctx, format!("vectorDb: unknown handle {handle}")),
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        let query: Vec<f64> = serde_json::from_str(&query_json)
            .map_err(|e| format!("vectorDb.search: invalid query JSON: {e}"))?;
        let query_f32: Vec<f32> = query.iter().map(|&v| v as f32).collect();
        let hits = glyx_db::vector_search(&store, &table, &query_f32, limit as usize).await
            .map_err(|e| e.to_string())?;
        let json_hits: Vec<serde_json::Value> = hits.into_iter().map(|(id, score, meta)| {
            let metadata = meta.and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                .unwrap_or(serde_json::Value::Null);
            serde_json::json!({ "id": id, "score": score, "metadata": metadata })
        }).collect();
        serde_json::to_string(&json_hits).map_err(|e| e.to_string())
    })
}

pub(crate) fn vectordb_close<'js>(
    ctx: Ctx<'js>, handle: u32, stores: VectorStores,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().db { return cap_denied(&ctx); }
    let store = stores.lock().remove(&handle);
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        if let Some(s) = store { s.pool.close().await; }
        Ok(String::new())
    })
}
