// @glyx-dev/react — Human Interface Device (HID) access.

// ── HID API ───────────────────────────────────────────────────────────────────

/**
 * Human Interface Device (HID) API — USB gamepads, custom hardware, etc.
 *
 * Requires `hid: true` in glyx.config.json.
 */
export const hid = {
  /**
   * List all connected HID devices.
   * @returns {Promise<{vendorId,productId,manufacturer,product,serialNumber,interfaceNumber,path}[]>}
   */
  async enumerate() {
    return JSON.parse(await __glyx_hid_enumerate());
  },
  /**
   * Open a HID device by vendor + product ID.
   * @param {number} vendorId
   * @param {number} productId
   * @returns {Promise<number>} Handle ID.
   */
  async open(vendorId, productId) {
    return parseInt(await __glyx_hid_open(vendorId, productId));
  },
  /**
   * Read bytes from an open HID device.
   * @param {number} handle   Handle returned by open().
   * @param {number} [timeoutMs=100]
   * @returns {Promise<number[]>} Array of byte values (up to 64).
   */
  async read(handle, timeoutMs = 100) {
    return JSON.parse(await __glyx_hid_read(handle, timeoutMs));
  },
  /**
   * Write bytes to an open HID device.
   * @param {number} handle   Handle returned by open().
   * @param {number[]} data   Array of byte values.
   * @returns {Promise<number>} Number of bytes written.
   */
  async write(handle, data) {
    return parseInt(await __glyx_hid_write(handle, JSON.stringify(data)));
  },
  /**
   * Close a HID device handle.
   * @param {number} handle
   */
  close(handle) {
    __glyx_hid_close(handle);
  },
};
