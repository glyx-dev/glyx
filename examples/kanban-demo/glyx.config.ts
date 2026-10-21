import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'kanban-demo',
  version: '1.0.0',
  app: {
    publisher:   'Glyx',
    description: 'A kanban board built from @glyx-dev/drag-drop.',
    website:     'https://example.com',
    license:     'LICENSE.txt',
  },
  window: {
    title:       'Kanban',
    width:       1180,
    height:      760,
    startupMode: 'windowed',
    background:  '#0f0f16',
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
