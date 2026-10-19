// Colour maths for <ColorPicker>: hex strings, RGB and HSV. Pure functions, no runtime needed.

export interface Rgba { r: number; g: number; b: number; a: number }   // r, g, b 0-255; a 0-1
export interface Hsv  { h: number; s: number; v: number }               // h 0-360; s, v 0-1

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Parse `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (the `#` is optional). Returns null when it is not a colour. */
export function hexToRgba(input: string): Rgba | null {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]+$/.test(s)) return null;
  if (s.length === 3 || s.length === 4) s = s.split('').map((c) => c + c).join('');
  if (s.length !== 6 && s.length !== 8) return null;
  const n = (i: number) => parseInt(s.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: s.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1 };
}

const h2 = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');

/** `#rrggbb`, or `#rrggbbaa` when `withAlpha` and the colour is not fully opaque. */
export function rgbaToHex({ r, g, b, a }: Rgba, withAlpha = false): string {
  const base = '#' + h2(r) + h2(g) + h2(b);
  return withAlpha && a < 1 ? base + h2(a * 255) : base;
}

export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

/** Whether black or white text reads better on this colour (for a label over a swatch). */
export function readableOn({ r, g, b }: { r: number; g: number; b: number }): '#000000' | '#ffffff' {
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#000000' : '#ffffff';
}
