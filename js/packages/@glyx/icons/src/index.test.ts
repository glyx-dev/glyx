import { test, expect } from 'bun:test';
import { Icon } from './index.js';

test('an icon is decorative unless it is given a label', () => {
  expect(Icon({ name: 'settings' }).props.role).toBe('presentation');
  expect(Icon({ name: 'settings' }).props.ariaLabel).toBeUndefined();
});

test('a labelled icon is announced, not hidden', () => {
  const props = Icon({ name: 'settings', ariaLabel: 'Settings' }).props;
  expect(props.ariaLabel).toBe('Settings');
  expect(props.role).toBeUndefined();
});

test('the text-formatting icons are in the registry', () => {
  for (const name of [
    'bold', 'italic', 'underline', 'list', 'list-ordered',
    'indent-increase', 'indent-decrease', 'type',
  ]) {
    expect(Icon({ name }), name).not.toBeNull();
  }
});
