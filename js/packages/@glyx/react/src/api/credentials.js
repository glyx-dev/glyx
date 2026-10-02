// @glyx-dev/react — OS credential store (Keychain/Credential Manager/Secret Service).

/**
 * OS credential store — Windows Credential Manager, macOS Keychain, Linux Secret Service.
 * Data is encrypted by the OS and tied to the logged-in user account.
 * Never stored as plaintext on disk. Survives app restarts.
 *
 * Use for: auth tokens, session IDs, API keys the user provides at runtime.
 * Do NOT embed build-time secrets in the binary — use a backend proxy instead.
 *
 * Requires `credentials: true` in glyx.config.ts capabilities.
 */
export const credentials = {
  /**
   * Store a secret. Replaces any existing value for the same key.
   * @param {string} key
   * @param {string} value
   * @param {{ service?: string }} [options]  service defaults to 'glyx'
   * @returns {Promise<void>}
   */
  async set(key, value, { service = 'glyx' } = {}) {
    await __glyx_credentials_set(service, key, value);
  },
  /**
   * Retrieve a secret. Returns null if no entry exists.
   * @param {string} key
   * @param {{ service?: string }} [options]
   * @returns {Promise<string|null>}
   */
  async get(key, { service = 'glyx' } = {}) {
    const raw = await __glyx_credentials_get(service, key);
    return raw === 'null' ? null : JSON.parse(raw);
  },
  /**
   * Delete a secret. No-op if it does not exist.
   * @param {string} key
   * @param {{ service?: string }} [options]
   * @returns {Promise<void>}
   */
  async delete(key, { service = 'glyx' } = {}) {
    await __glyx_credentials_delete(service, key);
  },
};
