import { defineConfig } from '@glyx/config';

export default defineConfig({
  name:    'dashboard',
  version: '1.0.0',
  app: {
    publisher:   'dashboard',              // Company or author name (used in installer)
    description: 'A dashboard app.',      // Short app description
    website:     'https://example.com', // https://yoursite.com
    license:     'LICENSE.txt',
  },
  window: {
    title:       'dashboard',
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
    system:       true,
    battery:      true,
  },
  dev: {
    entry:  'src/app.jsx',
    output: 'dist/app.js',
    watch:  ['src'],
  },
});