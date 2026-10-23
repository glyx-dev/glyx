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
//! - **Latency hidden.** One call from JavaScript costs a round trip (0.15 ms in a release build, about 1.2 ms under `glyx dev`, which also
//!   runs the DevTools pump on every wake), and a 256 KiB chunk takes about 0.2 ms to read, so asking for one chunk and waiting would leave
//!   the disk idle for much of the time (measured under `glyx dev`: 117 MB/s against 1.6 GB/s for the stream alone; in release 1.3 GB/s
//!   serial and 1.5 GB/s with the two measures below). Two things fix it: a `read` returns every chunk already queued, up to
//!   `chunkKb * queueChunks`, in one answer; and the JavaScript side keeps one request in flight ahead of the one it is waiting for.
//!   Requests carry a sequence number and are answered in that order whatever order they arrive in, so overlapping them is safe.
//! - **Engine neutral.** The registry is driven by built-in backend commands (see [`register`]), so V8 and QuickJS behave the same and
//!   neither needs a binding of its own. Control calls are JSON; the data calls use the binary lane (an `ArrayBuffer` each way).
//! - **Gated.** Opening a file checks the path against the app's `fs` read or write grant (canonical path first, then open) and needs the
//!   `fs` capability; opening an HTTP response (`glyx_stream.fetch`) runs the same checks as `fetch` (scheme, private addresses, the
//!   `network.allow` list, on every redirect) and needs `network`. A stream remembers which capability opened it, and every later call on it
//!   (`read`, `write`, `close`, ...) needs that capability too, so an app cannot use a stream it could not have opened.
//! - **Sources and sinks.** A reader is a file, a directory walk (`walk.rs`), an HTTP response body or a child process's stdout or stderr; a
//!   writer is a file or a child process's stdin. `glyx_stream.pipe` copies a reader into a writer inside Rust, with no JavaScript per chunk.
//! - **Processes.** `glyx_stream.spawn` (needs `shell`, with the binary in `shellExec.allow`, as `shell.run` does) starts a child with its
//!   output as two readers and optionally its input as a writer; a reader nobody drains holds the child back (the pipe fills), which is the
//!   backpressure. The child itself is one more entry (`wait` for its exit, `kill` to stop it), and a window's children are killed when it closes.
//!
//! The wire format of the binary commands is in [`register`]. Chunks are copied twice (disk into a `Vec`, `Vec` into the `ArrayBuffer`);
//! that is the price of the binary lane, and it is one copy per chunk, not per byte of JSON.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
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

/// How a child process is stopped: its waiting task is aborted, which drops the child (it was started with `kill_on_drop`, so that kills it),
/// and the exit is published as `-1` if the task had not already published a real one.
#[cfg(feature = "shell")]
pub(crate) struct ProcessControl {
    task: Mutex<Option<JoinHandle<()>>>,
    exit: Arc<watch::Sender<Option<(i32, bool)>>>,
}

#[cfg(feature = "shell")]
impl ProcessControl {
    fn kill(&self) {
        if let Some(task) = self.task.lock().unwrap().take() {
            task.abort();
        }
        self.exit.send_if_modified(|v| {
            if v.is_none() {
                *v = Some((-1, false));
                true
            } else {
                false
            }
        });
    }
}

/// What to start and which pipes to open for `glyx_stream.spawn`.
#[cfg(feature = "shell")]
pub(crate) struct SpawnOptions {
    pub stdout: bool,
    pub stderr: bool,
    pub stdin: bool,
    pub timeout: Option<std::time::Duration>,
}

/// The ids `glyx_stream.spawn` answers with.
#[cfg(feature = "shell")]
pub(crate) struct Spawned {
    pub process: u32,
    pub pid: Option<u32>,
    pub stdout: Option<u32>,
    pub stderr: Option<u32>,
    pub stdin: Option<u32>,
}

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
        /// The capability that opened it (`fs` or `network`), needed for every call on it.
        cap: &'static str,
        /// Set while `pipe` owns it: `read` is refused then.
        busy: Arc<AtomicBool>,
    },
    Writer {
        tx: Mutex<Option<mpsc::Sender<Vec<u8>>>>,
        task: Mutex<Option<JoinHandle<()>>>,
        /// Why the writer task stopped early (disk full, permission), for the next `write` or the `close`.
        failed: Arc<Mutex<Option<String>>>,
        owner: Option<u32>,
        cap: &'static str,
        /// Set while `pipe` owns it: `write` is refused then.
        busy: Arc<AtomicBool>,
        /// Bytes `pipe` has written so far, for `glyx_stream.progress`.
        piped: Arc<AtomicU64>,
    },
    /// A child process started by `glyx_stream.spawn`: its exit (`(code, timed_out)` once it has) and a way to stop it.
    #[cfg(feature = "shell")]
    Process {
        exit: watch::Receiver<Option<(i32, bool)>>,
        control: Arc<ProcessControl>,
        owner: Option<u32>,
        cap: &'static str,
        busy: Arc<AtomicBool>,
    },
}

impl Entry {
    fn owner(&self) -> Option<u32> {
        match self {
            Entry::Reader { owner, .. } | Entry::Writer { owner, .. } => *owner,
            #[cfg(feature = "shell")]
            Entry::Process { owner, .. } => *owner,
        }
    }

