// @glyx-dev/react — system tray icon + menu.

// ── System tray ─────────────────────────────────────────────────────────────
//
// Requires `tray: true` capability in glyx.config.json.

import { addTrayListener, removeTrayListener, trayListenerCount } from '../events.js';

export const tray = {
  /**
   * Create a system tray icon from raw RGBA pixel data, or from the app's own icon.
   * @param {ArrayBuffer|null} rgba      RGBA pixel buffer (width×height×4 bytes), or null to use the app icon
   *                                     (the `icon` in glyx.config, else the Glyx default).
   * @param {number}      width          Icon width in pixels (ignored when `rgba` is null).
   * @param {number}      height         Icon height in pixels (ignored when `rgba` is null).
   * @param {string}      tooltip        Tooltip text.
   * @param {Array<{id:string,label:string,enabled?:boolean,checked?:boolean,separator?:boolean,accelerator?:string,children?:Array}>} [menu]
   * @returns {number} Tray handle ID, or 0 on failure.
   */
  create(rgba, width, height, tooltip, menu = []) {
    if (typeof __glyx_tray_create === 'undefined') return 0;
    // No pixels: the runtime uses the app icon.
    if (rgba == null) return __glyx_tray_create(null, 0, 0, tooltip, JSON.stringify(menu));
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
   * Called for every tray event, pushed by the runtime as it happens (no polling).
   * The event is `{ Click: { tray_id } }`, `{ DoubleClick: { tray_id } }` or
   * `{ MenuItemClick: { tray_id, item_id } }`. While anything is subscribed here,
   * events are delivered to it and `pollEvents` stays empty. Returns an unsubscribe function.
   * @param {(ev: object) => void} handler
   * @returns {() => void}
   */
  onEvent(handler) {
    addTrayListener(handler);
    if (trayListenerCount() === 1 && typeof __glyx_tray_listen !== 'undefined') __glyx_tray_listen(true);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      removeTrayListener(handler);
      if (trayListenerCount() === 0 && typeof __glyx_tray_listen !== 'undefined') __glyx_tray_listen(false);
    };
  },

  /**
   * Poll for pending tray events. Returns JSON array string or empty string.
   * Prefer `onEvent`, which needs no timer.
   * @returns {string}
   */
  pollEvents() {
    if (typeof __glyx_tray_poll_events === 'undefined') return '';
    return __glyx_tray_poll_events();
  },
};
