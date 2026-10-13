#!/usr/bin/env node
// Type-checks every package under js/packages/@glyx that has a tsconfig.json (i.e. is TypeScript).
//
//   bun run typecheck                 all of them
//   bun run typecheck store form      only these
//   bun run typecheck -- --verbose    print the errors, not just the counts
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgs = join(root, 'js', 'packages', '@glyx');
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const only = args.filter((a) => !a.startsWith('--'));

if (!existsSync(tsc)) { console.error('TypeScript is not installed: run `bun install`.'); process.exit(1); }

let failed = 0;
let checked = 0;
for (const name of readdirSync(pkgs).sort()) {
  if (only.length && !only.includes(name)) continue;
  const dir = join(pkgs, name);
  if (!existsSync(join(dir, 'tsconfig.json'))) continue;
  checked++;
  const r = spawnSync(process.execPath, [tsc, '-p', dir, '--pretty', 'false'], { encoding: 'utf8' });
  const lines = (r.stdout + r.stderr).split('\n').filter((l) => /error TS\d+/.test(l));
  if (r.status === 0) {
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}: ${lines.length} error${lines.length === 1 ? '' : 's'}`);
    if (verbose) for (const l of lines.slice(0, 40)) console.log('      ' + l);
  }
}
console.log(checked ? `\n${checked - failed}/${checked} packages type-check.` : 'No TypeScript packages yet.');
process.exit(failed ? 1 : 0);
