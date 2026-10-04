// Shared description of an application menu (the native menu bar, and the
// in-app menu bar that follows it). One shape, one set of rules:
//
//   [{ label: '&File', children: [
//        { id: 'file.new',  label: 'New',  accelerator: 'Ctrl+N' },
//        { separator: true },
//        { id: 'file.auto', label: 'Autosave', checked: false },
//        { label: 'Recent', children: [{ id: 'recent.1', label: 'notes.txt' }] },
//   ]}]
//
// The top level must be menus (`children` required). `checked` present, true
// or false, makes an item checkable. `&` before a letter marks its mnemonic.
// Ids are unique across the whole bar.

/** Check a menu bar description. Returns an error message, or null when it is fine. */
export function validateMenu(items) {
  if (!Array.isArray(items) || items.length === 0) return 'a menu bar needs at least one menu';
  const seen = new Set();
  for (let i = 0; i < items.length; i++) {
    const top = items[i];
    if (!top || top.separator || !String(top.label ?? '').trim()) return `menu ${i}: top-level entries need a label`;
    if (!Array.isArray(top.children) || top.children.length === 0) {
      return `menu "${top.label}": top-level entries must be menus with \`children\``;
    }
    const err = validateChildren(top.label, top.children, seen);
    if (err) return err;
  }
  return null;
}

function validateChildren(path, items, seen) {
  for (const item of items) {
    if (!item) return `${path}: an entry is empty`;
    if (item.separator) continue;
    if (!String(item.label ?? '').trim()) return `${path}: an item has no label`;
    const here = `${path} > ${item.label}`;
    if (Array.isArray(item.children) && item.children.length > 0) {
      const err = validateChildren(here, item.children, seen);
      if (err) return err;
      continue;
    }
    if (!item.id) return `${here}: an item needs an \`id\` so its clicks can be told apart`;
    if (seen.has(item.id)) return `${here}: id "${item.id}" is used more than once`;
    seen.add(item.id);
    if (item.accelerator != null && !parseAccelerator(item.accelerator)) {
      return `${here}: "${item.accelerator}" is not a valid accelerator (try "Ctrl+N" or "CmdOrCtrl+Shift+S")`;
    }
  }
  return null;
}

/** Every actionable item (not separators or menus), depth first. */
export function flattenItems(items, out = []) {
  for (const item of items ?? []) {
    if (item.separator) continue;
    if (Array.isArray(item.children) && item.children.length > 0) flattenItems(item.children, out);
    else out.push(item);
  }
  return out;
}

const MODIFIERS = {
  ctrl: 'ctrl', control: 'ctrl', cmdorctrl: 'ctrl', cmdorcontrol: 'ctrl', commandorcontrol: 'ctrl',
  shift: 'shift',
  // Valid, shown in the menu, but key events do not report these, so they never trigger.
  alt: 'alt', option: 'alt', super: 'super', cmd: 'super', command: 'super', meta: 'super',
};

const NAMED_KEYS = {
  enter: 'Enter', return: 'Enter', esc: 'Escape', escape: 'Escape', space: 'Space', tab: 'Tab',
  backspace: 'Backspace', delete: 'Delete', del: 'Delete', insert: 'Insert',
  home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
};

/**
 * "Ctrl+Shift+S" → `{ ctrl, shift, alt, super, key: 'KeyS', triggers }`, or null when it is not
 * a key combination. `triggers` is false when it uses a modifier key events cannot report.
 */
export function parseAccelerator(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const parts = text.split('+').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const acc = { ctrl: false, shift: false, alt: false, super: false, key: '', triggers: true };
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const lower = p.toLowerCase();
    if (i < parts.length - 1) {
      const m = MODIFIERS[lower];
      if (!m) return null;
      acc[m] = true;
    } else if (MODIFIERS[lower]) {
      return null;
    } else if (/^[a-z]$/i.test(p)) acc.key = 'Key' + p.toUpperCase();
    else if (/^[0-9]$/.test(p)) acc.key = 'Digit' + p;
    else if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(p)) acc.key = p.toUpperCase();
    else if (NAMED_KEYS[lower]) acc.key = NAMED_KEYS[lower];
    else return null;
  }
  acc.triggers = !acc.alt && !acc.super;
  return acc;
}

/** Does this raw key event (`{ key, ctrl, shift, pressed }`) press this accelerator? */
export function matchesAccelerator(acc, ev) {
  return !!acc && acc.triggers && ev.pressed === true && ev.key === acc.key && !!ev.ctrl === acc.ctrl && !!ev.shift === acc.shift;
}
