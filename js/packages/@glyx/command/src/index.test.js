import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useCommands, CommandPalette } from './index.js';

test('exports are functions', () => {
  expect(typeof useCommands).toBe('function');
  expect(typeof CommandPalette).toBe('function');
});

test('CommandPalette renders closed without throwing', () => {
  expect(() => renderToStaticMarkup(React.createElement(CommandPalette))).not.toThrow();
});

test('useCommands registers without throwing in a render pass', () => {
  const Probe = () => {
    useCommands([{ id: 'save', title: 'Save file', run: () => {} }]);
    return null;
  };
  expect(() => renderToStaticMarkup(React.createElement(Probe))).not.toThrow();
});
