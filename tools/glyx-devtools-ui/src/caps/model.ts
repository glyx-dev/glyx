// Overview → Capabilities: what glyx.config.json grants, what the app's
// code uses without a grant, and what was refused while it ran.

export interface Finding {
  capability: string;
  api: string;
  file: string;
  line: number;
  reason: 'missing' | 'hostNotAllowed';
  host?: string;
}

export interface Denial { capability: string; target: string; count: number; firstMs: number; lastMs: number }

export interface Report {
  configured: Record<string, unknown>;
  mayBreak: Finding[];
  denied: Denial[];
  scanned: { available: boolean; appFiles: number };
}

/** Human names, in display order. Keys are glyx.config.json's. */
export const CAPABILITIES: [string, string][] = [
  ['network', 'Network'], ['fs', 'Files'], ['db', 'Database'], ['dbPath', 'Database path'],
  ['dialog', 'Dialogs'], ['clipboard', 'Clipboard'], ['notification', 'Notifications'], ['tray', 'Tray'], ['menubar', 'Menu bar'],
  ['shellExec', 'Run programs'], ['shellAgent', 'Agent shell'], ['shell', 'Shell (open)'], ['env', 'Environment'],
  ['mdns', 'mDNS'], ['system', 'System info'], ['power', 'Power'], ['battery', 'Battery'], ['storage', 'Storage'],
  ['credentials', 'Credentials'], ['audio', 'Audio'], ['video', 'Video'], ['camera', 'Camera'], ['microphone', 'Microphone'],
  ['ai', 'AI'], ['aiModelDownload', 'AI model download'], ['gamepads', 'Gamepads'], ['globalShortcuts', 'Global shortcuts'],
  ['hid', 'HID'], ['usb', 'USB'], ['updater', 'Updater'], ['crash', 'Crash reports'], ['deeplink', 'Deep links'], ['webview', 'WebView'],
];

/** Capabilities grouped for display. */
export const CATEGORIES: { title: string; keys: string[] }[] = [
  { title: 'Network & data', keys: ['network', 'fs', 'db', 'dbPath', 'storage', 'credentials', 'env'] },
  { title: 'Desktop', keys: ['dialog', 'clipboard', 'notification', 'tray', 'menubar', 'globalShortcuts', 'deeplink', 'webview', 'shell', 'shellExec', 'shellAgent'] },
  { title: 'Devices & media', keys: ['camera', 'microphone', 'audio', 'video', 'gamepads', 'hid', 'usb', 'battery', 'power', 'system', 'mdns'] },
  { title: 'AI & app', keys: ['ai', 'aiModelDownload', 'updater', 'crash'] },
];

/** Granted: `true`, or an object/list that grants something. Mirrors the app's check. */
export function granted(configured: Record<string, unknown>, key: string): boolean {
  const v = configured[key];
  if (v == null || v === false) return false;
  if (key === 'network') return Array.isArray((v as any).allow) && (v as any).allow.length > 0;
  if (typeof v === 'object' && !Array.isArray(v)) return Object.values(v as object).some((x) => x != null);
  return true;
}

/** Short description of a grant's scope: hosts, globs, programs… */
export function scope(configured: Record<string, unknown>, key: string): string {
  const v = configured[key] as any;
  if (!v || typeof v !== 'object') return '';
  const list = (a: unknown) => (Array.isArray(a) ? a.join(', ') : '');
  switch (key) {
    case 'network': return list(v.allow);
    case 'fs': return ['read', 'write', 'delete'].filter((k) => Array.isArray(v[k])).map((k) => `${k}: ${list(v[k]) || 'none'}`).join(' · ');
    case 'shellExec': case 'env': return list(v.allow);
    case 'shellAgent': return v.scopeDir ?? '';
    case 'deeplink': return v.scheme ? `${v.scheme}://` : '';
    default: return '';
  }
}

/** The glyx.config.json change that would allow a finding or a denial. */
export function fixFor(capability: string, target?: string): string {
  const cap = capability.split('.')[0];
  switch (cap) {
    case 'network': return `"network": { "allow": ["${target ?? 'api.example.com'}"] }`;
    case 'fs': {
      const op = capability.split('.')[1] ?? 'read';
      return `"fs": { "${op}": ["${target ? globFor(target) : '<glob>'}"] }`;
    }
    case 'shellExec': return `"shellExec": { "allow": ["${target ?? '<program>'}"] }`;
    case 'env': return `"env": { "allow": ["${target ?? '<NAME>'}"] }`;
    default: return `"${cap}": true`;
  }
}

/** A glob covering a denied path's folder. */
function globFor(path: string): string {
  const p = path.replace(/\\/g, '/').replace(/^\/\/\?\//, '');
  const dir = p.slice(0, p.lastIndexOf('/') + 1);
  return dir ? `${dir}**` : p;
}

/** Findings grouped by capability, for one row each. */
export function groupFindings(f: Finding[]): { capability: string; items: Finding[] }[] {
  const m = new Map<string, Finding[]>();
  for (const x of f) m.set(x.capability, [...(m.get(x.capability) ?? []), x]);
  return [...m.entries()].map(([capability, items]) => ({ capability, items }));
}

export function capName(key: string): string {
  const base = key.split('.')[0];
  const name = CAPABILITIES.find(([k]) => k === base)?.[1] ?? base;
  return key.includes('.') ? `${name} (${key.split('.')[1]})` : name;
}
