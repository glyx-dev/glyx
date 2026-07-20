import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'log-viewer',
  version: '1.0.0',
  app: {
    publisher:   'log-viewer',          // Company or author name (used in installer)
    description: 'A local log file viewer.',
    website:     'https://example.com',
    license:     'LICENSE.txt',
  },
  window: {
    title:       'Log Viewer',
    width:       1280,
    height:      800,
    startupMode: 'windowed',
    decorations: false,
    background:  '#080809',
  },
  capabilities: {
    // Reading the picked file (path lives outside the app root, so allow all).
    fs:           { read: ['**'], write: [] },
    dialog:       true,
    clipboard:    false,
    notification: false,
  },
  // Locale set for Intl.* / toLocaleString() (timestamp + count formatting).
  locales: ['en', 'de', 'ja'],
  dev: {
    entry:  'src/app.jsx',
    output: 'dist/app.js',
    watch:  ['src'],
  },
});
