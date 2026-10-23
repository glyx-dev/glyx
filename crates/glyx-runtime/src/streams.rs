//! Streaming I/O: files read and written in chunks, with flat memory.
//!
//! `fs.readFileBytes` reads a whole file and base64-encodes it into one JavaScript string, so a 1 GB file costs over 2 GB before the app sees
//! a byte. A stream keeps the file on the Rust side and hands JavaScript one chunk at a time:
//!
//! - **Pull, with backpressure.** A reader task reads ahead into a bounded queue (`streams.queueChunks` chunks of `streams.chunkKb` KiB) and
//!   waits when it is full; JavaScript pulls a chunk with `read`. A slow consumer slows the disk read instead of growing memory. A writer
//!   is the mirror image: `write` waits when the queue to the writer task is full.
//! - **Bounded.** At most `streams.maxOpen` streams are open at once, so a stream that is never closed cannot pile up. A stream is removed
//!   when it ends or fails, so the common loop (`for await`) leaves nothing behind.
//! - **Owned by a window.** A stream belongs to the window whose JavaScript opened it (the dispatchers say which, see `crate::as_window`).
//!   When that window closes, or its JavaScript is reloaded in development, its streams are closed: a reader's file is released and a
//!   writer's queued chunks are still written, in the background. A stream another window was handed the id of dies with its owner.
//! - **Latency hidden.** One call from JavaScript costs about a millisecond of round trip, and a 256 KiB chunk takes about 0.2 ms to read,
//!   so asking for one chunk and waiting would leave the disk idle most of the time (measured: 117 MB/s against 1.6 GB/s for the stream
//!   alone). Two things fix it: a `read` returns every chunk already queued, up to `chunkKb * queueChunks`, in one answer; and the JavaScript
//!   side keeps one request in flight ahead of the one it is waiting for. Requests carry a sequence number and are answered in that order
//!   whatever order they arrive in, so overlapping them is safe.
//! - **Engine neutral.** The registry is driven by built-in backend commands (see [`register`]), so V8 and QuickJS behave the same and
//!   neither needs a binding of its own. Control calls are JSON; the data calls use the binary lane (an `ArrayBuffer` each way).
//! - **Gated.** Opening checks the path against the app's `fs` read or write grant (canonical path first, then open), and every command
//!   needs the `fs` capability.
//!
//! The wire format of the binary commands is in [`register`]. Chunks are copied twice (disk into a `Vec`, `Vec` into the `ArrayBuffer`);
//! that is the price of the binary lane, and it is one copy per chunk, not per byte of JSON.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::{mpsc, watch};
use tokio::task::JoinHandle;

use crate::BackendRegistryBuilder;

/// Answer byte of `glyx_stream.read`: a chunk follows.
pub(crate) const STATUS_DATA: u8 = 0;
/// Answer byte of `glyx_stream.read`: the stream has ended (and is closed).
pub(crate) const STATUS_END: u8 = 1;

/// What bounds a stream's memory and count.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Limits {
    pub chunk_bytes: usize,
    pub queue_chunks: usize,
    pub max_open: usize,
}

impl Limits {
    /// The limits in force now, from the `streams.*` settings.
    fn from_settings() -> Limits {
        let s = glyx_settings::global();
        Limits {
            chunk_bytes: s.int("streams.chunkKb").max(1) as usize * 1024,
            queue_chunks: s.int("streams.queueChunks").max(1) as usize,
            max_open: s.int("streams.maxOpen").max(1) as usize,
        }
    }
}

type ChunkResult = Result<Vec<u8>, String>;

struct ReaderState {
    rx: mpsc::Receiver<ChunkResult>,
    /// An error that arrived while chunks were being batched: the next `read` reports it.
    carry_err: Option<String>,
}

enum Entry {
    Reader {
        state: tokio::sync::Mutex<ReaderState>,
        /// Whose turn it is: the sequence number of the request that may take chunks next, and whether the stream is closed (waiting
        /// requests then give up).
        turn: watch::Sender<(u32, bool)>,
        /// The most bytes one answer carries (`chunkKb * queueChunks`).
        max_batch: usize,
        task: JoinHandle<()>,
        /// Chunks the reader task has produced so far (tests check it stays near the queue size while nobody reads).
        #[cfg_attr(not(test), allow(dead_code))]
        produced: Arc<AtomicUsize>,
        /// Tells a walker (a blocking thread, which cannot be aborted) to stop.
        stop: Arc<AtomicBool>,
        owner: Option<u32>,
    },
    Writer {
        tx: Mutex<Option<mpsc::Sender<Vec<u8>>>>,
        task: Mutex<Option<JoinHandle<()>>>,
        /// Why the writer task stopped early (disk full, permission), for the next `write` or the `close`.
        failed: Arc<Mutex<Option<String>>>,
        owner: Option<u32>,
    },
}

impl Entry {
    fn owner(&self) -> Option<u32> {
        match self {
            Entry::Reader { owner, .. } | Entry::Writer { owner, .. } => *owner,
        }
    }
}

/// The set of open streams.
pub(crate) struct Streams {
    next_id: AtomicU32,
    open: Mutex<HashMap<u32, Arc<Entry>>>,
    limits: Box<dyn Fn() -> Limits + Send + Sync>,
}

impl Streams {
    pub(crate) fn new(limits: impl Fn() -> Limits + Send + Sync + 'static) -> Streams {
        Streams { next_id: AtomicU32::new(1), open: Mutex::new(HashMap::new()), limits: Box::new(limits) }
    }

    #[cfg(test)]
    pub(crate) fn open_count(&self) -> usize {
        self.open.lock().unwrap().len()
    }

    /// Reserve an id, refusing when the app already has `max_open` streams.
    fn insert(&self, build: impl FnOnce(Limits) -> Entry) -> Result<u32, String> {
        let limits = (self.limits)();
        let mut open = self.open.lock().unwrap();
        if open.len() >= limits.max_open {
            log::warn!("[streams] {} streams are open (streams.maxOpen); a stream that is never closed holds a file and its read-ahead", open.len());
            return Err(format!(
                "too many open streams ({}): close the ones you are done with, or raise streams.maxOpen",
                limits.max_open
            ));
        }
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        open.insert(id, Arc::new(build(limits)));
        Ok(id)
    }

