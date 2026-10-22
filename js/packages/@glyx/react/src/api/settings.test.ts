import { describe, test, expect, afterEach } from 'bun:test';
import { settings, _pollSettings } from './settings.js';

const g = globalThis as any;

const INFO = {
  name: 'motion.reduce', value: 'auto', source: 'default', default: 'auto', type: 'choice', choices: ['auto', 'on', 'off'],
  scope: 'live', safety: 'app', locked: false, appCanSet: false, doc: 'x',
};

afterEach(() => {
  for (const k of ['list', 'set', 'reset', 'poll']) delete g[`__glyx_settings_${k}`];
});

describe('settings', () => {
  test('list and get read the native registry', () => {
    g.__glyx_settings_list = () => JSON.stringify([INFO]);
    expect(settings.list()).toEqual([INFO as any]);
    expect(settings.get('motion.reduce')).toBe('auto');
    expect(settings.get('no.such')).toBeUndefined();
  });

  test('without the bindings the calls answer instead of throwing', () => {
    expect(settings.list()).toEqual([]);
    expect(settings.get('motion.reduce')).toBeUndefined();
    const r = settings.set('motion.reduce', 'on');
    expect(r.ok).toBe(false);
    expect(settings.reset('motion.reduce').ok).toBe(false);
  });

  test('set sends the value as JSON text and returns the native answer, refused or not', () => {
    const seen: any[] = [];
    g.__glyx_settings_set = (name: string, json: string) => {
      seen.push([name, json]);
      return JSON.stringify(name === 'motion.reduce'
        ? { ok: false, name, error: 'this setting cannot be changed by this caller' }
        : { ok: true, name, value: JSON.parse(json), source: 'runtime' });
    };
    expect(settings.set('motion.reduce', 'on')).toEqual({ ok: false, name: 'motion.reduce', error: 'this setting cannot be changed by this caller' });
    expect(settings.set('render.x', 5)).toEqual({ ok: true, name: 'render.x', value: 5, source: 'runtime' });
    expect(seen).toEqual([['motion.reduce', '"on"'], ['render.x', '5']]);
  });

  test('a native call that throws is an unavailable runtime, not an exception', () => {
    g.__glyx_settings_list = () => { throw new Error('boom'); };
    expect(settings.list()).toEqual([]);
  });

  test('onChange listeners hear polled changes and stop when removed; no poll without a listener', () => {
    let polls = 0;
    let next: any[] = [];
    g.__glyx_settings_poll = () => { polls++; const out = JSON.stringify(next); next = []; return out; };
    _pollSettings();
    expect(polls).toBe(0);

    const heard: any[] = [];
    const stop = settings.onChange((name, value) => heard.push([name, value]));
    expect(polls).toBe(1); // subscribing starts the native collection
    next = [{ name: 'motion.reduce', value: 'on' }];
    _pollSettings();
    expect(heard).toEqual([['motion.reduce', 'on']]);

    stop();
    polls = 0;
    next = [{ name: 'motion.reduce', value: 'off' }];
    _pollSettings();
    expect(polls).toBe(0);
    expect(heard.length).toBe(1);
  });

  test('a listener that throws does not stop the others', () => {
    g.__glyx_settings_poll = () => JSON.stringify([{ name: 'a.b', value: true }]);
    const heard: any[] = [];
    const quiet = console.error;
    console.error = () => {};
    const s1 = settings.onChange(() => { throw new Error('bad'); });
    const s2 = settings.onChange((n, v) => heard.push([n, v]));
    _pollSettings();
    console.error = quiet;
    s1(); s2();
    expect(heard).toEqual([['a.b', true]]);
  });
});
