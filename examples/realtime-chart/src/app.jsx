import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, render } from '@glyx-dev/react';
import { LineChart, AreaChart, useChartStream } from '@glyx-dev/charts';

// A feed that can run far faster than the screen refreshes. `useChartStream`
// keeps a fixed window of the latest points and hands it to the charts at most
// `maxHz` times a second, so the UI does the same amount of work whether 20 or
// 1000 values arrive per second. The window keeps its length, so each chart's
// native transition can ease between updates instead of redrawing with a jump.

const RATES = [20, 200, 1000];   // values per second
const CAPACITY = 120;            // points on screen
const MAX_HZ = 30;               // chart updates per second, at most

const COLOR = { bg: '#0D0D14', panel: '#12131A', text: '#E6E8EF', muted: '#8A90A2', sky: '#38bdf8', button: '#232636' };

function RateButton({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderRadius: 8,
        backgroundColor: active ? COLOR.sky : COLOR.button,
      }}
    >
      <Text fontSize={13} style={{ color: active ? '#06121c' : COLOR.text }}>{label}</Text>
    </Pressable>
  );
}

function App() {
  const [rate, setRate] = useState(200);
  const { data, push } = useChartStream({ capacity: CAPACITY, maxHz: MAX_HZ });
  const [shown, setShown] = useState({ pushes: 0, updates: 0 });
  const counts = useRef({ pushes: 0, updates: 0 });

  // The feed: `rate` values a second, in a batch on every timer tick. Counted by
  // elapsed time, not by tick, so a busy frame that delays the timer delivers
  // a bigger batch instead of losing values.
  useEffect(() => {
    let owed = 0, n = 0, last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      owed += rate * (now - last) / 1000;
      last = now;
      const batch = [];
      while (owed >= 1) {
        owed -= 1; n += 1;
        const t = n / 40;
        batch.push({ x: String(n), y: 50 + 30 * Math.sin(t) + 10 * Math.sin(t * 3.7) + (Math.random() - 0.5) * 6 });
      }
      if (batch.length) { push(batch); counts.current.pushes += batch.length; }
    }, 10);
    return () => clearInterval(id);
  }, [rate, push]);

  // How many times the charts actually updated.
  useEffect(() => { counts.current.updates += 1; }, [data]);

  // Once a second: show the last second's pushes and chart updates.
  useEffect(() => {
    const id = setInterval(() => {
      const { pushes, updates } = counts.current;
      counts.current = { pushes: 0, updates: 0 };
      setShown({ pushes, updates });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: COLOR.bg }}>
      <Text fontSize={20} style={{ color: COLOR.text, fontWeight: '600' }}>Realtime chart</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        {RATES.map((r) => <RateButton key={r} label={`${r}/s`} active={rate === r} onPress={() => setRate(r)} />)}
        <Text fontSize={13} style={{ color: COLOR.muted, marginLeft: 8 }}>
          {shown.pushes} values/s in → {shown.updates} chart updates/s
        </Text>
      </View>
      <View style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: COLOR.panel }}>
        <LineChart data={data} width={836} height={250} color={COLOR.sky} showDots={false} title="Signal" />
      </View>
      <View style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: COLOR.panel }}>
        <AreaChart data={data} width={836} height={250} color="#818cf8" showDots={false} title="Signal (area)" />
      </View>
    </View>
  );
}

render(<App />);
