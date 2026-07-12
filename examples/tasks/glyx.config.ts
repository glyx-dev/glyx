import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'tasks',
  version: '1.0.0',
  app: {
    publisher:   'tasks',              // Company or author name (used in installer)
    description: 'A tasks app.',      // Short app description
    website:     'https://example.com', // https://yoursite.com
    license:     'LICENSE.txt',
  },
  window: {
    title:       'tasks',
    width:       1280,
    height:      800,
    startupMode: 'windowed',
  },
  capabilities: {
    fs:           { read: ['public/**'], write: [] },
    db:           true,
    dialog:       false,
    clipboard:    false,
    notification: false,
  },
  dev: {
    entry:  'src/app.jsx',
    output: 'dist/app.js',
    watch:  ['src'],
  },
});