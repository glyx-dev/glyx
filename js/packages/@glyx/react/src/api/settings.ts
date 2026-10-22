// @glyx-dev/react — runtime settings.

// ── Settings ─────────────────────────────────────────────────────────────────
//
// The tunables of the runtime (caches, reduced motion, ...), read here and changed live where a setting allows it. The registry lives in
// Rust; this is a thin view. No capability is needed to read. A change is refused unless the setting is marked safe for app JavaScript
// (most are developer-only: they can be changed from DevTools or the config, not by the app), unless it is live (a startup setting is read
// once), and unless the app's `glyx.config` allows it: JavaScript is locked out by default (`settings: { allowJsChanges: true }` opts in, and
// even then only the few settings marked for apps can change). `appCanSet` tells you whether a setting can be changed from here right now.
// Where a setting comes from is one of `env` (an environment variable pins it), `runtime`, `config` or `default`.
//
// @example
// import { settings } from '@glyx-dev/react';
// const all = settings.list();                  // [{ name, value, source, default, type, scope, safety, locked, doc, ... }]
// const reduce = settings.get('motion.reduce');  // 'auto' | 'on' | 'off'
// const stop = settings.onChange((name, value) => console.log(name, value));

export type SettingValue = boolean | number | string;

export interface SettingInfo {
  name: string;
  value: SettingValue;
  /** Where the value in force comes from. */
  source: 'env' | 'runtime' | 'config' | 'default';
  default: SettingValue;
  type: 'boolean' | 'integer' | 'choice';
  min?: number;
  max?: number;
  choices?: string[];
  /** `startup`: read once, cannot change while the app runs. `live`: can change. */
  scope: 'startup' | 'live';
  /** Who may change it at runtime: `config` nobody, `developer` DevTools and native code, `app` app JavaScript too. */
  safety: 'config' | 'developer' | 'app';
  /** No runtime change is possible for anyone (config only, locked, or runtime changes switched off). */
  locked: boolean;
  /** JavaScript could change it right now: it is marked for apps, the app's `glyx.config` allows JavaScript to change settings, and nothing locks it. */
  appCanSet: boolean;
  doc: string;
}

export type SettingResult =
  | { ok: true; name: string; value: SettingValue; source: SettingInfo['source'] }
  | { ok: false; name: string; error: string };

type Listener = (name: string, value: SettingValue) => void;

const listeners = new Set<Listener>();

function call(fn: string, ...args: any[]): any {
  const f = (globalThis as any)[fn];
  if (typeof f === 'undefined') return undefined;
  try { return f(...args); } catch { return undefined; }
}

function parse(text: any): any {
  if (typeof text !== 'string' || !text) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

/** Called every frame; free unless somebody listens. Changes made by DevTools or native code reach `onChange` listeners here. */
export function _pollSettings() {
  if (listeners.size === 0) return;
  const changes = parse(call('__glyx_settings_poll'));
  if (!Array.isArray(changes)) return;
  for (const c of changes) {
    for (const fn of Array.from(listeners)) {
      try { fn(c.name, c.value); } catch (e) { console.error('[settings] listener threw', e); }
    }
  }
}

export const settings = {
  /** Every setting with its value, source, range, scope and safety class. */
  list(): SettingInfo[] {
    const all = parse(call('__glyx_settings_list'));
    return Array.isArray(all) ? all : [];
  },

  /** The value in force, or `undefined` for a name that is not a setting. */
  get(name: string): SettingValue | undefined {
    return settings.list().find((s) => s.name === name)?.value;
  },

  /**
   * Change a setting. Never throws: the result says whether it was applied (`ok`) and, if not, why. Refused unless the app's `glyx.config`
   * allows JavaScript to change settings, and then for a startup setting, a setting not marked for apps, a locked one, one pinned by its
   * environment variable, and a value of the wrong type or out of range.
   */
  set(name: string, value: SettingValue): SettingResult {
    const r = parse(call('__glyx_settings_set', name, JSON.stringify(value)));
    return r ?? { ok: false, name, error: 'settings are not available in this runtime' };
  },

  /** Drop a runtime change, back to the config value or the default. */
  reset(name: string): SettingResult {
    const r = parse(call('__glyx_settings_reset', name));
    return r ?? { ok: false, name, error: 'settings are not available in this runtime' };
  },

  /** Be told when a setting's value changes (made from DevTools, native code or here). Returns the function that stops listening. */
  onChange(fn: Listener): () => void {
    listeners.add(fn);
    // The first poll starts collecting on the native side; nothing is gathered for an app that never listens.
    call('__glyx_settings_poll');
    return () => { listeners.delete(fn); };
  },
};
