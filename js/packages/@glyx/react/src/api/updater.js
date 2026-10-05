// @glyx-dev/react — app auto-updater.

// ── Auto-updater API ──────────────────────────────────────────────────────────

/**
 * Auto-updater — check for and apply updates.
 *
 * Requires `updater: true` in glyx.config.json.
 *
 * ## Manifest-based flow (recommended)
 *
 * Host a `latest.json` on any static server:
 * ```json
 * {
 *   "version":     "2.1.0",
 *   "update_type": "js_only",   // "js_only" | "runner" | "full"
 *   "notes":       "Bug fixes",
 *   "js_url":      "https://cdn.example.com/2.1.0/app.js",
 *   "js_sig":      "a1b2c3..."  // Ed25519 signature, hex-encoded, over the bundle bytes
 * }
 * ```
 *
 * Then in your app:
 * ```js
 * const manifest = await updater.checkManifest('https://cdn.example.com/latest.json');
 * if (manifest) {
 *   if (manifest.update_type === 'js_only') {
 *     await updater.downloadJs(manifest.js_url, manifest.js_sig);
 *     glyxWindow.restart();   // applies on next launch automatically
 *   } else {
 *     // runner/full: use updater.update() for GitHub releases, or direct download
 *   }
 * }
 * ```
 *
 * ## GitHub-release flow (binary updates)
 *
 * The release owner/repo/binary name are NOT passed from JS — they're baked
 * in at build time from `updater: { owner, repo, binName }` in glyx.config
 * (see `bind_updater.rs`'s "Build-time update origin" doc). JS only ever
 * supplies the version to compare against; it can't redirect the update
 * source to a different repo.
 *
 * ```js
 * const info = await updater.check('1.0.0');
 * if (info.hasUpdate) {
 *   const result = await updater.update('1.0.0');
 *   if (result.updated) { // show "restart required" dialog }
 * }
 * ```
 */
export const updater = {
  /**
   * Returns the app version declared in `glyx.config.json` (`version` field),
   * or `"0.0.0"` if not set.
   * @returns {string}
   */
  getVersion() {
    return __glyx_updater_get_version();
  },

  /**
   * Returns the current platform identifier: `"windows"`, `"macos"`, or `"linux"`.
   * Matches the `_platform` field injected into manifests by `checkManifest`.
   * @returns {string}
   */
  getPlatform() {
    return __glyx_platform();
  },

  /**
   * Fetch a JSON manifest from `url` and compare its `version` field against
   * `currentVersion` (defaults to `updater.getVersion()` when omitted).
   *
   * Returns `null` when already up to date **or** when the manifest's optional
   * `platforms` array does not include the current OS.
   *
   * The returned manifest includes a `_platform` key (e.g. `"windows"`) so you
   * can read platform-specific asset URLs:
   * ```js
   * const m = await updater.checkManifest('https://cdn.example.com/latest.json');
   * if (m && m.update_type === 'runner') {
   *   const { runner_url, runner_sha256 } = m[m._platform] ?? {};
   * }
   * ```
   * @param {string}  url            URL of the JSON manifest.
   * @param {string=} currentVersion Semver string to compare against. Defaults to app version.
   * @returns {Promise<object|null>}  Manifest object if a newer version exists, otherwise null.
   */
  async checkManifest(url, currentVersion) {
    const current = currentVersion ?? updater.getVersion();
    const raw = await __glyx_updater_check_manifest(url, current);
    return raw === 'null' ? null : JSON.parse(raw);
  },

  /**
   * Download a JS bundle from `url`, verify its Ed25519 signature, and stage
   * it for the next restart. On next launch the runner loads the staged JS
   * instead of the trailer bundle — completing a JS-only update with zero downtime.
   *
   * There is no "skip verification" option — an unsigned bundle is always
   * rejected before anything is written to disk.
   * @param {string} url    Direct download URL of the new `app.js`.
   * @param {string} sigHex Ed25519 signature, hex-encoded, over the raw bundle
   *                        bytes (e.g. the manifest's `js_sig` field — NOT a
   *                        SHA-256 digest).
   * @returns {Promise<void>}
   */
  async downloadJs(url, sigHex) {
    await __glyx_updater_download_js(url, sigHex);
  },

  /**
   * Check the build-time-configured GitHub repo for a newer version. The
   * owner/repo are NOT passed from JS — see the module doc above.
   * @param {string} currentVersion Current semver string (e.g. "1.0.0").
   * @returns {Promise<{hasUpdate:boolean, latestVersion:string, body:string}>}
   */
  async check(currentVersion) {
    return JSON.parse(await __glyx_updater_check(currentVersion));
  },

  /**
   * Download the latest GitHub release and replace the running binary.
   * The release source (owner/repo/binName) is build-time-configured, not
   * caller-supplied — see the module doc above. The caller should prompt the
   * user to restart the app after this resolves.
   * @param {string} currentVersion Current semver string.
   * @returns {Promise<{updated:boolean, latestVersion:string}>}
   */
  async update(currentVersion) {
    return JSON.parse(await __glyx_updater_update(currentVersion));
  },
};
