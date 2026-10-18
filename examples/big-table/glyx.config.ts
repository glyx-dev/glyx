import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'big-table',
  version: '1.0.0',
  app: {
    publisher:   'big-table',              // Company or author name (used in installer)
    description: 'A big-table app.',      // Short app description
    website:     'https://example.com', // https://yoursite.com
    license:     'LICENSE.txt',
  },
  // GLYX_ENGINE=quickjs runs the same table on QuickJS, to compare the engines (default: V8).
  engine:  process.env.GLYX_ENGINE === 'quickjs' ? 'quickjs' : 'v8',
  window: {
    title:       'big-table',
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
    entry:  'src/app.jsx',
    output: 'dist/app.js',
    watch:  ['src'],
  },
});