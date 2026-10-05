// @glyx-dev/react — printing.
//
// Requires `print: true` capability in glyx.config.json.
//
// @example
// import { print } from '@glyx-dev/react';
// const printers = await print.listPrinters();
// await print.file('/path/to/report.pdf');          // default printer
// await print.file('/path/to/report.pdf', { printer: printers[0] });

export const print = {
  /**
   * List the names of installed printers.
   * @returns {Promise<string[]>}
   */
  listPrinters() {
    if (typeof __glyx_print_listPrinters === 'undefined') return Promise.resolve([]);
    return __glyx_print_listPrinters().then(JSON.parse);
  },

  /**
   * The OS's current default printer, or `null` if none is set.
   * @returns {Promise<string|null>}
   */
  getDefaultPrinter() {
    if (typeof __glyx_print_getDefaultPrinter === 'undefined') return Promise.resolve(null);
    return __glyx_print_getDefaultPrinter().then(JSON.parse);
  },

  /**
   * Send a file to a printer — whatever app/driver is associated with the
   * file type handles the actual rendering (same as right-click → Print).
   * @param {string} path  Absolute path to the file (PDF, image, text, …).
   * @param {{ printer?: string }} [opts]  Omit to use the default printer.
   *   **Windows note:** a specific `printer` is ignored there — Windows'
   *   print verb has no way to target one, so it always uses the default.
   *   Honored on macOS/Linux.
   * @returns {Promise<void>}
   */
  file(path, { printer = '' } = {}) {
    if (typeof __glyx_print_file === 'undefined')
      return Promise.reject(new Error('print.file: binding not available'));
    return __glyx_print_file(path, printer);
  },
};
