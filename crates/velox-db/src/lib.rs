//! velox-db — async SQLite bindings for the Velox runtime.
//!
//! Wraps `sqlx` with a simple open/query/run API.
//! All functions are async and designed to be called from tokio tasks.
//!
//! # Example
//! ```ignore
//! let pool = velox_db::open("my_app.db").await?;
//! let rows = velox_db::query(&pool, "SELECT * FROM items WHERE id = ?", vec![json!(1)]).await?;
//! velox_db::run(&pool, "INSERT INTO items (name) VALUES (?)", vec![json!("hello")]).await?;
//! ```

pub use sqlx::sqlite::SqlitePool;

use anyhow::Result;
use sqlx::{Column, Row};
use sqlx::sqlite::SqlitePoolOptions;

// ── Pool management ────────────────────────────────────────────────────────────

/// Open (or create) a SQLite database at the given path and return a connection pool.
///
/// - `":memory:"` opens an in-memory database.
/// - Any other path creates the file if it does not exist (`mode=rwc`).
/// - WAL journal mode and `synchronous=NORMAL` are set on every new pool for
///   fast concurrent writes without risking data loss on unexpected exit.
pub async fn open(path: &str) -> Result<SqlitePool> {
    let url = if path == ":memory:" {
        "sqlite::memory:".to_string()
    } else {
        // ?mode=rwc — create the file if it does not exist
        format!("sqlite:{}?mode=rwc", path)
    };

    let pool = SqlitePoolOptions::new()
        .max_connections(4)
        .connect(&url)
        .await?;

    // WAL: allows concurrent reads while writing
    sqlx::query("PRAGMA journal_mode=WAL").execute(&pool).await?;
    // NORMAL: flush at the most critical moments; fast and safe enough for apps
    sqlx::query("PRAGMA synchronous=NORMAL").execute(&pool).await?;

    log::info!("velox-db: opened {:?}", path);
    Ok(pool)
}

// ── Query (SELECT) ─────────────────────────────────────────────────────────────

/// Execute a SELECT query and return all rows as JSON objects.
///
/// `params` is a JSON array of values bound to `?` placeholders in order.
/// Each value is bound as an `Option<String>`; SQLite's type affinity converts
/// numeric strings back to integers/reals where the schema declares it.
pub async fn query(
    pool:   &SqlitePool,
    sql:    &str,
    params: Vec<serde_json::Value>,
) -> Result<Vec<serde_json::Map<String, serde_json::Value>>> {
    let mut q = sqlx::query(sql);
    for p in &params {
        q = q.bind(json_to_string(p));
    }

    let rows = q.fetch_all(pool).await?;
    let mut result = Vec::with_capacity(rows.len());

    for row in &rows {
        let mut map = serde_json::Map::new();
        for col in row.columns() {
            let val = get_cell_value(row, col.ordinal());
            map.insert(col.name().to_string(), val);
        }
        result.push(map);
    }

    Ok(result)
}

// ── Run (INSERT / UPDATE / DELETE / DDL) ──────────────────────────────────────

/// Execute a non-SELECT statement and return `(rows_affected, last_insert_rowid)`.
///
/// `params` is a JSON array of values bound to `?` placeholders in order.
pub async fn run(
    pool:   &SqlitePool,
    sql:    &str,
    params: Vec<serde_json::Value>,
) -> Result<(u64, i64)> {
    let mut q = sqlx::query(sql);
    for p in &params {
        q = q.bind(json_to_string(p));
    }

    let result = q.execute(pool).await?;
    Ok((result.rows_affected(), result.last_insert_rowid()))
}

// ── Transaction ───────────────────────────────────────────────────────────────

/// A single SQL statement with its bound parameters for use in a transaction.
pub struct TxStmt {
    pub sql:    String,
    pub params: Vec<serde_json::Value>,
}

/// Execute a batch of SQL statements atomically.
///
/// All statements run inside a single SQLite transaction.  If any statement
/// fails the transaction is automatically rolled back; on success it is
/// committed.  Results of individual statements are discarded — this is for
/// INSERT / UPDATE / DELETE / DDL only, not SELECT.
pub async fn transaction(pool: &SqlitePool, stmts: Vec<TxStmt>) -> Result<()> {
    let mut tx = pool.begin().await?;
    for stmt in stmts {
        let mut q = sqlx::query(&stmt.sql);
        for p in &stmt.params {
            q = q.bind(json_to_string(&p));
        }
        q.execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/// Convert a JSON value to `Option<String>` for binding.
/// NULL → None; everything else → Some(string representation).
/// SQLite's type affinity converts numeric strings to numbers when inserting
/// into columns with INTEGER/REAL affinity.
fn json_to_string(v: &serde_json::Value) -> Option<String> {
    match v {
        serde_json::Value::Null      => None,
        serde_json::Value::Bool(b)   => Some(if *b { "1" } else { "0" }.to_owned()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::String(s) => Some(s.clone()),
        _                            => Some(v.to_string()),
    }
}

/// Read a single cell from a `SqliteRow` and convert it to a `serde_json::Value`.
///
/// Strategy: try `i64` first (INTEGER storage class), then `f64` (REAL), then
/// `String` (TEXT), then fall back to Null. sqlx enforces SQLite storage-class
/// type checking, so this sequence is always correct:
/// - NULL cells  → `try_get::<Option<i64>>` returns `Ok(None)` → Null
/// - INTEGER cells → `try_get::<Option<i64>>` returns `Ok(Some(n))`
/// - REAL cells    → `try_get::<Option<i64>>` returns `Err`, f64 returns `Ok(Some(f))`
/// - TEXT cells    → both numeric tries return `Err`, String returns `Ok(Some(s))`
fn get_cell_value(row: &sqlx::sqlite::SqliteRow, idx: usize) -> serde_json::Value {
    // NULL or INTEGER
    if let Ok(v) = row.try_get::<Option<i64>, _>(idx) {
        return match v {
            Some(n) => serde_json::Value::Number(n.into()),
            None    => serde_json::Value::Null,
        };
    }
    // REAL
    if let Ok(v) = row.try_get::<Option<f64>, _>(idx) {
        return match v {
            Some(f) => serde_json::Number::from_f64(f)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null),
            None => serde_json::Value::Null,
        };
    }
    // TEXT
    if let Ok(v) = row.try_get::<Option<String>, _>(idx) {
        return match v {
            Some(s) => serde_json::Value::String(s),
            None    => serde_json::Value::Null,
        };
    }
    serde_json::Value::Null
}
