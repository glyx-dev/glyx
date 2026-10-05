// @glyx-dev/react — camera capture + recording.

// ── Camera API ────────────────────────────────────────────────────────────────

export const camera = {
  /** List connected camera devices. @returns {Promise<{index:number,name:string}[]>} */
  async listDevices() {
    return JSON.parse(await __glyx_camera_list());
  },
  /** Open camera by device index. @returns {Promise<number>} handle ID */
  async open(deviceIndex = 0) {
    return parseInt(await __glyx_camera_open(deviceIndex));
  },
  /** Close a previously opened camera. @param {number} handle */
  close(handle) {
    __glyx_camera_close(String(handle));
  },
  /**
   * Capture the current frame as a PNG file.
   * @param {number} handle  Handle returned by open() or Camera.start().
   * @returns {Promise<string>}  Absolute path to the saved PNG.
   */
  async capture(handle) {
    return __glyx_camera_capture(String(handle));
  },
  /**
   * Start recording to an MP4 file via ffmpeg (must be in PATH).
   * @param {number} handle
   * @param {string} outputPath  Absolute path for the output MP4.
   */
  startRecord(handle, outputPath) {
    __glyx_camera_record_start(String(handle), outputPath);
  },
  /**
   * Stop recording and flush the MP4.
   * @param {number} handle
   * @returns {Promise<string>}  Absolute path to the finished MP4.
   */
  async stopRecord(handle) {
    return __glyx_camera_record_stop(String(handle));
  },
};
