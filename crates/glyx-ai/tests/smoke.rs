//! Real runs of the three models, for checking that local AI still works and what it costs. They download models (about 22 MB, 75 MB and 1.7 GB the
//! first time) and take minutes, so they are ignored by default:
//!
//! ```text
//! cargo test --release -p glyx-ai --test smoke -- --ignored --nocapture embed
//! GLYX_AI_AUDIO="<speech .wav>;<speech .mp3>" cargo test --release -p glyx-ai --test smoke -- --ignored --nocapture whisper
//! cargo test --release -p glyx-ai --test smoke -- --ignored --nocapture generate
//! ```
//!
//! Use `--release`: candle on the CPU is many times slower unoptimised, and the numbers mean nothing there.

use std::time::Instant;

/// This process's resident memory in MB (what the OS holds right now).
fn rss_mb() -> f64 {
    let mut sys = sysinfo::System::new();
    let pid = sysinfo::get_current_pid().unwrap();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[pid]), true);
    sys.process(pid).map_or(0.0, |p| p.memory() as f64 / 1_048_576.0)
}

/// Samples resident memory while a closure runs and returns the peak.
fn with_peak<R>(f: impl FnOnce() -> R) -> (R, f64) {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    let stop = Arc::new(AtomicBool::new(false));
    let flag = Arc::clone(&stop);
    let sampler = std::thread::spawn(move || {
        let mut peak = 0.0f64;
        while !flag.load(Ordering::Relaxed) {
            peak = peak.max(rss_mb());
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        peak.max(rss_mb())
    });
    let out = f();
    stop.store(true, Ordering::Relaxed);
    (out, sampler.join().unwrap())
}

fn cosine(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

#[test]
#[ignore = "downloads a 22 MB model"]
fn embed() {
    let before = rss_mb();
    let t = Instant::now();
    let (model, peak) = with_peak(|| glyx_ai::EmbedModel::load().expect("load"));
    println!("embed: load {:.2} s, resident {:.0} MB before, peak {:.0} MB, after {:.0} MB", t.elapsed().as_secs_f64(), before, peak, rss_mb());

    let v = |s: &str| model.embed(s).expect("embed");
    let (cat, kitten, stock) = (v("A cat sits on the mat."), v("A kitten is resting on the rug."), v("Stock markets fell sharply on Tuesday."));
    println!("embed: vector length {}, norm {:.4}", cat.len(), cosine(&cat, &cat).sqrt());
    println!("embed: cat~kitten {:.3}, cat~stock {:.3}", cosine(&cat, &kitten), cosine(&cat, &stock));
    assert_eq!(cat.len(), 384);
    assert!(cosine(&cat, &kitten) > cosine(&cat, &stock) + 0.2, "related sentences should be clearly closer (padding bug if not)");

    // Speed per sentence, one at a time (what ai.embed does).
    let sentences: Vec<String> = (0..100).map(|i| format!("Note number {i}: remember to buy milk, eggs and bread for the weekend dinner party.")).collect();
    let t = Instant::now();
    for s in &sentences {
        model.embed(s).unwrap();
    }
    println!("embed: 100 short sentences one by one: {:.0} ms each", t.elapsed().as_secs_f64() * 10.0);

    // A long text: BERT has 512 positions.
    let long = "word ".repeat(3000);
    let t = Instant::now();
    match model.embed(&long) {
        Ok(v) => println!("embed: 3000-word text ok ({} dims) in {:.0} ms", v.len(), t.elapsed().as_secs_f64() * 1000.0),
        Err(e) => println!("embed: 3000-word text FAILS: {e}"),
    }
    let t = Instant::now();
    let _ = model.embed(&"word ".repeat(600));
    println!("embed: 600-word text in {:.0} ms", t.elapsed().as_secs_f64() * 1000.0);
}

#[test]
#[ignore = "downloads a 75 MB model and needs GLYX_AI_AUDIO"]
fn whisper() {
    // One or more audio files (WAV, MP3, FLAC, OGG), separated by `;`.
    let Ok(files) = std::env::var("GLYX_AI_AUDIO") else {
        println!("whisper: set GLYX_AI_AUDIO to speech files, separated by ;");
        return;
    };
    let before = rss_mb();
    let t = Instant::now();
    let (model, peak) = with_peak(|| glyx_ai::WhisperModel::load().expect("load"));
    println!("whisper: load {:.2} s, resident {:.0} MB before, peak {:.0} MB, after {:.0} MB", t.elapsed().as_secs_f64(), before, peak, rss_mb());
    let mut model = model;
    for file in files.split(';').filter(|f| !f.is_empty()) {
        let name = file.rsplit(|c| c == '/' || c == '\\').next().unwrap_or(file);
        let t = Instant::now();
        let (text, peak) = with_peak(|| model.transcribe(file, "en"));
        match text {
            Ok(text) => println!("whisper: {name}: {:.1} s, peak {:.0} MB, transcript: {text:?}", t.elapsed().as_secs_f64(), peak),
            Err(e) => println!("whisper: {name}: FAILS after {:.1} s: {e:#}", t.elapsed().as_secs_f64()),
        }
    }
    // No language given: it is detected from the audio.
    if let Some(file) = files.split(';').find(|f| !f.is_empty()) {
        let t = Instant::now();
        match model.transcribe(file, "") {
            Ok(text) => println!("whisper: language auto-detected: {:.1} s, transcript: {text:?}", t.elapsed().as_secs_f64()),
            Err(e) => println!("whisper: language auto-detect FAILS: {e:#}"),
        }
    }
}

#[test]
#[ignore = "downloads a 1.7 GB model"]
fn generate() {
    let before = rss_mb();
    let t = Instant::now();
    let (model, peak) = with_peak(|| glyx_ai::GenerateModel::load().expect("load"));
    println!("generate: load {:.1} s, resident {:.0} MB before, peak {:.0} MB, after {:.0} MB", t.elapsed().as_secs_f64(), before, peak, rss_mb());
    let mut model = model;

    let prompt = "Instruct: Name the capital of France in one sentence.\nOutput:";
    let t = Instant::now();
    let (out, peak) = with_peak(|| model.generate(prompt, 40, 0.0).expect("generate"));
    let secs = t.elapsed().as_secs_f64();
    println!("generate: greedy, 40 tokens max: {secs:.1} s, peak {peak:.0} MB, output: {out:?}");

    // Prefill against decode speed: time to the first piece of text, then the rate after it.
    for words in [10usize, 60] {
        let prompt = format!("Instruct: Repeat the word below many times.\n{}\nOutput:", "apple ".repeat(words));
        let (mut first, mut pieces) = (None, 0usize);
        let t = Instant::now();
        let out = model
            .generate_stream(&prompt, 24, 0.0, |_| {
                first.get_or_insert(t.elapsed().as_secs_f64());
                pieces += 1;
                true
            })
            .expect("generate");
        let total = t.elapsed().as_secs_f64();
        let first = first.unwrap_or(total);
        println!(
            "generate: prompt of ~{} words: first text after {first:.1} s, {pieces} pieces in {total:.1} s ({:.2} s per piece after the first), output {out:?}",
            words, if pieces > 1 { (total - first) / (pieces - 1) as f64 } else { 0.0 }
        );
    }
}

#[test]
#[ignore = "needs the MiniLM model in the cache"]
fn idle_unload() {
    // Two seconds of idleness instead of five minutes. Set before the first use: the unloading thread reads it each time it wakes.
    std::env::set_var(glyx_ai::IDLE_ENV, "2");
    let slot = glyx_ai::shared_embed();
    let base = rss_mb();
    *slot.lock() = Some(glyx_ai::EmbedModel::load().expect("load"));
    slot.lock().as_ref().unwrap().embed("hello").unwrap();
    let loaded = rss_mb();
    println!("idle_unload: resident {base:.0} MB before, {loaded:.0} MB loaded");

    // In use: the lock is held for longer than the idle time, and the model must still be there afterwards.
    {
        let guard = slot.lock();
        std::thread::sleep(std::time::Duration::from_millis(3500));
        assert!(guard.is_some(), "a model whose slot is locked must not be unloaded");
    }

    // Used just now, so it survives the next check; then unused, so it goes.
    slot.lock().as_ref().unwrap().embed("hello again").unwrap();
    let start = Instant::now();
    while slot.lock().is_some() && start.elapsed().as_secs() < 15 {
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    let after = rss_mb();
    println!("idle_unload: unloaded after {:.1} s idle, resident {after:.0} MB (was {loaded:.0})", start.elapsed().as_secs_f64());
    assert!(slot.lock().is_none(), "the idle model should have been unloaded");
    assert!(start.elapsed().as_secs_f64() >= 1.5, "it was unloaded before the idle time had passed");
}
