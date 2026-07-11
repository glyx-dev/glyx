//! glyx-db — async SQLite bindings for the Glyx runtime.
//!
//! Wraps `sqlx` with a simple open/query/run API.
//! All functions are async and designed to be called from tokio tasks.
//!
//! # Example
//! ```ignore
//! let pool = glyx_db::open("my_app.db").await?;
//! let rows = glyx_db::query(&pool, "SELECT * FROM items WHERE id = ?", vec![json!(1)]).await?;
//! glyx_db::run(&pool, "INSERT INTO items (name) VALUES (?)", vec![json!("hello")]).await?;
//! ```

pub use sqlx::sqlite::SqlitePool;

use anyhow::Result;
use sqlx::{Column, Row};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};

// ── Pool management ────────────────────────────────────────────────────────────

/// Open (or create) a SQLite database at the given path and return a connection pool.
///
/// - `":memory:"` opens an in-memory database.
/// - Any other path creates the file if it does not exist (`mode=rwc`).
/// - WAL journal mode and `synchronous=NORMAL` are set on every new pool for
///   fast concurrent writes without risking data loss on unexpected exit.
pub async fn open(path: &str) -> Result<SqlitePool> {
    // Build connect options directly to avoid URL-parsing issues with Windows
    // paths (backslashes confuse sqlx's sqlite: URI parser).
    let opts = if path == ":memory:" {
        SqliteConnectOptions::new()
            .filename(":memory:")
            .in_memory(true)
    } else {
        SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
    };

    let pool = SqlitePoolOptions::new()
        .max_connections(2)
        // Give up acquiring a connection after 5 s instead of blocking forever.
        // This surfaces lock errors quickly (e.g. WAL left by a previous crash).
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect_with(opts)
        .await?;

    sqlx::query("PRAGMA busy_timeout=5000").execute(&pool).await?;
    sqlx::query("PRAGMA trusted_schema=OFF").execute(&pool).await?;

    log::info!("glyx-db: opened {:?}", path);
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

// ── Vector Store ──────────────────────────────────────────────────────────────

/// An embedded vector store backed by SQLite.
///
/// Vectors are stored as raw f32 little-endian bytes in a BLOB column.
/// Similarity search is brute-force cosine similarity — correct and fast enough
/// for typical in-app vector datasets (< 100 k vectors).
#[derive(Clone)]
pub struct VectorStore {
    pub pool: SqlitePool,
}

/// Open (or create) a vector store database at the given path.
///
/// Accepts the same path format as [`open`], including `":memory:"`.
/// Creates the internal `__glyx_vectors` table if it does not already exist.
pub async fn open_vector_store(path: &str) -> Result<VectorStore> {
    let pool = open(path).await?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS __glyx_vectors (
            table_name TEXT NOT NULL,
            id         TEXT NOT NULL,
            vector     BLOB NOT NULL,
            metadata   TEXT,
            PRIMARY KEY (table_name, id)
        )",
    )
    .execute(&pool)
    .await?;
    log::info!("glyx-db: vector store opened {:?}", path);
    Ok(VectorStore { pool })
}

/// Insert or replace a vector record in the given logical table.
///
/// - `table`    — namespace / collection name (e.g. `"embeddings"`).
/// - `id`       — unique string key for this record.
/// - `vector`   — embedding as a slice of `f32` values.
/// - `metadata` — optional JSON string stored alongside the vector.
pub async fn vector_upsert(
    store:    &VectorStore,
    table:    &str,
    id:       &str,
    vector:   &[f32],
    metadata: Option<&str>,
) -> Result<()> {
    let bytes: Vec<u8> = vector.iter().flat_map(|f| f.to_le_bytes()).collect();
    sqlx::query(
        "INSERT OR REPLACE INTO __glyx_vectors (table_name, id, vector, metadata) \
         VALUES (?, ?, ?, ?)",
    )
    .bind(table)
    .bind(id)
    .bind(bytes)
    .bind(metadata)
    .execute(&store.pool)
    .await?;
    Ok(())
}

/// Return the `limit` nearest records to `query` in the given table.
///
/// Results are sorted by descending cosine similarity (1.0 = identical direction).
/// Each entry is `(id, score, metadata_json_or_null)`.
pub async fn vector_search(
    store: &VectorStore,
    table: &str,
    query: &[f32],
    limit: usize,
) -> Result<Vec<(String, f32, Option<String>)>> {
    let rows = sqlx::query(
        "SELECT id, vector, metadata FROM __glyx_vectors WHERE table_name = ?",
    )
    .bind(table)
    .fetch_all(&store.pool)
    .await?;

    let mut scored: Vec<(String, f32, Option<String>)> = rows
        .iter()
        .filter_map(|row| {
            let id:   String         = row.try_get(0).ok()?;
            let bytes: Vec<u8>       = row.try_get(1).ok()?;
            let meta: Option<String> = row.try_get(2).ok()?;
            let vec = bytes_to_f32(&bytes);
            let score = cosine_similarity(query, &vec);
            Some((id, score, meta))
        })
        .collect();

    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit);
    Ok(scored)
}

// ── Vector helpers ────────────────────────────────────────────────────────────

fn bytes_to_f32(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot:   f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if mag_a == 0.0 || mag_b == 0.0 { 0.0 } else { dot / (mag_a * mag_b) }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

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
