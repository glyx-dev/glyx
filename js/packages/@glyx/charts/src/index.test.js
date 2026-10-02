import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LineChart, AreaChart, BarChart, PieChart, Legend, DEFAULT_PALETTE, THEMES, _internals } from './index.js';

const { _niceScale, _fmt, _fmtTick, _normSeries, _theme, _cartesianSummary } = _internals;

const data = [
  { x: 'Jan', y: 10 },
  { x: 'Feb', y: 25 },
  { x: 'Mar', y: 18 },
];

test('DEFAULT_PALETTE is a non-empty color list', () => {
  expect(Array.isArray(DEFAULT_PALETTE)).toBe(true);
  expect(DEFAULT_PALETTE.length).toBeGreaterThan(0);
});

test('all chart components render without throwing', () => {
  for (const Chart of [LineChart, AreaChart, BarChart, PieChart]) {
    const html = renderToStaticMarkup(React.createElement(Chart, { data, width: 300, height: 200 }));
    expect(html).toContain('<canvas width="300"');
  }
});

test('charts tolerate empty data', () => {
  for (const Chart of [LineChart, AreaChart, BarChart, PieChart]) {
    expect(() => renderToStaticMarkup(React.createElement(Chart, { data: [] }))).not.toThrow();
  }
});

test('every chart is an accessible, focusable figure with a spoken summary', () => {
  const cases = [
    [LineChart, 'line chart'], [AreaChart, 'area chart'], [BarChart, 'bar chart'], [PieChart, 'pie chart'],
  ];
  for (const [Chart, kind] of cases) {
    const html = renderToStaticMarkup(React.createElement(Chart, { data, width: 300, height: 200, title: 'Sales' }));
    expect(html).toContain('role="figure"');
    expect(html).toContain('focusable="true"');
    expect(html).toContain(`accessibilityRoleDescription="${kind}"`);
    expect(html).toContain('accessibilityLiveRegion="polite"');
    expect(html).toContain('ariaLabel="Sales, ');
  }
});

test('a donut says donut, and a multi-series chart gets a legend', () => {
  const donut = renderToStaticMarkup(React.createElement(PieChart, { data, innerRadius: 0.6 }));
  expect(donut).toContain('accessibilityRoleDescription="donut chart"');
  const multi = renderToStaticMarkup(React.createElement(LineChart, {
    width: 300, height: 200,
    series: [{ name: 'North', data }, { name: 'South', data: data.map((d) => ({ ...d, y: d.y * 2 })) }],
  }));
  expect(multi).toContain('North');
  expect(multi).toContain('South');
});

