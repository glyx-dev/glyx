// @glyx-dev/react: <MenuBar>, a menu bar drawn by Glyx itself.
//
// It takes the same menu description as the native `menubar` API (see
// ./api/menuSchema.js) and covers what a native bar cannot: Linux, where
// Glyx's windows are not GTK windows, and frameless windows with a custom
// title bar. `native` asks for the native bar where one exists and draws this
// one everywhere else.
//
//   <MenuBar items={MENU} onSelect={({ id, checked }) => ...} />
//
// Mouse: click a menu to open it, move across the bar to switch, click an item.
// Keyboard: Alt+letter opens a menu (the letter after `&`), then Up / Down /
// Left / Right move, Enter or Space chooses, Escape closes. Accelerators work
// whether or not a menu is open.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable } from './core.js';
import { addKeyListener, removeKeyListener, addGlobalClickListener, removeGlobalClickListener, runEditCommand } from './events.js';
import { validateMenu, normalizeMenu, parseAccelerator, matchesAccelerator } from './api/menuSchema.js';
import { menubar } from './api/menubar.js';

const DARK = {
  bar: '#16161F', panel: '#1C1C26', border: '#2A2A3A', text: '#E6E8EF', muted: '#8A90A2',
  disabled: '#555A6B', hover: '#2B2D3D', accent: '#F59E0B',
};

const BAR_HEIGHT = 30;
const ROW_HEIGHT = 28;
const CHAR_W = 7.4; // average glyph width at fontSize 13, for sizing a panel to its longest row

/** `'&File'` -> `{ before: '', key: 'F', after: 'ile', plain: 'File' }`. `&&` is a literal `&`. */
export function parseLabel(label) {
  const text = String(label ?? '');
  let out = '';
  let mnemonicAt = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '&') {
      if (text[i + 1] === '&') { out += '&'; i++; continue; }
      if (mnemonicAt < 0 && i + 1 < text.length) { mnemonicAt = out.length; continue; }
      continue;
    }
    out += text[i];
  }
  if (mnemonicAt < 0) return { before: out, key: '', after: '', plain: out };
  return { before: out.slice(0, mnemonicAt), key: out[mnemonicAt], after: out.slice(mnemonicAt + 1), plain: out };
}

const isAction = (it) => !it.separator && !(Array.isArray(it.children) && it.children.length > 0);
const hasChildren = (it) => Array.isArray(it.children) && it.children.length > 0;
const isEnabled = (it) => it.enabled !== false;
const selectable = (it) => !it.separator && isEnabled(it);

function itemAt(items, path) {
  let list = items;
  let it = null;
  for (const i of path) {
    if (!list || !list[i]) return null;
    it = list[i];
    list = it.children;
  }
  return it;
}

function listAt(items, path) {
  let list = items;
  for (const i of path) list = list?.[i]?.children;
  return list ?? [];
}

function step(list, from, dir) {
  const n = list.length;
  if (n === 0) return -1;
  let i = from;
  for (let k = 0; k < n; k++) {
    i = (i + dir + n) % n;
    if (selectable(list[i])) return i;
  }
  return -1;
}

const firstSelectable = (list) => step(list, -1, 1);

/** Flatten actionable items with their paths, to match accelerators. */
function collect(items, prefix = [], out = []) {
  items.forEach((it, i) => {
    const path = [...prefix, i];
    if (it.separator) return;
    if (hasChildren(it)) collect(it.children, path, out);
    else out.push({ item: it, path });
  });
  return out;
}

function checkedMap(items) {
  const m = {};
  for (const { item } of collect(items)) if (typeof item.checked === 'boolean') m[item.id] = item.checked;
  return m;
}

function Label({ text, color, size = 13, underline = true }) {
  const p = parseLabel(text);
  if (!p.key) return React.createElement(Text, { fontSize: size, style: { color } }, p.plain);
  return React.createElement(
    View, { style: { flexDirection: 'row' } },
    p.before ? React.createElement(Text, { fontSize: size, style: { color } }, p.before) : null,
    React.createElement(Text, { fontSize: size, style: { color, textDecorationLine: underline ? 'underline' : 'none' } }, p.key),
    p.after ? React.createElement(Text, { fontSize: size, style: { color } }, p.after) : null,
  );
}

