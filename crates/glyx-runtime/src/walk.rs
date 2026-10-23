//! `fs.walk`: a recursive directory walk, streamed.
//!
//! Walking a tree from JavaScript with `listDir` is one native call per directory, and a project with 100,000 files and 10,000 directories
//! is 10,000 round trips plus a `stat` per file. Here the walk runs on one blocking thread on the native side
//! and its entries travel through the file-stream machinery in `streams.rs`: batched into chunks of newline-free JSON, in a bounded queue
//! that the walker waits on when JavaScript is slow, so memory is flat however big the tree is.
//!
//! - **What is reported.** Every file, directory and link under the root (not the root itself), directories before what is inside them, in
//!   the order the operating system lists them (not sorted). Each entry is `{ path, name, type, size, mtime, depth }`: `type` is `file`,
//!   `dir`, `symlink` or `other`; `size` is the file's length (0 for a directory); `mtime` is milliseconds since the epoch; `depth` is 1
//!   for the root's children.
//! - **Options.** `maxDepth` (1 = the root's children only), `ignore` (globs: one without a `/` matches a name at any depth, one with a `/`
//!   matches the path below the root; an ignored directory is not entered), `type` (`file` or `dir` to report only those), `followLinks`.
//! - **Links** are reported and not entered, which also keeps a loop from running forever. With `followLinks` a link to a directory is entered
//!   when its target is inside the app's `fs.read` grant (checked on the canonical path) and has not been entered before.
//! - **Errors are skipped, not fatal.** A directory that cannot be read, an entry that vanished, a link that leaves the grant: counted, and
//!   the last chunk carries `{ "$summary": { skipped, errors } }` (the first 20 reasons).

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, UNIX_EPOCH};

use globset::{Glob, GlobBuilder, GlobSet, GlobSetBuilder};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

/// The most reasons the summary carries.
const MAX_ERRORS: usize = 20;
/// A batch is sent at least this often while entries are coming, so a consumer sees progress in a big tree.
const FLUSH_EVERY: Duration = Duration::from_millis(100);

#[derive(Deserialize)]
pub(crate) struct WalkArgs {
    pub path: String,
    #[serde(rename = "maxDepth")]
    pub max_depth: Option<u32>,
    #[serde(default)]
    pub ignore: Vec<String>,
    #[serde(rename = "followLinks")]
    pub follow_links: Option<bool>,
    #[serde(rename = "type")]
    pub kind: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Kind {
    File,
    Dir,
}

pub(crate) struct WalkOptions {
    max_depth: Option<u32>,
    follow_links: bool,
    only: Option<Kind>,
    /// Patterns without a `/`: matched against an entry's name.
    names: GlobSet,
    /// Patterns with a `/`: matched against the path below the root, with `/` separators.
    paths: GlobSet,
}

impl WalkOptions {
    pub(crate) fn from_args(a: &WalkArgs) -> Result<WalkOptions, String> {
        let only = match a.kind.as_deref() {
            None => None,
            Some("file") => Some(Kind::File),
            Some("dir") => Some(Kind::Dir),
            Some(other) => return Err(format!("type must be \"file\" or \"dir\", not {other:?}")),
        };
        if a.max_depth == Some(0) {
            return Err("maxDepth must be 1 or more (1 is the root's children only)".to_string());
        }
        let (mut names, mut paths) = (GlobSetBuilder::new(), GlobSetBuilder::new());
        for pattern in &a.ignore {
            let cleaned = pattern.trim().trim_start_matches("./").trim_end_matches('/').replace('\\', "/");
            if cleaned.is_empty() {
                continue;
            }
            let glob = |p: &str| -> Result<Glob, String> {
                GlobBuilder::new(p).literal_separator(true).build().map_err(|e| format!("ignore pattern {pattern:?}: {e}"))
            };
            if cleaned.contains('/') {
                paths.add(glob(&cleaned)?);
            } else {
                names.add(glob(&cleaned)?);
            }
        }
        Ok(WalkOptions {
            max_depth: a.max_depth,
            follow_links: a.follow_links.unwrap_or(false),
            only,
            names: names.build().map_err(|e| e.to_string())?,
            paths: paths.build().map_err(|e| e.to_string())?,
        })
    }

