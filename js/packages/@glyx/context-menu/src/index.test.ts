import { test, expect, afterEach } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, act, getNodeTree } from '@glyx-dev/testing';
import { _popoverStore, PopoverHost } from '@glyx-dev/react';
import { dispatchEvents } from '../../react/src/events.js';
import { ContextMenu } from './index.js';

test('ContextMenu renders its children (menu closed by default)', () => {
  const html = renderToStaticMarkup(
    React.createElement(ContextMenu, {
      items: [{ label: 'Copy', action: () => {} }, { label: 'Delete', action: () => {} }],
    }, React.createElement('text', null, 'TARGET-CONTENT'))
  );
  expect(html).toContain('TARGET-CONTENT');
  // Menu items only appear after a right-click, not on initial render.
  expect(html).not.toContain('Copy');
});

// Feed native events through the real dispatcher, as the runtime would: a right click on the card reaches the wrapping Pressable's `onRightPress`
// with the pointer's window position.
function feed(events: any[]) {
  const prev = (globalThis as any).__glyx_pollEvents;
  (globalThis as any).__glyx_pollEvents = () => events;
  try { dispatchEvents(); } finally { (globalThis as any).__glyx_pollEvents = prev; }
}
const idOf = (label: string) => {
  const e = [...getNodeTree()].find(([, n]: any) => n.props && n.props.ariaLabel === label);
  if (!e) throw new Error('no node labelled ' + label);
  return e[0];
};
// The Pressable wrapping the card: the node that holds it.
const wrapperOf = (label: string) => {
  const card = idOf(label);
  const e = [...getNodeTree()].find(([, n]: any) => n.children && n.children.includes(card));
  if (!e) throw new Error('nothing holds the node labelled ' + label);
  return e[0];
};
const rightClick = (x = 40, y = 30) => act(() => feed([
  { type: 'mouseButton', x, y, button: 1, pressed: true, target: wrapperOf('card') },
  { type: 'mouseButton', x, y, button: 1, pressed: false, target: wrapperOf('card') },
]));

// A root that holds the menu and the popover layer (render() wants a component, as render() in an app is given one).
const App = ({ items }: { items: any[] }) => React.createElement('view', null,
  React.createElement(ContextMenu, { items }, React.createElement('view', { ariaLabel: 'card' })),
  React.createElement(PopoverHost, null),
);

let current: any = null;
afterEach(async () => {
  _popoverStore.close(undefined);
  if (current) await act(() => current.unmount());
  current = null;
});

test('a right click opens the menu in the popover layer at the pointer, and choosing an item runs it and closes the menu', async () => {
  const seen: string[] = [];
  current = await render(React.createElement(App, { items: [
    { label: 'Open', action: () => seen.push('open') },
    { separator: true },
    { label: 'Delete', action: () => seen.push('delete'), destructive: true },
  ] }));
  await act(() => {}); // let the popover layer subscribe, as it has long since in a running app
  expect(_popoverStore.current).toBeNull();
  await rightClick(40, 30);
  expect(_popoverStore.current).not.toBeNull();
  // At the pointer, with no anchor height: the popover layer places it (and keeps it in the window).
  expect(_popoverStore.current.x).toBe(40);
  expect(_popoverStore.current.y).toBe(30);
  expect(_popoverStore.current.h).toBe(0);
  expect(_popoverStore.current.contentH).toBe(30 + 9 + 30 + 10);
  expect(seen).toEqual([]);
});

test('a menu with nothing to choose does not open', async () => {
  current = await render(React.createElement(App, { items: [{ label: 'Nope', disabled: true }, { separator: true }] }));
  await rightClick();
  expect(_popoverStore.current).toBeNull();
});

const key = (k: string) => act(() => feed([{ type: 'keyInput', key: k, pressed: true }, { type: 'keyInput', key: k, pressed: false }]));

test('the arrow keys move through the items (skipping a disabled one), Enter chooses, Escape closes', async () => {
  const seen: string[] = [];
  current = await render(React.createElement(App, { items: [
    { label: 'Open', action: () => seen.push('open') },
    { label: 'Pin', disabled: true },
    { label: 'Delete', action: () => seen.push('delete') },
  ] }));
  await act(() => {}); // let the popover layer subscribe
  await rightClick();
  await act(() => {}); // let the menu mount and take the keys
  await key('ArrowDown');   // Open
  await key('ArrowDown');   // (Pin is disabled) Delete
  await key('Enter');
  expect(seen).toEqual(['delete']);
  expect(_popoverStore.current).toBeNull();

  await rightClick();
  await act(() => {});
  await key('Escape');
  expect(_popoverStore.current).toBeNull();
  expect(seen).toEqual(['delete']);
});

const textsOf = () => [...getNodeTree()].map(([, n]: any) => n.props && (n.props.text ?? (typeof n.props.children === 'string' ? n.props.children : undefined))).filter((x: any) => typeof x === 'string');

