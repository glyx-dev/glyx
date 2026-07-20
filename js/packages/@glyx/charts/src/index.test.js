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

test('tooltip hit-regions are present by default and absent when showTooltip is false', () => {
  for (const Chart of [LineChart, AreaChart, BarChart, PieChart]) {
    const withTooltip = renderToStaticMarkup(React.createElement(Chart, { data, width: 300, height: 200 }));
    const withoutTooltip = renderToStaticMarkup(React.createElement(Chart, { data, width: 300, height: 200, showTooltip: false }));
    // The tooltip overlay is a full-size absolutely-positioned wrapper
    // (left:0;top:0) containing one hit-region per data point/bar/wedge;
    // showTooltip:false should render none of that markup.
    expect(withTooltip).toContain('left:0;top:0;width:300px;height:200px');
    expect(withoutTooltip).not.toContain('left:0;top:0;width:300px;height:200px');
    // The chart's own canvas still renders identically either way.
    expect(withTooltip).toContain('<canvas width="300" height="200">');
    expect(withoutTooltip).toContain('<canvas width="300" height="200">');
  }
});

test('tooltip hit-regions tolerate empty data without throwing', () => {
  for (const Chart of [LineChart, AreaChart, BarChart, PieChart]) {
    expect(() => renderToStaticMarkup(React.createElement(Chart, { data: [], showTooltip: true }))).not.toThrow();
  }
});
