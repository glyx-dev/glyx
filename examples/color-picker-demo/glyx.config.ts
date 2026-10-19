import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'color-picker-demo',
  version: '0.1.0',
  app: {
    publisher:   'color-picker-demo',
    description: 'A colour picker: drag, type a hex, presets, opacity.',
    website:     'https://example.com',
    license:     'LICENSE.txt',
  },
  window: {
    title:       'color-picker-demo',
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
