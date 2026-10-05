import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'realtime-chart',
  version: '0.1.0',
  app: {
    publisher:   'realtime-chart',
    description: 'A live chart fed faster than anyone can see.',
    website:     'https://example.com',
    license:     'LICENSE.txt',
  },
  window: {
    title:       'Realtime chart',
    width:       900,
    height:      700,
    startupMode: 'windowed',
  },
  capabilities: {
    db:           false,
    dialog:       false,
    clipboard:    false,
    notification: false,
    system:       false,
    battery:      false,
  },
  dev: {
    entry:  'src/app.jsx',
    output: 'dist/app.js',
    watch:  ['src'],
  },
});
