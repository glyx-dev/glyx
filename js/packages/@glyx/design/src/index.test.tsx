import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tokens, darkTokens, createTheme, ThemeProvider, Button, Badge, Heading } from './index.js';

test('light and dark token sets share the same color keys', () => {
  expect(Object.keys(darkTokens.colors).sort()).toEqual(Object.keys(tokens.colors).sort());
});

test('createTheme deep-merges overrides onto the base', () => {
  const theme = createTheme('dark', { colors: { accent: '#FF00FF' } });
  expect(theme.colors.accent).toBe('#FF00FF');
  // Non-overridden keys survive the merge.
  expect(theme.colors.text).toBe(darkTokens.colors.text);
});

test('Button renders its label inside a ThemeProvider', () => {
  const html = renderToStaticMarkup(
    React.createElement(ThemeProvider, { colorScheme: 'dark' },
      React.createElement(Button, { label: 'Save Changes' }))
  );
  expect(html).toContain('Save Changes');
});

test('Badge and Heading render text content', () => {
  const html = renderToStaticMarkup(
    React.createElement(ThemeProvider, { colorScheme: 'light' },
      React.createElement(Heading, null, 'Title-X'),
      React.createElement(Badge, { label: 'NEW' }))
  );
  expect(html).toContain('Title-X');
  expect(html).toContain('NEW');
});
