# Releasing Glyx

Glyx is versioned in **lockstep**: every `@glyx-dev/*` npm package, the
`glyx-cli` npm wrapper, and every Rust crate under `crates/` share one
version. The npm packages call native bindings that ship in the runner, and
the CLI downloads its runner and capability modules by its own version, so
one number tells users what goes together. A package with no changes still
gets the new version, and its changelog says "No changes in this package".

## While you work

Add notes to the `## [Unreleased]` section of each package's `CHANGELOG.md`
you change. That's the only thing to remember between releases.

## To release

```bash
bun run release:version minor --dry-run   # preview: versions, and which changelogs have notes
bun run release:version minor             # patch | minor | major | 1.2.3
```

It needs a clean working tree (commit your work first). It then:

- sets every package and crate to the new version;
- points internal dependencies at it (`^<version>`);
- rolls each changelog's `[Unreleased]` notes into `[<version>] - <date>`;
- refreshes `Cargo.lock`, and prints the commands to finish.

Run it on `dev`, with your work already merged there. Review the diff, then
land the version bump on `main` through pull requests:

```bash
git checkout -b release/v0.2.0
git commit -am "chore: release 0.2.0"
git push -u origin release/v0.2.0
```

1. Open a PR from `release/v0.2.0` into `dev` and merge it once CI is green.
2. Open a PR from `dev` into `main` and merge it.

Use a **merge commit** for the PR into `main`, not squash or rebase: those
create a new commit, and the tag must point at the commit that carries the
bumped versions. Then tag the merged `main` and push the tags:

```bash
git checkout main && git pull
git tag v0.2.0
git tag js-v0.2.0
git push origin v0.2.0 js-v0.2.0
```

Check that `git log -1` shows the merge of the release PR before tagging.

- `v0.2.0` builds and publishes the CLI, runners and signed capability
  modules (`.github/workflows/release.yml`).
- `js-v0.2.0` publishes the npm packages (`.github/workflows/npm-publish.yml`).

Both workflows start by checking that every version equals the tag, so a
mismatched tag stops before anything is built or published.

## Checks

- `bun run release:check` (also in CI on every push) fails if any package,
  crate or internal dependency drifts from the shared version, or a
  changelog lacks an `[Unreleased]` section.
- `bun run release:check --fix` repairs internal dependency ranges and
  missing `[Unreleased]` headings. It never changes a version.

## One-time setup per new npm package

npm publishing uses Trusted Publishing (OIDC), not a token. Each package's
npm settings must list this repository, `npm-publish.yml` and the `release`
environment as a trusted publisher; see the note at the top of
`npm-publish.yml`. The package also needs a `CHANGELOG.md`.
