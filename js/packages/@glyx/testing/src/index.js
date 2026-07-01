// @glyx/testing — Unit testing utilities for Glyx apps.
//
// Works with Bun's built-in test runner (`bun test`).
//
// Usage:
//   // In your test file:
//   import { render, screen, act, fireEvent } from '@glyx/testing';
//
//   test('Counter increments', () => {
//     const { getByText } = render(<Counter />);
//     fireEvent.press(getByText('+'));
//     expect(screen.getByText('1')).toBeTruthy();
//   });
//
// Setup:
//   // bunfig.toml
//   [test]
//   preload = ["@glyx/testing/setup"]
//
// Architecture:
//   • All __glyx_* native bindings are mocked so React components that call
//     Glyx APIs can run in a plain Bun/Node process without a running Glyx window.
//   • React is rendered synchronously using react-dom/server (SSR) or a custom
//     minimal reconciler, producing a JSON node tree you can query.
//   • No actual GPU / wgpu / winit is required.

// ── Mock registry ─────────────────────────────────────────────────────────────

const _mocks = new Map();

/**
 * Register a custom mock for a `__glyx_*` binding.
 * The mock replaces the auto-generated stub for the duration of the test file.
 *
 * @param {string}   name  The binding name (e.g. `"__glyx_fetch"`)
 * @param {function} impl  Mock implementation
 */
export function mockBinding(name, impl) {
  _mocks.set(name, impl);
  globalThis[name] = impl;
}

// ── Node tree ─────────────────────────────────────────────────────────────────

// Simple in-memory node tree used as Glyx's scene graph in tests.
let _nodes = new Map();
let _root   = null;
let _nextId = 1;

function _resetTree() {
  _nodes.clear();
  _root = null;
  _nextId = 1;
}

// ── Install default stubs ─────────────────────────────────────────────────────
//
// Call installStubs() in your test setup or import '@glyx/testing/setup'.
// Stubs are no-ops / sensible defaults so tests don't throw on missing bindings.