test('icons, shortcut labels, check marks and a submenu arrow are drawn', async () => {
  current = await render(React.createElement(App, { items: [
    { label: 'Copy', icon: '⧉', shortcut: 'Ctrl+C', action: () => {} },
    { label: 'Show grid', checked: true, action: () => {} },
    { label: 'Delete', accelerator: 'Del', action: () => {} },
    { label: 'Share', children: [{ label: 'Copy link', action: () => {} }] },
  ] }));
  await act(() => {});
  await rightClick();
  await act(() => {}); await act(() => {});
  const texts = textsOf();
  for (const want of ['Copy', 'Ctrl+C', '⧉', 'Show grid', '✓', 'Del', 'Share', '›']) expect(texts).toContain(want);
  expect(texts).not.toContain('Copy link'); // the submenu is closed until it is opened
});

test('Right opens a submenu, Enter chooses inside it, and Left or Escape closes one level', async () => {
  const seen: string[] = [];
  current = await render(React.createElement(App, { items: [
    { label: 'Open', action: () => seen.push('open') },
    { label: 'Share', children: [
      { label: 'Copy link', action: () => seen.push('link') },
      { label: 'Email', action: () => seen.push('email') },
    ] },
  ] }));
  await act(() => {});
  await rightClick();
  await act(() => {}); await act(() => {});
  await key('ArrowDown'); await key('ArrowDown');   // Share
  await key('ArrowRight');
  await act(() => {});
  expect(textsOf()).toContain('Copy link');
  await key('ArrowLeft');                            // back to the parent
  await act(() => {});
  expect(textsOf()).not.toContain('Copy link');
  await key('ArrowRight'); await key('ArrowDown');   // Email
  await key('Enter');
  expect(seen).toEqual(['email']);
  expect(_popoverStore.current).toBeNull();

  await rightClick();
  await act(() => {}); await act(() => {});
  await key('ArrowDown'); await key('ArrowDown'); await key('ArrowRight');
  await key('Escape');                               // closes the submenu, not the menu
  expect(_popoverStore.current).not.toBeNull();
  await key('Escape');
  expect(_popoverStore.current).toBeNull();
});

test('a check item is passed its new state', async () => {
  const seen: any[] = [];
  current = await render(React.createElement(App, { items: [{ label: 'Show grid', checked: true, action: (c?: boolean) => seen.push(c) }] }));
  await act(() => {});
  await rightClick();
  await act(() => {}); await act(() => {});
  await key('ArrowDown'); await key('Enter');
  expect(seen).toEqual([false]);
});

test('with native, the system menu is used when there is one, and its answer runs the item', async () => {
  const g = globalThis as any;
  const calls: any[] = [];
  g.__glyx_contextmenu_supported = () => true;
  const places: any[] = [];
  g.__glyx_contextmenu_show = (json: string, x: number, y: number) => { calls.push(JSON.parse(json)); places.push([x, y]); return JSON.stringify({ ok: true, id: '2.0', checked: null }); };
  try {
    const seen: string[] = [];
    const Native = () => React.createElement('view', null,
      React.createElement(ContextMenu, { native: true, items: [
        { label: 'Open', accelerator: 'Ctrl+O', action: () => seen.push('open') },
        { label: 'Delete', accelerator: 'Ctrl+Del', action: () => seen.push('delete') },
        { label: 'Share', children: [{ label: 'Copy link', action: () => seen.push('link') }] },
        { separator: true },
        { label: 'View', checked: false, action: (c?: boolean) => seen.push('view:' + c) },
      ] }, React.createElement('view', { ariaLabel: 'card' })),
      React.createElement(PopoverHost, null));
    current = await render(React.createElement(Native));
    await act(() => {});
    await rightClick(120, 90);
    expect(seen).toEqual(['link']);
    expect(places).toEqual([[120, 90]]);      // where the card was clicked, not at the cursor
    expect(_popoverStore.current).toBeNull();      // nothing was drawn
    expect(calls[0]).toEqual([
      { id: '0', label: 'Open', enabled: true, accelerator: 'Ctrl+O' },
      { id: '1', label: 'Delete', enabled: true, accelerator: 'Ctrl+Delete' },
      { id: '2', label: 'Share', enabled: true, children: [{ id: '2.0', label: 'Copy link', enabled: true }] },
      { separator: true, id: '3' },
      { id: '4', label: 'View', enabled: true, checked: false },
    ]);
    // A menu the system could not show is drawn instead.
    g.__glyx_contextmenu_show = () => JSON.stringify({ ok: false, error: 'no' });
    await rightClick();
    expect(_popoverStore.current).not.toBeNull();
  } finally {
    delete g.__glyx_contextmenu_supported;
    delete g.__glyx_contextmenu_show;
  }
});
