// Which files take part in a Glyx release. Shared by version.mjs and check.mjs.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Published npm packages: js/packages/@glyx/* and js/packages/glyx-cli. */
export function packageDirs() {
  const scoped = join(ROOT, 'js/packages/@glyx');
  const dirs = readdirSync(scoped, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(scoped, d.name))
    .filter((d) => existsSync(join(d, 'package.json')));
  dirs.push(join(ROOT, 'js/packages/glyx-cli'));
  return dirs;
}

/** Every Rust crate under crates/. (Examples and vendor/ keep their own versions.) */
export function crateTomls() {
  const crates = join(ROOT, 'crates');
  return readdirSync(crates, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(crates, d.name, 'Cargo.toml')))
    .map((d) => join(crates, d.name, 'Cargo.toml'));
}

/** The VS Code extension isn't on npm, but it ships in lockstep with everything else. */
export const EXTENSION_DIR = join(ROOT, 'tools/vscode-glyx');

export function readState() {
  const pkgs = [...packageDirs(), EXTENSION_DIR].map((d) => ({ file: join(d, 'package.json'), json: JSON.parse(readFileSync(join(d, 'package.json'), 'utf8')) }));
  const crates = crateTomls().map((f) => ({ file: f, text: readFileSync(f, 'utf8') }));
  // npm packages and crates both keep a CHANGELOG.md beside their manifest.
  const changelogs = [...packageDirs(), EXTENSION_DIR, ...crateTomls().map((f) => join(f, '..'))]
    .map((d) => join(d, 'CHANGELOG.md'))
    .filter(existsSync)
    .map((f) => ({ file: f, text: readFileSync(f, 'utf8') }));
  return { pkgs, crates, changelogs };
}