    fn get(&self, id: u32) -> Result<Arc<Entry>, String> {
        self.open.lock().unwrap().get(&id).cloned().ok_or_else(|| format!("stream {id} is not open (it ended, failed or was closed)"))
    }

    fn remove(&self, id: u32) -> Option<Arc<Entry>> {
        self.open.lock().unwrap().remove(&id)
    }

    /// Open `path` (already checked against the app's read grant) for reading, for no window in particular (tests).
    #[cfg(test)]
    pub(crate) async fn open_read(&self, path: &Path, chunk_kb: Option<usize>) -> Result<u32, String> {
        self.open_read_for(path, chunk_kb, None).await
    }

    /// Open `path` (already checked against the app's read grant) for reading, for window `owner`. `chunk_kb` overrides `streams.chunkKb` for
    /// this stream. Must be called inside the Tokio runtime.
    pub(crate) async fn open_read_for(&self, path: &Path, chunk_kb: Option<usize>, owner: Option<u32>) -> Result<u32, String> {
        let file = tokio::fs::File::open(path).await.map_err(|e| format!("cannot open {}: {e}", path.display()))?;
        if file.metadata().await.map(|m| m.is_dir()).unwrap_or(false) {
            return Err(format!("{} is a directory", path.display()));
        }
        self.insert(|limits| {
            let chunk = chunk_kb.map_or(limits.chunk_bytes, |kb| kb * 1024);
            let (tx, rx) = mpsc::channel(limits.queue_chunks);
            let produced = Arc::new(AtomicUsize::new(0));
            let task = tokio::spawn(read_loop(file, chunk, tx, Arc::clone(&produced)));
            Entry::Reader {
                state: tokio::sync::Mutex::new(ReaderState { rx, carry_err: None }),
                turn: watch::channel((0, false)).0,
                max_batch: chunk * limits.queue_chunks,
                task,
                produced,
                stop: Arc::new(AtomicBool::new(false)),
                owner,
            }
        })
    }

    /// Start a directory walk of `root` (already checked against the app's read grant), for window `owner`. Its entries come out of `read` as
    /// chunks of comma-joined JSON objects (see `walk.rs`). The walk runs on a blocking thread.
    pub(crate) fn open_walk_for(&self, root: &Path, opts: crate::walk::WalkOptions, owner: Option<u32>) -> Result<u32, String> {
        let root = root.to_path_buf();
        self.insert(|limits| {
            let (tx, rx) = mpsc::channel(limits.queue_chunks);
            let produced = Arc::new(AtomicUsize::new(0));
            let stop = Arc::new(AtomicBool::new(false));
            let (p, s) = (Arc::clone(&produced), Arc::clone(&stop));
            let chunk = limits.chunk_bytes;
            let task = tokio::task::spawn_blocking(move || {
                crate::walk::run_walk(&root, &opts, chunk, &tx, &p, &s, |link| glyx_security::resolve_and_check_read(link).ok());
            });
            Entry::Reader {
                state: tokio::sync::Mutex::new(ReaderState { rx, carry_err: None }),
                turn: watch::channel((0, false)).0,
                max_batch: chunk * limits.queue_chunks,
                task,
                produced,
                stop,
                owner,
            }
        })
    }

    /// Open `path` (already checked against the app's write grant) for writing, for no window in particular (tests).
    #[cfg(test)]
    pub(crate) async fn open_write(&self, path: &Path, append: bool) -> Result<u32, String> {
        self.open_write_for(path, append, None).await
    }

    /// Open `path` (already checked against the app's write grant) for writing, for window `owner`: created, and truncated unless `append`.
    pub(crate) async fn open_write_for(&self, path: &Path, append: bool, owner: Option<u32>) -> Result<u32, String> {
        let mut options = tokio::fs::OpenOptions::new();
        options.create(true);
        if append {
            options.append(true);
        } else {
            options.write(true).truncate(true);
        }
        let file = options.open(path).await.map_err(|e| format!("cannot open {} for writing: {e}", path.display()))?;
        self.insert(|limits| {
            let (tx, rx) = mpsc::channel(limits.queue_chunks);
            let failed = Arc::new(Mutex::new(None));
            let task = tokio::spawn(write_loop(file, rx, Arc::clone(&failed)));
            Entry::Writer { tx: Mutex::new(Some(tx)), task: Mutex::new(Some(task)), failed, owner }
        })
    }

    /// The next chunks, or `None` at the end (the stream is then closed). Waits for the first chunk, then takes every other one already
    /// queued, up to the batch size. Request number `seq` (counted from 0 per stream) is answered after request `seq - 1`, so requests
    /// may overlap. An error closes the stream too.
    pub(crate) async fn read(&self, id: u32, seq: u32) -> Result<Option<Vec<Vec<u8>>>, String> {
        let entry = self.get(id)?;
        let Entry::Reader { state, turn, max_batch, .. } = &*entry else {
            return Err(format!("stream {id} is a writer"));
        };
        let closed = || format!("stream {id} is not open (it ended, failed or was closed)");
        {
            let mut turns = turn.subscribe();
            let t = turns.wait_for(|t| t.1 || t.0 == seq).await.map_err(|_| closed())?;
            if t.1 {
                return Err(closed());
            }
        }
        let result = {
            let mut st = state.lock().await;
            if let Some(e) = st.carry_err.take() {
                Err(e)
            } else {
                match st.rx.recv().await {
                    Some(Ok(first)) => {
                        let mut total = first.len();
                        let mut chunks = vec![first];
                        while total < *max_batch {
                            match st.rx.try_recv() {
                                Ok(Ok(more)) => {
                                    total += more.len();
                                    chunks.push(more);
                                }
                                Ok(Err(e)) => {
                                    st.carry_err = Some(e);
                                    break;
                                }
                                Err(_) => break,
                            }
                        }
                        Ok(Some(chunks))
                    }
                    Some(Err(e)) => Err(e),
                    None => Ok(None),
                }
            }
        };
        match result {
            Ok(Some(chunks)) => {
                turn.send_modify(|t| t.0 = t.0.wrapping_add(1));
                Ok(Some(chunks))
            }
            Ok(None) => {
                self.cancel(id);
                Ok(None)
            }
            Err(e) => {
                self.cancel(id);
                Err(e)
            }
        }
    }

