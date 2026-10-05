// @glyx-dev/react — system clipboard.
import { _noBinding } from './_shared.js';

// ── Clipboard ─────────────────────────────────────────────────────────────────
//
// Requires `clipboard: true` capability in glyx.config.json.

export const clipboard = {
  /**
   * Read plain text from the system clipboard.
   * @returns {Promise<string>}
   */
  readText() {
    if (typeof __glyx_clipboard_readText === 'undefined') return _noBinding('clipboard.readText');
    return __glyx_clipboard_readText();
  },

  /**
   * Write plain text to the system clipboard.
   * @param {string} text
   * @returns {Promise<void>}
   */
  writeText(text) {
    if (typeof __glyx_clipboard_writeText === 'undefined') return _noBinding('clipboard.writeText');
    return __glyx_clipboard_writeText(text);
  },
};
