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

import { dividerLook } from './index.js';

const colors = { lineColor: '#111', hoverColor: '#222', activeColor: '#0a8' };

test('the divider is a thin line at rest, highlighted with a grip on hover, accent while dragging', () => {
  expect(dividerLook({ hovering: false, dragging: false, ...colors }))
    .toEqual({ lineThickness: 1, lineColor: '#111', showGrip: false });
  expect(dividerLook({ hovering: true, dragging: false, ...colors }))
    .toEqual({ lineThickness: 3, lineColor: '#222', showGrip: true });
  // Dragging wins, even once the pointer has run ahead of the divider.
  expect(dividerLook({ hovering: false, dragging: true, ...colors }))
    .toEqual({ lineThickness: 3, lineColor: '#0a8', showGrip: true });
});

test('the divider renders its grab area, line and grip', () => {
  const html = renderToStaticMarkup(
    React.createElement(SplitPane, { width: 800, height: 600 },
      React.createElement('text', null, 'L'), React.createElement('text', null, 'R'))
  );
  expect(html).toContain('Resize panes horizontally');
});

test('a pane can be a render function that receives its own pixel size', () => {
  const html = renderToStaticMarkup(
    React.createElement(SplitPane, { width: 1000, height: 500, defaultSizes: [30, 70], dividerSize: 8 },
      ({ width, height }) => React.createElement('text', null, `L:${width}x${height}`),
      ({ width, height }) => React.createElement('text', null, `R:${width}x${height}`))
  );
  expect(html).toContain('L:300x500');
  expect(html).toContain('R:692x500'); // 1000 - 300 - divider
});
