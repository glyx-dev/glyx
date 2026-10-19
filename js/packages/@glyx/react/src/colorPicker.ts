import React, { useState, useEffect, useRef, useCallback } from 'react';
import { registerDraggable, unregisterDraggable, registerPressable, unregisterPressable, registerFocusable, unregisterFocusable, registerA11yValue, unregisterA11yValue } from './events.js';
import { View, Text, Pressable } from './core.js';
import { Canvas } from './canvas.js';
import { openPopover, closePopover } from './popover.js';
import { flattenStyle } from './style.js';
import { SelectColorsContext, SelectColorsProvider, TextInput } from './controls.js';
import { hexToRgba, rgbaToHex, rgbToHsv, hsvToRgb } from './colorMath.js';
import type { ColorPickerProps } from './types.js';

// <ColorPicker value="#7aa2f7" onValueChange={setColor} alpha presets />
//
// A swatch button that opens a popover with a saturation/brightness square, a hue strip, an optional alpha strip, a hex field and
// optional preset swatches. Drawn by Glyx, so it looks the same on every platform. The value is a hex string: `#rrggbb`, or
// `#rrggbbaa` when `alpha` is on and the colour is not fully opaque.

const PANEL_W = 232;
const PAD = 12;
const AREA_W = PANEL_W - PAD * 2;
const SV_H = 150;
const BAR_H = 14;
const DEFAULT_PRESETS = ['#f38ba8', '#fab387', '#f9e2af', '#a6e3a1', '#94e2d5', '#89b4fa', '#b4befe', '#cba6f7', '#ffffff', '#9399b2', '#45475a', '#000000'];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * A rectangle the pointer drags in: reports the position as fractions (0-1) of its width and height. Clicking works as well as
 * dragging, the arrow keys move it once focused (Shift for bigger steps), and a screen reader can step it.
 */
function DragArea({ width, height, onPos, onKey, label, valueText, disabled, children }: Record<string, any>) {
  const nodeId = useRef<any>(null);
  const cb = useRef({ onPos, onKey, disabled });
  cb.current = { onPos, onKey, disabled };
  const [focused, setFocused] = useState(false);

  const fromPoint = useCallback((x: number, y: number) => {
    if (cb.current.disabled || typeof __glyx_getLayout === 'undefined' || nodeId.current == null) return;
    const l = __glyx_getLayout(nodeId.current);
    if (!l || l.width <= 0 || l.height <= 0) return;
    cb.current.onPos(clamp01((x - l.x) / l.width), clamp01((y - l.y) / l.height));
  }, []);

  const onMount = useCallback((id: any) => {
    nodeId.current = id;
    const focus = () => { if (typeof __glyx_setFocus !== 'undefined') __glyx_setFocus(id); };
    registerDraggable(id, {
      onDragStart: ({ x, y }: any) => { focus(); fromPoint(x, y); },
      onDragMove:  ({ x, y }: any) => fromPoint(x, y),
    });
    registerPressable(id, { onPress: ({ x, y }: any) => { focus(); fromPoint(x, y); }, onPressIn() {}, onPressOut() {}, onHoverIn() {}, onHoverOut() {} });
    registerFocusable(id, {
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      onKeyDown: (e: any) => {
        if (cb.current.disabled || !cb.current.onKey) return;
        const step = e.shift ? 10 : 1;
        const d = e.key === 'ArrowLeft' ? [-step, 0] : e.key === 'ArrowRight' ? [step, 0] : e.key === 'ArrowUp' ? [0, -step] : e.key === 'ArrowDown' ? [0, step] : null;
        if (d && cb.current.onKey(d[0], d[1]) !== false) e.preventDefault?.();
      },
    });
    registerA11yValue(id, {
      onIncrement: () => cb.current.onKey?.(1, 0),
      onDecrement: () => cb.current.onKey?.(-1, 0),
      onSetValue: () => {},
    });
  }, [fromPoint]);

  useEffect(() => () => {
    if (nodeId.current != null) {
      unregisterDraggable(nodeId.current); unregisterPressable(nodeId.current);
      unregisterFocusable(nodeId.current); unregisterA11yValue(nodeId.current);
    }
  }, []);

  return React.createElement(View, {
    _glyxOnMount: onMount, pressable: true, width, height, role: 'slider', ariaLabel: label, ariaValueText: valueText, cursor: disabled ? 'default' : 'crosshair',
    style: { borderRadius: 6, clip: true, borderWidth: focused ? 2 : 0, borderColor: '#7aa2f7' },
  }, children);
}

/** Paint into a canvas whenever `deps` change. */
function Painted({ width, height, paint, deps }: { width: number; height: number; paint: (ctx: any, w: number, h: number) => void; deps: any[] }) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const ctx = ref.current;
    if (!ctx) return;
    paint(ctx, width, height);
    ctx.flush?.();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return React.createElement(Canvas, { ref, style: { width, height } });
}

const rgba = (r: number, g: number, b: number, a: number) => `rgba(${r},${g},${b},${a})`;

