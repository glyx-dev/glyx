// @glyx-dev/react — microphone recording.

// ── Microphone API ────────────────────────────────────────────────────────────

export const microphone = {
  /** List connected input devices. @returns {Promise<{name:string}[]>} */
  async listDevices() {
    return JSON.parse(await __glyx_microphone_list());
  },
  /**
   * Record from the microphone to a WAV file.
   * @param {number} [durationMs=3000] Recording duration in milliseconds.
   * @param {string|null} [deviceName=null] Device name, or null for default.
   * @returns {Promise<string>} Absolute path to the recorded WAV file.
   */
  async record(durationMs = 3000, deviceName = null) {
    return __glyx_microphone_record(deviceName || '', durationMs);
  },
};
