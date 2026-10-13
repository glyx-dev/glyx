import { test, expect } from 'bun:test';
import { flattenStyle, StyleSheet } from './style.js';

test('a plain object is returned as is', () => {
  const s = { padding: 4 };
  expect(flattenStyle(s)).toBe(s);
});

test('falsy values flatten to undefined', () => {
  for (const v of [undefined, null, false, 0, '']) expect(flattenStyle(v)).toBeUndefined();
  expect(flattenStyle([false, null, undefined])).toBeUndefined();
});

test('arrays merge in order, later entries win', () => {
  expect(flattenStyle([{ padding: 4, color: 'red' }, { color: 'blue' }])).toEqual({ padding: 4, color: 'blue' });
});

test('falsy entries are skipped', () => {
  const active = false;
  expect(flattenStyle([{ opacity: 1 }, active && { opacity: 0.5 }])).toEqual({ opacity: 1 });
  expect(flattenStyle([{ opacity: 1 }, !active && { opacity: 0.5 }])).toEqual({ opacity: 0.5 });
});

test('arrays nest', () => {
  expect(flattenStyle([{ a: 1 }, [{ b: 2 }, [{ a: 3 }]]])).toEqual({ a: 3, b: 2 });
});

test('inputs are never mutated', () => {
  const base = { padding: 4 }; const extra = { padding: 8 };
  flattenStyle([base, extra]);
  expect(base).toEqual({ padding: 4 });
  expect(extra).toEqual({ padding: 8 });
});

test('StyleSheet helpers', () => {
  const styles = { box: { margin: 2 } };
  expect(StyleSheet.create(styles)).toBe(styles);
  expect(StyleSheet.flatten([styles.box, { margin: 5 }])).toEqual({ margin: 5 });
  expect(StyleSheet.compose(styles.box, null)).toBe(styles.box);
  expect(StyleSheet.compose(styles.box, { a: 1 })).toEqual([styles.box, { a: 1 }]);
  expect(StyleSheet.absoluteFill).toEqual({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 });
});

test('the host sends a flattened array style to the runtime', async () => {
  const HostConfig = (await import('./hostConfig.js')).default;
  const prev = globalThis.__glyx_createNode;
  let sent;
  globalThis.__glyx_createNode = (_t, props) => { sent = props; return 1; };
  HostConfig.createInstance('view', { style: [{ padding: 4, opacity: 1 }, false, { opacity: 0.5 }] }, null, null, {});
  globalThis.__glyx_createNode = prev;
  expect(sent.padding).toBe(4);
  expect(sent.opacity).toBe(0.5);
  expect(sent['0']).toBeUndefined();
});

test('built-in components accept array styles', async () => {
  const React = (await import('react')).default;
  const { Pressable } = await import('./core.js');
  expect(typeof Pressable).toBe('function');
  expect(React.isValidElement(React.createElement(Pressable, { style: [{ opacity: 1 }, null] }))).toBe(true);
});
