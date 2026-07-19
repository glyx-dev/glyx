import { test, expect } from 'bun:test';
import { prepareUpdate } from './hostConfig.js';

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
