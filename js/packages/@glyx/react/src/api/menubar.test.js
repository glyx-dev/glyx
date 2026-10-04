import { test, expect, beforeEach, afterEach } from 'bun:test';
import { menubar, _resetMenubar, _handleKey, _handleNative } from './menubar.js';

const menu = [
  { label: 'File', children: [{ id: 'new', label: 'New', accelerator: 'Ctrl+N' }, { id: 'auto', label: 'Autosave', checked: false, accelerator: 'Ctrl+Shift+A' }] },
];

let calls, nativeError;

beforeEach(() => {
  calls = []; nativeError = '';
  globalThis.__glyx_menubar_supported = () => true;
  globalThis.__glyx_menubar_set = (json) => { calls.push(['set', JSON.parse(json)]); return nativeError; };
  globalThis.__glyx_menubar_clear = () => { calls.push(['clear']); return true; };
  globalThis.__glyx_menubar_set_enabled = (id, on) => { calls.push(['enabled', id, on]); return id !== 'ghost'; };
  globalThis.__glyx_menubar_set_checked = (id, on) => { calls.push(['checked', id, on]); return id !== 'ghost'; };
});

afterEach(() => {
  _resetMenubar();
  for (const k of Object.keys(globalThis)) if (k.startsWith('__glyx_menubar_')) delete globalThis[k];
});

test('set sends the description to the runtime', () => {
  menubar.set(menu);
  expect(calls[0]).toEqual(['set', menu]);
});

test('an invalid menu throws before anything native happens', () => {
  expect(() => menubar.set([{ label: 'File', children: [{ label: 'No id' }] }])).toThrow(/menubar.set: File > No id/);
  expect(calls.length).toBe(0);
});

test('a native refusal becomes an error', () => {
  nativeError = 'the `menubar` capability is not enabled';
  expect(() => menubar.set(menu)).toThrow(/capability is not enabled/);
});

test('supported reflects the runtime, and is false without one', () => {
  expect(menubar.supported).toBe(true);
  delete globalThis.__glyx_menubar_supported;
  expect(menubar.supported).toBe(false);
});

test('menu clicks reach handlers, with the new state for checkable items', () => {
  const seen = [];
  menubar.set(menu);
  const off = menubar.onSelect((e) => seen.push(e));
  _handleNative({ id: 'new' });
  _handleNative({ id: 'auto', checked: true });
  expect(seen).toEqual([{ id: 'new' }, { id: 'auto', checked: true }]);
  off();
});

test('unsubscribing stops delivery', () => {
  const seen = [];
  menubar.set(menu);
  const off = menubar.onSelect((e) => seen.push(e));
  off();
  // With no subscriber the runtime listener is gone, so nothing is delivered either way.
  expect(seen).toEqual([]);
});

test('a native choice keeps the tracked checked state in step, so an accelerator flips from it', () => {
  const seen = [];
  menubar.set(menu);
  menubar.onSelect((e) => seen.push(e));
  _handleNative({ id: 'auto', checked: true });
  _handleKey({ key: 'KeyA', ctrl: true, shift: true, pressed: true });
  expect(seen.at(-1)).toEqual({ id: 'auto', checked: false });
});

test('setEnabled and setChecked pass through and report unknown ids', () => {
  menubar.set(menu);
  expect(menubar.setEnabled('new', false)).toBe(true);
  expect(menubar.setChecked('auto', true)).toBe(true);
  expect(menubar.setEnabled('ghost', true)).toBe(false);
  expect(calls.slice(1)).toEqual([['enabled', 'new', false], ['checked', 'auto', true], ['enabled', 'ghost', true]]);
});

test('clear removes the bar', () => {
  menubar.set(menu);
  menubar.clear();
  expect(calls.at(-1)).toEqual(['clear']);
});

test('an accelerator selects its item, and toggles a checkable one', () => {
  const seen = [];
  menubar.set(menu);
  menubar.onSelect((e) => seen.push(e));
  _handleKey({ key: 'KeyN', ctrl: true, shift: false, pressed: true });
  _handleKey({ key: 'KeyA', ctrl: true, shift: true, pressed: true });
  _handleKey({ key: 'KeyA', ctrl: true, shift: true, pressed: true });
  expect(seen).toEqual([{ id: 'new' }, { id: 'auto', checked: true }, { id: 'auto', checked: false }]);
  expect(calls.filter((c) => c[0] === 'checked')).toEqual([['checked', 'auto', true], ['checked', 'auto', false]]);
});

test('accelerators ignore releases, other keys, and disabled items', () => {
  const seen = [];
  menubar.set(menu);
  menubar.onSelect((e) => seen.push(e));
  _handleKey({ key: 'KeyN', ctrl: true, shift: false, pressed: false });
  _handleKey({ key: 'KeyM', ctrl: true, shift: false, pressed: true });
  menubar.setEnabled('new', false);
  _handleKey({ key: 'KeyN', ctrl: true, shift: false, pressed: true });
  expect(seen).toEqual([]);
});
