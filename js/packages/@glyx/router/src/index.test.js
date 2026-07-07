import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Router, Route, useRoute } from './index.js';

const Home = () => React.createElement('text', null, 'HOME-SCREEN');
const Settings = () => React.createElement('text', null, 'SETTINGS-SCREEN');

function app(initialRoute) {
  return React.createElement(Router, { initialRoute },
    React.createElement(Route, { name: 'home', component: Home }),
    React.createElement(Route, { name: 'settings', component: Settings }),
  );
}

test('Router renders the initial route only', () => {
  const html = renderToStaticMarkup(app('home'));
  expect(html).toContain('HOME-SCREEN');
  expect(html).not.toContain('SETTINGS-SCREEN');
});

test('Router honors an explicit initialRoute', () => {
  const html = renderToStaticMarkup(app('settings'));
  expect(html).toContain('SETTINGS-SCREEN');
  expect(html).not.toContain('HOME-SCREEN');
});

test('Router defaults to the first declared route', () => {
  const html = renderToStaticMarkup(app(undefined));
  expect(html).toContain('HOME-SCREEN');
});

test('useRoute exposes name, params, and canGoBack', () => {
  let route;
  const Probe = () => { route = useRoute(); return null; };
  renderToStaticMarkup(
    React.createElement(Router, { initialRoute: 'p' },
      React.createElement(Route, { name: 'p', component: Probe }))
  );
  expect(route.name ?? route.routeName).toBe('p');
  expect(route.params).toEqual({});
  expect(route.canGoBack).toBe(false);
});
