import { test, expect } from 'bun:test';
import { validateMenu, flattenItems, parseAccelerator, matchesAccelerator } from './menuSchema.js';

const bar = [
  { label: '&File', children: [{ id: 'new', label: 'New', accelerator: 'Ctrl+N' }, { separator: true }, { id: 'quit', label: 'Quit' }] },
  { label: 'View', children: [{ id: 'grid', label: 'Grid', checked: false }, { label: 'Zoom', children: [{ id: 'zin', label: 'In' }] }] },
];

test('a normal menu bar is valid', () => {
  expect(validateMenu(bar)).toBeNull();
});

test('the top level must be non-empty menus', () => {
  expect(validateMenu([])).toMatch(/at least one/);
  expect(validateMenu([{ id: 'x', label: 'Loose' }])).toMatch(/children/);
  expect(validateMenu([{ label: '', children: [{ id: 'a', label: 'A' }] }])).toMatch(/label/);
});

test('items need labels and unique ids, and errors name the path', () => {
  expect(validateMenu([{ label: 'File', children: [{ label: 'New' }] }])).toBe('File > New: an item needs an `id` so its clicks can be told apart');
  expect(validateMenu([{ label: 'File', children: [{ id: 'a', label: 'One' }] }, { label: 'Edit', children: [{ id: 'a', label: 'Two' }] }])).toMatch(/used more than once/);
  expect(validateMenu([{ label: 'View', children: [{ label: 'Zoom', children: [{ label: 'In' }] }] }])).toMatch(/View > Zoom > In/);
});

test('a bad accelerator is an error', () => {
  expect(validateMenu([{ label: 'File', children: [{ id: 'a', label: 'A', accelerator: 'Ctrl+Nope' }] }])).toMatch(/not a valid accelerator/);
});

test('flattenItems lists the actionable items in order', () => {
  expect(flattenItems(bar).map((i) => i.id)).toEqual(['new', 'quit', 'grid', 'zin']);
});

test('accelerators parse', () => {
  expect(parseAccelerator('Ctrl+N')).toMatchObject({ ctrl: true, shift: false, key: 'KeyN', triggers: true });
  expect(parseAccelerator('CmdOrCtrl+Shift+S')).toMatchObject({ ctrl: true, shift: true, key: 'KeyS' });
  expect(parseAccelerator('ctrl+1')).toMatchObject({ key: 'Digit1' });
  expect(parseAccelerator('F5')).toMatchObject({ key: 'F5', ctrl: false });
  expect(parseAccelerator('Ctrl+Delete')).toMatchObject({ key: 'Delete' });
  expect(parseAccelerator('Ctrl+Left')).toMatchObject({ key: 'ArrowLeft' });
});

test('combinations key events cannot report are valid but never trigger', () => {
  const alt = parseAccelerator('Alt+F4');
  expect(alt).toMatchObject({ alt: true, key: 'F4', triggers: false });
  expect(matchesAccelerator(alt, { key: 'F4', ctrl: false, shift: false, pressed: true })).toBe(false);
});

test('things that are not key combinations are rejected', () => {
  for (const bad of ['', 'Ctrl+', 'Ctrl+Shift', 'Nope', 'Ctrl+Nope', 'Ctrl++', null, 5]) expect(parseAccelerator(bad)).toBeNull();
});

test('matching needs the exact modifiers and a key press', () => {
  const acc = parseAccelerator('Ctrl+Shift+S');
  expect(matchesAccelerator(acc, { key: 'KeyS', ctrl: true, shift: true, pressed: true })).toBe(true);
  expect(matchesAccelerator(acc, { key: 'KeyS', ctrl: true, shift: false, pressed: true })).toBe(false);
  expect(matchesAccelerator(acc, { key: 'KeyS', ctrl: true, shift: true, pressed: false })).toBe(false);
  expect(matchesAccelerator(acc, { key: 'KeyD', ctrl: true, shift: true, pressed: true })).toBe(false);
});