export function MenuBar({ items: rawItems, onSelect, native = false, colors, style }) {
  const C = { ...DARK, ...(colors || {}) };
  const problem = useMemo(() => validateMenu(rawItems), [rawItems]);
  // A `role` fills in its own id, label and accelerator.
  const items = useMemo(() => (problem ? rawItems : normalizeMenu(rawItems)), [rawItems, problem]);
  const useNative = native && menubar.supported;

  const [open, setOpen] = useState(false);
  const [hot, setHot] = useState([]);                 // path of the highlighted entry: [menu], [menu, item], [menu, item, sub]...
  const [collapsed, setCollapsed] = useState(null);    // path ("2.1") whose submenu was closed with Left
  const [checks, setChecks] = useState(() => (problem ? {} : checkedMap(items)));
  const checksRef = useRef(checks);
  checksRef.current = checks;
  const pressedInside = useRef(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  // A new menu description resets the check marks to what it says.
  useEffect(() => { if (!problem) setChecks(checkedMap(items)); }, [items, problem]);

  const accelerators = useMemo(() => (problem ? [] : collect(items)
    .filter(({ item }) => item.accelerator && !item.role)
    .map(({ item, path }) => ({ item, path, acc: parseAccelerator(item.accelerator) }))), [items, problem]);

  const choose = (item) => {
    if (!item || !isAction(item) || !isEnabled(item)) return;
    if (item.role) {
      // The bar never took focus from the field, so an editing item acts on it directly. The menu counts as
      // closed from here (the re-render comes later), so it does not swallow the replayed chord.
      openRef.current = false;
      setOpen(false);
      setHot([]);
      runEditCommand(item.role);
      selectRef.current?.({ id: item.id, role: item.role });
      return;
    }
    let ev = { id: item.id };
    if (typeof item.checked === 'boolean') {
      const next = !(checksRef.current[item.id] ?? item.checked);
      setChecks((c) => ({ ...c, [item.id]: next }));
      ev = { id: item.id, checked: next };
    }
    openRef.current = false;
    setOpen(false);
    setHot([]);
    selectRef.current?.(ev);
  };
  const chooseRef = useRef(choose);
  chooseRef.current = choose;

  // Native bar where there is one: describe it, forward its choices, draw nothing.
  useEffect(() => {
    if (!useNative || problem) return undefined;
    try { menubar.set(items); } catch (e) { return undefined; }
    const off = menubar.onSelect((ev) => selectRef.current?.(ev));
    return () => { off(); menubar.clear(); };
  }, [useNative, items, problem]);

  // Keys: accelerators always, menu navigation while open.
  useEffect(() => {
    if (useNative || problem) return undefined;
    const handleKey = (ev) => {
      if (!ev.pressed) return;
      for (const { item, acc } of accelerators) {
        if (matchesAccelerator(acc, ev)) { chooseRef.current(item); return; }
      }
      // Alt+letter opens the menu whose mnemonic it is.
      if (ev.alt && !ev.ctrl && !ev.super && /^Key[A-Z]$/.test(ev.key)) {
        const letter = ev.key.slice(3);
        const idx = items.findIndex((m) => parseLabel(m.label).key.toUpperCase() === letter);
        if (idx >= 0 && isEnabled(items[idx])) {
          setOpen(true);
          setHot([idx, firstSelectable(items[idx].children)]);
          return;
        }
      }
      if (!openRef.current) return;
      const path = hotRef.current;
      const menu = path[0] ?? 0;
      const move = (dir) => {
        if (path.length <= 1) { setHot([menu, firstSelectable(items[menu].children)]); return; }
        const list = listAt(items, path.slice(0, -1));
        const next = step(list, path[path.length - 1], dir);
        if (next >= 0) setHot([...path.slice(0, -1), next]);
      };
      const sideways = (dir) => {
        const n = items.length;
        let next = menu;
        for (let k = 0; k < n; k++) { next = (next + dir + n) % n; if (isEnabled(items[next])) break; }
        setHot([next, firstSelectable(items[next].children)]);
      };
      switch (ev.key) {
        case 'ArrowDown': move(1); break;
        case 'ArrowUp': move(-1); break;
        case 'ArrowRight': {
          const it = itemAt(items, path);
          if (path.length > 1 && it && hasChildren(it)) { setCollapsed(null); setHot([...path, firstSelectable(it.children)]); }
          else sideways(1);
          break;
        }
        case 'ArrowLeft':
          if (path.length > 2) {
            // Back out of a submenu: highlight its parent and close the submenu until the pointer or keys reopen it.
            const parent = path.slice(0, -1);
            setCollapsed(parent.join('.'));
            setHot(parent);
          } else sideways(-1);
          break;
        case 'Enter': case 'Space': {
          const it = path.length > 1 ? itemAt(items, path) : null;
          if (it && hasChildren(it)) { setCollapsed(null); setHot([...path, firstSelectable(it.children)]); }
          else if (it) chooseRef.current(it);
          break;
        }
        case 'Escape': setOpen(false); setHot([]); break;
        default: break;
      }
    };
    // While a menu is open its keys are the menu's: the field that still has focus must not also act on them.
    const onKey = (ev) => {
      const wasOpen = openRef.current;
      handleKey(ev);
      return wasOpen && ev.pressed;
    };
    addKeyListener(onKey);
    return () => removeKeyListener(onKey);
  }, [useNative, problem, items, accelerators]);

  const openRef = useRef(open);
  openRef.current = open;
  const hotRef = useRef(hot);
  hotRef.current = hot;

  // A press anywhere outside the bar closes it. Presses inside mark themselves first.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = () => {
      setTimeout(() => {
        if (!pressedInside.current) { setOpen(false); setHot([]); }
        pressedInside.current = false;
      }, 0);
    };
    addGlobalClickListener(onClick);
    return () => removeGlobalClickListener(onClick);
  }, [open]);

  if (useNative) return null;
  if (problem) {
    return React.createElement(Text, { fontSize: 13, style: { color: '#f87171', padding: 8 } }, 'MenuBar: ' + problem);
  }

  // Called first thing in every press on the bar. `onPress` is the only press callback a plain click gets.
  const inside = () => { pressedInside.current = true; };
  const startsWith = (path, prefix) => prefix.length <= path.length && prefix.every((v, i) => path[i] === v);

  const renderPanel = (list, prefix) => {
    const labelChars = Math.max(...list.map((it) => (it.separator ? 0 : parseLabel(it.label).plain.length)), 4);
    const accChars = Math.max(...list.map((it) => String(it.accelerator ?? '').length), 0);
    const width = Math.max(190, Math.round((labelChars + accChars) * CHAR_W) + 78);
    return React.createElement(
      View,
      {
        role: 'menu',
        style: {
          position: 'absolute', zIndex: 9000, width,
          ...(prefix.length === 1 ? { top: '100%', left: 0 } : { top: -5, left: '100%' }),
          backgroundColor: C.panel, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 4,
        },
      },
      ...list.map((it, i) => {
        if (it.separator) {
          return React.createElement(View, { key: i, style: { height: 1, backgroundColor: C.border, marginVertical: 4, marginHorizontal: 6 } });
        }
        const path = [...prefix, i];
        const enabled = isEnabled(it);
        const sub = hasChildren(it);
        const isHot = hot.length === path.length && path.every((v, k) => hot[k] === v);
        const showSub = sub && startsWith(hot, path) && !(hot.length === path.length && collapsed === path.join('.'));
        const checkable = typeof it.checked === 'boolean';
        const checked = checkable && (checks[it.id] ?? it.checked);
        const color = enabled ? C.text : C.disabled;
        return React.createElement(
          View, { key: i, style: { position: 'relative' } },
          React.createElement(
            Pressable,
            {
              role: checkable ? 'menuitemcheckbox' : 'menuitem',
              ariaLabel: parseLabel(it.label).plain,
              checked: checkable ? !!checked : undefined,
              expanded: sub ? showSub : undefined,
              disabled: !enabled,
              feedback: false,
            keepFocus: true,
              keepFocus: true,
              onHoverIn: () => { if (enabled) { setCollapsed(null); setHot(path); } },
              onPress: () => { inside(); if (!enabled) return; if (sub) { setCollapsed(null); setHot(path); } else choose(it); },
              style: {
                height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderRadius: 5,
                backgroundColor: isHot && enabled ? C.hover : 'transparent',
              },
            },
            React.createElement(View, { style: { width: 20 } },
              checked ? React.createElement(Text, { fontSize: 13, style: { color: C.accent } }, '✓') : null),
            React.createElement(View, { style: { flex: 1 } }, React.createElement(Label, { text: it.label, color, underline: false })),
            it.accelerator
              ? React.createElement(Text, { fontSize: 12, style: { color: enabled ? C.muted : C.disabled, marginLeft: 16 } }, it.accelerator)
              : null,
            sub ? React.createElement(Text, { fontSize: 12, style: { color: C.muted, marginLeft: 12 } }, '▸') : null,
          ),
          showSub ? renderPanel(it.children, path) : null,
        );
      }),
    );
  };

  return React.createElement(
    View,
    {
      role: 'menubar',
      ariaLabel: 'Application menu',
      style: {
        flexDirection: 'row', alignItems: 'center', height: BAR_HEIGHT, paddingHorizontal: 6,
        backgroundColor: C.bar, zIndex: 9000, ...(style || {}),
      },
    },
    ...items.map((menu, i) => {
      const enabled = isEnabled(menu);
      const active = open && hot[0] === i;
      return React.createElement(
        View, { key: i, style: { position: 'relative' } },
        React.createElement(
          Pressable,
          {
            role: 'menuitem',
            ariaLabel: parseLabel(menu.label).plain,
            expanded: active,
            disabled: !enabled,
            feedback: false,
            keepFocus: true,
            onHoverIn: () => { if (open && enabled) setHot([i]); },
            onPress: () => {
              inside();
              if (!enabled) return;
              if (active) { setOpen(false); setHot([]); } else { setOpen(true); setHot([i]); }
            },
            style: {
              height: BAR_HEIGHT - 6, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 5,
              backgroundColor: active ? C.hover : 'transparent',
            },
          },
          React.createElement(Label, { text: menu.label, color: enabled ? C.text : C.disabled, underline: open }),
        ),
        active ? renderPanel(menu.children, [i]) : null,
      );
    }),
  );
}