    /// Queue a chunk for the writer, waiting while the queue is full (that wait is the backpressure).
    pub(crate) async fn write(&self, id: u32, chunk: Vec<u8>) -> Result<(), String> {
        let entry = self.get(id)?;
        let Entry::Writer { tx, failed, .. } = &*entry else {
            return Err(format!("stream {id} is a reader"));
        };
        let sender = tx.lock().unwrap().clone().ok_or_else(|| format!("stream {id} is closed"))?;
        if sender.send(chunk).await.is_err() {
            let why = failed.lock().unwrap().clone().unwrap_or_else(|| "the writer stopped".to_string());
            self.cancel(id);
            return Err(format!("write failed: {why}"));
        }
        Ok(())
    }

    /// Finish a stream. A writer is flushed first (every queued chunk is written), and a failure of the writer is reported here.
    pub(crate) async fn close(&self, id: u32) -> Result<(), String> {
        let Some(entry) = self.remove(id) else { return Ok(()) };
        match &*entry {
            Entry::Reader { task, turn, stop, .. } => {
                task.abort();
                stop.store(true, Ordering::Relaxed);
                turn.send_modify(|t| t.1 = true);
                Ok(())
            }
            Entry::Writer { tx, task, failed, .. } => {
                tx.lock().unwrap().take();
                let handle = task.lock().unwrap().take();
                if let Some(handle) = handle {
                    let _ = handle.await;
                }
                match failed.lock().unwrap().take() {
                    Some(why) => Err(format!("write failed: {why}")),
                    None => Ok(()),
                }
            }
        }
    }

    /// Stop a stream now, without waiting for anything queued: a reader's file is released, a writer's queue is dropped.
    pub(crate) fn cancel(&self, id: u32) {
        if let Some(entry) = self.remove(id) {
            match &*entry {
                Entry::Reader { task, turn, stop, .. } => {
                    task.abort();
                    stop.store(true, Ordering::Relaxed);
                    turn.send_modify(|t| t.1 = true);
                }
                Entry::Writer { task, tx, .. } => {
                    tx.lock().unwrap().take();
                    if let Some(handle) = task.lock().unwrap().take() {
                        handle.abort();
                    }
                }
            }
        }
    }

    /// Read as a caller that waits for each answer would: the next request number, the chunks joined (tests).
    #[cfg(test)]
    async fn read_next(&self, id: u32) -> Result<Option<Vec<u8>>, String> {
        let seq = match self.get(id)?.as_ref() {
            Entry::Reader { turn, .. } => turn.borrow().0,
            Entry::Writer { .. } => return Err(format!("stream {id} is a writer")),
        };
        Ok(self.read(id, seq).await?.map(|chunks| chunks.concat()))
    }

    /// Close every stream window `owner` left open. A reader is stopped and its file released; a writer stops accepting chunks but is not
    /// aborted: it finishes writing what was already queued, in the background. Returns how many were closed.
    pub(crate) fn close_window(&self, owner: u32) -> usize {
        let ids: Vec<u32> = self.open.lock().unwrap().iter().filter(|(_, e)| e.owner() == Some(owner)).map(|(id, _)| *id).collect();
        for id in &ids {
            let Some(entry) = self.remove(*id) else { continue };
            match &*entry {
                Entry::Reader { task, turn, stop, .. } => {
                    task.abort();
                    stop.store(true, Ordering::Relaxed);
                    turn.send_modify(|t| t.1 = true);
                }
                Entry::Writer { tx, .. } => {
                    tx.lock().unwrap().take();
                }
            }
        }
        if !ids.is_empty() {
            log::warn!(
                "[streams] window {owner} closed with {} stream(s) still open; closed them (close a stream when you are done with it)",
                ids.len()
            );
        }
        ids.len()
    }

    /// Chunks produced so far by a reader (tests).
    #[cfg(test)]
    fn produced(&self, id: u32) -> usize {
        match self.get(id).as_deref() {
            Ok(Entry::Reader { produced, .. }) => produced.load(Ordering::Relaxed),
            _ => 0,
        }
    }
}

/// Read the file in chunks into a bounded queue; the send waits while it is full. Ends when the file does, when the reader side is gone
/// (a cancelled stream drops its receiver), or on an error, which is passed on as the last item.
async fn read_loop(mut file: tokio::fs::File, chunk: usize, tx: mpsc::Sender<ChunkResult>, produced: Arc<AtomicUsize>) {
    loop {
        let mut buf = vec![0u8; chunk];
        match file.read(&mut buf).await {
            Ok(0) => break,
            Ok(n) => {
                buf.truncate(n);
                produced.fetch_add(1, Ordering::Relaxed);
                if tx.send(Ok(buf)).await.is_err() {
                    break;
                }
            }
            Err(e) => {
                let _ = tx.send(Err(e.to_string())).await;
                break;
            }
        }
    }
}

/// Write queued chunks to the file until the queue closes, then flush. A failure is kept for the next `write` or the `close`.
async fn write_loop(mut file: tokio::fs::File, mut rx: mpsc::Receiver<Vec<u8>>, failed: Arc<Mutex<Option<String>>>) {
    while let Some(chunk) = rx.recv().await {
        if let Err(e) = file.write_all(&chunk).await {
            *failed.lock().unwrap() = Some(e.to_string());
            return;
        }
    }
    if let Err(e) = file.flush().await {
        *failed.lock().unwrap() = Some(e.to_string());
    }
}

// ── Backend commands ──────────────────────────────────────────────────────────

/// The first four bytes of a binary request: the stream id, little-endian.
fn split_id(bytes: &[u8]) -> Result<(u32, &[u8]), String> {
    if bytes.len() < 4 {
        return Err("a stream request starts with the 4-byte stream id".to_string());
    }
    Ok((u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]), &bytes[4..]))
}

