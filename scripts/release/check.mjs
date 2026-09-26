#!/usr/bin/env bun
// Fails when Glyx's versions have drifted: any package, crate or internal
// dependency not on the one shared version, or a changelog missing its
// [Unreleased] section. Runs in CI on every push, and in both release
// workflows with the tag's version:
//
//   bun scripts/release/check.mjs              (versions agree with each other)
//   bun scripts/release/check.mjs v0.2.0       (…and equal this tag)
//   bun scripts/release/check.mjs --fix        (repair ranges + changelog headings;
//                                               never changes a version)
import { readFileSync, writeFileSync } from 'node:fs';
import { findProblems, bumpPackageJsonText, cargoVersion, ensureUnreleased } from './lib.mjs';
import { ROOT, readState } from './files.mjs';

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const tag = args.find((a) => !a.startsWith('--'));
const expected = tag ? tag.replace(/^(js-)?v/, '') : undefined;
const norm = (s) => s.replace(/\\/g, '/');
const rel = (s) => norm(s).replace(norm(ROOT), '');

if (fix) {
  const state = readState();
  const cli = state.crates.find((c) => /glyx-cli[\\/]Cargo\.toml$/.test(c.file));
  const version = cargoVersion(cli.text);
  for (const { file, json } of state.pkgs) {
    // Same version → only internal ranges change (formatting untouched).
    if (json.version !== version) continue;
    const text = readFileSync(file, 'utf8');
    const fixed = bumpPackageJsonText(text, version);
    if (fixed !== text) writeFileSync(file, fixed);
  }
  for (const { file, text } of state.changelogs) writeFileSync(file, ensureUnreleased(text));
}

const problems = findProblems({ ...readState(), expected });
if (problems.length) {
  console.error(`Glyx versions are inconsistent${expected ? ` with tag ${tag}` : ''}:\n  ` + problems.map(rel).join('\n  '));
  console.error('\nFix with: bun run release:version <patch | minor | major | x.y.z>, or bun run release:check --fix');
  process.exit(1);
}
console.log(`Glyx versions consistent${expected ? ` with ${tag}` : ''}.`);
