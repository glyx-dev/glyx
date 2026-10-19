// @glyx-dev/context-menu — right-click context menus.
//
// Wraps content in a `Pressable` that listens for the native `onRightPress` and opens a menu at the pointer. The menu is either drawn by Glyx
// in the app's root popover layer (`openPopover`: in window coordinates, never clipped by a scroller or covered by other content, flipped
// above near the bottom edge) or, with `native`, the operating system's own menu (Windows: submenus, check marks and accelerator labels
// in the system's look; the drawn menu is the fallback where there is none).
//
// Items can have icons, shortcut labels, check marks and submenus. Dismisses on a click (left or right) outside it, on Escape, or when an
// item is chosen. Keyboard: Up / Down move, Right opens a submenu, Left or Escape closes it, Enter chooses.
//
//   import { ContextMenu } from '@glyx-dev/context-menu';
//   <ContextMenu items={[
//     { label: 'Open', icon: '↗', shortcut: 'Enter', action: () => open(id) },
//     { label: 'Share', children: [
//       { label: 'Copy link', action: () => copyLink(id) },
//       { label: 'Email…', action: () => email(id) },
//     ] },
//     { separator: true },
//     { label: 'Delete', accelerator: 'Del', action: () => del(id), destructive: true },
//   ]}>
//     <NoteCard note={note} />
//   </ContextMenu>

import React from 'react';
import { View, Text, Pressable, openPopover, closePopover, addKeyListener, removeKeyListener, useWindowSize } from '@glyx-dev/react';

const { useState, useEffect, useRef } = React;

/** A row of the menu, or (with `separator`) a divider line. */
export interface ContextMenuItem {
  /** Names the item in a native menu (defaults to its place in the list). */
  id?: string;
  label?: string;
  /** Runs when the item is chosen. A check item (`checked` is set) is passed its new state. */
  action?: (checked?: boolean) => void;
  separator?: boolean;
  disabled?: boolean;
  /** Draws the label in red (Delete, Remove, ...). Drawn menus only. */
  destructive?: boolean;
  /** A glyph or emoji (a string), or any element, in the column before the label. Drawn menus only. */
  icon?: React.ReactNode;
  /** Text shown at the right edge, such as `Ctrl+C`. Drawn menus only; defaults to `accelerator`. */
  shortcut?: string;
  /** A key chord such as `Ctrl+Shift+N` or `Del`. It is shown beside the item (native menus format it themselves); the menu does not trigger it. */
  accelerator?: string;
  /** Shows a check mark when true, none when false; an item with `checked` set (either way) is a check item. */
  checked?: boolean;
  /** Makes the item a submenu. */
  children?: ContextMenuItem[];
}

export interface ContextMenuProps {
  /** What the menu opens on when right-clicked. */
  children?: React.ReactNode;
  items?: ContextMenuItem[];
  /** The width of a drawn menu and of each submenu. Default 220. */
  width?: number;
  /** Use the operating system's own menu where there is one (Windows), the drawn one elsewhere. Default false. */
  native?: boolean;
}

// Rows have a fixed height (this component's own styling, not an estimate that can drift): the popover layer uses the total to decide
// whether the menu fits below the pointer, and a submenu is placed against the row that opened it.
const ITEM_H = 30;
const SEPARATOR_H = 9;
const PADDING = 4;
const BORDER = 1;
const OVERLAP = 4; // a submenu sits this far over its parent's edge
const COLORS = { panel: '#1C1C26', border: '#2A2A3A', hover: '#2A2A3A', text: '#E0E0F0', muted: '#8A90A2', disabled: '#444455', danger: '#E05060' };

const isSelectable = (it: ContextMenuItem) => !it.separator && !it.disabled;
const hasChildren = (it: ContextMenuItem | undefined) => !!it && Array.isArray(it.children) && it.children.length > 0;
const rowHeight = (it: ContextMenuItem) => (it.separator ? SEPARATOR_H : ITEM_H);
const listHeight = (items: ContextMenuItem[]) => items.reduce((h, it) => h + rowHeight(it), 2 * (PADDING + BORDER));
const rowTop = (items: ContextMenuItem[], index: number) => items.slice(0, index).reduce((h, it) => h + rowHeight(it), PADDING + BORDER);

/** Whether the menu has anything the user can choose or open. */
const anyChoice = (items: ContextMenuItem[]): boolean => items.some((it) => isSelectable(it) && (hasChildren(it) ? anyChoice(it.children!) : true));

function listAt(items: ContextMenuItem[], path: number[]): ContextMenuItem[] {
  let list = items;
  for (const i of path) list = list[i]?.children ?? [];
  return list;
}

function itemAt(items: ContextMenuItem[], path: number[]): ContextMenuItem | undefined {
  const list = listAt(items, path.slice(0, -1));
  return list[path[path.length - 1]];
}

/** The next selectable index after `from` in `list` (wrapping), or -1 when there is none. */
function step(list: ContextMenuItem[], from: number, dir: number): number {
  const n = list.length;
  let i = from;
  for (let k = 0; k < n; k++) {
    i = (i + dir + n) % n;
    if (isSelectable(list[i])) return i;
  }
  return -1;
}