/// A `glyx_stream.read` request: the stream id, then the request number (both 4 bytes, little-endian).
fn read_request(bytes: &[u8]) -> Result<(u32, u32), String> {
    let (id, rest) = split_id(bytes)?;
    if rest.len() < 4 {
        return Err("a stream read request is the 4-byte stream id and the 4-byte request number".to_string());
    }
    Ok((id, u32::from_le_bytes([rest[0], rest[1], rest[2], rest[3]])))
}

#[derive(serde::Deserialize)]
struct OpenArgs {
    path: String,
    /// `read` (default), `write` (create or truncate) or `append`.
    mode: Option<String>,
    #[serde(rename = "chunkKb")]
    chunk_kb: Option<usize>,
}

fn id_arg(args: &str) -> Result<u32, String> {
    #[derive(serde::Deserialize)]
    struct A {
        id: u32,
    }
    serde_json::from_str::<A>(args).map(|a| a.id).map_err(|_| "id (a stream id) is required".to_string())
}

/// `glyx_stream.open`: check the path (`check_read` or `check_write` returns the canonical path or the reason), open it, answer `{ "id": n }`.
pub(crate) async fn open_command(
    streams: &Streams,
    args: &str,
    owner: Option<u32>,
    check_read: impl Fn(&Path) -> Result<PathBuf, String>,
    check_write: impl Fn(&Path) -> Result<PathBuf, String>,
) -> Result<String, String> {
    let a: OpenArgs = serde_json::from_str(args).map_err(|e| format!("invalid arguments: {e}"))?;
    if let Some(kb) = a.chunk_kb {
        if !(4..=4096).contains(&kb) {
            return Err("chunkKb must be between 4 and 4096".to_string());
        }
    }
    let mode = a.mode.as_deref().unwrap_or("read");
    let id = match mode {
        "read" => {
            let path = check_read(Path::new(&a.path)).map_err(|e| format!("fs.read denied: {e}"))?;
            streams.open_read_for(&path, a.chunk_kb, owner).await?
        }
        "write" | "append" => {
            let path = check_write(Path::new(&a.path)).map_err(|e| format!("fs.write denied: {e}"))?;
            streams.open_write_for(&path, mode == "append", owner).await?
        }
        other => return Err(format!("mode must be \"read\", \"write\" or \"append\", not {other:?}")),
    };
    Ok(format!("{{\"id\":{id}}}"))
}

#[derive(serde::Deserialize)]
struct NextArgs {
    id: u32,
    seq: u32,
}

/// `glyx_stream.walk`: check the root (`check_read` returns its canonical path or the reason), start the walk, answer `{ "id": n }`.
pub(crate) fn walk_command(
    streams: &Streams,
    args: &str,
    owner: Option<u32>,
    check_read: impl Fn(&Path) -> Result<PathBuf, String>,
) -> Result<String, String> {
    let a: crate::walk::WalkArgs = serde_json::from_str(args).map_err(|e| format!("invalid arguments: {e}"))?;
    let opts = crate::walk::WalkOptions::from_args(&a)?;
    let root = check_read(Path::new(&a.path)).map_err(|e| format!("fs.read denied: {e}"))?;
    if !root.is_dir() {
        return Err(format!("{} is not a directory", root.display()));
    }
    let id = streams.open_walk_for(&root, opts, owner)?;
    Ok(format!("{{\"id\":{id}}}"))
}

/// `glyx_stream.next`: the next batch of a walk, as `{ "items": [...] }` (every batch already queued, joined), or `{ "items": [], "done": true }`
/// at the end. Requests are numbered and answered in order, like `glyx_stream.read`. The final batch ends with a `{ "$summary": ... }` item.
pub(crate) async fn next_command(streams: &Streams, args: &str) -> Result<String, String> {
    let a: NextArgs = serde_json::from_str(args).map_err(|_| "id and seq (numbers) are required".to_string())?;
    Ok(match streams.read(a.id, a.seq).await? {
        Some(chunks) => {
            let mut out = String::with_capacity(16 + chunks.iter().map(Vec::len).sum::<usize>() + chunks.len());
            out.push_str("{\"items\":[");
            for (i, chunk) in chunks.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                out.push_str(std::str::from_utf8(chunk).map_err(|_| "a walk produced text that is not UTF-8".to_string())?);
            }
            out.push_str("]}");
            out
        }
        None => "{\"items\":[],\"done\":true}".to_string(),
    })
}

/// The process-wide registry, with limits read from the settings each time a stream opens.
fn global() -> &'static Arc<Streams> {
    static GLOBAL: OnceLock<Arc<Streams>> = OnceLock::new();
    GLOBAL.get_or_init(|| Arc::new(Streams::new(Limits::from_settings)))
}

/// Close the streams window `owner` left open (see `Streams::close_window`).
pub(crate) fn close_window_global(owner: u32) -> usize {
    global().close_window(owner)
}

