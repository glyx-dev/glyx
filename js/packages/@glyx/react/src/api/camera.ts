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
  close(handle: any) {
    __glyx_camera_close(String(handle));
  },
  /**
   * Capture the current frame as a PNG file.
   * @param {number} handle  Handle returned by open() or Camera.start().
   * @returns {Promise<string>}  Absolute path to the saved PNG.
   */
  async capture(handle: any) {
    return __glyx_camera_capture(String(handle));
  },
  /**
   * Start recording to an MP4 file (H.264, video only; there is no audio track).
   * Encoding uses the glyx-media library, which `glyx dev` / `glyx package` download for you when
   * the app declares `camera`. If it can't be loaded, an `ffmpeg` executable (`FFMPEG_PATH`, or on
   * PATH) is used instead.
   * @param {number} handle
   * @param {string} outputPath  Absolute path for the output MP4.
   */
  startRecord(handle: any, outputPath: any) {
    __glyx_camera_record_start(String(handle), outputPath);
  },
  /**
   * Stop recording and flush the MP4.
   * @param {number} handle
   * @returns {Promise<string>}  Absolute path to the finished MP4.
   */
  async stopRecord(handle: any) {
    return __glyx_camera_record_stop(String(handle));
  },
};
