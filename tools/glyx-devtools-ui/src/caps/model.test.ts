import { test, expect } from 'bun:test';
import { capName, fixFor, granted, groupFindings, scope } from './model';

const configured = { db: true, clipboard: false, network: { allow: ['api.example.com'] }, fs: { read: ['assets/**'], write: null, delete: null }, env: null };

test('granted mirrors the app: true, or a non-empty grant', () => {
  expect(granted(configured, 'db')).toBe(true);
  expect(granted(configured, 'clipboard')).toBe(false);
  expect(granted(configured, 'network')).toBe(true);
  expect(granted({ network: { allow: [] } }, 'network')).toBe(false);
  expect(granted(configured, 'fs')).toBe(true);
  expect(granted(configured, 'env')).toBe(false);
});

test('scopes and fixes read like the config', () => {
  expect(scope(configured, 'network')).toBe('api.example.com');
  expect(scope(configured, 'fs')).toBe('read: assets/**');
  expect(fixFor('network', 'other.example')).toBe('"network": { "allow": ["other.example"] }');
  expect(fixFor('clipboard')).toBe('"clipboard": true');
  expect(fixFor('fs.write', 'C:\\Users\\me\\notes\\a.txt')).toBe('"fs": { "write": ["C:/Users/me/notes/**"] }');
  expect(capName('fs.read')).toBe('Files (read)');
  expect(capName('shellExec')).toBe('Run programs');
});

test('findings group by capability', () => {
  const f = [
    { capability: 'clipboard', api: 'clipboard', file: 'a.jsx', line: 3, reason: 'missing' as const },
    { capability: 'network', api: 'https://x/', file: 'a.jsx', line: 9, reason: 'hostNotAllowed' as const, host: 'x' },
    { capability: 'clipboard', api: 'cb', file: 'b.jsx', line: 1, reason: 'missing' as const },
  ];
  expect(groupFindings(f).map((g) => [g.capability, g.items.length])).toEqual([['clipboard', 2], ['network', 1]]);
});
