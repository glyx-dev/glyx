// @glyx-dev/react — launch-at-login.

// ── Autostart ────────────────────────────────────────────────────────────────
//
// Requires `autostart: true` capability in glyx.config.json.
//
// @example
// import { autostart } from '@glyx-dev/react';
// if (autostart.wasOpenedAtLogin()) showMinimizedToTray();
// await autostart.setEnabled(true);  // "Start with Windows" etc.

export const autostart = {
  /**
   * Whether the app is currently registered to launch at login.
   * @returns {boolean}
   */
  isEnabled() {
    if (typeof __glyx_autostart_isEnabled === 'undefined') return false;
    return __glyx_autostart_isEnabled();
  },
  /**
   * Register (`true`) or unregister (`false`) the app to launch at login.
   * @param {boolean} enabled
   * @returns {boolean} Whether it succeeded — `false` on a missing
   *   capability, an unsupported platform, or an OS-level failure.
   */
  setEnabled(enabled) {
    if (typeof __glyx_autostart_setEnabled === 'undefined') return false;
    return __glyx_autostart_setEnabled(!!enabled);
  },
  /**
   * Whether this launch was the OS starting the app at login, not the user
   * opening it by hand. Check this early to start minimized/to the tray
   * instead of popping a window.
   * @returns {boolean}
   */
  wasOpenedAtLogin() {
    if (typeof __glyx_autostart_wasOpenedAtLogin === 'undefined') return false;
    return __glyx_autostart_wasOpenedAtLogin();
  },
};