function paintSV(hue: number) {
  return (ctx: any, w: number, h: number) => {
    const c = hsvToRgb(hue, 1, 1);
    ctx.fillStyle = rgbaToHex({ ...c, a: 1 }); ctx.fillRect(0, 0, w, h);
    const white = ctx.createLinearGradient(0, 0, w, 0);
    white.addColorStop(0, rgba(255, 255, 255, 1)); white.addColorStop(1, rgba(255, 255, 255, 0));
    ctx.fillStyle = white; ctx.fillRect(0, 0, w, h);
    const black = ctx.createLinearGradient(0, 0, 0, h);
    black.addColorStop(0, rgba(0, 0, 0, 0)); black.addColorStop(1, rgba(0, 0, 0, 1));
    ctx.fillStyle = black; ctx.fillRect(0, 0, w, h);
  };
}

function paintHue(ctx: any, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i <= 6; i++) { const c = hsvToRgb(i * 60, 1, 1); g.addColorStop(i / 6, rgba(c.r, c.g, c.b, 1)); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

function paintAlpha(c: { r: number; g: number; b: number }) {
  return (ctx: any, w: number, h: number) => {
    // A checkerboard so transparency shows, then the colour fading in over it.
    const S = 7;
    for (let y = 0; y * S < h; y++) for (let x = 0; x * S < w; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#8a8a96' : '#c8c8d2';
      ctx.fillRect(x * S, y * S, S, S);
    }
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, rgba(c.r, c.g, c.b, 0)); g.addColorStop(1, rgba(c.r, c.g, c.b, 1));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  };
}

const ring = (x: number, y: number, size: number) => React.createElement(View, {
  width: size, height: size,
  style: { position: 'absolute', left: x - size / 2, top: y - size / 2, borderRadius: size / 2, borderWidth: 2, borderColor: '#ffffff' },
});
const tick = (x: number, h: number) => React.createElement(View, {
  width: 6, height: h,
  style: { position: 'absolute', left: x - 3, top: 0, borderRadius: 2, borderWidth: 2, borderColor: '#ffffff' },
});

function ColorPanel({ initial, alpha, presets, onChange, C }: Record<string, any>) {
  const start = hexToRgba(initial) ?? { r: 0, g: 0, b: 0, a: 1 };
  const [hsv, setHsv] = useState(() => rgbToHsv(start.r, start.g, start.b));
  const [a, setA] = useState(start.a);
  const [text, setText] = useState(() => rgbaToHex(start, alpha));
  const hsvRef = useRef(hsv); hsvRef.current = hsv;
  const aRef = useRef(a); aRef.current = a;

  const emit = (h: number, s: number, v: number, al: number) => {
    setHsv({ h, s, v }); setA(al);
    const hex = rgbaToHex({ ...hsvToRgb(h, s, v), a: al }, alpha);
    setText(hex);
    onChange(hex);
  };
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);

  const applyText = (t: string) => {
    setText(t);
    const p = hexToRgba(t);
    if (!p || !(t.replace('#', '').length === 6 || t.replace('#', '').length === 8 || t.replace('#', '').length === 3 || t.replace('#', '').length === 4)) return;
    const n = rgbToHsv(p.r, p.g, p.b);
    // A grey or black has no hue of its own: keep the one on screen so the strip does not jump.
    const h = n.s === 0 || n.v === 0 ? hsvRef.current.h : n.h;
    setHsv({ h, s: n.s, v: n.v });
    const al = alpha ? p.a : 1;
    setA(al);
    onChange(rgbaToHex({ r: p.r, g: p.g, b: p.b, a: al }, alpha));
  };

  const swatches: string[] = Array.isArray(presets) ? presets : presets ? DEFAULT_PRESETS : [];

  return React.createElement(View, {
    style: { width: PANEL_W, padding: PAD, gap: 10, backgroundColor: C.dropdownBg, borderWidth: 1, borderColor: C.dropdownBorder, borderRadius: 10 },
  },
    // Saturation (left to right) and brightness (top to bottom).
    React.createElement(DragArea, {
      width: AREA_W, height: SV_H, label: 'Saturation and brightness',
      valueText: `saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`,
      onPos: (fx: number, fy: number) => emit(hsvRef.current.h, fx, 1 - fy, aRef.current),
      onKey: (dx: number, dy: number) => emit(hsvRef.current.h, clamp01(hsvRef.current.s + dx / 100), clamp01(hsvRef.current.v - dy / 100), aRef.current),
    },
      React.createElement(Painted, { width: AREA_W, height: SV_H, paint: paintSV(hsv.h), deps: [Math.round(hsv.h * 4)] }),
      ring(hsv.s * AREA_W, (1 - hsv.v) * SV_H, 14),
    ),
    // Hue.
    React.createElement(DragArea, {
      width: AREA_W, height: BAR_H, label: 'Hue', valueText: `${Math.round(hsv.h)} degrees`,
      onPos: (fx: number) => emit(Math.min(359.99, fx * 360), hsvRef.current.s, hsvRef.current.v, aRef.current),
      onKey: (dx: number) => emit(Math.min(359.99, Math.max(0, hsvRef.current.h + dx * 3.6)), hsvRef.current.s, hsvRef.current.v, aRef.current),
    },
      React.createElement(Painted, { width: AREA_W, height: BAR_H, paint: paintHue, deps: [] }),
      tick((hsv.h / 360) * AREA_W, BAR_H),
    ),
    // Alpha.
    alpha ? React.createElement(DragArea, {
      width: AREA_W, height: BAR_H, label: 'Opacity', valueText: `${Math.round(a * 100)}%`,
      onPos: (fx: number) => emit(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v, Math.round(fx * 100) / 100),
      onKey: (dx: number) => emit(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v, clamp01(Math.round((aRef.current + dx / 100) * 100) / 100)),
    },
      React.createElement(Painted, { width: AREA_W, height: BAR_H, paint: paintAlpha(rgb), deps: [rgb.r, rgb.g, rgb.b] }),
      tick(a * AREA_W, BAR_H),
    ) : null,
    // The colour, and its hex.
    React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 10 } },
      React.createElement(View, { width: 32, height: 32, style: { borderRadius: 6, borderWidth: 1, borderColor: C.triggerBorder, backgroundColor: rgbaToHex({ ...rgb, a }, true) } }),
      React.createElement(TextInput, { value: text, onChangeText: applyText, width: AREA_W - 42, height: 32, fontSize: 13, maxLength: alpha ? 9 : 7, ariaLabel: 'Hex colour' }),
    ),
    swatches.length ? React.createElement(View, { style: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 } },
      ...swatches.map((hex) => React.createElement(Pressable, {
        key: hex, width: 22, height: 22, ariaLabel: hex,
        onPress: () => applyText(hex),
        style: { borderRadius: 5, backgroundColor: hex, borderWidth: 1, borderColor: C.triggerBorder },
      })),
    ) : null,
  );
}

