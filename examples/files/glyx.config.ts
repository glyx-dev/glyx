import { defineConfig } from '@glyx/config';

export default defineConfig({
  name:    'files',
  version: '1.0.0',
  app: {
    publisher:   'files',              // Company or author name (used in installer)
    description: 'A files app.',      // Short app description
    website:     'https://example.com', // https://yoursite.com
    license:     'LICENSE.txt',
  },
  window: {
    title:       'files',
    width:       1280,
    height:      800,
    startupMode: 'windowed',
  },
  capabilities: {
    fs:           { read: ['**'], write: ['**'] },
    db:           false,
    dialog:       true,
    clipboard:    false,
    notification: false,
  },
  dev: {
    entry:  'ui/app.jsx',
    output: 'dist/app.js',
    watch:  ['ui'],
  },
});