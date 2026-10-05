#!/usr/bin/env bun
// Builds the DevTools UI into dist/, which the Glyx CLI embeds at compile
// time (crates/glyx-cli/build.rs):
//
//   dist/index.html
//   dist/assets/app.js       React app, minified
//   dist/assets/app.css      design tokens + app styles
//   dist/assets/*.svg        symbol + favicon
//
//   bun run build            (then: cargo build -p glyx-cli)
import { rmSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dir;
const dist = join(here, 'dist');
const assets = join(dist, 'assets');
rmSync(dist, { recursive: true, force: true });
mkdirSync(assets, { recursive: true });

const result = await Bun.build({
  entrypoints: [join(here, 'src/main.tsx')],
  outdir: assets,
  naming: 'app.js',
  target: 'browser',
  format: 'iife',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const css = readFileSync(join(here, 'src/vendor/tokens.css'), 'utf8') + '\n' + readFileSync(join(here, 'src/app.css'), 'utf8');
writeFileSync(join(assets, 'app.css'), css);
for (const f of ['glyx-symbol-dark.svg', 'glyx-symbol-light.svg', 'favicon.svg']) {
  copyFileSync(join(here, 'src/vendor', f), join(assets, f));
}
copyFileSync(join(here, 'index.html'), join(dist, 'index.html'));

const size = (f) => (readFileSync(join(assets, f)).length / 1024).toFixed(0) + ' KB';
console.log(`DevTools UI built: app.js ${size('app.js')}, app.css ${size('app.css')} → ${dist}`);
