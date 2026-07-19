import React, { useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, VirtualizedList, render } from '@glyx-dev/react';

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
  const [fullResult, setFullResult] = useState(null);
  const [virtResult, setVirtResult] = useState(null);
  const [rows, setRows] = useState([]);
  const [activeMode, setActiveMode] = useState('full');
  const busyRef = useRef(false);

  const onCompute = useCallback(() => {
    setComputeResult('running');
    setTimeout(() => {
      const r = runComputeBench();
      setComputeResult(r);
      console.log(`[bench] compute: ${r.ms}ms (primes below 300000 = ${r.result})`);
    }, 16);
  }, []);

  const onListStressFull = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setFullResult('running');
    const r = await runListStress({ virtualized: false, rowsPerIter: 4000, iters: 10, setRows, setActiveMode });
    setFullResult(r);
    console.log(`[bench] list-stress (full render): ${r.ms}ms for ${r.iters} builds+renders of ${r.rows} rows`);
    busyRef.current = false;
  }, []);

  const onListStressVirtualized = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setVirtResult('running');
    const r = await runListStress({ virtualized: true, rowsPerIter: 4000, iters: 10, setRows, setActiveMode });
    setVirtResult(r);
    console.log(`[bench] list-stress (virtualized): ${r.ms}ms for ${r.iters} builds+renders of ${r.rows} rows`);
    busyRef.current = false;
  }, []);

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
