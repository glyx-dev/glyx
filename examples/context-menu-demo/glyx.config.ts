import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'context-menu-demo',
  version: '0.1.0',
  app: {
    publisher:   'context-menu-demo',
    description: 'Right-click a card to open its context menu.',
    website:     'https://example.com',
    license:     'LICENSE.txt',
  },
  window: {
    title:       'context-menu-demo',
    width:       720,
    height:      480,
    startupMode: 'windowed',
  },
  capabilities: {
    db:     false,
    dialog: false,
  },
  dev: {
    entry:  'src/app.jsx',
    output: 'dist/app.js',
    watch:  ['src'],
  },
});