    fn ignored(&self, name: &str, rel: &str) -> bool {
        self.names.is_match(name) || self.paths.is_match(rel)
    }
}

#[derive(Serialize)]
struct EntryJson<'a> {
    path: &'a str,
    name: &'a str,
    #[serde(rename = "type")]
    kind: &'static str,
    size: u64,
    mtime: u64,
    depth: u32,
}

#[derive(Serialize)]
struct ErrorJson {
    path: String,
    error: String,
}

#[derive(Serialize)]
struct Summary {
    skipped: usize,
    errors: Vec<ErrorJson>,
}

/// The batch being built, and what to do with it.
struct Batcher<'a> {
    buf: String,
    chunk_bytes: usize,
    last_flush: Instant,
    tx: &'a mpsc::Sender<Result<Vec<u8>, String>>,
    produced: &'a std::sync::atomic::AtomicUsize,
}

impl Batcher<'_> {
    fn push(&mut self, json: &str) -> bool {
        if !self.buf.is_empty() {
            self.buf.push(',');
        }
        self.buf.push_str(json);
        if self.buf.len() >= self.chunk_bytes || self.last_flush.elapsed() >= FLUSH_EVERY {
            return self.flush();
        }
        true
    }

    /// Send what is built. `false` when the consumer is gone (the stream was closed): the walk should stop.
    fn flush(&mut self) -> bool {
        self.last_flush = Instant::now();
        if self.buf.is_empty() {
            return true;
        }
        let chunk = std::mem::take(&mut self.buf).into_bytes();
        self.produced.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        // Waits while the queue is full: the backpressure.
        self.tx.blocking_send(Ok(chunk)).is_ok()
    }
}

