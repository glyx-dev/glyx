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
