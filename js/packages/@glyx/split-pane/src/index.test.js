import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SplitPane } from './index.js';

test('SplitPane renders both panes', () => {
  const html = renderToStaticMarkup(
    React.createElement(SplitPane, { width: 800, height: 600 },
      React.createElement('text', null, 'LEFT-PANE'),
      React.createElement('text', null, 'RIGHT-PANE'))
  );
  expect(html).toContain('LEFT-PANE');
  expect(html).toContain('RIGHT-PANE');
});
