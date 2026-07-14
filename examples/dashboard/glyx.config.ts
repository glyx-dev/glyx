import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'dashboard',
  version: '1.0.0',
  app: {
    publisher:   'dashboard',              // Company or author name (used in installer)
    description: 'A real-time analytics dashboard.', // Short app description
    website:     'https://example.com', // https://yoursite.com
    license:     'LICENSE.txt',
  },
  window: {
    title:       'Nexus Analytics',
    width:       1280,
    height:      800,
    startupMode: 'windowed',
  },
  capabilities: {
    fs:           { read: [], write: ['**'] },
    db:           false,
    dialog:       true,
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