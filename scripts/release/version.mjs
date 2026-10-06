#!/usr/bin/env bun
// Prepare a Glyx release — the one manual step:
//
//   bun run release:version minor        (or: patch | major | 0.3.0)
//
// Sets every @glyx-dev/* package, the glyx-cli npm wrapper and every crate
// under crates/ to the new version, points internal dependencies at it,
// rolls every package CHANGELOG ([Unreleased] → [version] - date), refreshes
// Cargo.lock, and prints the commit + tag commands. Nothing is committed,
// tagged or published: review the diff first.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { relative } from 'node:path';
import { nextVersion, bumpPackageJsonText, bumpCargoToml, rollChangelog, cargoVersion, findProblems, parseArgs, localDate } from './lib.mjs';
import { ROOT, readState } from './files.mjs';

const USAGE = 'usage: bun run release:version <patch | minor | major | x.y.z> [--dry-run] [--allow-dirty]';
let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (e) {
  // Anything unrecognised stops here — a typo must never become a real run.
  console.error(`${e.message}\n${USAGE}`);
  process.exit(1);
}
const { bump, dryRun, allowDirty } = opts;

if (!dryRun && !allowDirty) {
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT, encoding: 'utf8' });
  if (status.stdout.trim()) {
    console.error('Uncommitted changes — commit them first so the release commit holds only the release.\n' +
      '(Preview with --dry-run, or override with --allow-dirty.)');
    process.exit(1);
  }
}

const state = readState();
const cli = state.crates.find((c) => /glyx-cli[\\/]Cargo\.toml$/.test(c.file));
const current = cargoVersion(cli.text);
const version = nextVersion(current, bump);
const date = localDate();
const rel = (f) => relative(ROOT, f).replace(/\\/g, '/');
const write = (file, text) => { if (!dryRun) writeFileSync(file, text); };

console.log(`Glyx ${current} → ${version}${dryRun ? '   (dry run: nothing is written)' : ''}\n`);

for (const { file } of state.pkgs) {
  write(file, bumpPackageJsonText(readFileSync(file, 'utf8'), version));
}
for (const { file, text } of state.crates) {
  write(file, bumpCargoToml(text, version));
}
let unchanged = 0;
for (const { file, text } of state.changelogs) {
  const rolled = rollChangelog(text, version, date);
  if (rolled.includes(`released alongside Glyx ${version}`)) unchanged++;
  write(file, rolled);
}
console.log(`  ${state.pkgs.length} npm packages and ${state.crates.length} crates → ${version}`);
console.log(`  ${state.changelogs.length} changelogs rolled to [${version}] - ${date} ` +
  `(${state.changelogs.length - unchanged} with notes, ${unchanged} "no changes")`);

if (dryRun) {
  console.log(`\nDry run — would tag v${version} and js-v${version}. Run without --dry-run to apply.`);
  process.exit(0);
}

// Cargo.lock records workspace crate versions.
const lock = spawnSync('cargo', ['update', '--workspace', '--offline'], { cwd: ROOT, stdio: 'inherit' });
if (lock.status !== 0) console.warn('  (cargo update --workspace failed — run it before committing)');

const problems = findProblems({ ...readState(), expected: version });
if (problems.length) {
  console.error('\nStill inconsistent:\n  ' + problems.map(rel).join('\n  '));
  process.exit(1);
}

console.log(`
Done. Review the diff, then land it on main through PRs (see RELEASING.md):

  git checkout -b release/v${version}
  git commit -am "chore: release ${version}"
  git push -u origin release/v${version}

Merge that PR into dev, then dev into main (a merge commit, not squash:
the tag must point at the commit that carries these versions). Then tag
the merged main:

  git checkout main && git pull
  git tag v${version}
  git tag js-v${version}
  git push origin v${version} js-v${version}

v${version} builds the CLI, runners and capability modules (release.yml);
js-v${version} publishes the npm packages (npm-publish.yml).`);
