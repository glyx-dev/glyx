import { test, expect, afterEach } from 'bun:test';
import React from 'react';
import { render, act, getNodeTree } from '@glyx-dev/testing';
import { ColorPicker } from './colorPicker.js';
import { PopoverHost, _popoverStore } from './popover.js';
import { dispatchEvents, setFocus } from './events.js';

function feed(events: any[]) {
  const prev = (globalThis as any).__glyx_pollEvents;
  (globalThis as any).__glyx_pollEvents = () => events;
  try { dispatchEvents(); } finally { (globalThis as any).__glyx_pollEvents = prev; }
}
const labelled = (label: string) => [...getNodeTree()].find(([, n]: any) => n.props?.ariaLabel === label);

const savedLayout = (globalThis as any).__glyx_getLayout;
let current: any = null;
afterEach(async () => {
  _popoverStore.close(undefined);
  if (current) await act(() => current.unmount());
  current = null;
});

function mount(props: any) {
  const seen: string[] = [];
  const App = () => React.createElement('view', null,
    React.createElement(ColorPicker, { onValueChange: (c: string) => seen.push(c), ...props }),
    React.createElement(PopoverHost, null));
  return render(React.createElement(App)).then((r) => { current = r; return seen; });
}

test('the button shows the colour as hex and its accessible name', async () => {
  await mount({ value: '#7aa2f7' });
  expect(labelled('Colour #7AA2F7')).toBeTruthy();
});

test('an alpha picker shows the opacity in the name only when not opaque', async () => {
  await mount({ value: '#00000080', alpha: true });
  expect(labelled('Colour #00000080')).toBeTruthy();
});

test('opening shows the panel; typing a hex colour reports it', async () => {
  (globalThis as any).__glyx_getLayout = (id: number) => ({ x: 10, y: 10, width: 240, height: 40, boxX: 10, boxY: 10, boxWidth: 240, boxHeight: 40 });
  const seen = await mount({ value: '#000000' });
  // The button is the node that holds the hex text.
  const text = [...getNodeTree()].find(([, n]: any) => n.props?.text === '#000000')!;
  const btn = [...getNodeTree()].find(([, n]: any) => n.children?.includes(text[0]))!;
  await act(() => feed([
    { type: 'mouseButton', x: 20, y: 20, button: 0, pressed: true, target: btn[0] },
    { type: 'mouseButton', x: 20, y: 20, button: 0, pressed: false, target: btn[0] },
  ]));
  expect(labelled('Hue')).toBeTruthy();
  expect(labelled('Saturation and brightness')).toBeTruthy();
  const hex = labelled('Hex colour')!;
  await act(() => setFocus(hex[0]));
  const keys = [...'ff0000'];
  // select all and replace the field's text with the new colour
  await act(() => feed([
    { type: 'keyInput', key: 'ControlLeft', pressed: true }, { type: 'keyInput', key: 'KeyA', pressed: true },
    { type: 'keyInput', key: 'KeyA', pressed: false }, { type: 'keyInput', key: 'ControlLeft', pressed: false },
  ]));
  for (const ch of '#' + keys.join('')) {
    await act(() => feed([{ type: 'keyInput', key: ch === '#' ? 'Digit3' : 'Key' + ch.toUpperCase(), text: ch, pressed: true }]));
  }
  expect(seen[seen.length - 1]).toBe('#ff0000');
  (globalThis as any).__glyx_getLayout = savedLayout;
});

test('clicking the hue strip and the square changes the colour', async () => {
  (globalThis as any).__glyx_getLayout = () => ({ x: 0, y: 0, width: 208, height: 150, boxX: 0, boxY: 0, boxWidth: 208, boxHeight: 150 });
  const seen = await mount({ value: '#ff0000' });
  const text = [...getNodeTree()].find(([, n]: any) => n.props?.text === '#FF0000')!;
  const btn = [...getNodeTree()].find(([, n]: any) => n.children?.includes(text[0]))!;
  const click = (id: number, x: number, y: number) => act(() => feed([
    { type: 'mouseButton', x, y, button: 0, pressed: true, target: id },
    { type: 'mouseButton', x, y, button: 0, pressed: false, target: id },
  ]));
  await click(btn[0], 20, 20);
  // Hue strip: halfway along is 180 degrees, cyan at full saturation and brightness.
  await click(labelled('Hue')![0], 104, 7);
  expect(seen[seen.length - 1]).toBe('#00ffff');
  // The square: the right edge (full saturation), the bottom (no brightness) is black.
  await click(labelled('Saturation and brightness')![0], 208, 150);
  expect(seen[seen.length - 1]).toBe('#000000');
  // The top-left corner is white.
  await click(labelled('Saturation and brightness')![0], 0, 0);
  expect(seen[seen.length - 1]).toBe('#ffffff');
  (globalThis as any).__glyx_getLayout = savedLayout;
});
