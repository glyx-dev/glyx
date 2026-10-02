//! GDP Performance + Animation helpers (M3): perf snapshots and frame
//! records as JSON, and the running-motion diff behind the Animation events.
//! Pure, so they're tested without a window.

use std::collections::{HashMap, HashSet};
use std::time::Instant;

use glyx_perf::{PerfFrame, PerfState};
use serde_json::{json, Value};

use crate::state::PerWindowState;

fn round(ms: f64) -> f64 { (ms * 1000.0).round() / 1000.0 }

/// One frame, camelCase, times in ms rounded to µs.
pub(crate) fn frame_json(f: &PerfFrame) -> Value {
    json!({
        "frameTime": round(f.frame_time_ms),
        "workTime": round(f.cost_ms()),
        "jsTime": round(f.js_time_ms),
        "layoutTime": round(f.layout_time_ms),
        "renderTime": round(f.render_ms),
        "presentTime": round(f.present_ms),
        "damagePx": f.damage_px,
        "partial": f.partial,
        "animating": f.animating,
        "nodeCount": f.node_count,
        "heapUsed": f.heap_used_bytes,
    })
}

fn p99(mut v: Vec<f64>) -> f64 {
    if v.is_empty() { return 0.0; }
    v.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    v[((v.len() as f64 * 0.99).ceil() as usize).clamp(1, v.len()) - 1]
}

fn avg(p: &PerfState, pick: impl Fn(&PerfFrame) -> f64) -> f64 {
    if p.ring.is_empty() { return 0.0; }
    round(p.ring.iter().map(&pick).sum::<f64>() / p.ring.len() as f64)
}

/// `Performance.snapshot`: averages over the recent-frames ring (~5 s),
/// p99, how many frames broke the budget, memory, and the last frame.
pub(crate) fn snapshot_json(p: &PerfState) -> Value {
    let last = p.ring.back().copied().unwrap_or_default();
    let partial = p.ring.iter().filter(|f| f.partial).count();
    json!({
        "frames": p.ring.len(),
        "fps": round(p.fps()),
        "budgetMs": round(p.budget_ms),
        "overBudget": p.over_budget(),
        "p99FrameTime": round(p.p99_frame_time()),
        "p99WorkTime": round(p99(p.ring.iter().map(PerfFrame::cost_ms).collect())),
        "average": {
            "frameTime": avg(p, |f| f.frame_time_ms),
            "workTime": avg(p, PerfFrame::cost_ms),
            "jsTime": avg(p, |f| f.js_time_ms),
            "layoutTime": avg(p, |f| f.layout_time_ms),
            "renderTime": avg(p, |f| f.render_ms),
            "presentTime": avg(p, |f| f.present_ms),
            "damagePx": avg(p, |f| f.damage_px as f64),
        },
        "partialFrames": partial,
        "memory": {
            "heapUsed": last.heap_used_bytes,
            "heapTotal": last.heap_total_bytes,
            "processRss": last.process_rss_bytes,
            "gpuBuffers": last.gpu_buffer_bytes,
            "gpuTextures": last.gpu_texture_bytes,
        },
        "last": frame_json(&last),
    })
}

/// `Performance.getViolations` / `getLeakWarnings`: history entries of
/// `kind` after `since`, with each entry's JSON parsed.
pub(crate) fn history_json(p: &PerfState, kind: &str, since: u64) -> Value {
    let entries: Vec<Value> = p.history_since(since)
        .filter(|(_, k, _)| *k == kind)
        .map(|(seq, _, data)| json!({
            "seq": seq,
            "data": serde_json::from_str::<Value>(data).unwrap_or_else(|_| json!(data)),
        }))
        .collect();
    json!({ "entries": entries, "lastSeq": p.history_seq })
}

// ── Running motion ──────────────────────────────────────────────────────────

/// One run of a transition or keyframe animation. The start time tells a
/// restart (same node, new run) apart from the same run continuing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) struct MotionKey {
    pub kind: &'static str,
    pub node: u32,
    pub start: Instant,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct MotionInfo {
    pub duration_ms: u32,
    /// Keyframe iterations (`f32::INFINITY` = forever); 1 for transitions.
    pub iterations: f32,
}

/// What's animating in a window right now (settled keyframe animations
/// excluded: they no longer drive frames).
pub(crate) fn running_motion(s: &PerWindowState) -> HashMap<MotionKey, MotionInfo> {
    let mut out = HashMap::new();
    for (&node, t) in &s.transitions {
        out.insert(MotionKey { kind: "transition", node, start: t.start },
                   MotionInfo { duration_ms: t.duration_ms, iterations: 1.0 });
    }
    for (&node, a) in &s.animations {
        if a.settled { continue; }
        out.insert(MotionKey { kind: "animation", node, start: a.start },
                   MotionInfo { duration_ms: a.spec.duration_ms, iterations: a.spec.iterations });
    }
    for (&node, c) in &s.canvas_tweens {
        out.insert(MotionKey { kind: "canvas", node, start: c.start() },
                   MotionInfo { duration_ms: c.duration_ms, iterations: 1.0 });
    }
    out
}

