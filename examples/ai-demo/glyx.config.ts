import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name:    'ai-demo',
  version: '1.0.0',
  app: {
    publisher:   'ai-demo',
    description: 'Runs the three local AI models: embeddings, speech-to-text and text generation.',
    website:     'https://example.com',
    license:     'LICENSE.txt',
  },
  window: {
    title:       'ai-demo',
    width:       900,
    height:      700,
    startupMode: 'windowed',
  },
  capabilities: {
    // `aiModelDownload` lets the first call fetch a model that is not in the HuggingFace cache yet.
    ai:              true,
    aiModelDownload: true,
    fs:              { read: ['**'] },
  },
  dev: {
    entry:  'ui/app.jsx',
    output: 'dist/app.js',
    watch:  ['ui'],
  },
});
