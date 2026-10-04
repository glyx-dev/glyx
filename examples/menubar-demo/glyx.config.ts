import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'menubar-demo',
  version: '0.1.0',
  app: {
    publisher:   'menubar-demo',
    description: 'A native File / Edit / View menu bar with accelerators.',
    website:     'https://example.com',
    license:     'LICENSE.txt',
  },
  window: {
    title:       'Menu bar demo',
    width:       720,
    height:      480,
    startupMode: 'windowed',
  },
  capabilities: {
    menubar:      true,
    db:           false,
    dialog:       false,
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