    fn cap(&self) -> &'static str {
        match self {
            Entry::Reader { cap, .. } | Entry::Writer { cap, .. } => cap,
            #[cfg(feature = "shell")]
            Entry::Process { cap, .. } => cap,
        }
    }

    fn busy(&self) -> &Arc<AtomicBool> {
        match self {
            Entry::Reader { busy, .. } | Entry::Writer { busy, .. } => busy,
            #[cfg(feature = "shell")]
            Entry::Process { busy, .. } => busy,
        }
    }

    /// Stop whatever the entry runs, without waiting. A reader's task is aborted (the closed flag first: see `Streams::read_inner`), a
    /// writer stops accepting chunks, a child process is killed.
    fn stop(&self, graceful_writer: bool) {
        match self {
            Entry::Reader { task, turn, stop, .. } => {
                turn.send_modify(|t| t.1 = true);
                stop.store(true, Ordering::Relaxed);
                task.abort();
            }
            Entry::Writer { tx, task, .. } => {
                tx.lock().unwrap().take();
                if !graceful_writer {
                    if let Some(handle) = task.lock().unwrap().take() {
                        handle.abort();
                    }
                }
            }
            #[cfg(feature = "shell")]
            Entry::Process { control, .. } => control.kill(),
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
        self.insert(|limits| make_reader(file, chunk_kb.map_or(limits.chunk_bytes, |kb| kb * 1024), limits, owner, "fs"))
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
                cap: "fs",
                busy: Arc::new(AtomicBool::new(false)),
            }
        })
    }

    /// Start a text generation, for window `owner`. `run` is called on a blocking thread and hands its output to the function it is given,
    /// piece by piece; the pieces come out of `read` as chunks, and `run` waits when the queue is full (so a slow consumer holds the model
    /// back instead of growing memory). The function it is given returns `false` once the stream is closed or cancelled: `run` should stop
    /// then. An `Err` from `run` is what the next `read` reports. The stream carries the `ai` capability.
    pub(crate) fn open_generator_for(
        &self,
        run: impl FnOnce(&mut dyn FnMut(&str) -> bool) -> Result<(), String> + Send + 'static,
        owner: Option<u32>,
    ) -> Result<u32, String> {
        self.insert(|limits| {
            let (tx, rx) = mpsc::channel(limits.queue_chunks);
            let produced = Arc::new(AtomicUsize::new(0));
            let stop = Arc::new(AtomicBool::new(false));
            let (p, s) = (Arc::clone(&produced), Arc::clone(&stop));
            let task = tokio::task::spawn_blocking(move || {
                let result = run(&mut |piece: &str| {
                    if s.load(Ordering::Relaxed) {
                        return false;
                    }
                    p.fetch_add(1, Ordering::Relaxed);
                    tx.blocking_send(Ok(piece.as_bytes().to_vec())).is_ok()
                });
                if let Err(e) = result {
                    let _ = tx.blocking_send(Err(e));
                }
            });
            Entry::Reader {
                state: tokio::sync::Mutex::new(ReaderState { rx, carry_err: None }),
                turn: watch::channel((0, false)).0,
                max_batch: limits.chunk_bytes * limits.queue_chunks,
                task,
                produced,
                stop,
                owner,
                cap: "ai",
                busy: Arc::new(AtomicBool::new(false)),
            }
        })
    }

    /// Start reading the body of an HTTP response (already past the `fetch` checks), for window `owner`. Chunks come out of `read` as they
    /// arrive from the network, and the task waits when the queue is full, so a slow consumer holds the connection back (TCP flow control)
    /// instead of growing memory. Must be called inside the Tokio runtime.
    #[cfg(feature = "fetch")]
    pub(crate) fn open_response_for(&self, response: reqwest::Response, owner: Option<u32>) -> Result<u32, String> {
        self.insert(|limits| {
            let (tx, rx) = mpsc::channel(limits.queue_chunks);
            let produced = Arc::new(AtomicUsize::new(0));
            let task = tokio::spawn(http_loop(response, tx, Arc::clone(&produced)));
            Entry::Reader {
                state: tokio::sync::Mutex::new(ReaderState { rx, carry_err: None }),
                turn: watch::channel((0, false)).0,
                max_batch: limits.chunk_bytes * limits.queue_chunks,
                task,
                produced,
                stop: Arc::new(AtomicBool::new(false)),
                owner,
                cap: "network",
                busy: Arc::new(AtomicBool::new(false)),
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
            make_writer(file, limits, owner, "fs")
        })
    }

    /// The next chunks, or `None` at the end (the stream is then closed). Waits for the first chunk, then takes every other one already
    /// queued, up to the batch size. Request number `seq` (counted from 0 per stream) is answered after request `seq - 1`, so requests
    /// may overlap. An error closes the stream too.
    pub(crate) async fn read(&self, id: u32, seq: u32) -> Result<Option<Vec<Vec<u8>>>, String> {
        self.check_free(id)?;
        self.read_inner(id, seq).await
    }

    /// `Err` while `pipe` owns the stream: two consumers of one queue would split its chunks between them.
    fn check_free(&self, id: u32) -> Result<(), String> {
        if self.get(id)?.busy().load(Ordering::Relaxed) {
            return Err(format!("stream {id} is being piped to another stream"));
        }
        Ok(())
    }

    async fn read_inner(&self, id: u32, seq: u32) -> Result<Option<Vec<Vec<u8>>>, String> {
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
                    // The queue closed: the source ended, or the stream was cancelled under this read (which looks the same from here).
                    // Cancelling sets the closed flag before it aborts anything, so the flag tells them apart: a cancelled stream is an
                    // error, never a clean end (a pipe would otherwise report a truncated copy as a success).
                    None if turn.borrow().1 => Err(closed()),
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
        self.check_free(id)?;
        self.write_inner(id, chunk).await
    }

    async fn write_inner(&self, id: u32, chunk: Vec<u8>) -> Result<(), String> {
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

    /// Copy reader `from` into writer `to` until the reader ends, inside Rust (the chunks never reach JavaScript), then flush and close the
    /// writer. Returns the bytes copied. Both streams belong to the pipe while it runs (`read` and `write` on them are refused); closing or
    /// cancelling either one stops it. On an error both are cancelled.
    pub(crate) async fn pipe(&self, from: u32, to: u32) -> Result<u64, String> {
        if from == to {
            return Err("a stream cannot be piped into itself".to_string());
        }
        let src = self.get(from)?;
        let dst = self.get(to)?;
        let (Entry::Reader { turn, busy: src_busy, .. }, Entry::Writer { busy: dst_busy, piped, .. }) = (&*src, &*dst) else {
            return Err("pipe needs a read stream first and a write stream second".to_string());
        };
        if src_busy.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire).is_err() {
            return Err(format!("stream {from} is already being piped"));
        }
        if dst_busy.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire).is_err() {
            src_busy.store(false, Ordering::Release);
            return Err(format!("stream {to} is already being piped"));
        }
        // Continue the numbering where any earlier reads left off.
        let mut seq = turn.borrow().0;
        let mut bytes = 0u64;
        let copied: Result<(), String> = async {
            while let Some(chunks) = self.read_inner(from, seq).await? {
                seq = seq.wrapping_add(1);
                for chunk in chunks {
                    bytes += chunk.len() as u64;
                    self.write_inner(to, chunk).await?;
                    piped.store(bytes, Ordering::Relaxed);
                }
            }
            Ok(())
        }
        .await;
        match copied {
            Ok(()) => self.close(to).await.map(|()| bytes),
            Err(e) => {
                self.cancel(from);
                self.cancel(to);
                Err(e)
            }
        }
    }

    /// Bytes `pipe` has copied into writer `id` so far.
    pub(crate) fn pipe_progress(&self, id: u32) -> Result<u64, String> {
        match &*self.get(id)? {
            Entry::Writer { piped, .. } => Ok(piped.load(Ordering::Relaxed)),
            Entry::Reader { .. } => Err(format!("stream {id} is a reader: ask for the progress of the write stream")),
            #[cfg(feature = "shell")]
            Entry::Process { .. } => Err(format!("stream {id} is a process")),
        }
    }

    /// The capability that opened stream `id` (`fs` or `network`), which every call on it needs.
    pub(crate) fn capability_of(&self, id: u32) -> Result<&'static str, String> {
        Ok(self.get(id)?.cap())
    }

    /// Finish a stream. A writer is flushed first (every queued chunk is written), and a failure of the writer is reported here.
    pub(crate) async fn close(&self, id: u32) -> Result<(), String> {
        let Some(entry) = self.remove(id) else { return Ok(()) };
        match &*entry {
            Entry::Reader { .. } => {
                entry.stop(false);
                Ok(())
            }
            #[cfg(feature = "shell")]
            Entry::Process { .. } => {
                entry.stop(false);
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
            entry.stop(false);
        }
    }

    /// Read as a caller that waits for each answer would: the next request number, the chunks joined (tests).
    #[cfg(test)]
    async fn read_next(&self, id: u32) -> Result<Option<Vec<u8>>, String> {
        let seq = match self.get(id)?.as_ref() {
            Entry::Reader { turn, .. } => turn.borrow().0,
            Entry::Writer { .. } => return Err(format!("stream {id} is a writer")),
            #[cfg(feature = "shell")]
            Entry::Process { .. } => return Err(format!("stream {id} is a process")),
        };
        Ok(self.read(id, seq).await?.map(|chunks| chunks.concat()))
    }

    /// Close every stream window `owner` left open. A reader is stopped and its file released; a writer stops accepting chunks but is not
    /// aborted: it finishes writing what was already queued, in the background. Returns how many were closed.
    pub(crate) fn close_window(&self, owner: u32) -> usize {
        let ids: Vec<u32> = self.open.lock().unwrap().iter().filter(|(_, e)| e.owner() == Some(owner)).map(|(id, _)| *id).collect();
        for id in &ids {
            let Some(entry) = self.remove(*id) else { continue };
            // A writer is not aborted: it finishes writing what was already queued, in the background.
            entry.stop(true);
        }
        if !ids.is_empty() {
            log::warn!(
                "[streams] window {owner} closed with {} stream(s) still open; closed them (close a stream when you are done with it)",
                ids.len()
            );
        }
        ids.len()
    }

    /// Start a child process (a command already approved by the shell checks) and open its pipes: stdout and stderr as readers unless they
    /// are ignored, stdin as a writer if asked for. The child is one more entry, for `wait` and `kill`. `timeout` kills it when it runs
    /// longer. A window's children die with it. Must be called inside the Tokio runtime. Four entries at most: the cap must have room for
    /// all of them, or nothing is started.
    #[cfg(feature = "shell")]
    pub(crate) fn open_spawn_for(&self, mut command: tokio::process::Command, opts: &SpawnOptions, owner: Option<u32>) -> Result<Spawned, String> {
        use std::process::Stdio;
        let limits = (self.limits)();
        let needed = 1 + opts.stdout as usize + opts.stderr as usize + opts.stdin as usize;
        {
            let open = self.open.lock().unwrap();
            if open.len() + needed > limits.max_open {
                return Err(format!(
                    "too many open streams ({}): a process needs {needed}; close the ones you are done with, or raise streams.maxOpen",
                    limits.max_open
                ));
            }
        }
        command
            .stdin(if opts.stdin { Stdio::piped() } else { Stdio::null() })
            .stdout(if opts.stdout { Stdio::piped() } else { Stdio::null() })
            .stderr(if opts.stderr { Stdio::piped() } else { Stdio::null() })
            .kill_on_drop(true);
        let mut child = command.spawn().map_err(|e| format!("cannot start the process: {e}"))?;
        let pid = child.id();
        let (stdout, stderr, stdin) = (child.stdout.take(), child.stderr.take(), child.stdin.take());

        let (exit_tx, exit_rx) = watch::channel(None);
        let exit_tx = Arc::new(exit_tx);
        let publish = Arc::clone(&exit_tx);
        let timeout = opts.timeout;
        let task = tokio::spawn(async move {
            let mut timed_out = false;
            let status = match timeout {
                None => child.wait().await,
                Some(limit) => match tokio::time::timeout(limit, child.wait()).await {
                    Ok(status) => status,
                    Err(_) => {
                        timed_out = true;
                        let _ = child.kill().await;
                        child.wait().await
                    }
                },
            };
            publish.send_replace(Some((status.ok().and_then(|s| s.code()).unwrap_or(-1), timed_out)));
        });
        let control = Arc::new(ProcessControl { task: Mutex::new(Some(task)), exit: exit_tx });

        let process = self.insert(|_| Entry::Process { exit: exit_rx, control: Arc::clone(&control), owner, cap: "shellExec", busy: Arc::new(AtomicBool::new(false)) })?;
        let reader = |source: Option<tokio::process::ChildStdout>| -> Result<Option<u32>, String> {
            source.map(|s| self.insert(|limits| make_reader(s, limits.chunk_bytes, limits, owner, "shellExec"))).transpose()
        };
        let stdout_id = reader(stdout)?;
        let stderr_id = stderr
            .map(|s| self.insert(|limits| make_reader(s, limits.chunk_bytes, limits, owner, "shellExec")))
            .transpose()?;
        let stdin_id = stdin.map(|s| self.insert(|limits| make_writer(s, limits, owner, "shellExec"))).transpose()?;
        Ok(Spawned { process, pid, stdout: stdout_id, stderr: stderr_id, stdin: stdin_id })
    }

    /// Wait for a child to end and answer `(exit code, whether it was killed by its timeout)`. The child's entry is removed: a process is
    /// waited for once.
    #[cfg(feature = "shell")]
    pub(crate) async fn wait_process(&self, id: u32) -> Result<(i32, bool), String> {
        let entry = self.get(id)?;
        let Entry::Process { exit, .. } = &*entry else {
            return Err(format!("stream {id} is not a process"));
        };
        let mut exit = exit.clone();
        let result = exit.wait_for(|v| v.is_some()).await.map(|v| (*v).unwrap()).map_err(|_| "the process was lost".to_string());
        self.remove(id);
        result
    }

    /// Stop a child now (it is killed; `wait` then reports how it ended). Harmless once it has ended.
    #[cfg(feature = "shell")]
    pub(crate) fn kill_process(&self, id: u32) -> Result<(), String> {
        match &*self.get(id)? {
            Entry::Process { control, .. } => {
                control.kill();
                Ok(())
            }
            _ => Err(format!("stream {id} is not a process")),
        }
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

/// A reader over any async source (a file, a child's stdout): a task reads it in chunks into a bounded queue.
fn make_reader<R: AsyncRead + Unpin + Send + 'static>(source: R, chunk: usize, limits: Limits, owner: Option<u32>, cap: &'static str) -> Entry {
    let (tx, rx) = mpsc::channel(limits.queue_chunks);
    let produced = Arc::new(AtomicUsize::new(0));
    let task = tokio::spawn(read_loop(source, chunk, tx, Arc::clone(&produced)));
    Entry::Reader {
        state: tokio::sync::Mutex::new(ReaderState { rx, carry_err: None }),
        turn: watch::channel((0, false)).0,
        max_batch: chunk * limits.queue_chunks,
        task,
        produced,
        stop: Arc::new(AtomicBool::new(false)),
        owner,
        cap,
        busy: Arc::new(AtomicBool::new(false)),
    }
}

/// A writer over any async sink (a file, a child's stdin): a task writes the queued chunks to it.
fn make_writer<W: AsyncWrite + Unpin + Send + 'static>(sink: W, limits: Limits, owner: Option<u32>, cap: &'static str) -> Entry {
    let (tx, rx) = mpsc::channel(limits.queue_chunks);
    let failed = Arc::new(Mutex::new(None));
    let task = tokio::spawn(write_loop(sink, rx, Arc::clone(&failed)));
    Entry::Writer {
        tx: Mutex::new(Some(tx)),
        task: Mutex::new(Some(task)),
        failed,
        owner,
        cap,
        busy: Arc::new(AtomicBool::new(false)),
        piped: Arc::new(AtomicU64::new(0)),
    }
}

