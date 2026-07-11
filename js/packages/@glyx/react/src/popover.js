import React, { useState, useEffect } from 'react';
import { addGlobalClickListener, removeGlobalClickListener } from './events.js';
import { View, Pressable, useWindowSize } from './core.js';

// ── Popover overlay ─────────────────────────────────────────────────────────────
//
// A single floating layer rendered at the app root. Because it lives at the root
// (not inside any ScrollView), its absolutely-positioned content is never clipped
// — the fix for floating dropdowns/menus. Positioned in window coordinates with
// flip-up near the bottom edge and horizontal clamping.

let _popoverNextId = 0;
export const _popoverStore = {
  current: null, // { id, x, y, h, width, contentH, render, onClose }
  listeners: new Set(),
  open(p) { const id = ++_popoverNextId; this.current = { id, ...p }; this._emit(); return id; },
  close(id) {
    if (!this.current) return;
    if (id != null && this.current.id !== id) return;
    const cb = this.current.onClose;
    this.current = null;
    this._emit();
    if (cb) cb();
  },
  _emit() { for (const l of this.listeners) l(); },
};

/** Open a floating popover anchored to a rect. Returns an id for closePopover(). */
export function openPopover(opts) { return _popoverStore.open(opts); }
/** Close the active popover (optionally only if it matches `id`). */
export function closePopover(id) { _popoverStore.close(id); }

/**
 * Root overlay host. Auto-injected by render(); you normally never use it
 * directly. Renders the active popover, a full-screen backdrop for outside-click
 * dismissal, and handles flip/clamp positioning.
 */
export function PopoverHost() {
  const [, force] = useState(0);
  const { width: winW, height: winH } = useWindowSize();
  useEffect(() => {
    const l = () => force((n) => (n + 1) | 0);
    _popoverStore.listeners.add(l);
    return () => { _popoverStore.listeners.delete(l); };
  }, []);

  const p = _popoverStore.current;
  if (!p) return null;

  const PAD = 4;
  const cw  = p.width || 240;
  const ch  = p.contentH || 200;
  const belowY = p.y + p.h + PAD;
  const flipUp = (belowY + ch > winH) && (p.y - ch - PAD >= 0);
  const top  = flipUp ? Math.max(4, p.y - ch - PAD) : belowY;
  const left = Math.max(4, Math.min(p.x, winW - cw - 4));

  return React.createElement(Pressable, {
    // Full-screen backdrop — a click anywhere outside the content dismisses.
    // feedback:false — opacity feedback on a container multiplies through the
    // subtree, which made the whole popover dim on hover.
    onPress: () => _popoverStore.close(p.id),
    feedback: false,
    style: { position: 'absolute', left: 0, top: 0, width: winW, height: winH, zIndex: 9000 },
  },
    React.createElement(Pressable, {
      onPress: () => {}, // absorb clicks inside the popover so it doesn't dismiss
      feedback: false,
      style: { position: 'absolute', left, top, width: cw, zIndex: 9001 },
    }, p.render(p.id))
  );
}
