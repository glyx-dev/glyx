import { test, expect } from 'bun:test';
import {
  nextVersion, bumpPackageJson, bumpCargoToml, cargoVersion, rollChangelog, findProblems, internalRange, ensureUnreleased, bumpPackageJsonText, parseArgs, localDate,
} from './lib.mjs';

test('next version from a bump keyword or an explicit version', () => {
  expect(nextVersion('0.1.0', 'patch')).toBe('0.1.1');
  expect(nextVersion('0.1.3', 'minor')).toBe('0.2.0');
  expect(nextVersion('0.9.2', 'major')).toBe('1.0.0');
  expect(nextVersion('0.1.0', '0.4.0')).toBe('0.4.0');
  expect(nextVersion('0.1.0', '1.0.0-rc.1')).toBe('1.0.0-rc.1');
  expect(() => nextVersion('0.1.0', 'huge')).toThrow();
});

test('package.json: version and internal ranges move together; others untouched', () => {
  const pkg = {
    name: '@glyx-dev/charts', version: '0.1.0',
    peerDependencies: { '@glyx-dev/react': '0.1.0', react: '^18' },
    dependencies: { '@glyx-dev/icons': '*', 'left-pad': '1.0.0' },
    devDependencies: { '@glyx-dev/testing': 'workspace:*' },
  };
  const out = bumpPackageJson(pkg, '0.2.0');
  expect(out.version).toBe('0.2.0');
  // The regression: charts' exact "0.1.0" pin on react (and a "*").
  expect(out.peerDependencies['@glyx-dev/react']).toBe('^0.2.0');
  expect(out.dependencies['@glyx-dev/icons']).toBe('^0.2.0');
  expect(out.peerDependencies.react).toBe('^18');
  expect(out.dependencies['left-pad']).toBe('1.0.0');
  expect(out.devDependencies['@glyx-dev/testing']).toBe('workspace:*');
  expect(pkg.version).toBe('0.1.0'); // input not mutated
});

test('Cargo.toml: only the [package] version changes', () => {
  const toml = `[package]\nname = "glyx-cli"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nureq = { version = "2" }\n`;
  const out = bumpCargoToml(toml, '0.2.0');
  expect(cargoVersion(out)).toBe('0.2.0');
  expect(out).toContain('ureq = { version = "2" }');
  expect(() => bumpCargoToml('[workspace]\n', '0.2.0')).toThrow();
});

test('changelog: Unreleased notes become the release, a fresh Unreleased goes on top', () => {
  const text = '# Changelog\n\n## [Unreleased]\n\n### Fixed\n- A thing.\n\n## [0.1.0] - 2026-08-07\n\n- Initial public release.\n';
  const out = rollChangelog(text, '0.2.0', '2026-09-26');
  expect(out).toBe('# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-26\n\n### Fixed\n- A thing.\n\n## [0.1.0] - 2026-08-07\n\n- Initial public release.\n');
  expect(rollChangelog(out, '0.2.0', '2026-09-26')).toBe(out); // idempotent
});

test('changelog: an unchanged package still records the release', () => {
  const empty = '# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-08-07\n\n- Initial public release.\n';
  const out = rollChangelog(empty, '0.2.0', '2026-09-26');
  expect(out).toContain('## [0.2.0] - 2026-09-26\n\n- No changes in this package; released alongside Glyx 0.2.0.');
  const none = '# Changelog\n\n## [0.1.0] - 2026-08-07\n\n- Initial public release.\n';
  const out2 = rollChangelog(none, '0.2.0', '2026-09-26');
  expect(out2.indexOf('## [Unreleased]')).toBeLessThan(out2.indexOf('## [0.2.0]'));
  expect(out2).toContain('## [0.1.0] - 2026-08-07');
});

test('the check catches every kind of drift', () => {
  const ok = {
    crates: [
      { file: 'crates/glyx-cli/Cargo.toml', text: '[package]\nname="glyx-cli"\nversion = "0.2.0"\n' },
      { file: 'crates/glyx-core/Cargo.toml', text: '[package]\nname="glyx-core"\nversion = "0.2.0"\n' },
    ],
    pkgs: [{ file: 'charts/package.json', json: { version: '0.2.0', peerDependencies: { '@glyx-dev/react': internalRange('0.2.0') } } }],
    changelogs: [{ file: 'charts/CHANGELOG.md', text: '# C\n\n## [Unreleased]\n' }],
  };
  expect(findProblems(ok)).toEqual([]);
  expect(findProblems({ ...ok, expected: '0.2.0' })).toEqual([]);
  expect(findProblems({ ...ok, expected: '0.3.0' }).length).toBeGreaterThan(0); // tag ≠ code

  const drifted = {
    crates: [ok.crates[0], { file: 'crates/glyx-core/Cargo.toml', text: '[package]\nversion = "0.1.0"\n' }],
    pkgs: [{ file: 'charts/package.json', json: { version: '0.1.0', peerDependencies: { '@glyx-dev/react': '0.1.0' } } }],
    changelogs: [{ file: 'charts/CHANGELOG.md', text: '# C\n' }],
  };
  const problems = findProblems(drifted).join('\n');
  expect(problems).toContain('glyx-core/Cargo.toml: version 0.1.0, expected 0.2.0');
  expect(problems).toContain('charts/package.json: version 0.1.0');
  expect(problems).toContain('peerDependencies.@glyx-dev/react is "0.1.0", expected "^0.2.0"');
  expect(problems).toContain('no "## [Unreleased]" section');
});

