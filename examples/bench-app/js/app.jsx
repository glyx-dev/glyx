import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, VirtualizedList, render, perf } from '@glyx-dev/react';

// Runs all four benchmarks sequentially on startup and logs machine-readable
// [bench] lines — for engine-comparison runs (V8 vs QuickJS) without having
// to click through the UI by hand. Leaves the window open afterward so the
// final results stay visible; does NOT quit. The buttons below still work
// for a manual re-run.
const AUTORUN = true;

function Button({ title, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: '#2a2a3a', padding: 10, borderRadius: 6, marginBottom: 4, alignItems: 'center' }}>
      <Text style={{ color: '#e8e8f0', fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

// ── JS-throughput benchmark: no native bindings involved at all — pure
// interpreter/JIT work, the thing QuickJS's lack of a JIT should show up on.
function runComputeBench() {
  const t0 = Date.now();
  const N = 300000;
  const sieve = new Uint8Array(N);
  let count = 0;
  for (let i = 2; i < N; i++) {
    if (sieve[i]) continue;
    count++;
    for (let j = i * i; j < N; j += i) sieve[j] = 1;
  }
  const t1 = Date.now();
  return { ms: t1 - t0, result: count };
}

// ── FFI-crossing-overhead benchmark: calls an existing trivial native
// binding (__glyx_platform — returns a static string, does no real work)
// many times in a tight loop. Isolates the raw per-call JS↔native crossing
// cost from everything else (no DOM, no layout, no reconciler) — added to
// find out whether the virtualized list-stress benchmark's regression (its
// V8/QuickJS ratio got WORSE after the JSON-removal work, even though its
// absolute time improved) comes from QuickJS paying disproportionately more
// per native call, or from something else entirely (JS-side Promise/
// microtask overhead, GC, etc).
function runFfiOverheadBench() {
  const N = 200000;
  const hasBinding = typeof __glyx_platform === 'function';
  const t0 = Date.now();
  if (hasBinding) {
    for (let i = 0; i < N; i++) __glyx_platform();
  }
  const t1 = Date.now();
  return { ms: t1 - t0, calls: N, ran: hasBinding };
}

// Snapshot the engine's own frame-level perf counters (see @glyx-dev/react's
// `perf` API) right after a benchmark phase, so we can see whether time went
// into JS execution, layout, or elsewhere — instead of only ever comparing
// wall-clock totals between engines.
function logPerfSnapshot(label) {
  const snap = perf.snapshot ? perf.snapshot() : null;
  if (!snap) {
    console.log(`[bench] perf snapshot (${label}): unavailable`);
    return;
  }
  console.log(`[bench] perf snapshot (${label}): jsTime=${snap.jsTime}ms layoutTime=${snap.layoutTime}ms gpuTime=${snap.gpuTime}ms frameTime=${snap.frameTime}ms frameTimeP99=${snap.frameTimeP99}ms nodeCount=${snap.nodeCount}`);
}

function buildRows(n, seed) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push({ id: i, label: `row-${i}-${(i * seed) % 997}`, active: (i + seed) % 3 === 0 });
  }
  return rows;
}

const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

// ── Reconciler-stress benchmark, real version: builds a fresh 4000-row
// array each iteration AND actually renders it (mapped to View/Text
// elements), awaiting a frame between iterations so each setRows commits
// as its own render instead of being batched away — this is what
// virtualization is supposed to protect an app from.
async function runListStress({ virtualized, rowsPerIter, iters, setRows, setActiveMode }) {
  setActiveMode(virtualized ? 'virtualized' : 'full');
  const t0 = Date.now();
  for (let k = 0; k < iters; k++) {
    const built = buildRows(rowsPerIter, k + 1);
    setRows(built);
    await nextFrame();
  }
  const t1 = Date.now();
  return { ms: t1 - t0, rows: rowsPerIter, iters };
}