/// Read the source in chunks into a bounded queue; the send waits while it is full. Ends when the source does, when the reader side is gone
/// (a cancelled stream drops its receiver), or on an error, which is passed on as the last item.
async fn read_loop<R: AsyncRead + Unpin>(mut file: R, chunk: usize, tx: mpsc::Sender<ChunkResult>, produced: Arc<AtomicUsize>) {
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

/// Pass the body of an HTTP response on as it arrives, into the bounded queue (the send waits while it is full, and not reading the socket
/// holds the sender back). Ends with the body, when the consumer is gone, or on a network error, which is the last item.
#[cfg(feature = "fetch")]
async fn http_loop(mut response: reqwest::Response, tx: mpsc::Sender<ChunkResult>, produced: Arc<AtomicUsize>) {
    loop {
        match response.chunk().await {
            Ok(Some(bytes)) => {
                produced.fetch_add(1, Ordering::Relaxed);
                if tx.send(Ok(bytes.to_vec())).await.is_err() {
                    break;
                }
            }
            Ok(None) => break,
            Err(e) => {
                let _ = tx.send(Err(e.to_string())).await;
                break;
            }
        }
    }
}

/// Write queued chunks to the file until the queue closes, then flush. A failure is kept for the next `write` or the `close`.
async fn write_loop<W: AsyncWrite + Unpin>(mut file: W, mut rx: mpsc::Receiver<Vec<u8>>, failed: Arc<Mutex<Option<String>>>) {
    while let Some(chunk) = rx.recv().await {
        if let Err(e) = file.write_all(&chunk).await {
            *failed.lock().unwrap() = Some(e.to_string());
            return;
        }
    }
    if let Err(e) = file.flush().await {
        *failed.lock().unwrap() = Some(e.to_string());
    }
    // Dropping the sink closes it: for a child's stdin that is the end of its input.
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

/// `glyx_stream.generate`: start a text generation (`{ prompt, maxTokens?, temperature? }`) and answer `{ "id": n }`. The text comes out of
/// `glyx_stream.read` as UTF-8 chunks that each end on a character boundary; closing or cancelling the stream stops the model.
pub(crate) fn generate_command(streams: &Streams, args: &str, owner: Option<u32>) -> Result<String, String> {
    let a: crate::ai_stream::GenerateArgs = serde_json::from_str(args).map_err(|e| format!("invalid arguments: {e}"))?;
    crate::ai_stream::available()?;
    let id = streams.open_generator_for(move |on_text| crate::ai_stream::generate_into(&a, on_text), owner)?;
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

#[cfg(feature = "fetch")]
#[derive(serde::Deserialize)]
struct FetchArgs {
    url: String,
    method: Option<String>,
    headers: Option<serde_json::Map<String, serde_json::Value>>,
    body: Option<String>,
}

/// `glyx_stream.fetch`: make the request (after `check` has approved the URL), wait for the response headers, and open the body as a reader.
/// Answers `{ id, status, ok, statusText, headers, url }`; `url` is the address after redirects. A non-2xx status still opens the body (an error
/// page is a body too), and `ok` says which it was. Only method, headers and a string body are supported here: use `fetch` for a multipart upload.
#[cfg(feature = "fetch")]
pub(crate) async fn fetch_command(
    streams: &Streams,
    args: &str,
    owner: Option<u32>,
    check: impl Fn(&str) -> Result<(), String>,
    client: reqwest::Client,
) -> Result<String, String> {
    let a: FetchArgs = serde_json::from_str(args).map_err(|e| format!("invalid arguments: {e}"))?;
    check(&a.url)?;
    let mut request = match a.method.as_deref().unwrap_or("GET").to_ascii_uppercase().as_str() {
        "POST" => client.post(&a.url),
        "PUT" => client.put(&a.url),
        "PATCH" => client.patch(&a.url),
        "DELETE" => client.delete(&a.url),
        "HEAD" => client.head(&a.url),
        _ => client.get(&a.url),
    };
    for (name, value) in a.headers.iter().flatten() {
        if let Some(value) = value.as_str() {
            request = request.header(name.as_str(), value);
        }
    }
    if let Some(body) = a.body {
        request = request.body(body);
    }
    let response = request.send().await.map_err(|e| e.to_string())?;

    let status = response.status();
    let mut headers = serde_json::Map::new();
    for (name, value) in response.headers() {
        if let Ok(text) = value.to_str() {
            // The same name twice is one value joined with a comma, as a browser's Headers does.
            match headers.get_mut(name.as_str()) {
                Some(serde_json::Value::String(existing)) => {
                    existing.push_str(", ");
                    existing.push_str(text);
                }
                _ => {
                    headers.insert(name.to_string(), serde_json::Value::String(text.to_string()));
                }
            }
        }
    }
    let meta = serde_json::json!({
        "status": status.as_u16(),
        "ok": status.is_success(),
        "statusText": status.canonical_reason().unwrap_or(""),
        "headers": headers,
        "url": response.url().as_str(),
    });
    let id = streams.open_response_for(response, owner)?;
    let mut meta = meta;
    meta["id"] = serde_json::json!(id);
    Ok(meta.to_string())
}

/// The checks `fetch` makes before a request, for the stream version: scheme, private and loopback addresses, and the `network.allow` list.
#[cfg(feature = "fetch")]
fn check_fetch_url(url: &str) -> Result<(), String> {
    crate::bindings::check_fetch_scheme(url)?;
    let host = crate::bindings::extract_host(url);
    if crate::bindings::is_private_host(&host) {
        return Err(format!("fetch: host {host:?} is a private/loopback address (SSRF denied)"));
    }
    if !glyx_security::get().can_network(&host) {
        return Err(format!(
            "network.allow[\"{host}\"] -- add to glyx.config.json under \"capabilities\": {{ \"network\": {{ \"allow\": [\"{host}\"] }} }}"
        ));
    }
    Ok(())
}

/// A call on an open stream needs the capability that opened it. An id that is not open is not this function's business (the call says so).
fn ensure_capability(streams: &Streams, id: u32, has: &(dyn Fn(&str) -> bool + Sync)) -> Result<(), String> {
    match streams.capability_of(id) {
        Ok(cap) if !has(cap) => Err(format!("missing capability \"{cap}\" -- add it to glyx.config.json's \"capabilities\" to use this stream")),
        _ => Ok(()),
    }
}

fn has_capability(name: &str) -> bool {
    glyx_security::get().has_named(name)
}

#[cfg(feature = "shell")]
#[derive(serde::Deserialize)]
struct SpawnArgs {
    bin: String,
    #[serde(default)]
    args: Vec<String>,
    /// Open the child's stdin as a writer. Default false: the child gets no input.
    #[serde(default)]
    stdin: bool,
    /// `pipe` (default) or `ignore`.
    stdout: Option<String>,
    stderr: Option<String>,
    #[serde(rename = "timeoutMs")]
    timeout_ms: Option<u64>,
}

/// `glyx_stream.spawn`: `prepare(bin, args)` approves the request and builds the command (the shell checks in production), then the child is
/// started. Answers `{ process, pid, stdout, stderr, stdin }` (a pipe that was not opened is `null`).
#[cfg(feature = "shell")]
pub(crate) fn spawn_command(
    streams: &Streams,
    args: &str,
    owner: Option<u32>,
    prepare: impl Fn(&str, &[String]) -> Result<tokio::process::Command, String>,
) -> Result<String, String> {
    let a: SpawnArgs = serde_json::from_str(args).map_err(|e| format!("invalid arguments: {e}"))?;
    let pipe = |name: &str, v: &Option<String>| match v.as_deref() {
        None | Some("pipe") => Ok(true),
        Some("ignore") => Ok(false),
        Some(other) => Err(format!("{name} must be \"pipe\" or \"ignore\", not {other:?}")),
    };
    let opts = SpawnOptions {
        stdout: pipe("stdout", &a.stdout)?,
        stderr: pipe("stderr", &a.stderr)?,
        stdin: a.stdin,
        timeout: a.timeout_ms.map(std::time::Duration::from_millis),
    };
    let command = prepare(&a.bin, &a.args)?;
    let spawned = streams.open_spawn_for(command, &opts, owner)?;
    Ok(serde_json::json!({
        "process": spawned.process,
        "pid": spawned.pid,
        "stdout": spawned.stdout,
        "stderr": spawned.stderr,
        "stdin": spawned.stdin,
    })
    .to_string())
}

#[cfg(feature = "shell")]
pub(crate) async fn wait_command(streams: &Streams, args: &str, has: &(dyn Fn(&str) -> bool + Sync)) -> Result<String, String> {
    let id = id_arg(args)?;
    ensure_capability(streams, id, has)?;
    let (code, timed_out) = streams.wait_process(id).await?;
    Ok(format!("{{\"exitCode\":{code},\"timedOut\":{timed_out}}}"))
}

#[derive(serde::Deserialize)]
struct PipeArgs {
    from: u32,
    to: u32,
}

/// `glyx_stream.pipe`: copy reader `from` into writer `to` inside Rust and answer `{ "bytes": n }` when it is done.
pub(crate) async fn pipe_command(streams: &Streams, args: &str, has: &(dyn Fn(&str) -> bool + Sync)) -> Result<String, String> {
    let a: PipeArgs = serde_json::from_str(args).map_err(|_| "from and to (stream ids) are required".to_string())?;
    ensure_capability(streams, a.from, has)?;
    ensure_capability(streams, a.to, has)?;
    let bytes = streams.pipe(a.from, a.to).await?;
    Ok(format!("{{\"bytes\":{bytes}}}"))
}

/// Register the stream commands. Opening needs a capability (`glyx_stream.open` and `.walk` need `fs` and check the path, `.fetch` needs
/// `network` and runs the checks `fetch` does); every other call on a stream needs the capability that opened it (checked per call, see
/// [`ensure_capability`]), so they carry none here.
///
/// | command | request | answer |
/// |---|---|---|
/// | `glyx_stream.open` (JSON) | `{ path, mode?, chunkKb? }` | `{ id }` |
/// | `glyx_stream.walk` (JSON) | `{ path, maxDepth?, ignore?, followLinks?, type? }` | `{ id }`; see `walk.rs` |
/// | `glyx_stream.fetch` (JSON) | `{ url, method?, headers?, body? }` | `{ id, status, ok, statusText, headers, url }` once the headers are in |
/// | `glyx_stream.read` (binary) | 4-byte id, 4-byte request number (0, 1, 2, ... per stream) | status byte (0 data, 1 end), then the bytes of every chunk that was queued (one or more, up to `chunkKb * queueChunks`) |
/// | `glyx_stream.next` (JSON) | `{ id, seq }` (a walk) | `{ items: [...] }` or `{ items: [], done: true }` |
/// | `glyx_stream.write` (binary) | 4-byte id, then the chunk | no bytes; resolves when the chunk is queued |
/// | `glyx_stream.spawn` (JSON, feature `shell`) | `{ bin, args?, stdin?, stdout?, stderr?, timeoutMs? }` | `{ process, pid, stdout, stderr, stdin }` (ids; `null` for a pipe not opened) |
/// | `glyx_stream.wait` (JSON, feature `shell`) | `{ id }` (the process) | `{ exitCode, timedOut }` once it has ended |
/// | `glyx_stream.kill` (JSON, feature `shell`) | `{ id }` (the process) | `{}` |
/// | `glyx_stream.pipe` (JSON) | `{ from, to }` | `{ bytes }` when the reader has ended and the writer is flushed |
/// | `glyx_stream.progress` (JSON) | `{ id }` (the write stream of a pipe) | `{ bytes }` copied so far |
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
    b.add_gated("glyx_stream.generate", &["ai"], move |args| {
        let s = Arc::clone(&s);
        async move { generate_command(&s, &args, crate::current_window()) }
    });

    #[cfg(feature = "fetch")]
    {
        let s = Arc::clone(&streams);
        b.add_gated("glyx_stream.fetch", &["network"], move |args| {
            let s = Arc::clone(&s);
            async move {
                let client = crate::bindings::safe_http_client()?;
                fetch_command(&s, &args, crate::current_window(), check_fetch_url, client).await
            }
        });
    }

    #[cfg(feature = "shell")]
    {
        let s = Arc::clone(&streams);
        b.add("glyx_stream.spawn", move |args| {
            let s = Arc::clone(&s);
            async move {
                spawn_command(&s, &args, crate::current_window(), |bin, argv| {
                    crate::bindings::check_shell_request(bin, argv)?;
                    crate::bindings::shell_command(bin, argv)
                })
            }
        });
        let s = Arc::clone(&streams);
        b.add("glyx_stream.wait", move |args| {
            let s = Arc::clone(&s);
            async move { wait_command(&s, &args, &has_capability).await }
        });
        let s = Arc::clone(&streams);
        b.add("glyx_stream.kill", move |args| {
            let s = Arc::clone(&s);
            async move {
                let id = id_arg(&args)?;
                ensure_capability(&s, id, &has_capability)?;
                s.kill_process(id)?;
                Ok("{}".to_string())
            }
        });
    }

    let s = Arc::clone(&streams);
    b.add_gated("glyx_stream.next", &[], move |args| {
        let s = Arc::clone(&s);
        async move {
            ensure_capability(&s, id_arg(&args)?, &has_capability)?;
            next_command(&s, &args).await
        }
    });

    let s = Arc::clone(&streams);
    b.add_bytes("glyx_stream.read", move |req| {
        let s = Arc::clone(&s);
        async move {
            let (id, seq) = read_request(&req)?;
            ensure_capability(&s, id, &has_capability)?;
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
    b.add_bytes("glyx_stream.write", move |req| {
        let s = Arc::clone(&s);
        async move {
            let (id, chunk) = split_id(&req)?;
            ensure_capability(&s, id, &has_capability)?;
            s.write(id, chunk.to_vec()).await?;
            Ok(Vec::new())
        }
    });

    let s = Arc::clone(&streams);
    b.add("glyx_stream.pipe", move |args| {
        let s = Arc::clone(&s);
        async move { pipe_command(&s, &args, &has_capability).await }
    });

    let s = Arc::clone(&streams);
    b.add("glyx_stream.progress", move |args| {
        let s = Arc::clone(&s);
        async move {
            let id = id_arg(&args)?;
            ensure_capability(&s, id, &has_capability)?;
            Ok(format!("{{\"bytes\":{}}}", s.pipe_progress(id)?))
        }
    });

    let s = Arc::clone(&streams);
    b.add("glyx_stream.close", move |args| {
        let s = Arc::clone(&s);
        async move {
            let id = id_arg(&args)?;
            ensure_capability(&s, id, &has_capability)?;
            s.close(id).await?;
            Ok("{}".to_string())
        }
    });

    let s = streams;
    b.add("glyx_stream.cancel", move |args| {
        let s = Arc::clone(&s);
        async move {
            let id = id_arg(&args)?;
            ensure_capability(&s, id, &has_capability)?;
            s.cancel(id);
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
            // Reading frees room and it goes on, but only as far as what was taken (each answer carries every queued chunk, up to two).
            let taken = s.read_next(id).await.unwrap().unwrap().len() + s.read_next(id).await.unwrap().unwrap().len();
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            let consumed = taken / (64 * 1024);
            assert!(s.produced(id) <= consumed + 3, "produced {} after {consumed} chunks were taken", s.produced(id));
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

    // ── Text generation as a stream ──

    /// Read a generator stream to its end, as the text it produced.
    async fn read_text(s: &Streams, id: u32) -> Result<String, String> {
        let mut out = Vec::new();
        let mut seq = 0;
        while let Some(chunks) = s.read(id, seq).await? {
            out.extend(chunks.concat());
            seq += 1;
        }
        Ok(String::from_utf8(out).expect("pieces are whole characters"))
    }

    #[test]
    fn a_generation_streams_its_pieces_in_order_and_the_stream_closes_at_the_end() {
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let id = s
                .open_generator_for(
                    |on_text| {
                        for piece in ["Hel", "lo ", "w\u{f6}rld", " \u{1f600}"] {
                            if !on_text(piece) {
                                return Ok(());
                            }
                        }
                        Ok(())
                    },
                    Some(1),
                )
                .unwrap();
            assert_eq!(read_text(&s, id).await.unwrap(), "Hello w\u{f6}rld \u{1f600}");
            assert_eq!(s.open_count(), 0, "a stream that ended is closed");
        });
    }

    #[test]
    fn a_generator_that_fails_hands_over_what_it_made_and_then_the_error() {
        let s = limits(64, 1, 8);
        runtime().block_on(async {
            let id = s
                .open_generator_for(
                    |on_text| {
                        on_text("partial answer");
                        Err("ai.generate: the model ran out of memory".to_string())
                    },
                    None,
                )
                .unwrap();
            let first = s.read(id, 0).await.unwrap().expect("the text made before the failure");
            assert_eq!(first.concat(), b"partial answer");
            assert_eq!(s.read(id, 1).await.unwrap_err(), "ai.generate: the model ran out of memory");
        });
    }

    #[test]
    fn closing_the_stream_stops_the_model_instead_of_letting_it_finish() {
        let s = limits(64, 2, 8);
        let stopped = Arc::new(AtomicBool::new(false));
        let made = Arc::new(AtomicUsize::new(0));
        runtime().block_on(async {
            let (flag, count) = (Arc::clone(&stopped), Arc::clone(&made));
            let id = s
                .open_generator_for(
                    move |on_text| {
                        // A model that would run for a long time, a piece every millisecond.
                        for _ in 0..100_000 {
                            count.fetch_add(1, Ordering::Relaxed);
                            if !on_text("x") {
                                flag.store(true, Ordering::SeqCst);
                                return Ok(());
                            }
                            std::thread::sleep(std::time::Duration::from_millis(1));
                        }
                        Ok(())
                    },
                    None,
                )
                .unwrap();
            s.read(id, 0).await.unwrap().expect("some text");
            s.cancel(id);
            until(|| stopped.load(Ordering::SeqCst)).await;
            assert!(made.load(Ordering::Relaxed) < 5_000, "the model went on after the stream was closed");
        });
    }

    #[test]
    fn a_consumer_that_does_not_read_holds_the_model_back() {
        let s = limits(64, 1, 8);
        runtime().block_on(async {
            let id = s.open_generator_for(|on_text| { for _ in 0..1_000 { if !on_text("tok ") { break; } } Ok(()) }, None).unwrap();
            until(|| s.produced(id) >= 2).await;
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            let produced = s.produced(id);
            assert!(produced <= 3, "the model produced {produced} pieces with a queue of 1 and nobody reading");
            // Cancel inside the runtime: dropping it waits for the blocked generator, which only stops once its stream is closed.
            s.cancel(id);
        });
    }

    #[test]
    fn a_generator_stream_needs_the_ai_capability_for_every_call_and_dies_with_its_window() {
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let id = s.open_generator_for(|on_text| { while on_text("x") { std::thread::sleep(std::time::Duration::from_millis(1)); } Ok(()) }, Some(9)).unwrap();
            let err = ensure_capability(&s, id, &|name| name != "ai").unwrap_err();
            assert!(err.contains("\"ai\""), "{err}");
            ensure_capability(&s, id, &|_| true).unwrap();
            assert_eq!(s.close_window(9), 1);
            assert_eq!(s.open_count(), 0);
        });
    }

    #[cfg(not(feature = "ai"))]
    #[test]
    fn the_generate_command_says_why_there_is_no_model() {
        // The test build has no ai module compiled in or loaded, so opening must fail at once with a reason, not on the first read.
        let s = limits(64, 1, 8);
        let err = generate_command(&s, r#"{"prompt":"hi"}"#, None).unwrap_err();
        assert!(err.contains("ai capability not loaded") || err.contains("cannot stream"), "{err}");
        assert_eq!(s.open_count(), 0);
        assert!(generate_command(&s, r#"{"maxTokens":5}"#, None).unwrap_err().contains("invalid arguments"));
    }

    #[test]
    fn the_stream_commands_are_registered_opening_is_gated_and_the_rest_check_the_stream() {
        let mut b = BackendRegistryBuilder::new();
        register(&mut b);
        let reg = b.build();
        // Opening needs the capability of what it opens.
        for name in ["glyx_stream.open", "glyx_stream.walk"] {
            assert!(reg[name].binary.is_none(), "{name}");
            assert_eq!(reg[name].capabilities, vec!["fs".to_string()], "{name}");
        }
        #[cfg(feature = "fetch")]
        assert_eq!(reg["glyx_stream.fetch"].capabilities, vec!["network".to_string()]);
        assert_eq!(reg["glyx_stream.generate"].capabilities, vec!["ai".to_string()]);
        assert!(reg["glyx_stream.generate"].binary.is_none());
        // Everything else carries none at registration: it checks the capability the stream was opened with, per call.
        for name in ["glyx_stream.next", "glyx_stream.pipe", "glyx_stream.progress", "glyx_stream.close", "glyx_stream.cancel"] {
            assert!(reg[name].binary.is_none(), "{name}");
            assert!(reg[name].capabilities.is_empty(), "{name}");
        }
        for name in ["glyx_stream.read", "glyx_stream.write"] {
            assert!(reg[name].binary.is_some(), "{name}");
            assert!(reg[name].capabilities.is_empty(), "{name}");
        }
    }

    #[test]
    fn a_call_on_a_stream_needs_the_capability_that_opened_it() {
        let dir = temp_dir("caps");
        let path = patterned_file(&dir, "o.bin", 1000);
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let file = s.open_read(&path, None).await.unwrap();
            let out = s.open_write(&dir.join("o.out"), false).await.unwrap();
            assert_eq!(s.capability_of(file).unwrap(), "fs");
            assert_eq!(s.capability_of(out).unwrap(), "fs");
            let only_network = |c: &str| c == "network";
            let only_fs = |c: &str| c == "fs";
            let err = ensure_capability(&s, file, &only_network).unwrap_err();
            assert!(err.contains("missing capability \"fs\""), "{err}");
            assert!(ensure_capability(&s, file, &only_fs).is_ok());
            // An id that is not open is not a capability matter: the call itself says it is not open.
            assert!(ensure_capability(&s, 999_999, &only_network).is_ok());
            assert!(s.capability_of(999_999).unwrap_err().contains("not open"));
            // The pipe checks both ends.
            let err = pipe_command(&s, &format!(r#"{{"from":{file},"to":{out}}}"#), &only_network).await.unwrap_err();
            assert!(err.contains("missing capability"), "{err}");
            s.cancel(file);
            s.cancel(out);
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn a_pipe_copies_a_reader_into_a_writer_inside_rust() {
        let dir = temp_dir("pipe");
        let src = patterned_file(&dir, "src.bin", 3 * 1024 * 1024 + 123);
        let dst = dir.join("dst.bin");
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let r = s.open_read(&src, None).await.unwrap();
            let w = s.open_write(&dst, false).await.unwrap();
            let bytes = s.pipe(r, w).await.unwrap();
            assert_eq!(bytes, 3 * 1024 * 1024 + 123);
            assert_eq!(std::fs::read(&dst).unwrap(), std::fs::read(&src).unwrap(), "the copy differs");
            assert_eq!(s.open_count(), 0, "both ends are closed afterwards");
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn a_pipe_continues_where_earlier_reads_left_off_and_an_empty_source_is_fine() {
        let dir = temp_dir("pipe-resume");
        let src = patterned_file(&dir, "src.bin", 1_000_000);
        let want = std::fs::read(&src).unwrap();
        let empty = dir.join("empty");
        std::fs::write(&empty, b"").unwrap();
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let r = s.open_read(&src, None).await.unwrap();
            let first = s.read_next(r).await.unwrap().unwrap();
            let w = s.open_write(&dir.join("out.bin"), false).await.unwrap();
            let bytes = s.pipe(r, w).await.unwrap();
            assert_eq!(first.len() as u64 + bytes, 1_000_000);
            let mut got = first;
            got.extend(std::fs::read(dir.join("out.bin")).unwrap());
            assert_eq!(got, want);

            let r = s.open_read(&empty, None).await.unwrap();
            let w = s.open_write(&dir.join("empty.out"), false).await.unwrap();
            assert_eq!(s.pipe(r, w).await.unwrap(), 0);
            assert!(std::fs::read(dir.join("empty.out")).unwrap().is_empty());
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn while_a_pipe_runs_its_streams_cannot_be_read_or_written_by_anyone_else() {
        let dir = temp_dir("pipe-busy");
        let src = patterned_file(&dir, "src.bin", 16 * 1024 * 1024);
        let s = Arc::new(limits(64, 1, 8));
        runtime().block_on(async {
            let r = s.open_read(&src, None).await.unwrap();
            let w = s.open_write(&dir.join("out.bin"), false).await.unwrap();
            let piping = {
                let s = Arc::clone(&s);
                tokio::spawn(async move { s.pipe(r, w).await })
            };
            until(|| s.get(r).map_or(true, |e| e.busy().load(Ordering::Relaxed))).await;
            if s.get(r).is_ok() {
                assert!(s.read(r, 0).await.unwrap_err().contains("being piped"));
                assert!(s.write(w, vec![1]).await.unwrap_err().contains("being piped"));
                // A second pipe over the same stream is refused too.
                let other = s.open_write(&dir.join("other.bin"), false).await.unwrap();
                assert!(s.pipe(r, other).await.unwrap_err().contains("already being piped"));
                s.cancel(other);
            }
            piping.await.unwrap().ok();
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn cancelling_either_end_stops_a_pipe_and_closes_both() {
        let dir = temp_dir("pipe-cancel");
        let src = patterned_file(&dir, "src.bin", 64 * 1024 * 1024);
        let s = Arc::new(limits(64, 1, 8));
        runtime().block_on(async {
            let r = s.open_read(&src, None).await.unwrap();
            let w = s.open_write(&dir.join("out.bin"), false).await.unwrap();
            let piping = {
                let s = Arc::clone(&s);
                tokio::spawn(async move { s.pipe(r, w).await })
            };
            until(|| s.pipe_progress(w).map_or(false, |b| b > 0)).await;
            s.cancel(r);
            let result = tokio::time::timeout(std::time::Duration::from_secs(5), piping).await.expect("the pipe did not stop").unwrap();
            assert!(result.is_err(), "a cancelled pipe is an error");
            assert_eq!(s.open_count(), 0, "both ends are closed");
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn pipe_arguments_are_checked() {
        let dir = temp_dir("pipe-args");
        let src = patterned_file(&dir, "a.bin", 100);
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let r = s.open_read(&src, None).await.unwrap();
            let w = s.open_write(&dir.join("b.out"), false).await.unwrap();
            assert!(s.pipe(r, r).await.unwrap_err().contains("itself"));
            assert!(s.pipe(w, r).await.unwrap_err().contains("read stream first"));
            assert!(s.pipe(r, 424_242).await.unwrap_err().contains("not open"));
            assert!(s.pipe_progress(r).unwrap_err().contains("is a reader"));
            assert_eq!(s.pipe_progress(w).unwrap(), 0);
            s.cancel(r);
            s.cancel(w);
            let allow = |_: &str| true;
            assert!(pipe_command(&s, "{}", &allow).await.unwrap_err().contains("from and to"));
        });
        std::fs::remove_dir_all(dir).ok();
    }

    /// A one-connection HTTP server for the tests below: answers the first request with `status_line`, then each body chunk as a chunked
    /// transfer, waiting `delay_ms` before it. Returns the URL. (The `fetch` checks refuse loopback addresses, so these tests call
    /// `fetch_command` with a check that allows it.)
    #[cfg(feature = "fetch")]
    fn serve(status_line: &'static str, chunks: Vec<Vec<u8>>, delay_ms: u64) -> String {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            let Ok((mut conn, _)) = listener.accept() else { return };
            let mut seen = Vec::new();
            let mut buf = [0u8; 1024];
            while !seen.windows(4).any(|w| w == b"\r\n\r\n") {
                match conn.read(&mut buf) {
                    Ok(0) | Err(_) => return,
                    Ok(n) => seen.extend_from_slice(&buf[..n]),
                }
            }
            let head = format!("HTTP/1.1 {status_line}\r\nContent-Type: application/octet-stream\r\nX-Test: one\r\nX-Test: two\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n");
            if conn.write_all(head.as_bytes()).is_err() {
                return;
            }
            for chunk in chunks {
                std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                if conn.write_all(format!("{:x}\r\n", chunk.len()).as_bytes()).is_err() || conn.write_all(&chunk).is_err() || conn.write_all(b"\r\n").is_err() {
                    return;
                }
            }
            let _ = conn.write_all(b"0\r\n\r\n");
        });
        format!("http://127.0.0.1:{port}/file")
    }

    #[cfg(feature = "fetch")]
    fn meta_of(answer: &str) -> serde_json::Value {
        serde_json::from_str(answer).unwrap()
    }

    #[cfg(feature = "fetch")]
    #[test]
    fn an_http_body_is_read_as_a_stream_and_the_answer_describes_the_response() {
        let body: Vec<u8> = (0..200_000u32).map(|i| (i % 251) as u8).collect();
        let url = serve("200 OK", body.chunks(30_000).map(|c| c.to_vec()).collect(), 5);
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let answer = fetch_command(&s, &format!(r#"{{"url":{url:?}}}"#), Some(1), |_| Ok(()), reqwest::Client::new()).await.unwrap();
            let meta = meta_of(&answer);
            assert_eq!((meta["status"].clone(), meta["ok"].clone(), meta["statusText"].clone()), (200.into(), true.into(), "OK".into()));
            assert_eq!(meta["headers"]["content-type"], "application/octet-stream");
            assert_eq!(meta["headers"]["x-test"], "one, two", "a repeated header is one comma-joined value");
            assert_eq!(meta["url"], url.as_str());
            let id = meta["id"].as_u64().unwrap() as u32;
            assert_eq!(s.capability_of(id).unwrap(), "network");
            let mut got = Vec::new();
            while let Some(chunk) = s.read_next(id).await.unwrap() {
                got.extend(chunk);
            }
            assert_eq!(got, body);
            assert_eq!(s.open_count(), 0, "the end closed the stream");
        });
    }

    #[cfg(feature = "fetch")]
    #[test]
    fn an_error_status_still_opens_the_body_and_a_refused_url_opens_nothing() {
        let url = serve("404 Not Found", vec![b"no such thing".to_vec()], 0);
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let answer = fetch_command(&s, &format!(r#"{{"url":{url:?}}}"#), None, |_| Ok(()), reqwest::Client::new()).await.unwrap();
            let meta = meta_of(&answer);
            assert_eq!((meta["status"].clone(), meta["ok"].clone()), (404.into(), false.into()));
            let id = meta["id"].as_u64().unwrap() as u32;
            assert_eq!(s.read_next(id).await.unwrap().unwrap(), b"no such thing");
            assert_eq!(s.read_next(id).await.unwrap(), None, "then the end");

            // The check runs before anything is sent; its reason is the answer.
            let err = fetch_command(&s, r#"{"url":"http://example.invalid/"}"#, None, |_| Err("not allowed".to_string()), reqwest::Client::new()).await.unwrap_err();
            assert_eq!(err, "not allowed");
            // Bad arguments, and an address nothing listens on.
            assert!(fetch_command(&s, "{}", None, |_| Ok(()), reqwest::Client::new()).await.unwrap_err().contains("invalid arguments"));
            assert!(fetch_command(&s, r#"{"url":"http://127.0.0.1:1/"}"#, None, |_| Ok(()), reqwest::Client::new()).await.is_err());
            assert_eq!(s.open_count(), 0);
        });
    }

    #[cfg(feature = "fetch")]
    #[test]
    fn a_slow_http_consumer_holds_the_connection_back_and_cancel_closes_it() {
        // Many chunks, a queue of one: with nobody reading, the loop stops after the queue and the chunk it holds.
        let url = serve("200 OK", (0..200).map(|_| vec![7u8; 4096]).collect(), 0);
        let s = limits(64, 1, 8);
        runtime().block_on(async {
            let meta = meta_of(&fetch_command(&s, &format!(r#"{{"url":{url:?}}}"#), None, |_| Ok(()), reqwest::Client::new()).await.unwrap());
            let id = meta["id"].as_u64().unwrap() as u32;
            until(|| s.produced(id) >= 1).await;
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            let produced = s.produced(id);
            assert!(produced <= 3, "the response was read {produced} chunks ahead with a queue of 1");
            s.cancel(id);
            assert_eq!(s.open_count(), 0);
        });
    }

    #[cfg(feature = "fetch")]
    #[test]
    fn cancelling_a_stream_under_a_waiting_read_is_an_error_not_a_clean_end() {
        // The server sends its first chunk after half a second, so the read is waiting on an empty queue when the stream is cancelled.
        let url = serve("200 OK", vec![b"late".to_vec()], 500);
        let s = Arc::new(limits(64, 2, 8));
        runtime().block_on(async {
            let meta = meta_of(&fetch_command(&s, &format!(r#"{{"url":{url:?}}}"#), None, |_| Ok(()), reqwest::Client::new()).await.unwrap());
            let id = meta["id"].as_u64().unwrap() as u32;
            let waiting = {
                let s = Arc::clone(&s);
                tokio::spawn(async move { s.read(id, 0).await })
            };
            tokio::time::sleep(std::time::Duration::from_millis(80)).await;
            s.cancel(id);
            let result = tokio::time::timeout(std::time::Duration::from_secs(3), waiting).await.expect("the read did not return").unwrap();
            assert!(result.unwrap_err().contains("not open"), "a cancelled stream must not look like one that ended");
        });
    }

    #[cfg(feature = "fetch")]
    #[test]
    fn an_http_body_can_be_piped_straight_into_a_file() {
        let dir = temp_dir("download");
        let body: Vec<u8> = (0..500_000u32).map(|i| (i * 7 % 256) as u8).collect();
        let url = serve("200 OK", body.chunks(16 * 1024).map(|c| c.to_vec()).collect(), 0);
        let s = limits(64, 2, 8);
        runtime().block_on(async {
            let meta = meta_of(&fetch_command(&s, &format!(r#"{{"url":{url:?}}}"#), None, |_| Ok(()), reqwest::Client::new()).await.unwrap());
            let r = meta["id"].as_u64().unwrap() as u32;
            let w = s.open_write(&dir.join("download.bin"), false).await.unwrap();
            assert_eq!(s.pipe(r, w).await.unwrap(), body.len() as u64);
            assert_eq!(std::fs::read(dir.join("download.bin")).unwrap(), body);
        });
        std::fs::remove_dir_all(dir).ok();
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

    // ── child processes ──────────────────────────────────────────────────────────────────────────────────────────────────────────
    // The tests build their commands directly (the shell checks sit in the command layer), from programs every machine has.

    #[cfg(all(feature = "shell", windows))]
    fn shell_line(line: &str) -> tokio::process::Command {
        let mut c = tokio::process::Command::new("cmd");
        c.arg("/C").arg(line);
        c
    }

    #[cfg(all(feature = "shell", unix))]
    fn shell_line(line: &str) -> tokio::process::Command {
        let mut c = tokio::process::Command::new("sh");
        c.arg("-c").arg(line);
        c
    }

    /// A command line that runs for about `secs` seconds and then creates `marker`, so a test can tell whether it was killed.
    #[cfg(all(feature = "shell", windows))]
    fn slow_then_marker(secs: u32, marker: &Path) -> String {
        // No quotes around the path: Rust escapes a quote inside an argument in a way `cmd` does not undo (the temp directory has no spaces).
        assert!(!marker.to_string_lossy().contains(' '), "the temp directory has a space in its path: {}", marker.display());
        format!("ping -n {} 127.0.0.1 >nul & echo alive>{}", secs + 1, marker.display())
    }

    #[cfg(all(feature = "shell", unix))]
    fn slow_then_marker(secs: u32, marker: &Path) -> String {
        format!("sleep {secs}; echo alive > '{}'", marker.display())
    }

    #[cfg(feature = "shell")]
    fn opts(stdout: bool, stderr: bool, stdin: bool, timeout_ms: Option<u64>) -> SpawnOptions {
        SpawnOptions { stdout, stderr, stdin, timeout: timeout_ms.map(std::time::Duration::from_millis) }
    }

    #[cfg(feature = "shell")]
    async fn drain(s: &Streams, id: u32) -> Vec<u8> {
        let mut out = Vec::new();
        while let Some(chunk) = s.read_next(id).await.unwrap() {
            out.extend(chunk);
        }
        out
    }

    #[cfg(feature = "shell")]
    #[test]
    fn a_process_output_arrives_as_streams_and_wait_reports_how_it_ended() {
        let s = limits(64, 2, 16);
        runtime().block_on(async {
            let sp = s.open_spawn_for(shell_line("echo hello from the child"), &opts(true, true, false, None), Some(1)).unwrap();
            assert!(sp.pid.is_some() && sp.stdin.is_none());
            assert_eq!(s.capability_of(sp.process).unwrap(), "shellExec");
            assert_eq!(s.capability_of(sp.stdout.unwrap()).unwrap(), "shellExec");
            let out = String::from_utf8_lossy(&drain(&s, sp.stdout.unwrap()).await).into_owned();
            assert!(out.contains("hello from the child"), "{out:?}");
            assert!(drain(&s, sp.stderr.unwrap()).await.is_empty());
            assert_eq!(s.wait_process(sp.process).await.unwrap(), (0, false));
            assert_eq!(s.open_count(), 0, "the ends closed the pipes and the wait closed the process");
            assert!(s.wait_process(sp.process).await.unwrap_err().contains("not open"), "a process is waited for once");
        });
    }

    #[cfg(feature = "shell")]
    #[test]
    fn the_exit_code_and_stderr_come_through() {
        let s = limits(64, 2, 16);
        runtime().block_on(async {
            let sp = s.open_spawn_for(shell_line("echo oops 1>&2 & exit 3"), &opts(true, true, false, None), None).unwrap();
            let err = String::from_utf8_lossy(&drain(&s, sp.stderr.unwrap()).await).into_owned();
            drain(&s, sp.stdout.unwrap()).await;
            assert!(err.contains("oops"), "{err:?}");
            assert_eq!(s.wait_process(sp.process).await.unwrap(), (3, false));
        });
    }

    #[cfg(all(feature = "shell", windows))]
    const ECHO_STDIN: &str = "sort";
    #[cfg(all(feature = "shell", unix))]
    const ECHO_STDIN: &str = "cat";

    #[cfg(feature = "shell")]
    #[test]
    fn what_is_written_to_stdin_reaches_the_child_and_closing_it_ends_the_input() {
        let s = limits(64, 2, 16);
        runtime().block_on(async {
            let sp = s.open_spawn_for(shell_line(ECHO_STDIN), &opts(true, false, true, None), None).unwrap();
            let stdin = sp.stdin.unwrap();
            s.write(stdin, b"typed into the child\r\n".to_vec()).await.unwrap();
            // Closing flushes and ends the input: without it `sort` and `cat` would wait forever.
            s.close(stdin).await.unwrap();
            let out = String::from_utf8_lossy(&drain(&s, sp.stdout.unwrap()).await).into_owned();
            assert!(out.contains("typed into the child"), "{out:?}");
            assert_eq!(s.wait_process(sp.process).await.unwrap().0, 0);
        });
    }

    #[cfg(feature = "shell")]
    #[test]
    fn the_marker_command_really_writes_its_marker_when_left_alone() {
        // The control for the kill, timeout and window tests below, which assert the marker is absent: this shows its absence means something.
        let dir = temp_dir("marker-control");
        let marker = dir.join("alive.txt");
        let s = limits(64, 2, 16);
        runtime().block_on(async {
            let sp = s.open_spawn_for(shell_line(&slow_then_marker(1, &marker)), &opts(false, false, false, None), None).unwrap();
            assert_eq!(s.wait_process(sp.process).await.unwrap(), (0, false));
            assert!(marker.exists(), "the command line that the kill tests use does not write its marker, so they prove nothing");
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[cfg(feature = "shell")]
    #[test]
    fn killing_a_process_stops_it_before_it_finishes() {
        let dir = temp_dir("kill");
        let marker = dir.join("alive.txt");
        let s = limits(64, 2, 16);
        runtime().block_on(async {
            let sp = s.open_spawn_for(shell_line(&slow_then_marker(2, &marker)), &opts(true, true, false, None), None).unwrap();
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
            s.kill_process(sp.process).unwrap();
            let started = std::time::Instant::now();
            let (code, timed_out) = tokio::time::timeout(std::time::Duration::from_secs(5), s.wait_process(sp.process)).await.expect("wait did not return").unwrap();
            assert_eq!((code, timed_out), (-1, false), "a killed process reports -1");
            assert!(started.elapsed() < std::time::Duration::from_secs(1), "the kill was not prompt");
            // Its pipes end (nothing more will come) and the command that was going to run afterwards never did.
            drain(&s, sp.stdout.unwrap()).await;
            drain(&s, sp.stderr.unwrap()).await;
            tokio::time::sleep(std::time::Duration::from_millis(2500)).await;
            assert!(!marker.exists(), "the process kept running after it was killed");
            assert!(s.kill_process(sp.process).unwrap_err().contains("not open"), "nothing left to kill");
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[cfg(feature = "shell")]
    #[test]
    fn a_process_that_runs_too_long_is_killed_and_wait_says_so() {
        let dir = temp_dir("timeout");
        let marker = dir.join("alive.txt");
        let s = limits(64, 2, 16);
        runtime().block_on(async {
            let sp = s.open_spawn_for(shell_line(&slow_then_marker(3, &marker)), &opts(false, false, false, Some(300)), None).unwrap();
            assert!(sp.stdout.is_none() && sp.stderr.is_none(), "ignored pipes are not opened");
            let started = std::time::Instant::now();
            let (_, timed_out) = tokio::time::timeout(std::time::Duration::from_secs(5), s.wait_process(sp.process)).await.expect("wait did not return").unwrap();
            assert!(timed_out);
            assert!(started.elapsed() < std::time::Duration::from_secs(2));
            tokio::time::sleep(std::time::Duration::from_millis(3500)).await;
            assert!(!marker.exists(), "the process kept running after its timeout");
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[cfg(feature = "shell")]
    #[test]
    fn closing_a_window_kills_the_processes_it_started() {
        let dir = temp_dir("window-kill");
        let marker = dir.join("alive.txt");
        let s = limits(64, 2, 16);
        runtime().block_on(async {
            let mine = s.open_spawn_for(shell_line(&slow_then_marker(2, &marker)), &opts(true, true, false, None), Some(8)).unwrap();
            let other = s.open_spawn_for(shell_line("echo still here"), &opts(true, false, false, None), Some(9)).unwrap();
            assert_eq!(s.open_count(), 5);
            assert_eq!(s.close_window(8), 3, "the process and its two pipes");
            assert_eq!(s.open_count(), 2, "the other window's are untouched");
            assert!(String::from_utf8_lossy(&drain(&s, other.stdout.unwrap()).await).contains("still here"));
            s.wait_process(other.process).await.unwrap();
            let _ = mine;
            tokio::time::sleep(std::time::Duration::from_millis(2500)).await;
            assert!(!marker.exists(), "the window's process outlived it");
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[cfg(feature = "shell")]
    #[test]
    fn a_child_that_nobody_reads_is_held_back_by_the_full_pipe() {
        let dir = temp_dir("backpressure-proc");
        // Plain text, so `type` prints all of it (it stops at the end-of-file character of a binary file).
        let big = dir.join("big.txt");
        std::fs::write(&big, "abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnop
".repeat(180_000)).unwrap();
        let s = Arc::new(limits(64, 1, 16));
        runtime().block_on(async {
            #[cfg(windows)]
            let line = format!("type {}", big.display());
            #[cfg(unix)]
            let line = format!("cat '{}'", big.display());
            let sp = s.open_spawn_for(shell_line(&line), &opts(true, false, false, None), None).unwrap();
            let out = sp.stdout.unwrap();
            until(|| s.produced(out) >= 1).await;
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
            assert!(s.produced(out) <= 3, "the output was read {} chunks ahead of a consumer that never reads", s.produced(out));
            // And the child has not finished: it is blocked writing into the full pipe.
            let finished = tokio::time::timeout(std::time::Duration::from_millis(100), s.wait_process(sp.process)).await;
            assert!(finished.is_err(), "a 16 MiB output finished while nobody read it");
            s.cancel(out);
            s.kill_process(sp.process).ok();
        });
        std::fs::remove_dir_all(dir).ok();
    }

    #[cfg(feature = "shell")]
    #[test]
    fn a_spawn_needs_room_for_all_its_streams_or_starts_nothing() {
        let s = limits(64, 2, 3);
        runtime().block_on(async {
            // A process with both pipes is three entries: it fits exactly.
            let first = s.open_spawn_for(shell_line("echo one"), &opts(true, true, false, None), None).unwrap();
            assert_eq!(s.open_count(), 3);
            let err = s.open_spawn_for(shell_line("echo two"), &opts(true, false, false, None), None).err().unwrap();
            assert!(err.contains("a process needs 2") && err.contains("streams.maxOpen"), "{err}");
            assert_eq!(s.open_count(), 3, "nothing was started");
            s.close_window(0);
            s.cancel(first.process);
            s.cancel(first.stdout.unwrap());
            s.cancel(first.stderr.unwrap());
        });
    }

    #[cfg(feature = "shell")]
    #[test]
    fn the_spawn_command_checks_its_arguments_and_the_request() {
        let s = limits(64, 2, 16);
        let echo = |_: &str, _: &[String]| Ok(shell_line("echo hi"));
        runtime().block_on(async {
            let answer: serde_json::Value = serde_json::from_str(&spawn_command(&s, r#"{"bin":"echo","stdin":true,"stderr":"ignore"}"#, Some(2), echo).unwrap()).unwrap();
            assert!(answer["process"].is_u64() && answer["stdout"].is_u64() && answer["stdin"].is_u64() && answer["pid"].is_u64());
            assert!(answer["stderr"].is_null());
            assert!(spawn_command(&s, "{}", None, echo).unwrap_err().contains("invalid arguments"));
            assert!(spawn_command(&s, r#"{"bin":"echo","stdout":"merge"}"#, None, echo).unwrap_err().contains("must be \"pipe\" or \"ignore\""));
            // The shell checks are the caller's `prepare`: its refusal is the answer and nothing starts.
            let before = s.open_count();
            let err = spawn_command(&s, r#"{"bin":"git"}"#, None, |bin, _| Err(format!("shellExec.allow[\"{bin}\"]"))).unwrap_err();
            assert_eq!(err, "shellExec.allow[\"git\"]");
            assert_eq!(s.open_count(), before);
            s.close_window(0);
            s.close_window(2);
        });
    }

    #[cfg(feature = "shell")]
    #[test]
    fn a_wait_or_kill_needs_the_capability_that_opened_the_process() {
        let s = limits(64, 2, 16);
        runtime().block_on(async {
            let sp = s.open_spawn_for(shell_line("echo hi"), &opts(true, false, false, None), None).unwrap();
            let none = |_: &str| false;
            let err = wait_command(&s, &format!(r#"{{"id":{}}}"#, sp.process), &none).await.unwrap_err();
            assert!(err.contains("missing capability \"shellExec\""), "{err}");
            let yes = |_: &str| true;
            let answer = wait_command(&s, &format!(r#"{{"id":{}}}"#, sp.process), &yes).await.unwrap();
            assert!(answer.contains("\"exitCode\":0"), "{answer}");
            s.cancel(sp.stdout.unwrap());
        });
    }

    #[test]
    fn the_default_limits_come_from_the_settings() {
        let l = Limits::from_settings();
        assert_eq!(l, Limits { chunk_bytes: 256 * 1024, queue_chunks: 2, max_open: 64 });
    }
}
