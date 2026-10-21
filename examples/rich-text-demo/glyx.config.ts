import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'rich-text-demo',
  version: '1.0.0',
  app: {
    publisher:   'Glyx',
    description: 'Fonts, sizes and OpenType features in @glyx-dev/rich-text.',
    website:     'https://example.com',
    license:     'LICENSE.txt',
  },
  window: {
    title:       'Rich text',
    width:       1180,
    height:      820,
    startupMode: 'windowed',
    background:  '#0e0e15',
  },
  capabilities: {
    fs:           { read: [], write: [] },
    db:           false,
    dialog:       false,
    clipboard:    false,
    notification: false,
  },
  dev: {
    entry:  'src/app.tsx',
    output: 'dist/app.js',
    watch:  ['src'],
  },
});