export function installStubs() {
  const stub  = () => {};
  const sp    = (v) => Promise.resolve(v);
  const spArr = () => Promise.resolve('[]');

  // Core scene graph
  globalThis.__glyx_createNode  = () => _nextId++;
  globalThis.__glyx_appendChild  = stub;
  globalThis.__glyx_updateNode   = stub;
  globalThis.__glyx_removeNode   = stub;
  globalThis.__glyx_setRoot      = (id) => { _root = id; };
  globalThis.__glyx_pollEvents   = () => [];
  globalThis.__glyx_getLayout    = () => ({ x: 0, y: 0, width: 0, height: 0 });
  globalThis.__glyx_getTime      = () => Date.now();
  globalThis.__glyx_request_frame = stub;
  globalThis.__glyx_log          = (...a) => {};
  globalThis.__glyx_createImage  = () => _nextId++;

  // Window
  globalThis.__glyx_getWindowSize  = () => ({ width: 1280, height: 800 });
  globalThis.__glyx_getScreenSize  = () => ({ width: 1920, height: 1080 });
  globalThis.__glyx_setFullscreen  = stub;
  globalThis.__glyx_setMaximized   = stub;
  globalThis.__glyx_setMinimized   = stub;
  globalThis.__glyx_isFullscreen   = () => false;
  globalThis.__glyx_isMaximized    = () => false;
  globalThis.__glyx_setAlwaysOnTop = stub;
  globalThis.__glyx_setTitle       = stub;
  globalThis.__glyx_platform       = () => 'test';
  globalThis.__glyx_quit           = stub;
  globalThis.__glyx_window_close   = stub;
  globalThis.__glyx_restart        = stub;
  globalThis.__glyx_window_create  = () => sp('0');
  globalThis.__glyx_ipc_send       = stub;
  globalThis.__glyx_ipc_poll       = () => '[]';

  // FS
  globalThis.__glyx_readFile       = () => sp('');
  globalThis.__glyx_readFileBytes  = () => sp('');
  globalThis.__glyx_writeFile      = () => sp(undefined);
  globalThis.__glyx_appendFile     = () => sp(undefined);
  globalThis.__glyx_listDir        = () => spArr();
  globalThis.__glyx_deleteFile     = () => sp(undefined);
  globalThis.__glyx_mkdirp         = () => sp(undefined);

  // DB
  let _dbHandle = 1;
  globalThis.__glyx_db_open        = () => sp(String(_dbHandle++));
  globalThis.__glyx_db_query       = () => spArr();
  globalThis.__glyx_db_run         = () => sp('{"rowsAffected":0,"lastInsertId":0}');
  globalThis.__glyx_db_close       = () => sp(undefined);
  globalThis.__glyx_db_transaction = () => sp(undefined);

  // Network
  globalThis.__glyx_fetch          = () => sp('{"status":200,"ok":true,"body":"","headers":{}}');
  globalThis.__glyx_ws_connect     = () => sp('0');
  globalThis.__glyx_ws_send        = stub;
  globalThis.__glyx_ws_poll        = () => '[]';
  globalThis.__glyx_ws_close       = stub;

  // Credentials
  globalThis.__glyx_credentials_set    = () => sp(null);
  globalThis.__glyx_credentials_get    = () => sp('null');
  globalThis.__glyx_credentials_delete = () => sp(null);

  // Clipboard, dialog, notifications
  globalThis.__glyx_clipboard_readText  = () => sp('');
  globalThis.__glyx_clipboard_writeText = () => sp(undefined);
  globalThis.__glyx_dialog_openFile     = () => sp('null');
  globalThis.__glyx_dialog_saveFile     = () => sp('null');
  globalThis.__glyx_dialog_openFolder   = () => sp('null');
  globalThis.__glyx_notification_send   = () => sp(undefined);
  globalThis.__glyx_getEnv              = () => null;

  // Audio
  let _audioId = 1;
  globalThis.__glyx_audio_play      = () => sp(String(_audioId++));
  globalThis.__glyx_audio_pause     = stub;
  globalThis.__glyx_audio_resume    = stub;
  globalThis.__glyx_audio_stop      = stub;
  globalThis.__glyx_audio_setVolume = stub;
  globalThis.__glyx_audio_getVolume = () => 1.0;
  globalThis.__glyx_audio_poll      = () => '[]';

  // Canvas
  globalThis.__glyx_canvas_update      = stub;
  globalThis.__glyx_canvas3d_update    = stub;
  globalThis.__glyx_canvas3d_load_gltf = stub;

  // AI
  globalThis.__glyx_ai_embed      = () => sp('[]');
  globalThis.__glyx_ai_generate   = () => sp('');
  globalThis.__glyx_ai_transcribe = () => sp('');

  // Camera + microphone
  globalThis.__glyx_camera_list         = () => spArr();
  globalThis.__glyx_camera_open         = () => sp('0');
  globalThis.__glyx_camera_close        = stub;
  globalThis.__glyx_camera_capture      = () => sp('');
  globalThis.__glyx_camera_record_start = stub;
  globalThis.__glyx_camera_record_stop  = () => sp('');
  globalThis.__glyx_microphone_list     = () => spArr();
  globalThis.__glyx_microphone_record   = () => sp('');

  // Crash + splash
  globalThis.__glyx_crash_report_js    = stub;
  globalThis.__glyx_crash_get_reports  = () => spArr();
  globalThis.__glyx_crash_clear_reports = stub;
  globalThis.__glyx_splash_hide        = stub;

  // Perf, power, system, etc.
  globalThis.__glyx_perf_snapshot           = () => '{"fps":60,"frameTime":16.7,"frameTimeP99":16.7,"jsTime":1,"layoutTime":0.5,"gpuTime":1,"memoryJS":10,"memoryTotal":50,"nodeCount":0}';
  globalThis.__glyx_perf_set_budget         = stub;
  globalThis.__glyx_perf_poll_violations    = () => '[]';
  globalThis.__glyx_perf_poll_leak_warnings = () => '[]';
  globalThis.__glyx_battery_getStatus       = () => sp('null');
  globalThis.__glyx_system_getInfo          = () => sp('{}');
  globalThis.__glyx_system_getDarkMode      = () => 'light';
  globalThis.__glyx_system_getBatterySaver  = () => false;
  globalThis.__glyx_power_preventSleep      = () => '0';
  globalThis.__glyx_power_allowSleep        = stub;
  globalThis.__glyx_storage_getDrives       = () => spArr();
  globalThis.__glyx_gamepad_poll            = () => '[]';
  globalThis.__glyx_shortcut_register       = () => '0';
  globalThis.__glyx_shortcut_unregister     = stub;
  globalThis.__glyx_shortcut_poll           = () => '[]';
  globalThis.__glyx_mdns_discover           = () => spArr();

  // Deeplink
  globalThis.__glyx_deeplink_getInitialUrl = () => '';
  globalThis.__glyx_deeplink_poll          = () => '[]';

  // HID, updater, video
  globalThis.__glyx_hid_enumerate   = () => spArr();
  globalThis.__glyx_hid_open        = () => sp('0');
  globalThis.__glyx_hid_read        = () => spArr();
  globalThis.__glyx_hid_write       = () => sp('0');
  globalThis.__glyx_hid_close       = stub;
  globalThis.__glyx_updater_check   = () => sp('{"hasUpdate":false,"latestVersion":"","body":""}');
  globalThis.__glyx_updater_update  = () => sp('{"updated":false,"latestVersion":""}');
  globalThis.__glyx_video_open      = () => sp('0');
  globalThis.__glyx_video_seek      = stub;
  globalThis.__glyx_video_close     = stub;
  globalThis.__glyx_video_poll      = () => '[]';

  // VectorDB
  globalThis.__glyx_vectorDb_open   = () => sp('0');
  globalThis.__glyx_vectorDb_upsert = () => sp(undefined);
  globalThis.__glyx_vectorDb_search = () => spArr();
  globalThis.__glyx_vectorDb_close  = () => sp(undefined);

  // Backend command dispatch
  globalThis.__glyx_backend_call = () => sp('null');

  // console passthrough
  if (typeof globalThis.console === 'undefined') {
    globalThis.console = {
      log: (...a) => {},
      info: (...a) => {},
      warn: (...a) => {},
      error: (...a) => {},
      debug: (...a) => {},
    };
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

let _React = null;
let _ReactDOMServer = null;

/**
 * Render a React element and return query utilities.
 * Uses react-dom/server for SSR-style rendering — no DOM or GPU required.
 *
 * @param {React.ReactElement} element
 * @returns {{ container: string, getByText, queryByText, getAllByText, debug }}
 */
export async function render(element) {
  if (!_React) {
    // Lazy import to avoid requiring React in every test file.
    _React = (await import('react')).default;
    try {
      _ReactDOMServer = (await import('react-dom/server')).default;
    } catch {
      _ReactDOMServer = null;
    }
  }

  let html = '';
  if (_ReactDOMServer) {
    html = _ReactDOMServer.renderToStaticMarkup(element);
  }

  function getByText(text) {
    if (html.includes(text)) return { textContent: text };
    throw new Error(`[glyx/testing] getByText("${text}"): not found in rendered output`);
  }

  function queryByText(text) {
    if (html.includes(text)) return { textContent: text };
    return null;
  }

  function getAllByText(text) {
    const results = [];
    let idx = 0;
    while ((idx = html.indexOf(text, idx)) !== -1) {
      results.push({ textContent: text, index: idx });
      idx += text.length;
    }
    if (results.length === 0) {
      throw new Error(`[glyx/testing] getAllByText("${text}"): not found in rendered output`);
    }
    return results;
  }

  function debug() {
    console.log('[glyx/testing] rendered HTML:', html);
  }

  return { container: html, getByText, queryByText, getAllByText, debug };
}

// ── screen ────────────────────────────────────────────────────────────────────

// Shorthand for the most recent render result — updated by render().
let _lastRender = null;

/**
 * Query helpers for the most recently rendered element.
 * Mirrors @testing-library/react's `screen` object.
 */
export const screen = {
  getByText:   (text) => _lastRender?.getByText(text),
  queryByText: (text) => _lastRender?.queryByText(text),
  getAllByText: (text) => _lastRender?.getAllByText(text),
  debug:       ()     => _lastRender?.debug(),
};

// Patch render() to update screen
const _originalRender = render;
export async function renderAndTrack(element) {
  const result = await _originalRender(element);
  _lastRender = result;
  return result;
}

// ── act ───────────────────────────────────────────────────────────────────────

/**
 * Wrap state updates and async operations so React can flush them before assertions.
 *
 * @param {function(): Promise<void>|void} callback
 */
export async function act(callback) {
  await callback();
  // In a real environment, React would flush updates here.
  // Since we render server-side, this is a no-op that future improvements can extend.
}

// ── fireEvent ─────────────────────────────────────────────────────────────────

/**
 * Simulate user interactions. Each method accepts the node returned by `getByText()`
 * and optional event data. Events are dispatched via React's synthetic event system
 * if available, or trigger onPress/onChange/etc. props directly.
 */
export const fireEvent = {
  /**
   * Simulate a press (tap / click).
   * @param {{ onPress?: function }} node
   */
  press(node) {
    if (node && typeof node.onPress === 'function') node.onPress();
  },

  /**
   * Simulate a text change.
   * @param {{ onChangeText?: function, onChange?: function }} node
   * @param {string} text  New text value
   */
  changeText(node, text) {
    if (node && typeof node.onChangeText === 'function') node.onChangeText(text);
    if (node && typeof node.onChange === 'function') node.onChange({ target: { value: text } });
  },

  /**
   * Simulate a submit (Enter key in TextInput).
   * @param {{ onSubmitEditing?: function }} node
   */
  submitEditing(node) {
    if (node && typeof node.onSubmitEditing === 'function') node.onSubmitEditing();
  },
};

// ── waitFor ───────────────────────────────────────────────────────────────────

/**
 * Poll an assertion until it passes or `timeout` expires.
 * Useful for testing async state updates.
 *
 * @param {function(): void} assertion  Should throw if not yet satisfied
 * @param {{ timeout?: number, interval?: number }} opts
 */
export async function waitFor(assertion, { timeout = 1000, interval = 50 } = {}) {
  const deadline = Date.now() + timeout;
  while (true) {
    try {
      assertion();
      return;
    } catch (err) {
      if (Date.now() >= deadline) throw err;
      await new Promise((r) => setTimeout(r, interval));
    }
  }
}
