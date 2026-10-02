// @glyx-dev/react — system tray icon + menu.

// ── System tray ─────────────────────────────────────────────────────────────
//
// Requires `tray: true` capability in glyx.config.json.

export const tray = {
  /**
   * Create a system tray icon from raw RGBA pixel data.
   * @param {ArrayBuffer} rgba           RGBA pixel buffer (width×height×4 bytes).
   * @param {number}      width          Icon width in pixels.
   * @param {number}      height         Icon height in pixels.
   * @param {string}      tooltip        Tooltip text.
   * @param {Array<{id:string,label:string,enabled?:boolean,checked?:boolean,separator?:boolean,accelerator?:string,children?:Array}>} [menu]
   * @returns {number} Tray handle ID, or 0 on failure.
   */
  create(rgba, width, height, tooltip, menu = []) {
    if (typeof __glyx_tray_create === 'undefined') return 0;
    return __glyx_tray_create(rgba, width, height, tooltip, JSON.stringify(menu));
  },

  /**
   * Destroy a tray icon.
   * @param {number} trayId
   * @returns {boolean}
   */
  destroy(trayId) {
    if (typeof __glyx_tray_destroy === 'undefined') return false;
    return __glyx_tray_destroy(trayId);
  },

  /**
   * Update the tray context menu.
   * @param {number} trayId
   * @param {Array}  menu
   * @returns {boolean}
   */
  updateMenu(trayId, menu) {
    if (typeof __glyx_tray_update_menu === 'undefined') return false;
    return __glyx_tray_update_menu(trayId, JSON.stringify(menu));
  },

  /**
   * Update the tooltip text.
   * @param {number} trayId
   * @param {string} tooltip
   */
  setTooltip(trayId, tooltip) {
    if (typeof __glyx_tray_set_tooltip !== 'undefined') {
      __glyx_tray_set_tooltip(trayId, tooltip);
    }
  },

  /**
   * Poll for pending tray events. Returns JSON array string or empty string.
   * @returns {string}
   */
  pollEvents() {
    if (typeof __glyx_tray_poll_events === 'undefined') return '';
    return __glyx_tray_poll_events();
  },
};
