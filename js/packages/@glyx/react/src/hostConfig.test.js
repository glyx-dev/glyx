import { test, expect } from 'bun:test';
import { prepareUpdate, applyTransition, applyAnimation } from './hostConfig.js';

test('prepareUpdate returns null when no visual props changed', () => {
  const oldProps = { backgroundColor: 'red', children: 'a', ref: null };
  const newProps = { backgroundColor: 'red', children: 'b', ref: null };
  expect(prepareUpdate({}, 'view', oldProps, newProps)).toBe(null);
});

test('prepareUpdate returns newProps when a visual prop changed', () => {
  const oldProps = { backgroundColor: 'red' };
  const newProps = { backgroundColor: 'blue' };
  expect(prepareUpdate({}, 'view', oldProps, newProps)).toBe(newProps);
});

test('prepareUpdate returns newProps when a prop is added or removed', () => {
  const oldProps = { backgroundColor: 'red' };
  const newProps = { backgroundColor: 'red', opacity: 0.5 };
  expect(prepareUpdate({}, 'view', oldProps, newProps)).toBe(newProps);
});

test('prepareUpdate ignores children/ref/_glyxOnMount/glyxDraggable churn', () => {
  const oldProps = { backgroundColor: 'red', _glyxOnMount: () => {}, glyxDraggable: true };
  const newProps = { backgroundColor: 'red', _glyxOnMount: () => {}, glyxDraggable: false };
  // glyxDraggable is in the skip list for the *diff*, but note it's still a
  // distinct key set only if counts differ — here both objects have the same
  // keys, so only non-skipped values are compared.
  expect(prepareUpdate({}, 'view', oldProps, newProps)).toBe(null);
});

test('prepareUpdate treats a transition prop change as a visual change', () => {
  const oldProps = { backgroundColor: 'red', transition: { duration: 200 } };
  const newProps = { backgroundColor: 'red', transition: { duration: 400 } };
  expect(prepareUpdate({}, 'view', oldProps, newProps)).toBe(newProps);
});

test('applyTransition flattens duration, properties and easing', () => {
  const p = {};
  applyTransition(p, { duration: 250, properties: ['opacity', 'transform'], easing: 'ease-in-out' });
  expect(p).toEqual({ transitionMs: 250, transitionProperty: 'opacity,transform', transitionEasing: 'ease-in-out' });

  const all = {};
  applyTransition(all, { duration: 100, properties: 'all' });
  expect(all).toEqual({ transitionMs: 100, transitionProperty: 'all' });
});

test('applyTransition keeps the v1 shape and ignores a missing duration', () => {
  const v1 = {};
  applyTransition(v1, { duration: 200 });
  expect(v1).toEqual({ transitionMs: 200 });

  const none = {};
  applyTransition(none, { easing: 'linear' });
  applyTransition(none, undefined);
  expect(none).toEqual({});
});

test('applyAnimation flattens keyframes keyed by percent / from / to', () => {
  const p = {};
  applyAnimation(p, {
    duration: 800, easing: 'linear', iterations: Infinity, direction: 'alternate', fill: 'forwards',
    keyframes: { from: { opacity: 0, color: 'red' }, '50%': { transform: 'scale(1.2)' }, 100: { opacity: 1 } },
  });
  expect(JSON.parse(p.animationKeyframes)).toEqual([
    [0, { opacity: 0 }],            // non-animatable keys dropped
    [0.5, { transform: 'scale(1.2)' }],
    [1, { opacity: 1 }],
  ]);
  expect(p).toMatchObject({
    animationMs: 800, animationEasing: 'linear', animationIterations: -1,
    animationDirection: 'alternate', animationFill: 'forwards',
  });
});

test('applyAnimation spaces array keyframes evenly unless they carry an offset', () => {
  const p = {};
  applyAnimation(p, { duration: 300, keyframes: [{ opacity: 0 }, { opacity: 0.5, offset: 0.2 }, { opacity: 1 }] });
  expect(JSON.parse(p.animationKeyframes)).toEqual([[0, { opacity: 0 }], [0.2, { opacity: 0.5 }], [1, { opacity: 1 }]]);
  expect(p.animationIterations).toBeUndefined();

  const none = {};
  applyAnimation(none, { keyframes: [{ opacity: 0 }] }); // no duration
  applyAnimation(none, undefined);
  expect(none).toEqual({});
});

test('componentName names the nearest component above a host node', async () => {
  const { componentName, markLibraryComponents } = await import('./hostConfig.js');
  function Btn() {}
  function Text() {}
  const Memo = { $$typeof: 'memo', type: function Card() {} };
  const Fwd = { $$typeof: 'forward_ref', render: function Field() {}, displayName: 'TextField' };
  function Pressable() {}
  markLibraryComponents([Pressable, Text]);
  const host = (parent) => ({ type: 'view', return: parent });
  expect(componentName(host({ type: 'view', return: { type: Btn } }))).toBe('Btn');
  // Nearest component plus the nearest app component, past Glyx's own ones,
  // each with where it was used.
  const btn = { type: Btn, _debugSource: { fileName: String.raw`C:\app\js\app.jsx`, lineNumber: 428 } };
  expect(componentName(host({ type: Pressable, return: btn }))).toBe('Btn@app.jsx:428 › Pressable');
  const deep = { type: Btn, _debugSource: { fileName: '/home/me/app/app.jsx', lineNumber: 7 }, return: { type: function App() {} } };
  expect(componentName(host({ type: Text, return: { type: Pressable, return: deep } }))).toBe('Btn@app.jsx:7 › Text');
  // Only library components above: the nearest one.
  expect(componentName(host({ type: Text, return: { type: Pressable } }))).toBe('Text');
  expect(componentName(host({ type: Memo }))).toBe('Card');
  expect(componentName(host({ type: Fwd }))).toBe('TextField');
  expect(componentName(host(null))).toBe(null);
  expect(componentName(undefined)).toBe(null);
});
