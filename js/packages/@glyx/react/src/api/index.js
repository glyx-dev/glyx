// @glyx-dev/react — native API bindings and frame poll state.
//
// Split by domain, one file per capability (fs, db, dialog, clipboard, …),
// so each is easy to find and change without touching unrelated code. This
// file is the barrel: every domain's exports, re-exported from one place.
// Import order has no effect on behavior — each domain's module-level side
// effects (installing a key listener, patching globalThis.fetch, wrapping
// globalThis.onerror) are independent of the others.

export * from './_shared.js';
export * from './fs.js';
export * from './db.js';
export * from './dialog.js';
export * from './clipboard.js';
export * from './tray.js';
export * from './notification.js';
export * from './fetch.js';
export * from './shell.js';
export * from './ws.js';
export * from './mdns.js';
export * from './ipc.js';
export * from './window.js';
export * from './crash.js';
export * from './backend.js';
export * from './perf.js';
export * from './system.js';
export * from './credentials.js';
export * from './audio.js';
export * from './ai.js';
export * from './camera.js';
export * from './microphone.js';
export * from './hid.js';
export * from './updater.js';
export * from './video.js';
export * from './webview.js';
export * from './input.js';
export * from './deeplink.js';
export * from './autostart.js';
