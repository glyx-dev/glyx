import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'media-player',
  version: '1.0.0',
  app: {
    publisher:   'media-player',
    description: 'A sleek music and video player.',
    website:     'https://example.com',
  },
  window: {
    title:       'Media Player',
    width:       1100,
    height:      720,
    startupMode: 'windowed',
    decorations: false,
    background:  '#0B0B0F',
  },
  capabilities: {
    audio:  true,
    video:  true,
    dialog: true,
    db:     true,
  },
  dev: {
    entry:  'src/app.jsx',
    output: 'dist/app.js',
    watch:  ['src'],
  },
});