export function ColorPicker({
  value = '#000000', onValueChange, onChange, alpha = false, presets, disabled = false, width = 240, style: styleProp, ...rest
}: ColorPickerProps) {
  const C = React.useContext(SelectColorsContext);
  const style = flattenStyle(styleProp);
  const emit = onValueChange ?? onChange;
  const [open, setOpen] = useState(false);
  const nodeId = useRef<any>(null);
  const popoverId = useRef<any>(null);
  const onMount = useCallback((id: any) => { nodeId.current = id; }, []);

  const close = () => {
    if (popoverId.current != null) { closePopover(popoverId.current); popoverId.current = null; }
    if (typeof __glyx_setFocus !== 'undefined' && nodeId.current != null) __glyx_setFocus(nodeId.current);
  };
  const toggle = () => {
    if (disabled) return;
    if (open) { close(); return; }
    const l = typeof __glyx_getLayout !== 'undefined' ? __glyx_getLayout(nodeId.current) : null;
    if (!l) return;
    setOpen(true);
    const swatchCount = Array.isArray(presets) ? presets.length : presets ? DEFAULT_PRESETS.length : 0;
    popoverId.current = openPopover({
      x: l.x, y: l.y, h: l.height, width: PANEL_W,
      contentH: PAD * 2 + SV_H + BAR_H * (alpha ? 2 : 1) + 32 + 10 * (alpha ? 4 : 3) + (swatchCount ? 10 + Math.ceil(swatchCount / 7) * 28 : 0),
      onClose: () => { popoverId.current = null; setOpen(false); },
      render: () => React.createElement(SelectColorsProvider, { colors: C },
        React.createElement(ColorPanel, { initial: value, alpha, presets, onChange: (hex: string) => emit?.(hex), C }),
      ),
    });
  };
  useEffect(() => () => { if (popoverId.current != null) closePopover(popoverId.current); }, []);

  const parsed = hexToRgba(value) ?? { r: 0, g: 0, b: 0, a: 1 };
  const label = rgbaToHex(parsed, alpha).toUpperCase();

  return React.createElement(View, {
    _glyxOnMount: onMount, role: 'combobox', ariaLabel: `Colour ${label}`,
    style: { alignSelf: 'flex-start', width, ...style },
    ...rest,
  },
    React.createElement(Pressable, {
      onPress: toggle, role: 'button', ariaLabel: `Colour ${label}`,
      style: {
        flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8, paddingRight: 10, height: 40, borderRadius: 8,
        backgroundColor: disabled ? C.triggerBgDisabled : C.triggerBg,
        borderWidth: 1, borderColor: open ? C.triggerBorderFocus : C.triggerBorder,
      },
    },
      React.createElement(View, { width: 24, height: 24, style: { borderRadius: 5, borderWidth: 1, borderColor: C.triggerBorder, backgroundColor: rgbaToHex(parsed, true) } }),
      React.createElement(Text, { height: 20, style: { color: disabled ? C.triggerPlaceholder : C.triggerText, fontSize: 14, flexGrow: 1 } }, label),
      React.createElement(Text, { width: 16, height: 16, style: { color: C.chevron, fontSize: 11 } }, open ? '▲' : '▼'),
    ),
  );
}
