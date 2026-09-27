import { test, expect } from 'bun:test';
import { collapse, detail, groupIssues, textSummary, type Issue } from './audit';

const i = (rule: string, severity: string, message = 'm', nodeId = 1): Issue => ({ rule, severity, message, nodeId });

test('groups by rule: groups with errors first, then the bigger ones', () => {
  const g = groupIssues([
    i('contrast', 'warning'), i('contrast', 'warning'), i('contrast', 'error'),
    i('image-name', 'warning'),
    i('pressable-name', 'error'),
    i('focusable-role', 'warning'), i('focusable-role', 'warning'),
  ]);
  expect(g.map((x) => [x.rule, x.issues.length, x.severity])).toEqual([
    ['contrast', 3, 'error'], ['pressable-name', 1, 'error'], ['focusable-role', 2, 'warning'], ['image-name', 1, 'warning'],
  ]);
  expect(g[0].issues[0].severity).toBe('error');
  expect(g[0].title).toBe('Hard-to-read text');
});

test('contrast rows show just the ratio', () => {
  expect(detail(i('contrast', 'warning', 'Text contrast 3.62:1 against its background; needs 4.5:1 for normal text.'))).toBe('3.62:1 (needs 4.5:1)');
  expect(detail(i('image-name', 'warning', 'Image with no ariaLabel'))).toBe('Image with no ariaLabel');
});

test('identical findings fold into one row that keeps each element', () => {
  const msg = 'Text contrast 4.40:1 against its background; needs 4.5:1 for normal text.';
  const card = (n: number, text: string): Issue => ({ rule: 'contrast', severity: 'warning', message: msg, nodeId: n, component: 'NoteCard › Text', text });
  const rows = collapse([card(1, 'Sep 24'), card(2, 'Aug 4'), card(3, 'Aug 4'), { ...card(4, 'Title'), component: 'NoteListScreen › Text' }]);
  expect(rows.map((r) => [r.component, r.issues.length, r.texts])).toEqual([
    ['NoteCard › Text', 3, ['Sep 24', 'Aug 4']], ['NoteListScreen › Text', 1, ['Title']],
  ]);
  expect(textSummary(['a', 'b', 'c', 'd'])).toBe('“a”, “b” and 2 more');
});
