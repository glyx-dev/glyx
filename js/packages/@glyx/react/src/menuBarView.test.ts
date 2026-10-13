import { test, expect, beforeEach, afterEach } from 'bun:test';
import React from 'react';
import { render, act, getNodeTree } from '@glyx-dev/testing';
import { MenuBar, parseLabel } from './menuBarView.js';
import { dispatchEvents } from './events.js';

const MENU = [
  { label: '&File', children: [
    { id: 'new', label: '&New', accelerator: 'Ctrl+N' },
    { id: 'open', label: 'Open...' },
    { separator: true },
    { id: 'gone', label: 'Disabled', enabled: false },
  ] },
  { label: '&Edit', children: [{ id: 'undo', label: 'Undo' }] },
  { label: '&View', children: [
    { id: 'grid', label: 'Show grid', checked: true },
    { label: 'Zoom', children: [{ id: 'zin', label: 'Zoom in' }, { id: 'zout', label: 'Zoom out' }] },
  ] },
];

const nodes = () => [...getNodeTree().values()];
const byLabel = (label) => nodes().find((n) => n.props && n.props.ariaLabel === label);
const need = (label) => { const n = byLabel(label); if (!n) throw new Error('no node labelled ' + label); return n.props; };

// Feed native events through the real dispatcher, as the runtime would.
function feed(events) {
  const prev = globalThis.__glyx_pollEvents;
  globalThis.__glyx_pollEvents = () => events;
  try { dispatchEvents(); } finally { globalThis.__glyx_pollEvents = prev; }
}
function keys(...events) {
  feed(events.map((e) => ({ type: 'keyInput', pressed: true, ...e })));
}
const nodeId = (label) => {
  const entry = [...getNodeTree()].find(([, n]) => n.props && n.props.ariaLabel === label);
  if (!entry) throw new Error('no node labelled ' + label);
  return entry[0];
};
const press = (label) => act(() => feed([
  { type: 'mouseButton', x: 5, y: 5, button: 0, pressed: true, target: nodeId(label) },
  { type: 'mouseButton', x: 5, y: 5, button: 0, pressed: false, target: nodeId(label) },
]));
const hover = (label) => act(() => feed([{ type: 'cursorMoved', x: 5, y: 5, target: nodeId(label) }]));

let seen;
let current = null;
const mount = async (props = {}) => {
  seen = [];
  current = await render(React.createElement(MenuBar, { items: MENU, onSelect: (e) => seen.push(e), ...props }));
  await act(() => {}); // let the mount effects (key listeners, native hand-off) run
};
const open = async (label) => { await press(label); };

beforeEach(() => { delete globalThis.__glyx_menubar_supported; });
afterEach(async () => {
  // Unmount, so one test's bar stops listening for the next test's keys.
  if (current) await act(() => current.unmount());
  current = null;
  delete globalThis.__glyx_menubar_supported;
});

test('mnemonic labels split around the marked letter', () => {
  expect(parseLabel('&File')).toEqual({ before: '', key: 'F', after: 'ile', plain: 'File' });
  expect(parseLabel('E&xit')).toEqual({ before: 'E', key: 'x', after: 'it', plain: 'Exit' });
  expect(parseLabel('Save && Close')).toEqual({ before: 'Save & Close', key: '', after: '', plain: 'Save & Close' });
  expect(parseLabel('Plain').key).toBe('');
});

test('a closed bar shows its menus and none of their items', async () => {
  await mount();
  expect(byLabel('File').props.role).toBe('menuitem');
  expect(byLabel('Edit')).toBeTruthy();
  expect(nodes().some((n) => n.props && n.props.role === 'menubar')).toBe(true);
  expect(byLabel('New')).toBeUndefined();
});

test('clicking a menu opens it, and choosing an item selects it and closes the menu', async () => {
  await mount();
  await open('File');
  expect(nodes().some((n) => n.props && n.props.role === 'menu')).toBe(true);
  expect(byLabel('File').props.expanded).toBe(true);
  await press('New');
  expect(seen).toEqual([{ id: 'new' }]);
  expect(byLabel('New')).toBeUndefined();
});

test('a disabled item does nothing', async () => {
  await mount();
  await open('File');
  await press('Disabled');
  expect(seen).toEqual([]);
});

test('moving across the bar while open switches menus', async () => {
  await mount();
  await open('File');
  await hover('Edit');
  expect(byLabel('Undo')).toBeTruthy();
  expect(byLabel('New')).toBeUndefined();
});

test('hovering outside an open bar does not open anything by itself', async () => {
  await mount();
  await hover('Edit');
  expect(byLabel('Undo')).toBeUndefined();
});

test('a check item reports and remembers its flipped state', async () => {
  await mount();
  await open('View');
  expect(need('Show grid').checked).toBe(true);
  await press('Show grid');
  expect(seen).toEqual([{ id: 'grid', checked: false }]);
  await open('View');
  expect(need('Show grid').checked).toBe(false);
});

test('submenus open on hover and select like any item', async () => {
  await mount();
  await open('View');
  await hover('Zoom');
  expect(byLabel('Zoom in')).toBeTruthy();
  await press('Zoom out');
  expect(seen).toEqual([{ id: 'zout' }]);
});

test('Alt plus a mnemonic opens that menu', async () => {
  await mount();
  await act(() => { keys({ key: 'AltLeft' }, { key: 'KeyE' }); });
  expect(byLabel('Undo')).toBeTruthy();
  await act(() => { keys({ key: 'AltLeft', pressed: false }); });
});

