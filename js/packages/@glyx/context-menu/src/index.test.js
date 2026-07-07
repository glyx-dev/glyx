import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContextMenu } from './index.js';

test('ContextMenu renders its children (menu closed by default)', () => {
  const html = renderToStaticMarkup(
    React.createElement(ContextMenu, {
      items: [{ label: 'Copy', onPress: () => {} }, { label: 'Delete', onPress: () => {} }],
    }, React.createElement('text', null, 'TARGET-CONTENT'))
  );
  expect(html).toContain('TARGET-CONTENT');
  // Menu items only appear after a right-click, not on initial render.
  expect(html).not.toContain('Copy');
});
