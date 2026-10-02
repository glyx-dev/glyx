// @glyx-dev/react — native file dialogs.
import { _noBinding } from './_shared.js';

// ── File Dialogs ───────────────────────────────────────────────────────────────
//
// Requires `dialog: true` capability in glyx.config.json.
//
// dialog.openFile({ filters?, multiple? }) → Promise<string[] | null>
// dialog.saveFile({ defaultName?, filters? }) → Promise<string | null>
// dialog.openFolder()                         → Promise<string | null>
//
// Filter shape: [{ name: string, extensions: string[] }]

export const dialog = {
  /**
   * Show a native open-file dialog.
   * @param {{ filters?: {name:string,extensions:string[]}[], multiple?: boolean }} [opts]
   * @returns {Promise<string[] | null>} Selected path(s), or null if cancelled.
   */
  openFile({ filters = [], multiple = false } = {}) {
    if (typeof __glyx_dialog_openFile === 'undefined') return _noBinding('dialog.openFile');
    return __glyx_dialog_openFile(JSON.stringify(filters), multiple).then(raw => {
      const result = JSON.parse(raw);
      if (result === null) return null;
      // multiple=false returns a bare JSON string; multiple=true returns a JSON array.
      // Always normalise to string[] so callers can use result[0] uniformly.
      return Array.isArray(result) ? result : [result];
    });
  },

  /**
   * Show a native save-file dialog.
   * @param {{ defaultName?: string, filters?: {name:string,extensions:string[]}[] }} [opts]
   * @returns {Promise<string | null>} Chosen save path, or null if cancelled.
   */
  saveFile({ defaultName = '', filters = [] } = {}) {
    if (typeof __glyx_dialog_saveFile === 'undefined') return _noBinding('dialog.saveFile');
    return __glyx_dialog_saveFile(defaultName, JSON.stringify(filters)).then(JSON.parse);
  },

  /**
   * Show a native open-folder dialog.
   * @returns {Promise<string | null>} Selected folder path, or null if cancelled.
   */
  openFolder() {
    if (typeof __glyx_dialog_openFolder === 'undefined') return _noBinding('dialog.openFolder');
    return __glyx_dialog_openFolder().then(JSON.parse);
  },
};