test('arrow keys move, Enter chooses, Escape closes', async () => {
  await mount();
  await act(() => { keys({ key: 'AltLeft' }, { key: 'KeyF' }); });
  await act(() => { keys({ key: 'AltLeft', pressed: false }); });
  expect(byLabel('New')).toBeTruthy();
  // First item is highlighted; Down skips the separator and the disabled item, wrapping to "Open...".
  await act(() => { keys({ key: 'ArrowDown' }); });
  await act(() => { keys({ key: 'Enter' }); });
  expect(seen).toEqual([{ id: 'open' }]);
  expect(byLabel('New')).toBeUndefined();

  await act(() => { keys({ key: 'AltLeft' }, { key: 'KeyF' }); });
  await act(() => { keys({ key: 'AltLeft', pressed: false }); });
  await act(() => { keys({ key: 'Escape' }); });
  expect(byLabel('New')).toBeUndefined();
});

test('Right and Left move between menus, and into and out of a submenu', async () => {
  await mount();
  await act(() => { keys({ key: 'AltLeft' }, { key: 'KeyF' }); });
  await act(() => { keys({ key: 'AltLeft', pressed: false }); });
  await act(() => { keys({ key: 'ArrowRight' }); });
  expect(byLabel('Undo')).toBeTruthy();
  await act(() => { keys({ key: 'ArrowRight' }); });
  expect(byLabel('Show grid')).toBeTruthy();
  await act(() => { keys({ key: 'ArrowDown' }); });          // onto Zoom
  await act(() => { keys({ key: 'ArrowRight' }); });         // into its submenu
  expect(byLabel('Zoom in')).toBeTruthy();
  await act(() => { keys({ key: 'ArrowLeft' }); });          // back out
  expect(byLabel('Zoom in')).toBeUndefined();
  expect(byLabel('Show grid')).toBeTruthy();
});

test('an accelerator selects its item with no menu open', async () => {
  await mount();
  await act(() => { keys({ key: 'ControlLeft' }, { key: 'KeyN' }); });
  expect(seen).toEqual([{ id: 'new' }]);
  await act(() => { keys({ key: 'ControlLeft', pressed: false }); });
});

test('a bad description shows its problem instead of a broken bar', async () => {
  await mount({ items: [{ label: 'File', children: [{ label: 'No id' }] }] });
  expect(nodes().some((n) => typeof n.props?.text === 'string' && n.props.text.includes('MenuBar: File > No id'))).toBe(true);
});

test('native hands the menu to the native bar and draws nothing', async () => {
  const sent = [];
  globalThis.__glyx_menubar_supported = () => true;
  globalThis.__glyx_menubar_set = (json) => { sent.push(JSON.parse(json)); return ''; };
  globalThis.__glyx_menubar_clear = () => true;
  await mount({ native: true });
  expect(sent.length).toBe(1);
  expect(nodes().some((n) => n.props && n.props.role === 'menubar')).toBe(false);
  delete globalThis.__glyx_menubar_set;
  delete globalThis.__glyx_menubar_clear;
});

test('native falls back to the drawn bar where there is no native one', async () => {
  globalThis.__glyx_menubar_supported = () => false;
  await mount({ native: true });
  expect(nodes().some((n) => n.props && n.props.role === 'menubar')).toBe(true);
});

test('an editing role runs on the focused field and is reported with its role', async () => {
  await mount({ items: [{ label: '&Edit', children: [{ role: 'copy' }, { role: 'paste' }] }] });
  await open('Edit');
  expect(byLabel('Copy')).toBeTruthy();
  await press('Copy');
  expect(seen).toEqual([{ id: 'role:copy', role: 'copy' }]);
  expect(byLabel('Copy')).toBeUndefined();
});

test('pressing the bar leaves the field focused, so an editing item acts on it', async () => {
  const { registerInput, unregisterInput, setFocus, getFocusedInput } = await import('./events.js');
  const got = [];
  registerInput(9001, { onKeyPress: (k) => got.push(k), onFocus() {}, onBlur() {} });
  setFocus(9001);
  await mount({ items: [{ label: '&Edit', children: [{ role: 'copy' }] }] });
  await open('Edit');
  expect(getFocusedInput()).toBe(9001);     // not blurred by pressing the bar
  await press('Copy');
  expect(seen).toEqual([{ id: 'role:copy', role: 'copy' }]);
  expect(got.some((k) => k.key === 'KeyC' && k.ctrl === true)).toBe(true);
  expect(getFocusedInput()).toBe(9001);
  unregisterInput(9001);
});

test('while a menu is open the focused field does not also get the menu keys', async () => {
  const { registerInput, unregisterInput, setFocus } = await import('./events.js');
  const got = [];
  registerInput(9002, { onKeyPress: (k) => got.push(k.key), onFocus() {}, onBlur() {} });
  setFocus(9002);
  await mount();
  await open('File');
  await act(() => { keys({ key: 'ArrowDown' }); });
  expect(got).toEqual([]);                  // the menu took it
  await act(() => { keys({ key: 'Escape' }); });
  await act(() => { keys({ key: 'ArrowDown' }); });
  expect(got).toEqual(['ArrowDown']);       // closed again: the field gets keys
  unregisterInput(9002);
});
