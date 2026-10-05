import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'chart-gallery',
  version: '0.1.0',
  app: {
    publisher:   'chart-gallery',
    description: 'Every chart type in @glyx-dev/charts.',
    website:     'https://example.com',
    license:     'LICENSE.txt',
  },
  window: {
    title:       'Chart gallery',
    width:       1100,
    height:      820,
    startupMode: 'windowed',
  },
  capabilities: {
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