const firstSelectable = (list: ContextMenuItem[]) => step(list, -1, 1);

// ── The drawn menu ────────────────────────────────────────────────────────────────────────────────

interface MenuListProps {
  items: ContextMenuItem[];
  width: number;
  /** Where the root panel's left edge and top edge are in the window, for placing submenus (the popover layer places the root). */
  rootLeft: number;
  rootTop: number;
  onChoose: (it: ContextMenuItem) => void;
  onClose: () => void;
}

/** The menu itself, mounted in the popover layer while it is open. Owns the keyboard: its keys are the menu's, not the page's. */
function MenuList({ items, width, rootLeft, rootTop, onChoose, onClose }: MenuListProps) {
  // The highlighted path: one index per open level. A trailing -1 is a submenu that is open with nothing in it highlighted yet.
  const [hot, setHot] = useState<number[]>([]);
  const hotRef = useRef<number[]>([]);
  hotRef.current = hot;
  const { width: winW, height: winH } = useWindowSize();

  useEffect(() => {
    const onKey = (ev: { key: string; pressed: boolean }) => {
      if (!ev.pressed) return true; // the release of a key the menu took
      const path = hotRef.current;
      const depth = Math.max(0, path.length - 1);
      const list = listAt(items, path.slice(0, depth));
      const here = path.length ? path[path.length - 1] : -1;
      const open = (p: number[]) => {
        const sub = itemAt(items, p)?.children ?? [];
        setHot([...p, firstSelectable(sub)]);
      };
      switch (ev.key) {
        case 'ArrowDown': case 'ArrowUp': {
          const next = step(list, here, ev.key === 'ArrowDown' ? 1 : -1);
          if (next >= 0) setHot([...path.slice(0, depth), next]);
          break;
        }
        case 'ArrowRight': {
          const it = path.length && here >= 0 ? itemAt(items, path) : undefined;
          if (it && hasChildren(it) && isSelectable(it)) open(path);
          break;
        }
        case 'ArrowLeft':
          if (path.length > 1) setHot(path.slice(0, -1));
          break;
        case 'Enter': case 'Space': {
          const it = path.length && here >= 0 ? itemAt(items, path) : undefined;
          if (it && isSelectable(it)) { if (hasChildren(it)) open(path); else onChoose(it); }
          break;
        }
        case 'Escape':
          if (path.length > 1) setHot(path.slice(0, -1)); else onClose();
          break;
        default: return false; // not the menu's: the page may have it
      }
      return true;
    };
    addKeyListener(onKey);
    return () => removeKeyListener(onKey);
  }, [items]);

  // One panel: its rows, and (for the highlighted row, when its submenu is open) the submenu panel beside it.
  // `left` / `top` are the panel's window position, so a submenu can be kept inside the window.
  const panel = (list: ContextMenuItem[], prefix: number[], left: number, top: number): React.ReactElement => {
    const depth = prefix.length;
    const openIndex = hot.length > depth + 1 && hot[depth] >= 0 ? hot[depth] : -1;
    let sub: React.ReactElement | null = null;
    const parent = openIndex >= 0 ? list[openIndex] : undefined;
    if (parent && hasChildren(parent)) {
      const kids = parent.children!;
      // To the right of this panel when there is room, else to its left; and up if it would run off the bottom.
      const toRight = left + (width - OVERLAP) + width <= winW - 4;
      const subLeft = toRight ? left + width - OVERLAP : left - width + OVERLAP;
      const wantTop = top + rowTop(list, openIndex) - PADDING;
      const subTop = Math.max(4, Math.min(wantTop, winH - listHeight(kids) - 4));
      sub = React.createElement(View, {
        key: 'sub',
        style: { position: 'absolute', left: subLeft - left, top: subTop - top, width, zIndex: 1 },
      }, panel(kids, [...prefix, openIndex], subLeft, subTop));
    }
    return React.createElement(
      View,
      {
        style: {
          width, backgroundColor: COLORS.panel, borderRadius: 8,
          borderWidth: BORDER, borderColor: COLORS.border, padding: PADDING,
        },
      },
      ...list.map((it, i) => {
        if (it.separator) return React.createElement(View, { key: i, style: { height: SEPARATOR_H - 2 * 4 - 0, backgroundColor: COLORS.border, marginVertical: 4, marginHorizontal: 2 } });
        const isHot = hot[depth] === i;
        const color = it.disabled ? COLORS.disabled : it.destructive ? COLORS.danger : COLORS.text;
        const shortcut = it.shortcut ?? it.accelerator;
        const lead = it.checked === true ? '✓' : it.icon;
        return React.createElement(Pressable, {
          key: i,
          disabled: it.disabled,
          feedback: false,
          onPress: () => { if (hasChildren(it)) setHot([...prefix, i, firstSelectable(it.children!)]); else onChoose(it); },
          onHoverIn: () => {
            if (it.disabled) return;
            // Hovering a submenu's row opens it; any other row closes whatever was open beside it.
            setHot(hasChildren(it) ? [...prefix, i, -1] : [...prefix, i]);
          },
          style: {
            height: ITEM_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderRadius: 6,
            backgroundColor: isHot ? COLORS.hover : 'transparent',
          },
        },
          React.createElement(View, { style: { width: 20, alignItems: 'center' } },
            lead == null || lead === false ? null
              : typeof lead === 'string' ? React.createElement(Text, { fontSize: 13, style: { color: it.disabled ? COLORS.disabled : COLORS.muted } }, lead)
              : lead),
          React.createElement(Text, { fontSize: 13, style: { color, flex: 1, marginLeft: 4 } }, it.label),
          hasChildren(it)
            ? React.createElement(Text, { fontSize: 16, style: { color: COLORS.muted } }, '›')
            : shortcut ? React.createElement(Text, { fontSize: 12, style: { color: it.disabled ? COLORS.disabled : COLORS.muted } }, shortcut) : null,
        );
      }),
      sub,
    );
  };

  return panel(items, [], rootLeft, rootTop);
}

