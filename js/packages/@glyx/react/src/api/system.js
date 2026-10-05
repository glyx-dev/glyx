// @glyx-dev/react — battery, system info, power, storage.
import { registerSystemWatch, unregisterSystemWatch } from '../events.js';

// ── OS system APIs ────────────────────────────────────────────────────────────

export const battery = {
  /** @returns {Promise<{level:number, charging:boolean, timeRemainingSecs:number|null}|null>} */
  async getStatus() {
    if (typeof __glyx_battery_getStatus === 'undefined') return null;
    const raw = await __glyx_battery_getStatus();
    return raw === 'null' ? null : JSON.parse(raw);
  },
};

export const system = {
  /**
   * Subscribe to a system metric — "don't poll; subscribe."
   *
   * A RUST-side poller reads the metric on a timer and fires `cb` ONLY when
   * the value changes; V8 stays completely idle between changes.  Use this
   * instead of setInterval + getInfo()/getStatus() for live displays.
   *
   * Kinds and payloads:
   *   'battery'      → { level, charging, timeRemainingSecs } | null
   *   'memory'       → { usedMb, totalMb }
   *   'darkMode'     → 'dark' | 'light' | 'unknown'
   *   'batterySaver' → boolean
   *
   * @param {'battery'|'memory'|'darkMode'|'batterySaver'} kind
   * @param {(value: any) => void} cb
   * @param {{ intervalMs?: number }} [opts]  Poll cadence (floor 1000ms;
   *   defaults: 2s for darkMode/batterySaver, 10s for battery/memory).
   * @returns {number} watch id — pass to `system.unwatch(id)`.
   */
  watch(kind, cb, opts) {
    if (typeof __glyx_system_watch === 'undefined') return 0;
    const id = __glyx_system_watch(kind, (opts && opts.intervalMs) || 0);
    if (id > 0) registerSystemWatch(id, cb);
    return id;
  },
  /** Stop a `system.watch` subscription. */
  unwatch(id) {
    if (!id) return;
    unregisterSystemWatch(id);
    if (typeof __glyx_system_unwatch !== 'undefined') __glyx_system_unwatch(id);
  },
  /** @returns {Promise<{cpuName,cpuCores,memoryTotalMb,memoryUsedMb,osName,osVersion}>} */
  async getInfo() {
    if (typeof __glyx_system_getInfo === 'undefined') return null;
    return JSON.parse(await __glyx_system_getInfo());
  },
  /**
   * Returns the OS-level color scheme preference synchronously (~1 µs).
   * @returns {"dark"|"light"|"unknown"}
   */
  getDarkMode() {
    if (typeof __glyx_system_getDarkMode === 'undefined') return 'unknown';
    return __glyx_system_getDarkMode();
  },
  /**
   * Returns whether battery-saver / power-saver mode is active synchronously (~1 µs).
   * Windows: reads GetSystemPowerStatus(). macOS/Linux: always false until native support lands.
   * @returns {boolean}
   */
  isBatterySaverActive() {
    if (typeof __glyx_system_getBatterySaver === 'undefined') return false;
    return __glyx_system_getBatterySaver();
  },
};

export const power = {
  /** Prevent system sleep. Returns a guard handle string. */
  preventSleep(reason = 'Glyx app running') {
    if (typeof __glyx_power_preventSleep === 'undefined') return null;
    return __glyx_power_preventSleep(reason);
  },
  /** Release sleep prevention guard by handle string. */
  allowSleep(handle) {
    if (typeof __glyx_power_allowSleep !== 'undefined') __glyx_power_allowSleep(handle);
  },
};

export const storage = {
  /** @returns {Promise<Array<{name,mountPoint,totalBytes,availableBytes}>>} */
  async getDrives() {
    if (typeof __glyx_storage_getDrives === 'undefined') return [];
    return JSON.parse(await __glyx_storage_getDrives());
  },
};