function App() {
  const [computeResult, setComputeResult] = useState(null);
  const [ffiResult, setFfiResult] = useState(null);
  const [fullResult, setFullResult] = useState(null);
  const [virtResult, setVirtResult] = useState(null);
  const [rows, setRows] = useState([]);
  const [activeMode, setActiveMode] = useState('full');
  const busyRef = useRef(false);

  // Shared by the button handlers AND the autorun sequence below — both
  // paths funnel through these so there's exactly one implementation of
  // "run this benchmark and report it" (avoids the two callers drifting).
  const runCompute = useCallback(() => {
    setComputeResult('running');
    return new Promise((resolve) => {
      setTimeout(() => {
        const r = runComputeBench();
        setComputeResult(r);
        console.log(`[bench] compute: ${r.ms}ms (primes below 300000 = ${r.result})`);
        logPerfSnapshot('compute');
        resolve(r);
      }, 16);
    });
  }, []);

  const runFfi = useCallback(() => {
    setFfiResult('running');
    return new Promise((resolve) => {
      setTimeout(() => {
        const r = runFfiOverheadBench();
        setFfiResult(r);
        console.log(`[bench] ffi-overhead: ${r.ms}ms for ${r.calls} no-op native calls (ran=${r.ran})`);
        logPerfSnapshot('ffi-overhead');
        resolve(r);
      }, 16);
    });
  }, []);

  const runFull = useCallback(async () => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setFullResult('running');
    const r = await runListStress({ virtualized: false, rowsPerIter: 4000, iters: 10, setRows, setActiveMode });
    setFullResult(r);
    console.log(`[bench] list-stress (full render): ${r.ms}ms for ${r.iters} builds+renders of ${r.rows} rows`);
    logPerfSnapshot('full render');
    busyRef.current = false;
    return r;
  }, []);

  const runVirtualized = useCallback(async () => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setVirtResult('running');
    const r = await runListStress({ virtualized: true, rowsPerIter: 4000, iters: 10, setRows, setActiveMode });
    setVirtResult(r);
    console.log(`[bench] list-stress (virtualized): ${r.ms}ms for ${r.iters} builds+renders of ${r.rows} rows`);
    logPerfSnapshot('virtualized');
    busyRef.current = false;
    return r;
  }, []);

  const onCompute = useCallback(() => { runCompute(); }, [runCompute]);
  const onFfi = useCallback(() => { runFfi(); }, [runFfi]);
  const onListStressFull = runFull;
  const onListStressVirtualized = runVirtualized;

  // Unattended engine-comparison run: all four benchmarks back to back,
  // each awaited so they never overlap, then a done marker. Does not quit —
  // leaves the window open with the final results on screen.
  useEffect(() => {
    if (!AUTORUN) return;
    console.log('[bench] autorun effect fired');
    let cancelled = false;
    (async () => {
      try {
        console.log('[bench] starting compute');
        await runCompute();
        if (cancelled) return;
        console.log('[bench] starting ffi-overhead');
        await runFfi();
        if (cancelled) return;
        console.log('[bench] starting full render');
        await runFull();
        if (cancelled) return;
        console.log('[bench] starting virtualized');
        await runVirtualized();
        if (cancelled) return;
        console.log('[bench] all done');
      } catch (e) {
        console.log('[bench] AUTORUN THREW: ' + (e && e.stack || e));
      }
    })();
    return () => { cancelled = true; };
  }, [runCompute, runFfi, runFull, runVirtualized]);

  const rowItem = (row) => (
    <View key={row.id} style={{ height: 20, flexDirection: 'row', paddingHorizontal: 4 }}>
      <Text style={{ color: row.active ? '#8fe08f' : '#a8a8b8', fontSize: 11 }}>{row.label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#0f0f14' }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#e8e8f0', marginBottom: 12 }}>
        Glyx Engine Benchmark
      </Text>

      <Button title="Run compute benchmark" onPress={onCompute} />
      <Text style={{ color: '#a8a8b8', marginTop: 4, marginBottom: 12 }}>
        {computeResult === null ? 'not run'
          : computeResult === 'running' ? 'running...'
          : `${computeResult.ms} ms (primes: ${computeResult.result})`}
      </Text>

      <Button title="Run FFI-overhead benchmark" onPress={onFfi} />
      <Text style={{ color: '#a8a8b8', marginTop: 4, marginBottom: 12 }}>
        {ffiResult === null ? 'not run'
          : ffiResult === 'running' ? 'running...'
          : `${ffiResult.ms} ms (${ffiResult.calls} no-op native calls)`}
      </Text>

      <Button title="Run list-stress (full render, unvirtualized)" onPress={onListStressFull} />
      <Text style={{ color: '#a8a8b8', marginTop: 4, marginBottom: 12 }}>
        {fullResult === null ? 'not run'
          : fullResult === 'running' ? 'running...'
          : `${fullResult.ms} ms (${fullResult.iters}x build+render of ${fullResult.rows} rows, all rendered)`}
      </Text>

      <Button title="Run list-stress (virtualized)" onPress={onListStressVirtualized} />
      <Text style={{ color: '#a8a8b8', marginTop: 4, marginBottom: 12 }}>
        {virtResult === null ? 'not run'
          : virtResult === 'running' ? 'running...'
          : `${virtResult.ms} ms (${virtResult.iters}x build+render of ${virtResult.rows} rows, only visible window rendered)`}
      </Text>

      {activeMode === 'full' ? (
        <View style={{ height: 140, borderWidth: 1, borderColor: '#333' }}>
          {rows.map(rowItem)}
        </View>
      ) : (
        <VirtualizedList
          data={rows}
          renderItem={({ item }) => rowItem(item)}
          keyExtractor={(item) => item.id}
          itemHeight={20}
          height={140}
          width={440}
        />
      )}
    </View>
  );
}

render(<App />);
