#!/usr/bin/env node
// Builds the declaration files (`types/`) of the TypeScript packages under js/packages/@glyx.
//
//   bun run types:build                 every TypeScript package
//   bun run types:build store form      only these
//
// The packages ship their TypeScript *source* (`main` is `src/index.ts`: the Glyx bundler compiles
// it with the app), and `types/` for TypeScript consumers. Consumers get declarations, not source,
// so the package's own strictness settings can't leak into their type-check and `skipLibCheck`
// applies. `types/` is build output: git-ignored, and made by the npm-publish workflow before
// publishing. Inside the repo nothing reads it (the base tsconfig maps `@glyx-dev/*` to source).
import { readdirSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgsDir = join(root, 'js', 'packages', '@glyx');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const ts = (await import('typescript')).default;
let failed = 0;
let built = 0;

// Neighbours are read from their *built* declarations (as a consumer would see them), so build
// dependencies first: order by the @glyx-dev/* packages each one lists.
const all = readdirSync(pkgsDir).sort();
const depsOf = (name) => {
  try {
    const pj = JSON.parse(readFileSync(join(pkgsDir, name, 'package.json'), 'utf8'));
    return Object.keys({ ...pj.dependencies, ...pj.peerDependencies }).filter((d) => d.startsWith('@glyx-dev/')).map((d) => d.slice('@glyx-dev/'.length));
  } catch { return []; }
};
const ordered = [];
const visit = (n) => { if (ordered.includes(n) || !all.includes(n)) return; ordered.push(n); };
const place = (n, seen = new Set()) => {
  if (ordered.includes(n) || seen.has(n) || !all.includes(n)) return;
  seen.add(n);
  for (const d of depsOf(n)) place(d, seen);
  visit(n);
};
all.forEach((n) => place(n));

for (const name of ordered) {
  if (only.length && !only.includes(name)) continue;
  const dir = join(pkgsDir, name);
  const configPath = join(dir, 'tsconfig.json');
  if (!existsSync(configPath)) continue; // still JavaScript

  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
    declarationMap: false,
    outDir: join(dir, 'types'),
    rootDir: join(dir, 'src'),
    baseUrl: join(root, 'js'),
    paths: { '@glyx-dev/*': ['packages/@glyx/*/types/index'] },
  }, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n')); } });

  // Only the package's own source goes into the declarations: the ambient files (runtime-globals,
  // glyx-native) are for type-checking, and tests are not part of the package.
  const files = parsed.fileNames.filter((f) => resolve(f).startsWith(join(dir, 'src')) && !/\.test\.tsx?$/.test(f) && !f.endsWith('.d.ts'));
  rmSync(join(dir, 'types'), { recursive: true, force: true });
  const program = ts.createProgram({ rootNames: [...files, ...parsed.fileNames.filter((f) => f.endsWith('.d.ts') && !resolve(f).startsWith(join(dir, 'src')))], options: parsed.options });
  const result = program.emit(undefined, undefined, undefined, true);
  const diagnostics = ts.getPreEmitDiagnostics(program).concat(result.diagnostics)
    .filter((d) => d.file && resolve(d.file.fileName).startsWith(join(dir, 'src')));

  built++;
  if (diagnostics.length) {
    failed++;
    console.log(`  ✗ ${name}: ${diagnostics.length} error(s)`);
    for (const d of diagnostics.slice(0, 20)) {
      const { line } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
      console.log(`      ${d.file.fileName.replace(root, '').replace(/\\/g, '/')}(${line + 1}): TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
    }
  } else {
    console.log(`  ✓ ${name}`);
  }
}

console.log(built ? `\n${built - failed}/${built} packages' declarations built.` : 'No TypeScript packages yet.');
process.exit(failed ? 1 : 0);