/// `Animation.list`: what's running, with how far along each run is on the
/// motion clock, its easing and what it animates.
pub(crate) fn motion_list(s: &PerWindowState) -> Vec<Value> {
    let now = s.motion_clock.now();
    let elapsed = |start: Instant| now.saturating_duration_since(start).as_secs_f64() * 1000.0;
    let mut out: Vec<(u32, Value)> = Vec::new();
    for (&node, t) in &s.transitions {
        let e = elapsed(t.start);
        out.push((node, json!({
            "nodeId": node, "kind": "transition", "durationMs": t.duration_ms, "iterations": 1,
            "elapsedMs": round(e), "progress": round((e / t.duration_ms.max(1) as f64).min(1.0)),
            "easing": if t.is_spring() { "spring".to_string() } else { format!("{:?}", t.easing) },
            "spring": t.is_spring(), "properties": t.properties(),
        })));
    }
    for (&node, a) in &s.animations {
        if a.settled { continue; }
        let e = elapsed(a.start);
        let d = a.spec.duration_ms.max(1) as f64;
        out.push((node, json!({
            "nodeId": node, "kind": "animation", "durationMs": a.spec.duration_ms,
            "iterations": if a.spec.iterations.is_finite() { json!(a.spec.iterations) } else { json!("infinite") },
            "elapsedMs": round(e), "progress": round((e % d) / d), "iteration": (e / d).floor() as u64,
            "easing": format!("{:?}", a.spec.easing), "alternate": a.spec.alternate, "keyframes": a.spec.stops.len(),
        })));
    }
    for (&node, c) in &s.canvas_tweens {
        let e = elapsed(c.start());
        out.push((node, json!({
            "nodeId": node, "kind": "canvas", "durationMs": c.duration_ms, "iterations": 1,
            "elapsedMs": round(e), "progress": round((e / c.duration_ms.max(1) as f64).min(1.0)),
            "easing": if c.is_spring() { "spring" } else { "timed" }, "spring": c.is_spring(),
        })));
    }
    out.sort_by_key(|(n, _)| *n);
    out.into_iter().map(|(_, v)| v).collect()
}

pub(crate) fn motion_json(key: &MotionKey, info: &MotionInfo) -> Value {
    json!({
        "nodeId": key.node,
        "kind": key.kind,
        "durationMs": info.duration_ms,
        "iterations": if info.iterations.is_finite() { json!(info.iterations) } else { json!("infinite") },
    })
}

/// Motion events since the previous look: runs that started, runs that
/// ended, and whether the window just became still (`settled`).
#[derive(Debug, Default, PartialEq)]
pub(crate) struct MotionChanges {
    pub started: Vec<(MotionKey, MotionInfo)>,
    pub ended: Vec<MotionKey>,
    pub settled: bool,
}

pub(crate) fn diff_motion(prev: &HashSet<MotionKey>, now: &HashMap<MotionKey, MotionInfo>) -> MotionChanges {
    let mut started: Vec<(MotionKey, MotionInfo)> = now.iter()
        .filter(|(k, _)| !prev.contains(k)).map(|(k, i)| (*k, *i)).collect();
    let mut ended: Vec<MotionKey> = prev.iter().filter(|k| !now.contains_key(k)).copied().collect();
    started.sort_by_key(|(k, _)| (k.node, k.kind));
    ended.sort_by_key(|k| (k.node, k.kind));
    MotionChanges { settled: !prev.is_empty() && now.is_empty(), started, ended }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn key(kind: &'static str, node: u32, start: Instant) -> MotionKey { MotionKey { kind, node, start } }
    const INFO: MotionInfo = MotionInfo { duration_ms: 200, iterations: 1.0 };

    #[test]
    fn motion_changes_report_starts_ends_restarts_and_settling() {
        let t0 = Instant::now();
        let t1 = t0 + Duration::from_millis(50);
        let a = key("transition", 1, t0);
        let b = key("animation", 2, t0);

        let c = diff_motion(&HashSet::new(), &HashMap::from([(a, INFO), (b, INFO)]));
        assert_eq!(c.started.len(), 2);
        assert!(c.ended.is_empty() && !c.settled);

        // Node 1 restarts (new start time): one end, one start.
        let a2 = key("transition", 1, t1);
        let c = diff_motion(&HashSet::from([a, b]), &HashMap::from([(a2, INFO), (b, INFO)]));
        assert_eq!(c.started, vec![(a2, INFO)]);
        assert_eq!(c.ended, vec![a]);

        // Everything done: ends plus settled, once.
        let c = diff_motion(&HashSet::from([a2, b]), &HashMap::new());
        assert_eq!(c.ended.len(), 2);
        assert!(c.settled);
        assert!(!diff_motion(&HashSet::new(), &HashMap::new()).settled, "already still is not a new settle");
    }

    #[test]
    fn snapshot_and_history_shapes() {
        let mut p = PerfState::new();
        p.budget_ms = 10.0;
        p.push(PerfFrame { frame_time_ms: 8.0, render_ms: 3.0, present_ms: 1.0, partial: true, damage_px: 100, ..Default::default() });
        p.push(PerfFrame { frame_time_ms: 20.0, render_ms: 5.0, present_ms: 1.0, damage_px: 300, ..Default::default() });
        let s = snapshot_json(&p);
        assert_eq!(s["frames"], 2);
        assert_eq!(s["overBudget"], 1);
        assert_eq!(s["partialFrames"], 1);
        assert_eq!(s["average"]["renderTime"], 4.0);
        assert_eq!(s["average"]["damagePx"], 200.0);
        assert_eq!(s["last"]["frameTime"], 20.0);

        let h = history_json(&p, "violation", 0);
        assert_eq!(h["entries"][0]["seq"], 1);
        assert_eq!(h["entries"][0]["data"]["actual"], 20.0);
        assert_eq!(history_json(&p, "violation", 1)["entries"].as_array().unwrap().len(), 0);
        assert_eq!(history_json(&p, "leak", 0)["entries"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn infinite_iterations_are_spelled_out() {
        let k = key("animation", 3, Instant::now());
        let v = motion_json(&k, &MotionInfo { duration_ms: 1000, iterations: f32::INFINITY });
        assert_eq!(v["iterations"], "infinite");
        assert_eq!(v["kind"], "animation");
    }
}
