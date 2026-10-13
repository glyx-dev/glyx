import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Draggable, DropZone } from './index.js';

test('Draggable renders its children', () => {
  const html = renderToStaticMarkup(
    React.createElement(Draggable, { data: { id: 1 }, type: 'card' },
      React.createElement('text', null, 'DRAG-ME'))
  );
  expect(html).toContain('DRAG-ME');
});

test('DropZone renders its children', () => {
  const html = renderToStaticMarkup(
    React.createElement(DropZone, { onDrop: () => {}, accepts: 'card' },
      React.createElement('text', null, 'DROP-HERE'))
  );
  expect(html).toContain('DROP-HERE');
});