// ── The native menu ───────────────────────────────────────────────────────────────────────────────

const g = globalThis as any;

/** Whether the operating system can show its own popup menu here. */
function nativeSupported(): boolean {
  return typeof g.__glyx_contextmenu_supported === 'function' && typeof g.__glyx_contextmenu_show === 'function' && !!g.__glyx_contextmenu_supported();
}

// The names a native menu knows keys by (muda's), for the short forms people write.
const KEY_NAMES: Record<string, string> = { del: 'Delete', esc: 'Escape', ins: 'Insert', return: 'Enter', pgup: 'PageUp', pgdn: 'PageDown', cmd: 'Super', win: 'Super' };
const nativeAccelerator = (a: string) => a.split('+').map((part) => KEY_NAMES[part.trim().toLowerCase()] ?? part.trim()).join('+');

/** The menu description the native side takes: ids are paths (`0`, `2.1`), so a choice can be mapped back to its item. */
function toNative(items: ContextMenuItem[], prefix = ''): any[] {
  return items.map((it, i) => {
    const id = prefix + i;
    if (it.separator) return { separator: true, id };
    if (hasChildren(it)) return { id, label: it.label ?? '', enabled: !it.disabled, children: toNative(it.children!, id + '.') };
    return {
      id, label: it.label ?? '', enabled: !it.disabled,
      ...(it.checked !== undefined ? { checked: !!it.checked } : null),
      ...(it.accelerator ? { accelerator: nativeAccelerator(it.accelerator) } : null),
    };
  });
}

function byPath(items: ContextMenuItem[], id: string): ContextMenuItem | undefined {
  let list = items;
  let it: ContextMenuItem | undefined;
  for (const part of id.split('.')) { it = list[Number(part)]; list = it?.children ?? []; }
  return it;
}

/** Shows the native menu and runs the chosen item. False when it could not be shown (the caller draws its own). */
function showNative(items: ContextMenuItem[]): boolean {
  let reply: any;
  try { reply = JSON.parse(g.__glyx_contextmenu_show(JSON.stringify(toNative(items)))); } catch { return false; }
  if (!reply || reply.ok !== true) return false;
  if (reply.id != null) {
    const it = byPath(items, String(reply.id));
    if (it && isSelectable(it)) it.action?.(reply.checked == null ? undefined : !!reply.checked);
  }
  return true;
}

// ── The component ─────────────────────────────────────────────────────────────────────────────────

export function ContextMenu({ children, items = [], width = 220, native = false }: ContextMenuProps): React.ReactElement {
  // The menu that is open for this wrapper, so it can be closed when the wrapper goes away (a list row removed while its menu is up).
  const openId = useRef<number | null>(null);
  const { width: winW, height: winH } = useWindowSize();
  useEffect(() => () => { if (openId.current != null) closePopover(openId.current); }, []);

  const show = (e: { x: number; y: number }) => {
    if (!anyChoice(items)) return;
    if (native && nativeSupported() && showNative(items)) return;
    const contentH = listHeight(items);
    // Where the popover layer will put the root panel (it keeps it in the window and flips it above near the bottom): the same arithmetic,
    // so submenus can be placed and kept inside the window too.
    const belowY = e.y + 4;
    const flipUp = belowY + contentH > winH && e.y - contentH - 4 >= 0;
    const rootTop = flipUp ? Math.max(4, e.y - contentH - 4) : belowY;
    const rootLeft = Math.max(4, Math.min(e.x, winW - width - 4));
    const id: number = openPopover({
      // Anchored at the pointer (a rect of no size).
      x: e.x, y: e.y, h: 0, width, contentH,
      render: () => React.createElement(MenuList, {
        items, width, rootLeft, rootTop,
        onChoose: (it: ContextMenuItem) => { closePopover(id); it.action?.(it.checked === undefined ? undefined : !it.checked); },
        onClose: () => closePopover(id),
      }),
      onClose: () => { if (openId.current === id) openId.current = null; },
    });
    openId.current = id;
  };

  return React.createElement(Pressable, { onRightPress: show, feedback: false }, children);
}
