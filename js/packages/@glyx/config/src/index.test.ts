import { test, expect } from 'bun:test';
import { defineConfig } from './index.ts';

test('defineConfig returns the config unchanged', () => {
  const config = {
    window: { title: 'Test App', width: 900, height: 600 },
    capabilities: { db: true, fs: { read: ['**'] } },
    dev: { entry: 'js/app.tsx', output: 'js/app.js' },
  };
  // Note: defineConfig also prints JSON to stdout by design (the CLI reads it).
  expect(defineConfig(config)).toEqual(config);
});

test('defineConfig accepts an empty config', () => {
  expect(defineConfig({})).toEqual({});
});
