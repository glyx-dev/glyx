import { test, expect } from 'bun:test';
import { hexToRgba, rgbaToHex, rgbToHsv, hsvToRgb, readableOn } from './colorMath.js';

test('hexToRgba reads 3, 4, 6 and 8 digit colours, with or without #, and rejects the rest', () => {
  expect(hexToRgba('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  expect(hexToRgba('#7aa2f7')).toEqual({ r: 122, g: 162, b: 247, a: 1 });
  expect(hexToRgba('7AA2F7')).toEqual({ r: 122, g: 162, b: 247, a: 1 });
  expect(hexToRgba('#f008')).toEqual({ r: 255, g: 0, b: 0, a: 0.533 });
  expect(hexToRgba('#00000080')?.a).toBeCloseTo(0.502, 2);
  for (const bad of ['', '#', '#12', '#12345', '#1234567', 'red', '#ggg', null as any]) expect(hexToRgba(bad)).toBeNull();
});

test('rgbaToHex writes #rrggbb, adding alpha only when asked and not opaque', () => {
  expect(rgbaToHex({ r: 122, g: 162, b: 247, a: 1 })).toBe('#7aa2f7');
  expect(rgbaToHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#000000');
  expect(rgbaToHex({ r: 0, g: 0, b: 0, a: 0.5 }, true)).toBe('#00000080');
  expect(rgbaToHex({ r: 1, g: 2, b: 3, a: 1 }, true)).toBe('#010203');
});

test('RGB and HSV convert both ways', () => {
  expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 1, v: 1 });
  expect(rgbToHsv(0, 255, 0).h).toBe(120);
  expect(rgbToHsv(0, 0, 255).h).toBe(240);
  expect(rgbToHsv(128, 128, 128)).toMatchObject({ h: 0, s: 0 });
  expect(hsvToRgb(0, 1, 1)).toEqual({ r: 255, g: 0, b: 0 });
  expect(hsvToRgb(60, 1, 1)).toEqual({ r: 255, g: 255, b: 0 });
  expect(hsvToRgb(180, 0.5, 1)).toEqual({ r: 128, g: 255, b: 255 });
  expect(hsvToRgb(360, 1, 1)).toEqual({ r: 255, g: 0, b: 0 });
  // every colour on a coarse grid survives a round trip
  for (let r = 0; r < 256; r += 51) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 51) {
    const h = rgbToHsv(r, g, b);
    expect(hsvToRgb(h.h, h.s, h.v)).toEqual({ r, g, b });
  }
});

test('readableOn picks black on light colours and white on dark ones', () => {
  expect(readableOn({ r: 250, g: 250, b: 250 })).toBe('#000000');
  expect(readableOn({ r: 20, g: 20, b: 40 })).toBe('#ffffff');
});
