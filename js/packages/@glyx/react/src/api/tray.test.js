import { test, expect, afterEach } from 'bun:test';
import { tray } from './tray.js';

afterEach(() => { delete globalThis.__glyx_tray_create; });

test('pixels are passed through with their size', () => {
  let args;
  globalThis.__glyx_tray_create = (...a) => { args = a; return 7; };
  const px = new ArrayBuffer(16);
  expect(tray.create(px, 2, 2, 'App', [{ id: 'q', label: 'Quit' }])).toBe(7);
  expect(args[0]).toBe(px);
  expect(args.slice(1, 4)).toEqual([2, 2, 'App']);
});

test('null pixels ask the runtime for the app icon', () => {
  let args;
  globalThis.__glyx_tray_create = (...a) => { args = a; return 3; };
  expect(tray.create(null, 99, 99, 'App')).toBe(3);
  expect(args.slice(0, 4)).toEqual([null, 0, 0, 'App']);
  expect(args[4]).toBe('[]');
});

test('without a runtime create returns 0', () => {
  expect(tray.create(null, 0, 0, 'App')).toBe(0);
});