/// Walk `root` and send its entries through `tx` in batches of about `chunk_bytes`. Runs on a blocking thread, and ends early when `stop` is set
/// or the consumer is gone. `follow_target` decides whether a link may be entered: it gets the link's path and returns the canonical target, or
/// `None` when the target is outside the app's grant.
pub(crate) fn run_walk(
    root: &Path,
    opts: &WalkOptions,
    chunk_bytes: usize,
    tx: &mpsc::Sender<Result<Vec<u8>, String>>,
    produced: &std::sync::atomic::AtomicUsize,
    stop: &std::sync::atomic::AtomicBool,
    follow_target: impl Fn(&Path) -> Option<PathBuf>,
) {
    let mut out = Batcher { buf: String::new(), chunk_bytes, last_flush: Instant::now(), tx, produced };
    let mut skipped = 0usize;
    let mut errors: Vec<ErrorJson> = Vec::new();
    let mut skip = |path: &Path, why: String| {
        skipped += 1;
        if errors.len() < MAX_ERRORS {
            errors.push(ErrorJson { path: path.to_string_lossy().into_owned(), error: why });
        }
    };
    // Directories already entered through a followed link (by canonical path), so a link back up the tree ends.
    let mut entered: HashSet<PathBuf> = HashSet::new();
    if opts.follow_links {
        if let Ok(c) = root.canonicalize() {
            entered.insert(c);
        }
    }

    // (directory, its depth: the root is 0)
    let mut stack: Vec<(PathBuf, u32)> = vec![(root.to_path_buf(), 0)];
    while let Some((dir, depth)) = stack.pop() {
        if stop.load(std::sync::atomic::Ordering::Relaxed) {
            return;
        }
        let reader = match std::fs::read_dir(&dir) {
            Ok(r) => r,
            Err(e) => {
                skip(&dir, e.to_string());
                continue;
            }
        };
        for item in reader {
            if stop.load(std::sync::atomic::Ordering::Relaxed) {
                return;
            }
            let entry = match item {
                Ok(e) => e,
                Err(e) => {
                    skip(&dir, e.to_string());
                    continue;
                }
            };
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            let rel = path.strip_prefix(root).map(|r| r.to_string_lossy().replace('\\', "/")).unwrap_or_else(|_| name.clone());
            if opts.ignored(&name, &rel) {
                continue;
            }
            let (file_type, meta) = match (entry.file_type(), entry.metadata()) {
                (Ok(t), Ok(m)) => (t, m),
                (Err(e), _) | (_, Err(e)) => {
                    skip(&path, e.to_string());
                    continue;
                }
            };
            let is_link = file_type.is_symlink();
            let kind = if is_link {
                "symlink"
            } else if file_type.is_dir() {
                "dir"
            } else if file_type.is_file() {
                "file"
            } else {
                "other"
            };
            let wanted = match opts.only {
                None => true,
                Some(Kind::File) => kind == "file",
                Some(Kind::Dir) => kind == "dir",
            };
            if wanted {
                let mtime = meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map_or(0, |d| d.as_millis() as u64);
                let size = if kind == "dir" { 0 } else { meta.len() };
                let path_text = path.to_string_lossy();
                let json = serde_json::to_string(&EntryJson { path: &path_text, name: &name, kind, size, mtime, depth: depth + 1 })
                    .unwrap_or_default();
                if !out.push(&json) {
                    return;
                }
            }

            // Descend: into a directory, or (if asked) a link to a directory whose target is allowed and new.
            let can_go_deeper = opts.max_depth.map_or(true, |m| depth + 1 < m);
            if !can_go_deeper {
                continue;
            }
            if kind == "dir" {
                stack.push((path, depth + 1));
            } else if is_link && opts.follow_links && std::fs::metadata(&path).map_or(false, |m| m.is_dir()) {
                match follow_target(&path) {
                    // A target already entered is a loop or a second way in: not entered again.
                    Some(target) => {
                        if entered.insert(target) {
                            stack.push((path, depth + 1));
                        }
                    }
                    None => skip(&path, "the link leads outside what the app may read".to_string()),
                }
            }
        }
    }

    // The last batch carries the summary.
    let summary = serde_json::to_string(&serde_json::json!({ "$summary": Summary { skipped, errors } })).unwrap_or_default();
    if out.push(&summary) {
        out.flush();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, AtomicUsize};

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("glyx-walk-{tag}-{}", std::process::id()));
        std::fs::remove_dir_all(&dir).ok();
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write(path: &Path, bytes: &[u8]) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, bytes).unwrap();
    }

    /// root/a.txt (5 bytes), root/sub/b.txt (7), root/sub/deep/c.txt (9), root/.git/config, root/node_modules/x/y.js
    fn sample_tree(tag: &str) -> PathBuf {
        let root = temp_dir(tag);
        write(&root.join("a.txt"), b"12345");
        write(&root.join("sub/b.txt"), b"1234567");
        write(&root.join("sub/deep/c.txt"), b"123456789");
        write(&root.join(".git/config"), b"[core]");
        write(&root.join("node_modules/x/y.js"), b"//");
        root
    }

    fn args(path: &Path, extra: serde_json::Value) -> WalkArgs {
        let mut v = serde_json::json!({ "path": path.to_string_lossy() });
        v.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
        serde_json::from_value(v).unwrap()
    }

    struct Walked {
        /// `rel/path` -> (type, size, depth)
        entries: std::collections::BTreeMap<String, (String, u64, u64)>,
        summary: serde_json::Value,
        batches: usize,
    }

    /// Run a walk to the end with a roomy queue and parse what it sent.
    fn walk(root: &Path, extra: serde_json::Value, chunk_bytes: usize) -> Walked {
        let opts = WalkOptions::from_args(&args(root, extra)).unwrap();
        let (tx, mut rx) = mpsc::channel(10_000);
        let produced = AtomicUsize::new(0);
        run_walk(root, &opts, chunk_bytes, &tx, &produced, &AtomicBool::new(false), |p| p.canonicalize().ok());
        drop(tx);
        let mut entries = std::collections::BTreeMap::new();
        let mut summary = serde_json::Value::Null;
        let mut batches = 0;
        while let Ok(chunk) = rx.try_recv() {
            batches += 1;
            let text = String::from_utf8(chunk.unwrap()).unwrap();
            let items: Vec<serde_json::Value> = serde_json::from_str(&format!("[{text}]")).expect("a batch is comma-joined JSON objects");
            for item in items {
                if item.get("$summary").is_some() {
                    summary = item["$summary"].clone();
                    continue;
                }
                let path = PathBuf::from(item["path"].as_str().unwrap());
                let rel = path.strip_prefix(root).unwrap().to_string_lossy().replace('\\', "/");
                entries.insert(rel, (item["type"].as_str().unwrap().to_string(), item["size"].as_u64().unwrap(), item["depth"].as_u64().unwrap()));
            }
        }
        Walked { entries, summary, batches }
    }

    fn names(w: &Walked) -> Vec<&str> {
        w.entries.keys().map(String::as_str).collect()
    }

    #[test]
    fn a_walk_reports_every_file_and_directory_with_type_size_and_depth() {
        let root = sample_tree("all");
        let w = walk(&root, serde_json::json!({}), 256 * 1024);
        assert_eq!(
            names(&w),
            [".git", ".git/config", "a.txt", "node_modules", "node_modules/x", "node_modules/x/y.js", "sub", "sub/b.txt", "sub/deep", "sub/deep/c.txt"]
        );
        assert_eq!(w.entries["a.txt"], ("file".to_string(), 5, 1));
        assert_eq!(w.entries["sub"], ("dir".to_string(), 0, 1));
        assert_eq!(w.entries["sub/deep/c.txt"], ("file".to_string(), 9, 3));
        assert_eq!(w.summary["skipped"], 0);
        assert_eq!(w.summary["errors"], serde_json::json!([]));
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn max_depth_one_is_the_roots_children_only() {
        let root = sample_tree("depth");
        assert_eq!(names(&walk(&root, serde_json::json!({ "maxDepth": 1 }), 1 << 18)), [".git", "a.txt", "node_modules", "sub"]);
        assert_eq!(
            names(&walk(&root, serde_json::json!({ "maxDepth": 2 }), 1 << 18)),
            [".git", ".git/config", "a.txt", "node_modules", "node_modules/x", "sub", "sub/b.txt", "sub/deep"]
        );
        assert!(WalkOptions::from_args(&args(&root, serde_json::json!({ "maxDepth": 0 }))).is_err());
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn ignored_names_and_paths_are_pruned_and_not_entered() {
        let root = sample_tree("ignore");
        // A name with no slash matches at any depth; the directory is not entered.
        let w = walk(&root, serde_json::json!({ "ignore": [".git", "node_modules"] }), 1 << 18);
        assert_eq!(names(&w), ["a.txt", "sub", "sub/b.txt", "sub/deep", "sub/deep/c.txt"]);
        // A pattern with a slash matches the path below the root; `*` stays inside one name, `**` crosses.
        assert_eq!(names(&walk(&root, serde_json::json!({ "ignore": ["sub/deep"] }), 1 << 18)).contains(&"sub/deep/c.txt"), false);
        assert!(names(&walk(&root, serde_json::json!({ "ignore": ["sub/deep"] }), 1 << 18)).contains(&"sub/b.txt"));
        assert_eq!(names(&walk(&root, serde_json::json!({ "ignore": ["**/*.txt"] }), 1 << 18)).iter().filter(|n| n.ends_with(".txt")).count(), 0, "**/ matches no directories too");
        assert_eq!(names(&walk(&root, serde_json::json!({ "ignore": ["*.txt"] }), 1 << 18)).iter().filter(|n| n.ends_with(".txt")).count(), 0);
        // Trailing and leading decoration is tolerated, and an empty pattern does nothing.
        assert!(!names(&walk(&root, serde_json::json!({ "ignore": ["./node_modules/", "", "  "] }), 1 << 18)).contains(&"node_modules"));
        assert!(WalkOptions::from_args(&args(&root, serde_json::json!({ "ignore": ["[unclosed"] }))).is_err());
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn the_type_option_keeps_only_files_or_only_directories() {
        let root = sample_tree("type");
        let files = walk(&root, serde_json::json!({ "type": "file" }), 1 << 18);
        assert_eq!(names(&files), [".git/config", "a.txt", "node_modules/x/y.js", "sub/b.txt", "sub/deep/c.txt"]);
        let dirs = walk(&root, serde_json::json!({ "type": "dir" }), 1 << 18);
        assert_eq!(names(&dirs), [".git", "node_modules", "node_modules/x", "sub", "sub/deep"]);
        assert!(WalkOptions::from_args(&args(&root, serde_json::json!({ "type": "link" }))).is_err());
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn a_big_tree_arrives_in_several_batches_each_under_the_size_asked_for() {
        let root = temp_dir("batches");
        for i in 0..400 {
            write(&root.join(format!("dir{}/file{i}.dat", i % 20)), b"x");
        }
        let w = walk(&root, serde_json::json!({ "type": "file" }), 4 * 1024);
        assert_eq!(w.entries.len(), 400);
        assert!(w.batches >= 5, "{} batches for 400 entries with a 4 KiB batch size", w.batches);
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn a_walk_stops_when_the_consumer_is_gone() {
        let root = temp_dir("cancel");
        for i in 0..2000 {
            write(&root.join(format!("d{}/f{i}", i % 10)), b"x");
        }
        let opts = WalkOptions::from_args(&args(&root, serde_json::json!({}))).unwrap();
        // A queue of one chunk and a tiny batch size: the walker blocks on the second send, then the receiver goes away.
        let (tx, rx) = mpsc::channel(1);
        let produced = AtomicUsize::new(0);
        let started = Instant::now();
        std::thread::scope(|s| {
            let handle = s.spawn(|| run_walk(&root, &opts, 64, &tx, &produced, &AtomicBool::new(false), |p| p.canonicalize().ok()));
            std::thread::sleep(Duration::from_millis(150));
            let before = produced.load(std::sync::atomic::Ordering::Relaxed);
            assert!(before <= 3, "the walker ran ahead by {before} batches with a queue of 1");
            drop(rx);
            handle.join().unwrap();
        });
        assert!(started.elapsed() < Duration::from_secs(5), "the walk did not stop");
        assert!(produced.load(std::sync::atomic::Ordering::Relaxed) < 20, "it kept walking after the consumer left");
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn an_unreadable_root_is_counted_not_fatal() {
        let root = temp_dir("unreadable");
        let missing = root.join("does-not-exist");
        let w = walk(&missing, serde_json::json!({}), 1 << 18);
        assert!(w.entries.is_empty());
        assert_eq!(w.summary["skipped"], 1);
        assert!(!w.summary["errors"][0]["error"].as_str().unwrap().is_empty());
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn a_stop_flag_ends_the_walk() {
        let root = sample_tree("stopflag");
        let opts = WalkOptions::from_args(&args(&root, serde_json::json!({}))).unwrap();
        let (tx, mut rx) = mpsc::channel(100);
        run_walk(&root, &opts, 1 << 18, &tx, &AtomicUsize::new(0), &AtomicBool::new(true), |p| p.canonicalize().ok());
        drop(tx);
        assert!(rx.try_recv().is_err(), "a walk that was told to stop sent something");
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn a_link_the_grant_refuses_is_skipped_and_counted() {
        // The target is outside what the app may read, so the link is not entered.
        let root = sample_tree("skip");
        let target = temp_dir("skip-target");
        write(&target.join("secret.txt"), b"s");
        let link = root.join("link");
        if make_dir_link(&target, &link).is_err() {
            eprintln!("skipped: cannot create a directory link here (Windows needs developer mode or elevation)");
            std::fs::remove_dir_all(root).ok();
            std::fs::remove_dir_all(target).ok();
            return;
        }
        let opts = WalkOptions::from_args(&args(&root, serde_json::json!({ "followLinks": true }))).unwrap();
        let (tx, mut rx) = mpsc::channel(100);
        let produced = AtomicUsize::new(0);
        run_walk(&root, &opts, 1 << 18, &tx, &produced, &AtomicBool::new(false), |_| None);
        drop(tx);
        let mut text = String::new();
        while let Ok(chunk) = rx.try_recv() {
            text.push_str(&String::from_utf8(chunk.unwrap()).unwrap());
            text.push(',');
        }
        let items: Vec<serde_json::Value> = serde_json::from_str(&format!("[{}]", text.trim_end_matches(','))).unwrap();
        let summary = items.iter().find_map(|i| i.get("$summary")).expect("a summary");
        assert_eq!(summary["skipped"], 1);
        assert!(summary["errors"][0]["error"].as_str().unwrap().contains("outside"), "{summary}");
        assert!(!items.iter().any(|i| i["name"] == "secret.txt"), "the walk entered a link the grant refused");
        std::fs::remove_dir_all(root).ok();
        std::fs::remove_dir_all(target).ok();
    }

    #[test]
    fn links_are_reported_and_not_entered_unless_asked_and_loops_end() {
        let root = sample_tree("links");
        let link = root.join("sub/up");
        if make_dir_link(&root, &link).is_err() {
            eprintln!("skipped: cannot create a directory link here (Windows needs developer mode or elevation)");
            std::fs::remove_dir_all(root).ok();
            return;
        }
        // Default: the link is an entry of type symlink, and nothing below it is listed.
        let w = walk(&root, serde_json::json!({}), 1 << 18);
        assert_eq!(w.entries["sub/up"].0, "symlink");
        assert!(!names(&w).iter().any(|n| n.starts_with("sub/up/")), "{:?}", names(&w));
        // Followed, a link back to the root is already entered, so the walk finishes and lists no second copy of the tree.
        let w = walk(&root, serde_json::json!({ "followLinks": true }), 1 << 18);
        assert_eq!(w.entries["sub/up"].0, "symlink");
        assert!(!names(&w).iter().any(|n| n.starts_with("sub/up/")), "{:?}", names(&w));
        std::fs::remove_dir_all(root).ok();
    }

    /// Native speed of the walk alone (no JavaScript, no parsing): `GLYX_WALK_BENCH_ROOT=<tree> cargo test -p glyx-runtime --lib bench_walk -- --ignored --nocapture`.
    #[test]
    #[ignore = "a benchmark: needs GLYX_WALK_BENCH_ROOT"]
    fn bench_walk_throughput() {
        let Ok(root) = std::env::var("GLYX_WALK_BENCH_ROOT") else { return };
        let root = PathBuf::from(root);
        let opts = WalkOptions::from_args(&args(&root, serde_json::json!({}))).unwrap();
        let (tx, mut rx) = mpsc::channel(100_000);
        let started = Instant::now();
        run_walk(&root, &opts, 256 * 1024, &tx, &AtomicUsize::new(0), &AtomicBool::new(false), |p| p.canonicalize().ok());
        drop(tx);
        let mut entries = 0usize;
        let mut bytes = 0usize;
        while let Ok(chunk) = rx.try_recv() {
            let chunk = chunk.unwrap();
            bytes += chunk.len();
            entries += chunk.iter().filter(|b| **b == b'{').count();
        }
        let secs = started.elapsed().as_secs_f64();
        println!("walked about {entries} objects ({} MB of JSON) in {secs:.2} s: {:.0} entries/s", bytes / 1_000_000, entries as f64 / secs);
    }

    #[cfg(windows)]
    fn make_dir_link(target: &Path, link: &Path) -> std::io::Result<()> {
        std::os::windows::fs::symlink_dir(target, link)
    }

    #[cfg(unix)]
    fn make_dir_link(target: &Path, link: &Path) -> std::io::Result<()> {
        std::os::unix::fs::symlink(target, link)
    }
}
