import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'media-bench',
  version: '0.1.0',
  app: {
    publisher:   'media-bench',
    description: 'Plays one video, to measure what playback costs (CPU, memory, frame time).',
    website:     'https://example.com',
    license:     'LICENSE.txt',
  },
  window: {
    title:       'media-bench',
    width:       1280,
    height:      800,
    startupMode: 'windowed',
  },
  capabilities: {
    audio:  true,
    video:  true,
    fs:     { read: ['**'], write: [] },
    db:     false,
    dialog: false,
  },
  dev: {
    entry:  'src/app.jsx',
    output: 'dist/app.js',
    watch:  ['src'],
  },
});
