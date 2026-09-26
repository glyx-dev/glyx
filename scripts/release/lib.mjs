// Lockstep versioning for Glyx: every @glyx-dev/* package, the glyx-cli npm
// wrapper, and every Rust crate under crates/ share ONE version. The npm
// packages call native bindings that ship in the runner, and the CLI
// downloads its runner and capability modules by its own version, so "which
// versions go together" must never be a question.
//
// Pure functions only (string/object in → string/object out) so every rule
// is unit-tested; version.mjs and check.mjs do the file I/O.

/** "0.1.0" + "minor" → "0.2.0". Also accepts an explicit "1.2.3". */
export function nextVersion(current, bump) {
  if (/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(bump)) return bump;
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(current);
  if (!m) throw new Error(`current version "${current}" isn't x.y.z`);
  let [maj, min, pat] = m.slice(1).map(Number);
  switch (bump) {
    case 'major': return `${maj + 1}.0.0`;
    case 'minor': return `${maj}.${min + 1}.0`;
    case 'patch': return `${maj}.${min}.${pat + 1}`;
    default: throw new Error(`bump must be major | minor | patch | x.y.z, got "${bump}"`);
  }
}

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

/** Is this one of ours? */
export const isInternal = (name) => name.startsWith('@glyx-dev/') || name === 'glyx-cli';

/**
 * The range an internal dependency must use: `^<version>`. Under 1.0 a caret
 * means "this minor line" (^0.2.0 = >=0.2.0 <0.3.0), matching a lockstep
 * release. `workspace:*` (in-repo tooling) is left alone.
 */
export const internalRange = (version) => `^${version}`;

/** Set a package.json object's version and internal ranges. Returns a new object. */
export function bumpPackageJson(pkg, version) {
  const out = { ...pkg, version };
  for (const field of DEP_FIELDS) {
    if (!pkg[field]) continue;
    out[field] = { ...pkg[field] };
    for (const name of Object.keys(out[field])) {
      if (isInternal(name) && !String(out[field][name]).startsWith('workspace:')) {
        out[field][name] = internalRange(version);
      }
    }
  }
  return out;
}

/**
 * `bumpPackageJson`, applied to the file's TEXT so formatting is untouched
 * (one-line arrays stay one-line; only the changed values differ). The
 * result is re-parsed and must equal the structured transform exactly;
 * anything unexpected falls back to a clean re-serialization.
 */
export function bumpPackageJsonText(text, version) {
  const want = bumpPackageJson(JSON.parse(text), version);
  let out = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
  out = out.replace(/("(@glyx-dev\/[^"]+|glyx-cli)"\s*:\s*")([^"]*)(")/g,
    (m, pre, _name, range, post) => (range.startsWith('workspace:') ? m : `${pre}${internalRange(version)}${post}`));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  try {
    if (same(JSON.parse(out), want)) return out;
  } catch { /* fall through */ }
  return JSON.stringify(want, null, 2) + '\n';
}

