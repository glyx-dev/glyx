import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LineChart, AreaChart, BarChart, PieChart, DEFAULT_PALETTE } from './index.js';

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
    expect(typeof html).toBe('string');
  }
});

test('charts tolerate empty data', () => {
  for (const Chart of [LineChart, AreaChart, BarChart, PieChart]) {
    expect(() => renderToStaticMarkup(React.createElement(Chart, { data: [] }))).not.toThrow();
  }
});
