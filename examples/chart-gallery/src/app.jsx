import React from 'react';
import { View, Text, ScrollView, render } from '@glyx-dev/react';
import {
  LineChart, AreaChart, BarChart, ScatterChart, CandlestickChart, Sparkline,
} from '@glyx-dev/charts';

// One of every chart. Charts sized '100%' measure the panel they sit in and
// follow it when the window is resized. Hold Ctrl and turn the wheel (or pinch
// a trackpad) over the zoomable line chart to zoom about the pointer.

const COLOR = { bg: '#0D0D14', panel: '#12131A', text: '#E6E8EF', muted: '#8A90A2' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const series = (name, base, wave) => ({
  name,
  data: MONTHS.map((x, i) => ({ x, y: Math.round(base + wave * Math.sin(i * 0.9 + base)) })),
});
const REGIONS = [series('North', 40, 14), series('South', 28, 10), series('West', 18, 7)];

// A reproducible random walk, so every launch draws the same pictures.
function walk(n, seed, step = 1) {
  let s = seed, v = 50;
  const next = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  return Array.from({ length: n }, (_, i) => ({ x: i, y: Math.round((v += (next() - 0.5) * 10 * step) * 10) / 10 }));
}

const CANDLES = (() => {
  let s = 7, price = 100;
  const next = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  return Array.from({ length: 28 }, (_, i) => {
    const open = price;
    const close = Math.round((open + (next() - 0.48) * 8) * 10) / 10;
    const high = Math.round((Math.max(open, close) + next() * 3) * 10) / 10;
    const low = Math.round((Math.min(open, close) - next() * 3) * 10) / 10;
    price = close;
    return { x: `D${i + 1}`, open, high, low, close };
  });
})();

const POINTS = [
  { name: 'Small', color: '#4C8DF6', data: walk(18, 11, 2).map((p, i) => ({ x: 10 + i * 4 + (p.y % 5), y: p.y })) },
  { name: 'Large', color: '#F2A93B', data: walk(14, 29, 2).map((p, i) => ({ x: 20 + i * 5 + (p.y % 7), y: p.y - 12, size: 20 + (i * 13) % 80 })) },
];

function Panel({ title, children, flex = 1 }) {
  return (
    <View style={{ flex, padding: 14, borderRadius: 12, backgroundColor: COLOR.panel, marginRight: 14, minWidth: 0 }}>
      <Text fontSize={13} style={{ color: COLOR.muted, marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ children }) {
  return <View style={{ flexDirection: 'row', marginBottom: 14 }}>{children}</View>;
}

function Stat({ label, value, data, color }) {
  return (
    <Panel title={label}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text fontSize={24} style={{ color: COLOR.text, fontWeight: '600' }}>{value}</Text>
        <Sparkline data={data} width={120} height={36} color={color} title={label} />
      </View>
    </Panel>
  );
}

function App() {
  const trend = walk(24, 3).map((p) => p.y);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <View style={{ padding: 20 }}>
        <Text fontSize={20} style={{ color: COLOR.text, fontWeight: '600', marginBottom: 14 }}>Chart gallery</Text>

        <Row>
          <Stat label="Visits" value="12.4k" data={trend} color="#4C8DF6" />
          <Stat label="Signups" value="831" data={walk(24, 5).map((p) => p.y)} color="#22C29B" />
          <Stat label="Errors" value="17" data={walk(24, 9).map((p) => p.y)} color="#EC5D78" />
        </Row>

        <Row>
          <Panel title="Grouped bars"><BarChart series={REGIONS} width="100%" height={250} /></Panel>
          <Panel title="Stacked bars"><BarChart series={REGIONS} stacked width="100%" height={250} /></Panel>
        </Row>

        <Row>
          <Panel title="Stacked area"><AreaChart series={REGIONS} stacked width="100%" height={250} /></Panel>
          <Panel title="Scatter and bubble"><ScatterChart series={POINTS} width="100%" height={250} /></Panel>
        </Row>

        <Row>
          <Panel title="Candlestick"><CandlestickChart data={CANDLES} width="100%" height={250} /></Panel>
          <Panel title="Zoom: Ctrl + wheel, or the buttons">
            <LineChart data={walk(200, 17, 0.6)} width="100%" height={250} zoomPan showDots={false} />
          </Panel>
        </Row>
      </View>
    </ScrollView>
  );
}

render(<App />);