/// Register the stream commands (all need the `fs` capability; `glyx_stream.open` also checks the path):
///
/// | command | request | answer |
/// |---|---|---|
/// | `glyx_stream.open` (JSON) | `{ path, mode?, chunkKb? }` | `{ id }` |
/// | `glyx_stream.read` (binary) | 4-byte id, 4-byte request number (0, 1, 2, ... per stream) | status byte (0 data, 1 end), then the bytes of every chunk that was queued (one or more, up to `chunkKb * queueChunks`) |
/// | `glyx_stream.write` (binary) | 4-byte id, then the chunk | no bytes; resolves when the chunk is queued |
/// | `glyx_stream.walk` (JSON) | `{ path, maxDepth?, ignore?, followLinks?, type? }` | `{ id }`; see `walk.rs` |
/// | `glyx_stream.next` (JSON) | `{ id, seq }` (a walk) | `{ items: [...] }` or `{ items: [], done: true }` |
/// | `glyx_stream.close` (JSON) | `{ id }` | `{}`; a writer is flushed first and its failure reported |
/// | `glyx_stream.cancel` (JSON) | `{ id }` | `{}`; drops what is queued |
///
/// A command that fails rejects, and a failed or ended stream is already closed.
pub(crate) fn register(b: &mut BackendRegistryBuilder) {
    const FS: &[&str] = &["fs"];
    let streams = Arc::clone(global());

    let s = Arc::clone(&streams);
    b.add_gated("glyx_stream.open", FS, move |args| {
        let s = Arc::clone(&s);
        async move {
            open_command(
                &s,
                &args,
                crate::current_window(),
                |p| glyx_security::resolve_and_check_read(p).map_err(|e| e.to_string()),
                |p| glyx_security::resolve_and_check_write(p).map_err(|e| e.to_string()),
            )
            .await
        }
    });

    let s = Arc::clone(&streams);
    b.add_gated("glyx_stream.walk", FS, move |args| {
        let s = Arc::clone(&s);
        async move {
            walk_command(&s, &args, crate::current_window(), |p| glyx_security::resolve_and_check_read(p).map_err(|e| e.to_string()))
        }
    });

    let s = Arc::clone(&streams);
    b.add_gated("glyx_stream.next", FS, move |args| {
        let s = Arc::clone(&s);
        async move { next_command(&s, &args).await }
    });

    let s = Arc::clone(&streams);
    b.add_bytes_gated("glyx_stream.read", FS, move |req| {
        let s = Arc::clone(&s);
        async move {
            let (id, seq) = read_request(&req)?;
            Ok(match s.read(id, seq).await? {
                Some(chunks) => {
                    let mut out = Vec::with_capacity(1 + chunks.iter().map(Vec::len).sum::<usize>());
                    out.push(STATUS_DATA);
                    for chunk in &chunks {
                        out.extend_from_slice(chunk);
                    }
                    out
                }
                None => vec![STATUS_END],
            })
        }
    });

    let s = Arc::clone(&streams);
    b.add_bytes_gated("glyx_stream.write", FS, move |req| {
        let s = Arc::clone(&s);
        async move {
            let (id, chunk) = split_id(&req)?;
            s.write(id, chunk.to_vec()).await?;
            Ok(Vec::new())
        }
    });

    let s = Arc::clone(&streams);
    b.add_gated("glyx_stream.close", FS, move |args| {
        let s = Arc::clone(&s);
        async move {
            s.close(id_arg(&args)?).await?;
            Ok("{}".to_string())
        }
    });

    let s = streams;
    b.add_gated("glyx_stream.cancel", FS, move |args| {
        let s = Arc::clone(&s);
        async move {
            s.cancel(id_arg(&args)?);
            Ok("{}".to_string())
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_multi_thread().worker_threads(2).enable_all().build().unwrap()
    }

    /// Wait (up to five seconds) until `ready` is true, instead of sleeping a fixed time that a loaded machine can overrun.
    async fn until(ready: impl Fn() -> bool) {
        for _ in 0..500 {
            if ready() {
                return;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        panic!("the condition was not reached within five seconds");
    }

    fn limits(chunk_kb: usize, queue: usize, max_open: usize) -> Streams {
        Streams::new(move || Limits { chunk_bytes: chunk_kb * 1024, queue_chunks: queue, max_open })
    }

    /// A file of `len` bytes that is never the same 4 bytes twice in a row (so a shuffled or repeated chunk shows).
    fn patterned_file(dir: &Path, name: &str, len: usize) -> PathBuf {
        let path = dir.join(name);
        let data: Vec<u8> = (0..len).map(|i| ((i / 4) as u32).wrapping_mul(2654435761).to_le_bytes()[i % 4]).collect();
        std::fs::write(&path, data).unwrap();
        path
    }

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("glyx-streams-{tag}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_file_is_read_in_chunks_that_add_up_to_the_file() {
        let dir = temp_dir("read");
        let path = patterned_file(&dir, "a.bin", 1_000_000);
        let want = std::fs::read(&path).unwrap();
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let id = s.open_read(&path, None).await.unwrap();
            let mut got = Vec::new();
            let mut chunks = 0;
            while let Some(chunk) = s.read_next(id).await.unwrap() {
                // One answer carries what was queued, up to chunkKb * queueChunks.
                assert!(!chunk.is_empty() && chunk.len() <= 2 * 64 * 1024, "chunk of {}", chunk.len());
                got.extend_from_slice(&chunk);
                chunks += 1;
            }
            assert_eq!(got, want);
            assert!(chunks >= 1_000_000 / (2 * 64 * 1024));
            // The end closed the stream: nothing is left open, and reading again says so instead of hanging.
            assert_eq!(s.open_count(), 0);
            assert!(s.read_next(id).await.unwrap_err().contains("not open"));
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn an_empty_file_ends_at_once_and_a_chunk_size_can_be_asked_for() {
        let dir = temp_dir("empty");
        let empty = dir.join("empty");
        std::fs::write(&empty, b"").unwrap();
        let path = patterned_file(&dir, "b.bin", 100_000);
        let s = limits(256, 2, 8);
        runtime().block_on(async {
            let id = s.open_read(&empty, None).await.unwrap();
            assert_eq!(s.read_next(id).await.unwrap(), None);
            let id = s.open_read(&path, Some(4)).await.unwrap();
            // 4 KiB chunks, and up to two of them in one answer.
            let first = s.read_next(id).await.unwrap().unwrap().len();
            assert!(first == 4 * 1024 || first == 8 * 1024, "{first}");
            s.cancel(id);
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn a_reader_that_is_not_read_stops_after_its_queue_is_full() {
        // Backpressure: with nobody reading, the task holds at most the queue plus the chunk it is waiting to hand over.
        let dir = temp_dir("pressure");
        let path = patterned_file(&dir, "c.bin", 8 * 1024 * 1024);
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let id = s.open_read(&path, None).await.unwrap();
            until(|| s.produced(id) >= 2).await;
            // Given time to run on, it still stops: the queue holds two and the task holds the chunk it cannot hand over.
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
            let produced = s.produced(id);
            assert!(produced <= 3, "the reader ran ahead by {produced} chunks of an 8 MiB file with a queue of 2");
            assert!(produced >= 2, "the reader should have filled its queue, produced {produced}");
            // Reading frees room and it goes on.
            s.read_next(id).await.unwrap();
            s.read_next(id).await.unwrap();
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            assert!(s.produced(id) <= 6);
            s.cancel(id);
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn one_answer_carries_every_chunk_that_is_queued() {
        let dir = temp_dir("batch");
        let path = patterned_file(&dir, "i.bin", 64 * 1024);
        let s = limits(4, 4, 8);
        runtime().block_on(async {
            let id = s.open_read(&path, None).await.unwrap();
            // Let the reader fill its queue of four 4 KiB chunks.
            until(|| s.produced(id) >= 4).await;
            let chunks = s.read(id, 0).await.unwrap().unwrap();
            assert!(chunks.len() >= 2, "only {} chunk(s) in the answer although four were queued", chunks.len());
            let total: usize = chunks.iter().map(Vec::len).sum();
            assert!(total <= 4 * 4 * 1024, "{total} bytes is more than chunkKb * queueChunks");
            s.cancel(id);
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn overlapping_requests_are_answered_in_order_whatever_order_they_arrive_in() {
        let dir = temp_dir("order");
        let path = patterned_file(&dir, "j.bin", 64 * 1024);
        let want = std::fs::read(&path).unwrap();
        // A queue of one chunk, so each answer is exactly one 4 KiB chunk and the order is visible in the bytes.
        let s = Arc::new(limits(4, 1, 8));
        runtime().block_on(async {
            let id = s.open_read(&path, None).await.unwrap();
            let mut tasks = Vec::new();
            for seq in [3u32, 1, 0, 2, 4] {
                let s = Arc::clone(&s);
                tasks.push((seq, tokio::spawn(async move { s.read(id, seq).await })));
            }
            tasks.sort_by_key(|(seq, _)| *seq);
            let mut got = Vec::new();
            for (seq, task) in tasks {
                let chunks = task.await.unwrap().unwrap().unwrap_or_else(|| panic!("request {seq} ended early"));
                got.extend(chunks.concat());
            }
            assert_eq!(got, want[..got.len()], "the answers were not in request order");
            assert!(got.len() >= 5 * 4 * 1024);
            s.cancel(id);
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn a_request_waiting_for_its_turn_gives_up_when_the_stream_is_closed() {
        let dir = temp_dir("wake");
        let path = patterned_file(&dir, "k.bin", 64 * 1024);
        let s = Arc::new(limits(4, 1, 8));
        runtime().block_on(async {
            let id = s.open_read(&path, None).await.unwrap();
            let waiting = {
                let s = Arc::clone(&s);
                // Request 7 can never come first: nothing sent 0 to 6.
                tokio::spawn(async move { s.read(id, 7).await })
            };
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            s.cancel(id);
            let result = tokio::time::timeout(std::time::Duration::from_secs(2), waiting).await.expect("the waiting request hung").unwrap();
            assert!(result.unwrap_err().contains("not open"));
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn a_walk_through_the_registry_streams_its_entries_and_ends_with_a_summary() {
        let dir = temp_dir("walk-stream");
        for i in 0..50 {
            std::fs::create_dir_all(dir.join(format!("d{}", i % 5))).unwrap();
            std::fs::write(dir.join(format!("d{}/f{i}.txt", i % 5)), b"hello").unwrap();
        }
        let s = Arc::new(limits(4, 2, 8));
        let allow = |p: &Path| Ok(p.to_path_buf());
        runtime().block_on(async {
            let id: u32 = serde_json::from_str::<serde_json::Value>(
                &walk_command(&s, &format!(r#"{{"path":{:?},"type":"file"}}"#, dir.to_string_lossy()), Some(1), allow).unwrap(),
            )
            .unwrap()["id"]
                .as_u64()
                .unwrap() as u32;
            let mut files = 0;
            let mut summary = None;
            let mut seq = 0;
            loop {
                let answer: serde_json::Value = serde_json::from_str(&next_command(&s, &format!(r#"{{"id":{id},"seq":{seq}}}"#)).await.unwrap()).unwrap();
                seq += 1;
                if answer["done"] == true {
                    break;
                }
                for item in answer["items"].as_array().unwrap() {
                    match item.get("$summary") {
                        Some(sum) => summary = Some(sum.clone()),
                        None => {
                            assert_eq!(item["type"], "file");
                            files += 1;
                        }
                    }
                }
            }
            assert_eq!(files, 50);
            assert_eq!(summary.expect("a summary")["skipped"], 0);
            assert_eq!(s.open_count(), 0, "the end closed the walk");
            // Bad arguments and non-directories are refused before anything starts.
            assert!(walk_command(&s, r#"{"path":"x","type":"link"}"#, None, allow).unwrap_err().contains("type must be"));
            assert!(walk_command(&s, &format!(r#"{{"path":{:?}}}"#, dir.join("d0/f0.txt").to_string_lossy()), None, allow).unwrap_err().contains("not a directory"));
            assert!(walk_command(&s, "{}", None, allow).unwrap_err().contains("invalid arguments"));
            assert!(walk_command(&s, &format!(r#"{{"path":{:?}}}"#, dir.to_string_lossy()), None, |_| Err("nope".to_string())).unwrap_err().contains("fs.read denied"));
            assert_eq!(s.open_count(), 0);
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn cancelling_a_walk_stops_its_thread() {
        let dir = temp_dir("walk-cancel");
        for i in 0..3000 {
            std::fs::create_dir_all(dir.join(format!("d{}", i % 30))).unwrap();
            std::fs::write(dir.join(format!("d{}/f{i}", i % 30)), b"x").unwrap();
        }
        let s = limits(1, 1, 8);
        let allow = |p: &Path| Ok(p.to_path_buf());
        runtime().block_on(async {
            let id: u32 = serde_json::from_str::<serde_json::Value>(&walk_command(&s, &format!(r#"{{"path":{:?}}}"#, dir.to_string_lossy()), None, allow).unwrap()).unwrap()["id"].as_u64().unwrap() as u32;
            until(|| s.produced(id) >= 1).await;
            s.cancel(id);
            assert_eq!(s.open_count(), 0);
            // The walker was blocked handing over a batch; the stop flag and the closed queue end it. Deleting the tree afterwards proves nothing
            // still holds a directory open (on Windows an open directory handle blocks removing it).
            let mut removed = false;
            for _ in 0..100 {
                if std::fs::remove_dir_all(&dir).is_ok() {
                    removed = true;
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(20)).await;
            }
            assert!(removed, "the walk still held the tree after cancel");
        });
    }

    #[test]
    fn closing_a_window_closes_its_streams_and_only_its_streams() {
        let dir = temp_dir("owner");
        let path = patterned_file(&dir, "l.bin", 4 * 1024 * 1024);
        let s = limits(64, 2, 16);
        runtime().block_on(async {
            let a_reader = s.open_read_for(&path, None, Some(1)).await.unwrap();
            let a_writer = s.open_write_for(&dir.join("a.out"), false, Some(1)).await.unwrap();
            let b_reader = s.open_read_for(&path, None, Some(2)).await.unwrap();
            let none = s.open_read_for(&path, None, None).await.unwrap();
            assert_eq!(s.open_count(), 4);

            // A chunk queued by window 1's writer before it closes is still written.
            s.write(a_writer, b"queued before the window closed".to_vec()).await.unwrap();
            assert_eq!(s.close_window(1), 2);
            assert_eq!(s.close_window(1), 0, "nothing left to close");
            assert_eq!(s.open_count(), 2);
            assert!(s.read_next(a_reader).await.unwrap_err().contains("not open"));
            assert!(s.write(a_writer, vec![1]).await.unwrap_err().contains("not open"));

            // The other window's stream and the one with no owner are untouched.
            assert!(s.read_next(b_reader).await.unwrap().is_some());
            assert!(s.read_next(none).await.unwrap().is_some());

            // The writer was not aborted: its queued chunk reaches the file.
            until(|| std::fs::read(dir.join("a.out")).map_or(false, |b| b == b"queued before the window closed")).await;
            s.cancel(b_reader);
            s.cancel(none);
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn closing_a_window_releases_the_files_its_readers_held() {
        let dir = temp_dir("owner-release");
        let path = patterned_file(&dir, "m.bin", 4 * 1024 * 1024);
        let s = limits(64, 2, 16);
        runtime().block_on(async {
            let id = s.open_read_for(&path, None, Some(3)).await.unwrap();
            s.read_next(id).await.unwrap();
            s.close_window(3);
            let mut removed = false;
            for _ in 0..50 {
                if std::fs::remove_file(&path).is_ok() {
                    removed = true;
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(20)).await;
            }
            assert!(removed, "the file was still held after its window closed");
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn the_open_command_records_the_window_it_is_given() {
        let dir = temp_dir("owner-cmd");
        let path = patterned_file(&dir, "n.bin", 5000);
        let s = limits(64, 2, 8);
        let allow = |p: &Path| Ok(p.to_path_buf());
        runtime().block_on(async {
            let args = format!(r#"{{"path":{:?}}}"#, path.to_string_lossy());
            open_command(&s, &args, Some(4), allow, allow).await.unwrap();
            open_command(&s, &args, Some(5), allow, allow).await.unwrap();
            assert_eq!(s.close_window(4), 1);
            assert_eq!(s.open_count(), 1);
            assert_eq!(s.close_window(5), 1);
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn work_run_as_a_window_can_tell_which() {
        assert_eq!(crate::current_window(), None, "outside a dispatched command there is no window");
        let rt = runtime();
        assert_eq!(rt.block_on(crate::as_window(7, async { crate::current_window() })), Some(7));
        // It follows the work onto another thread of the pool, and does not leak into a sibling.
        let both = rt.block_on(async {
            let a = tokio::spawn(crate::as_window(1, async { tokio::task::yield_now().await; crate::current_window() }));
            let b = tokio::spawn(crate::as_window(2, async { tokio::task::yield_now().await; crate::current_window() }));
            (a.await.unwrap(), b.await.unwrap())
        });
        assert_eq!(both, (Some(1), Some(2)));
        assert_eq!(crate::current_window(), None);
    }

    #[test]
    fn cancelling_a_reader_releases_the_file() {
        let dir = temp_dir("cancel");
        let path = patterned_file(&dir, "d.bin", 4 * 1024 * 1024);
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let id = s.open_read(&path, None).await.unwrap();
            s.read_next(id).await.unwrap();
            s.cancel(id);
            assert_eq!(s.open_count(), 0);
            // On Windows an open handle blocks deleting the file; on Unix this only checks the task is gone.
            let mut removed = false;
            for _ in 0..50 {
                if std::fs::remove_file(&path).is_ok() {
                    removed = true;
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(20)).await;
            }
            assert!(removed, "the file was still held after cancel");
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn a_writer_writes_what_it_is_given_and_close_flushes_it() {
        let dir = temp_dir("write");
        let path = dir.join("out.bin");
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let id = s.open_write(&path, false).await.unwrap();
            let mut want = Vec::new();
            for i in 0..40u8 {
                let chunk = vec![i; 10_000 + i as usize];
                want.extend_from_slice(&chunk);
                s.write(id, chunk).await.unwrap();
            }
            s.close(id).await.unwrap();
            assert_eq!(std::fs::read(&path).unwrap(), want);
            assert_eq!(s.open_count(), 0);
            // Writing to it now is an error, and closing again is harmless.
            assert!(s.write(id, vec![1]).await.unwrap_err().contains("not open"));
            s.close(id).await.unwrap();

            // Truncates by default; append keeps what was there.
            let id = s.open_write(&path, false).await.unwrap();
            s.write(id, b"abc".to_vec()).await.unwrap();
            s.close(id).await.unwrap();
            assert_eq!(std::fs::read(&path).unwrap(), b"abc");
            let id = s.open_write(&path, true).await.unwrap();
            s.write(id, b"def".to_vec()).await.unwrap();
            s.close(id).await.unwrap();
            assert_eq!(std::fs::read(&path).unwrap(), b"abcdef");
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn a_reader_and_a_writer_do_not_answer_each_others_calls() {
        let dir = temp_dir("kinds");
        let path = patterned_file(&dir, "e.bin", 1000);
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let r = s.open_read(&path, None).await.unwrap();
            let w = s.open_write(&dir.join("f.bin"), false).await.unwrap();
            assert!(s.write(r, vec![1]).await.unwrap_err().contains("is a reader"));
            assert!(s.read_next(w).await.unwrap_err().contains("is a writer"));
            s.cancel(r);
            s.close(w).await.unwrap();
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn too_many_open_streams_are_refused_and_closing_one_makes_room() {
        let dir = temp_dir("cap");
        let path = patterned_file(&dir, "g.bin", 1000);
        let s = limits(64, 2, 2);
        runtime().block_on(async {
            let a = s.open_read(&path, None).await.unwrap();
            let _b = s.open_read(&path, None).await.unwrap();
            let err = s.open_read(&path, None).await.unwrap_err();
            assert!(err.contains("too many open streams") && err.contains("streams.maxOpen"), "{err}");
            s.cancel(a);
            assert!(s.open_read(&path, None).await.is_ok());
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn opening_a_directory_or_a_missing_file_fails_without_leaving_a_stream() {
        let dir = temp_dir("bad");
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            assert!(s.open_read(&dir, None).await.is_err());
            assert!(s.open_read(&dir.join("missing"), None).await.unwrap_err().contains("cannot open"));
            assert!(s.open_write(&dir.join("no-such-dir").join("x"), false).await.unwrap_err().contains("cannot open"));
            assert_eq!(s.open_count(), 0);
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn the_open_command_checks_the_path_and_the_arguments() {
        let dir = temp_dir("cmd");
        let path = patterned_file(&dir, "h.bin", 5000);
        let s = limits(64, 2, 8);
        let allow = |p: &Path| Ok(p.to_path_buf());
        let deny = |_: &Path| Err("not allowed".to_string());
        let rt = runtime();
        rt.block_on(async {
            let args = |extra: &str| format!(r#"{{"path":{:?}{extra}}}"#, path.to_string_lossy());
            // Read is the default mode, and the answer is the id.
            let out = open_command(&s, &args(""), None, allow, deny).await.unwrap();
            let id: serde_json::Value = serde_json::from_str(&out).unwrap();
            assert!(id["id"].as_u64().is_some(), "{out}");
            // A denied read says which grant, and nothing is opened.
            let before = s.open_count();
            let err = open_command(&s, &args(""), None, deny, allow).await.unwrap_err();
            assert!(err.contains("fs.read denied") && err.contains("not allowed"), "{err}");
            let err = open_command(&s, &args(r#","mode":"write""#), None, allow, deny).await.unwrap_err();
            assert!(err.contains("fs.write denied"), "{err}");
            assert_eq!(s.open_count(), before);
            // Bad arguments.
            assert!(open_command(&s, &args(r#","mode":"rw""#), None, allow, allow).await.unwrap_err().contains("mode must be"));
            assert!(open_command(&s, &args(r#","chunkKb":3"#), None, allow, allow).await.unwrap_err().contains("chunkKb"));
            assert!(open_command(&s, "{}", None, allow, allow).await.unwrap_err().contains("invalid arguments"));
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn request_headers_and_arguments_are_checked() {
        assert_eq!(split_id(&[1, 0, 0, 0, 9, 9]).unwrap(), (1, &[9u8, 9][..]));
        assert_eq!(split_id(&[0x2A, 1, 0, 0]).unwrap(), (0x012A, &[][..]));
        assert!(split_id(&[1, 2, 3]).is_err());
        assert_eq!(read_request(&[7, 0, 0, 0, 2, 0, 0, 0]).unwrap(), (7, 2));
        assert_eq!(read_request(&[1, 0, 1, 0, 0, 1, 0, 0]).unwrap(), (0x0001_0001, 0x0100));
        assert!(read_request(&[7, 0, 0, 0]).is_err(), "a read request without its number");
        assert!(read_request(&[7, 0, 0, 0, 1, 2]).is_err());
        assert_eq!(id_arg(r#"{"id":7}"#).unwrap(), 7);
        assert!(id_arg("{}").is_err());
    }

    #[test]
    fn the_stream_commands_are_registered_and_need_the_fs_capability() {
        let mut b = BackendRegistryBuilder::new();
        register(&mut b);
        let reg = b.build();
        for name in ["glyx_stream.open", "glyx_stream.walk", "glyx_stream.next", "glyx_stream.close", "glyx_stream.cancel"] {
            assert!(reg[name].binary.is_none(), "{name}");
            assert_eq!(reg[name].capabilities, vec!["fs".to_string()], "{name}");
        }
        for name in ["glyx_stream.read", "glyx_stream.write"] {
            assert!(reg[name].binary.is_some(), "{name}");
            assert_eq!(reg[name].capabilities, vec!["fs".to_string()], "{name}");
        }
    }

    /// Throughput of the stream itself, without JavaScript: `GLYX_STREAM_BENCH_FILE=<big file> cargo test -p glyx-runtime --lib bench_stream -- --ignored --nocapture`.
    #[test]
    #[ignore = "a benchmark: needs GLYX_STREAM_BENCH_FILE"]
    fn bench_stream_read_throughput() {
        let Ok(file) = std::env::var("GLYX_STREAM_BENCH_FILE") else { return };
        let path = PathBuf::from(file);
        let len = std::fs::metadata(&path).unwrap().len();
        for chunk_kb in [64usize, 256, 1024, 4096] {
            let s = limits(chunk_kb, 2, 8);
            let started = std::time::Instant::now();
            let got = runtime().block_on(async {
                let id = s.open_read(&path, None).await.unwrap();
                let mut n = 0u64;
                while let Some(chunk) = s.read_next(id).await.unwrap() {
                    n += chunk.len() as u64;
                }
                n
            });
            let secs = started.elapsed().as_secs_f64();
            assert_eq!(got, len);
            println!("chunk {chunk_kb:>5} KiB: {:>7.0} MB/s ({} chunks in {:.2} s)", got as f64 / 1e6 / secs, len / (chunk_kb as u64 * 1024), secs);
        }
        // The same file read whole, for comparison.
        let started = std::time::Instant::now();
        let n = std::fs::read(&path).unwrap().len() as u64;
        println!("std::fs::read whole: {:>7.0} MB/s", n as f64 / 1e6 / started.elapsed().as_secs_f64());
    }

    #[test]
    fn the_default_limits_come_from_the_settings() {
        let l = Limits::from_settings();
        assert_eq!(l, Limits { chunk_bytes: 256 * 1024, queue_chunks: 2, max_open: 64 });
    }
}
