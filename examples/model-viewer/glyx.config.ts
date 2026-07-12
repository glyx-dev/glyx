import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'model-viewer',
  version: '1.0.0',
  app: {
    publisher:   'model-viewer',              // Company or author name (used in installer)
    description: 'A model-viewer app.',      // Short app description
    website:     'https://example.com', // https://yoursite.com
    license:     'LICENSE.txt',
  },
  window: {
    title:       'model-viewer',
    width:       1280,
    height:      800,
    startupMode: 'windowed',
  },
  capabilities: {
    fs:           { read: ['public/**'], write: [] },
    db:           false,
    dialog:       false,
    clipboard:    false,
    notification: false,
  },
  dev: {
    entry:  'ui/app.jsx',
    output: 'dist/app.js',
    watch:  ['ui'],
  },
});