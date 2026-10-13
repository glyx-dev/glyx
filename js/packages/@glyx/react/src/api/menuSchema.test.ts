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
  expect(parseAccelerator('Ctrl+N')).toMatchObject({ ctrl: true, shift: false, key: 'KeyN' });
  expect(parseAccelerator('CmdOrCtrl+Shift+S')).toMatchObject({ ctrl: true, shift: true, key: 'KeyS' });
  expect(parseAccelerator('ctrl+1')).toMatchObject({ key: 'Digit1' });
  expect(parseAccelerator('F5')).toMatchObject({ key: 'F5', ctrl: false });
  expect(parseAccelerator('Ctrl+Delete')).toMatchObject({ key: 'Delete' });
  expect(parseAccelerator('Ctrl+Left')).toMatchObject({ key: 'ArrowLeft' });
});

test('CmdOrCtrl is Cmd on macOS and Ctrl everywhere else', () => {
  expect(parseAccelerator('CmdOrCtrl+S', 'macos')).toMatchObject({ super: true, ctrl: false, key: 'KeyS' });
  expect(parseAccelerator('CmdOrCtrl+S', 'windows')).toMatchObject({ ctrl: true, super: false });
  expect(parseAccelerator('CmdOrCtrl+S', 'linux')).toMatchObject({ ctrl: true, super: false });
  expect(parseAccelerator('Cmd+S', 'windows')).toMatchObject({ super: true, ctrl: false });
  globalThis.__glyx_platform = () => 'macos';
  expect(parseAccelerator('CmdOrCtrl+S')).toMatchObject({ super: true });
  delete globalThis.__glyx_platform;
});

test('Alt and Super combinations parse and match like any other', () => {
  const alt = parseAccelerator('Alt+F4');
  expect(alt).toMatchObject({ alt: true, key: 'F4' });
  expect(matchesAccelerator(alt, { key: 'F4', ctrl: false, shift: false, alt: true, pressed: true })).toBe(true);
  expect(matchesAccelerator(alt, { key: 'F4', ctrl: false, shift: false, pressed: true })).toBe(false);
  const win = parseAccelerator('Super+E');
  expect(win).toMatchObject({ super: true, key: 'KeyE' });
  expect(matchesAccelerator(win, { key: 'KeyE', super: true, pressed: true })).toBe(true);
  expect(matchesAccelerator(win, { key: 'KeyE', pressed: true })).toBe(false);
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

import { normalizeMenu, EDIT_ROLES } from './menuSchema.js';

test('a role fills in its id, label and accelerator and needs none of them', () => {
  const bar = [{ label: 'Edit', children: [{ role: 'copy' }, { role: 'selectAll', label: 'Everything' }] }];
  expect(validateMenu(bar)).toBeNull();
  const full = normalizeMenu(bar);
  expect(full[0].children[0]).toMatchObject({ role: 'copy', id: 'role:copy', label: 'Copy', accelerator: 'Ctrl+C' });
  expect(full[0].children[1]).toMatchObject({ id: 'role:selectAll', label: 'Everything', accelerator: 'Ctrl+A' });
  expect(Object.keys(EDIT_ROLES).sort()).toEqual(['copy', 'cut', 'paste', 'selectAll']);
});

test('an unknown role is an error, and a repeated role is a repeated id', () => {
  expect(validateMenu([{ label: 'Edit', children: [{ role: 'undo' }] }])).toMatch(/unknown role "undo"/);
  expect(validateMenu([{ label: 'Edit', children: [{ role: 'copy' }, { role: 'copy' }] }])).toMatch(/used more than once/);
});

test('normalizing leaves everything else alone', () => {
  const bar = [{ label: 'File', children: [{ id: 'a', label: 'A' }, { separator: true }] }];
  expect(normalizeMenu(bar)).toEqual(bar);
});