/** Replace the `[package]` version in a Cargo.toml's text. */
export function bumpCargoToml(text, version) {
  const pkg = /(\[package\][^\[]*?\nversion\s*=\s*")[^"]*(")/;
  if (!pkg.test(text)) throw new Error('no [package] version line');
  return text.replace(pkg, `$1${version}$2`);
}

/** The `[package]` version in a Cargo.toml's text, or null. */
export function cargoVersion(text) {
  const m = /\[package\][^\[]*?\nversion\s*=\s*"([^"]*)"/.exec(text);
  return m ? m[1] : null;
}

/**
 * Run a line-based transform on LF text, preserving the file's own line
 * endings (CRLF files stay CRLF — no mixed endings).
 */
function keepEol(text, fn) {
  const crlf = text.includes('\r\n');
  const out = fn(text.replace(/\r\n/g, '\n'));
  return crlf ? out.replace(/\n/g, '\r\n') : out;
}

/**
 * Roll a keep-a-changelog file: the `## [Unreleased]` notes become
 * `## [<version>] - <date>`, and a fresh empty `## [Unreleased]` goes on top.
 * A package with nothing unreleased still gets an entry saying so, so every
 * changelog lists every release. Only the Unreleased section is touched;
 * everything after it is kept byte-for-byte.
 */
export function rollChangelog(text, version, date) {
  if (text.includes(`## [${version}]`)) return text; // already rolled
  return keepEol(text, (t) => {
    const heading = `## [${version}] - ${date}`;
    const none = `- No changes in this package; released alongside Glyx ${version}.`;
    const m = /## \[Unreleased\][ \t]*\n/.exec(t);
    if (!m) {
      const title = /^# .*\n/.exec(t);
      const at = title ? title[0].length : 0;
      return `${t.slice(0, at)}\n## [Unreleased]\n\n${heading}\n\n${none}\n\n${t.slice(at).replace(/^\n+/, '')}`;
    }
    const start = m.index + m[0].length;
    const next = t.slice(start).search(/\n## \[/);
    const body = (next < 0 ? t.slice(start) : t.slice(start, start + next)).trim();
    const rest = next < 0 ? '' : t.slice(start + next + 1); // begins at "## ["
    const released = `${heading}\n\n${body || none}\n`;
    return `${t.slice(0, m.index)}## [Unreleased]\n\n${released}${rest ? `\n${rest}` : ''}`;
  });
}

/** Add an empty `## [Unreleased]` section under the title if there isn't one. */
export function ensureUnreleased(text) {
  if (/## \[Unreleased\]/.test(text)) return text;
  return keepEol(text, (t) => {
    const title = /^# .*\n/.exec(t);
    const at = title ? title[0].length : 0;
    return `${t.slice(0, at)}\n## [Unreleased]\n\n${t.slice(at).replace(/^\n+/, '')}`;
  });
}

/**
 * Every problem with the current state, as human-readable strings (empty =
 * consistent). `pkgs`: [{ file, json }], `crates`: [{ file, text }],
 * `changelogs`: [{ file, text }]. `expected`: e.g. a release tag's version.
 */
export function findProblems({ pkgs, crates, changelogs, expected }) {
  const problems = [];
  const cli = crates.find((c) => /glyx-cli[\\/]Cargo\.toml$/.test(c.file));
  const version = expected ?? (cli && cargoVersion(cli.text));
  if (!version) return ['cannot determine the release version (crates/glyx-cli/Cargo.toml)'];
  for (const { file, text } of crates) {
    const v = cargoVersion(text);
    if (v !== version) problems.push(`${file}: version ${v}, expected ${version}`);
  }
  for (const { file, json } of pkgs) {
    if (json.version !== version) problems.push(`${file}: version ${json.version}, expected ${version}`);
    for (const field of DEP_FIELDS) {
      for (const [name, range] of Object.entries(json[field] || {})) {
        if (!isInternal(name) || String(range).startsWith('workspace:')) continue;
        if (range !== internalRange(version)) {
          problems.push(`${file}: ${field}.${name} is "${range}", expected "${internalRange(version)}"`);
        }
      }
    }
  }
  for (const { file, text } of changelogs) {
    if (!/## \[Unreleased\]/.test(text)) problems.push(`${file}: no "## [Unreleased]" section`);
  }
  return problems;
}

/**
 * `release:version` arguments. Throws on anything unrecognised: an unknown
 * flag must never fall through to a real run.
 */
export function parseArgs(argv) {
  const opts = { bump: undefined, dryRun: false, allowDirty: false };
  for (const a of argv) {
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--allow-dirty') opts.allowDirty = true;
    else if (a.startsWith('-')) throw new Error(`unknown option ${a}`);
    else if (opts.bump === undefined) opts.bump = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  if (!opts.bump) throw new Error('missing version: patch | minor | major | x.y.z');
  nextVersion('0.0.0', opts.bump); // validates the keyword/version format
  return opts;
}

/** Today in the machine's own timezone, YYYY-MM-DD (not UTC). */
export function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