test('nice scales use round tick values', () => {
  // The dashboard's old axis read 0 / 449.5 / 899 / 1348.5 / 1.8k.
  const s = _niceScale(1210, 1830, { zero: true });
  expect(s.ticks).toEqual([0, 500, 1000, 1500, 2000]);
  const t = _niceScale(1210, 1830);
  expect(t.ticks.every((v) => v % t.step === 0)).toBe(true);
  expect(t.lo).toBeLessThanOrEqual(1210);
  expect(t.hi).toBeGreaterThanOrEqual(1830);
  expect(_niceScale(0, 1).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
  // Degenerate ranges still produce a usable scale.
  expect(_niceScale(5, 5).ticks.length).toBeGreaterThan(1);
  expect(_niceScale(NaN, Infinity).ticks.length).toBeGreaterThan(1);
});

test('numbers format compactly and ticks carry the decimals their step needs', () => {
  expect(_fmt(1500)).toBe('1.5k');
  expect(_fmt(2000)).toBe('2k');
  expect(_fmt(2_500_000)).toBe('2.5M');
  expect(_fmt(42)).toBe('42');
  expect(_fmtTick(0.25, 0.25)).toBe('0.25');
  expect(_fmtTick(20, 10)).toBe('20');
  expect(_fmtTick(1500, 500)).toBe('1.5k');
  expect(_fmtTick(0.5, 0.5)).toBe('0.5');
  expect(_fmtTick(3, 0.5)).toBe('3.0');
});

test('series normalize from data or series props', () => {
  const one = _normSeries({ data, color: '#123456', name: 'Rev' });
  expect(one).toEqual([{ name: 'Rev', data, color: '#123456' }]);
  const two = _normSeries({ series: [{ data }, { name: 'B', data }] });
  expect(two.map((s) => s.name)).toEqual(['Series 1', 'B']);
  expect(two[0].color).toBe(DEFAULT_PALETTE[0]);
  expect(two[1].color).toBe(DEFAULT_PALETTE[1]);
});

test('themes: dark by default, light, and overrides', () => {
  expect(_theme()).toBe(THEMES.dark);
  expect(_theme('light')).toBe(THEMES.light);
  expect(_theme({ text: '#ff0000' }).text).toBe('#ff0000');
  expect(_theme({ text: '#ff0000' }).label).toBe(THEMES.dark.label);
});

test('the spoken summary names the range, extremes and latest value', () => {
  const s = _cartesianSummary({
    title: 'Revenue', kindName: 'line chart', series: [{ name: '', data }],
    formatValue: _fmt, formatLabel: String,
  });
  expect(s).toBe('Revenue, line chart. 3 points from Jan to Mar. lowest 10 at Jan, highest 25 at Feb, latest 18.');
});

test('Legend renders values and toggles as switches', () => {
  const html = renderToStaticMarkup(React.createElement(Legend, {
    items: [{ label: 'Desktop', value: '42%' }], onToggle: () => {},
  }));
  expect(html).toContain('Desktop');
  expect(html).toContain('42%');
  expect(html).toContain('role="switch"');
});

// ── Realtime stream window ──────────────────────────────────────────────────

// A scheduler we drive by hand: `run()` fires whatever is pending.
function manualClock() {
  let pending = null, id = 0;
  return {
    schedule: (fn) => { pending = { fn, id: ++id }; return pending.id; },
    cancel: (h) => { if (pending && pending.id === h) pending = null; },
    run: () => { const p = pending; pending = null; p?.fn(); },
    get waiting() { return pending !== null; },
  };
}
const mkStream = (cap, flushes, clock) => new _internals._ChartStream({
  capacity: cap, intervalMs: 33, onFlush: (pts) => flushes.push(pts), schedule: clock.schedule, cancel: clock.cancel,
});

test('a stream window keeps the latest `capacity` points, oldest first', () => {
  const flushes = [], clock = manualClock();
  const s = mkStream(3, flushes, clock);
  for (let i = 1; i <= 5; i++) s.push({ x: i, y: i * 10 });
  clock.run();
  expect(flushes).toHaveLength(1);
  expect(flushes[0].map((p) => p.x)).toEqual([3, 4, 5]);
});

test('a burst of pushes reaches the chart as one update, and arrays work', () => {
  const flushes = [], clock = manualClock();
  const s = mkStream(10, flushes, clock);
  s.push({ x: 1, y: 1 });
  expect(clock.waiting).toBe(true);
  s.push([{ x: 2, y: 2 }, { x: 3, y: 3 }]);
  for (let i = 4; i <= 100; i++) s.push({ x: i, y: i });
  expect(flushes).toHaveLength(0);            // nothing until the interval fires
  clock.run();
  expect(flushes).toHaveLength(1);            // 100 pushes, one update
  expect(flushes[0]).toHaveLength(10);
  expect(flushes[0].at(-1).x).toBe(100);
  // The next push schedules the next update.
  s.push({ x: 101, y: 101 });
  expect(clock.waiting).toBe(true);
});

test('a full window keeps its length, so a chart sees the same shape every update', () => {
  const flushes = [], clock = manualClock();
  const s = mkStream(5, flushes, clock);
  for (let i = 0; i < 5; i++) s.push({ x: i, y: i });
  clock.run();
  for (let i = 5; i < 12; i++) { s.push({ x: i, y: i }); clock.run(); }
  expect(flushes.every((w, i) => i === 0 || w.length === 5)).toBe(true);
  expect(flushes.at(-1).map((p) => p.x)).toEqual([7, 8, 9, 10, 11]);
});

test('clear() empties the window and cancels a pending update; dispose() stops everything', () => {
  const flushes = [], clock = manualClock();
  const s = mkStream(5, flushes, clock);
  s.push({ x: 1, y: 1 });
  s.clear();
  expect(clock.waiting).toBe(false);
  expect(flushes.at(-1)).toEqual([]);
  s.push({ x: 2, y: 2 });
  s.dispose();
  expect(clock.waiting).toBe(false);
  const before = flushes.length;
  s.push({ x: 3, y: 3 }); clock.run();
  expect(flushes.length).toBe(before);
});

// ── Curve tessellation ───────────────────────────────────────────────────────

import { GlyxCanvasContext } from '../../react/src/canvas.js';

test('curve segments follow the gap between points, within 4–20, and never the data', () => {
  const { _curveSegments } = _internals;
  expect(_curveSegments(7)).toBe(7);
  expect(_curveSegments(0.5)).toBe(4);
  expect(_curveSegments(40)).toBe(20);
  expect(_curveSegments(-7)).toBe(7);

  // Two different datasets over the same x grid tessellate to the same number of points, so a
  // canvas with a transition can still ease between consecutive draws of a live chart.
  const pointsFor = (ys) => {
    const c = new GlyxCanvasContext(1);
    c.beginPath();
    _internals._smoothPath(c, ys.map((y, i) => [i * 7, y]));
    return c._path.length;
  };
  const calm = Array.from({ length: 60 }, (_, i) => 50 + 5 * Math.sin(i / 5));
  const wild = Array.from({ length: 60 }, (_, i) => (i % 2 ? 10 : 90));
  expect(pointsFor(calm)).toBe(pointsFor(wild));
  expect(pointsFor(calm)).toBe(2 * (1 + 59 * 7));   // moveTo + 59 curves of 7 segments, x/y pairs
});

test('the coarser curve stays within about a quarter pixel of the fine one, even on a spiky line', () => {
  const ys = Array.from({ length: 80 }, (_, i) => 100 + 30 * Math.sin(i * 1.3) + 25 * Math.sin(i * 4.1) + 12 * Math.sin(i * 9.7));
  const pts = ys.map((y, i) => [i * 7, y]);
  const tessellate = (segmentsFor) => {
    const c = new GlyxCanvasContext(1);
    const real = c.bezierCurveTo.bind(c);
    c.bezierCurveTo = (a, b, d, e, f, g) => real(a, b, d, e, f, g, segmentsFor(f));
    c.beginPath();
    _internals._smoothPath(c, pts);
    const p = c._path, out = [];
    for (let i = 0; i < p.length; i += 2) out.push([p[i], p[i + 1]]);
    return out;
  };
  const fine = tessellate(() => 20);
  const coarse = tessellate(() => _internals._curveSegments(7));
  // Distance from a point to the nearest piece of the fine polyline.
  const dist = (q) => {
    let best = Infinity;
    for (let i = 0; i < fine.length - 1; i++) {
      const [ax, ay] = fine[i], [bx, by] = fine[i + 1];
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / len2));
      best = Math.min(best, Math.hypot(q[0] - (ax + t * dx), q[1] - (ay + t * dy)));
    }
    return best;
  };
  let worst = 0;
  for (let i = 0; i < coarse.length - 1; i++) {
    worst = Math.max(worst, dist([(coarse[i][0] + coarse[i + 1][0]) / 2, (coarse[i][1] + coarse[i + 1][1]) / 2]));
  }
  expect(worst).toBeLessThan(0.3); // measured 0.19 px at 7 segments per curve
});
