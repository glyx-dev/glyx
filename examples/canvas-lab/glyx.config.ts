import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'canvas-lab',
  version: '1.0.0',
  app: {
    publisher:   'canvas-lab',              // Company or author name (used in installer)
    description: 'The 2D canvas: transforms, alpha, blend modes, dashes, shadows, gradients, images, pointer drawing, PNG export.',      // Short app description
    website:     'https://example.com', // https://yoursite.com
    license:     'LICENSE.txt',
  },
  // GLYX_ENGINE=quickjs runs the same drawings on QuickJS (default: V8).
  engine:  process.env.GLYX_ENGINE === 'quickjs' ? 'quickjs' : 'v8',
  window: {
    title:       'canvas-lab',
    width:       1280,
    height:      800,
    startupMode: 'windowed',
    // GLYX_RENDER=direct2d tries the Direct2D backend (Windows): its text, clips and gradients differ a little.
    ...(process.env.GLYX_RENDER ? { renderMode: process.env.GLYX_RENDER as any } : {}),
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