test('ensureUnreleased adds the section once, under the title', () => {
  const out = ensureUnreleased('# Changelog\n\n## [0.1.0] - 2026-08-07\n\n- Initial public release.\n');
  expect(out).toBe('# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-08-07\n\n- Initial public release.\n');
  expect(ensureUnreleased(out)).toBe(out);
});

test('package.json edits keep the file\'s formatting', () => {
  const text = '{\n  "name": "@glyx-dev/charts",\n  "version": "0.1.0",\n  "keywords": ["a", "b"],\n  "peerDependencies": {\n    "@glyx-dev/react": "0.1.0",\n    "react": "^18"\n  },\n  "devDependencies": { "@glyx-dev/testing": "workspace:*" }\n}\n';
  const out = bumpPackageJsonText(text, '0.2.0');
  expect(out).toBe(text.replace('"version": "0.1.0"', '"version": "0.2.0"').replace('"@glyx-dev/react": "0.1.0"', '"@glyx-dev/react": "^0.2.0"'));
  expect(out).toContain('"keywords": ["a", "b"]'); // not expanded
  expect(out).toContain('"name": "@glyx-dev/charts"'); // the name isn't a dependency
  expect(JSON.parse(out)).toEqual(bumpPackageJson(JSON.parse(text), '0.2.0'));
});

test('an internal devDependency the text edit would wrongly touch falls back safely', () => {
  // devDependencies aren't rewritten by the structured transform, so the
  // text edit's result differs → it must fall back, not write a mismatch.
  const text = '{\n  "name": "x",\n  "version": "0.1.0",\n  "devDependencies": { "@glyx-dev/react": "0.0.9" }\n}\n';
  const out = bumpPackageJsonText(text, '0.2.0');
  expect(JSON.parse(out)).toEqual(bumpPackageJson(JSON.parse(text), '0.2.0'));
  expect(JSON.parse(out).devDependencies['@glyx-dev/react']).toBe('0.0.9');
});

test('arguments: unknown options and typos never become a real run', () => {
  expect(parseArgs(['minor'])).toEqual({ bump: 'minor', dryRun: false, allowDirty: false });
  expect(parseArgs(['minor', '--dry-run'])).toEqual({ bump: 'minor', dryRun: true, allowDirty: false });
  expect(parseArgs(['--allow-dirty', '0.3.0']).bump).toBe('0.3.0');
  // The 2026-09-26 accident: an unsupported flag was ignored and it released.
  expect(() => parseArgs(['minor', '--dryrun'])).toThrow('unknown option --dryrun');
  expect(() => parseArgs(['minor', 'patch'])).toThrow('unexpected argument');
  expect(() => parseArgs(['--dry-run'])).toThrow('missing version');
  expect(() => parseArgs(['minr'])).toThrow();
});

test('the release date is the local calendar date', () => {
  expect(localDate(new Date(2026, 8, 26, 0, 30))).toBe('2026-09-26'); // just after local midnight
  expect(localDate(new Date(2026, 0, 5))).toBe('2026-01-05');
});

test('changelogs keep CRLF line endings and untouched blank lines elsewhere', () => {
  const crlf = '# Changelog\r\n\r\n## [Unreleased]\r\n\r\n### Fixed\r\n- A thing.\r\n\r\n\r\n## [0.1.0] - 2026-08-07\r\n\r\n- Initial.\r\n';
  const out = rollChangelog(crlf, '0.2.0', '2026-09-26');
  expect(out.replace(/\r\n/g, '')).not.toContain('\n'); // no bare LF introduced
  expect(out).toContain('## [0.2.0] - 2026-09-26\r\n\r\n### Fixed\r\n- A thing.\r\n');
  // Everything from the previous release on is byte-for-byte unchanged.
  expect(out.slice(out.indexOf('## [0.1.0]'))).toBe(crlf.slice(crlf.indexOf('## [0.1.0]')));
  expect(ensureUnreleased('# C\r\n\r\n## [0.1.0]\r\n')).toBe('# C\r\n\r\n## [Unreleased]\r\n\r\n## [0.1.0]\r\n');
});
