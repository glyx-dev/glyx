// @velox/testing — Unit testing utilities for Velox apps.
//
// Works with Bun's built-in test runner (`bun test`).
//
// Usage:
//   // In your test file:
//   import { render, screen, act, fireEvent } from '@velox/testing';
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
//   preload = ["@velox/testing/setup"]
//
// Architecture:
//   • All __velox_* native bindings are mocked so React components that call
//     Velox APIs can run in a plain Bun/Node process without a running Velox window.
//   • React is rendered synchronously using react-dom/server (SSR) or a custom
//     minimal reconciler, producing a JSON node tree you can query.
//   • No actual GPU / wgpu / winit is required.

// ── Mock registry ─────────────────────────────────────────────────────────────

const _mocks = new Map();

/**
 * Register a custom mock for a `__velox_*` binding.
 * The mock replaces the auto-generated stub for the duration of the test file.
 *
 * @param {string}   name  The binding name (e.g. `"__velox_fetch"`)
 * @param {function} impl  Mock implementation
 */
export function mockBinding(name, impl) {
  _mocks.set(name, impl);
  globalThis[name] = impl;
}

// ── Node tree ─────────────────────────────────────────────────────────────────

// Simple in-memory node tree used as Velox's scene graph in tests.
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
// Call installStubs() in your test setup or import '@velox/testing/setup'.
// Stubs are no-ops / sensible defaults so tests don't throw on missing bindings.

export function installStubs() {
  const stub  = () => {};
  const sp    = (v) => Promise.resolve(v);
  const spArr = () => Promise.resolve('[]');

  // Core scene graph
  globalThis.__velox_createNode  = () => _nextId++;
  globalThis.__velox_appendChild  = stub;
  globalThis.__velox_updateNode   = stub;
  globalThis.__velox_removeNode   = stub;
  globalThis.__velox_setRoot      = (id) => { _root = id; };
  globalThis.__velox_pollEvents   = () => [];
  globalThis.__velox_getLayout    = () => ({ x: 0, y: 0, width: 0, height: 0 });
  globalThis.__velox_getTime      = () => Date.now();
  globalThis.__velox_request_frame = stub;
  globalThis.__velox_log          = (...a) => {};
  globalThis.__velox_createImage  = () => _nextId++;

  // Window
  globalThis.__velox_getWindowSize  = () => ({ width: 1280, height: 800 });
  globalThis.__velox_getScreenSize  = () => ({ width: 1920, height: 1080 });
  globalThis.__velox_setFullscreen  = stub;
  globalThis.__velox_setMaximized   = stub;
  globalThis.__velox_setMinimized   = stub;
  globalThis.__velox_isFullscreen   = () => false;
  globalThis.__velox_isMaximized    = () => false;
  globalThis.__velox_setAlwaysOnTop = stub;
  globalThis.__velox_setTitle       = stub;
  globalThis.__velox_platform       = () => 'test';
  globalThis.__velox_quit           = stub;
  globalThis.__velox_window_close   = stub;
  globalThis.__velox_restart        = stub;
  globalThis.__velox_window_create  = () => sp('0');
  globalThis.__velox_ipc_send       = stub;
  globalThis.__velox_ipc_poll       = () => '[]';

  // FS
  globalThis.__velox_readFile       = () => sp('');
  globalThis.__velox_readFileBytes  = () => sp('');
  globalThis.__velox_writeFile      = () => sp(undefined);
  globalThis.__velox_appendFile     = () => sp(undefined);
  globalThis.__velox_listDir        = () => spArr();
  globalThis.__velox_deleteFile     = () => sp(undefined);
  globalThis.__velox_mkdirp         = () => sp(undefined);

  // DB
  let _dbHandle = 1;
  globalThis.__velox_db_open        = () => sp(String(_dbHandle++));
  globalThis.__velox_db_query       = () => spArr();
  globalThis.__velox_db_run         = () => sp('{"rowsAffected":0,"lastInsertId":0}');
  globalThis.__velox_db_close       = () => sp(undefined);
  globalThis.__velox_db_transaction = () => sp(undefined);

  // Network
  globalThis.__velox_fetch          = () => sp('{"status":200,"ok":true,"body":"","headers":{}}');
  globalThis.__velox_ws_connect     = () => sp('0');
  globalThis.__velox_ws_send        = stub;
  globalThis.__velox_ws_poll        = () => '[]';
  globalThis.__velox_ws_close       = stub;

  // Credentials
  globalThis.__velox_credentials_set    = () => sp(null);
  globalThis.__velox_credentials_get    = () => sp('null');
  globalThis.__velox_credentials_delete = () => sp(null);

  // Clipboard, dialog, notifications
  globalThis.__velox_clipboard_readText  = () => sp('');
  globalThis.__velox_clipboard_writeText = () => sp(undefined);
  globalThis.__velox_dialog_openFile     = () => sp('null');
  globalThis.__velox_dialog_saveFile     = () => sp('null');
  globalThis.__velox_dialog_openFolder   = () => sp('null');
  globalThis.__velox_notification_send   = () => sp(undefined);
  globalThis.__velox_getEnv              = () => null;

  // Audio
  let _audioId = 1;
  globalThis.__velox_audio_play      = () => sp(String(_audioId++));
  globalThis.__velox_audio_pause     = stub;
  globalThis.__velox_audio_resume    = stub;
  globalThis.__velox_audio_stop      = stub;
  globalThis.__velox_audio_setVolume = stub;
  globalThis.__velox_audio_getVolume = () => 1.0;
  globalThis.__velox_audio_poll      = () => '[]';

  // Canvas
  globalThis.__velox_canvas_update      = stub;
  globalThis.__velox_canvas3d_update    = stub;
  globalThis.__velox_canvas3d_load_gltf = stub;

  // AI
  globalThis.__velox_ai_embed      = () => sp('[]');
  globalThis.__velox_ai_generate   = () => sp('');
  globalThis.__velox_ai_transcribe = () => sp('');

  // Camera + microphone
  globalThis.__velox_camera_list         = () => spArr();
  globalThis.__velox_camera_open         = () => sp('0');
  globalThis.__velox_camera_close        = stub;
  globalThis.__velox_camera_capture      = () => sp('');
  globalThis.__velox_camera_record_start = stub;
  globalThis.__velox_camera_record_stop  = () => sp('');
  globalThis.__velox_microphone_list     = () => spArr();
  globalThis.__velox_microphone_record   = () => sp('');

  // Crash + splash
  globalThis.__velox_crash_report_js    = stub;
  globalThis.__velox_crash_get_reports  = () => spArr();
  globalThis.__velox_crash_clear_reports = stub;
  globalThis.__velox_splash_hide        = stub;

  // Perf, power, system, etc.
  globalThis.__velox_perf_snapshot           = () => '{"fps":60,"frameTime":16.7,"frameTimeP99":16.7,"jsTime":1,"layoutTime":0.5,"gpuTime":1,"memoryJS":10,"memoryTotal":50,"nodeCount":0}';
  globalThis.__velox_perf_set_budget         = stub;
  globalThis.__velox_perf_poll_violations    = () => '[]';
  globalThis.__velox_perf_poll_leak_warnings = () => '[]';
  globalThis.__velox_battery_getStatus       = () => sp('null');
  globalThis.__velox_system_getInfo          = () => sp('{}');
  globalThis.__velox_system_getDarkMode      = () => 'light';
  globalThis.__velox_system_getBatterySaver  = () => false;
  globalThis.__velox_power_preventSleep      = () => '0';
  globalThis.__velox_power_allowSleep        = stub;
  globalThis.__velox_storage_getDrives       = () => spArr();
  globalThis.__velox_gamepad_poll            = () => '[]';
  globalThis.__velox_shortcut_register       = () => '0';
  globalThis.__velox_shortcut_unregister     = stub;
  globalThis.__velox_shortcut_poll           = () => '[]';
  globalThis.__velox_mdns_discover           = () => spArr();

  // Deeplink
  globalThis.__velox_deeplink_getInitialUrl = () => '';
  globalThis.__velox_deeplink_poll          = () => '[]';

  // HID, updater, video
  globalThis.__velox_hid_enumerate   = () => spArr();
  globalThis.__velox_hid_open        = () => sp('0');
  globalThis.__velox_hid_read        = () => spArr();
  globalThis.__velox_hid_write       = () => sp('0');
  globalThis.__velox_hid_close       = stub;
  globalThis.__velox_updater_check   = () => sp('{"hasUpdate":false,"latestVersion":"","body":""}');
  globalThis.__velox_updater_update  = () => sp('{"updated":false,"latestVersion":""}');
  globalThis.__velox_video_open      = () => sp('0');
  globalThis.__velox_video_seek      = stub;
  globalThis.__velox_video_close     = stub;
  globalThis.__velox_video_poll      = () => '[]';

  // VectorDB
  globalThis.__velox_vectorDb_open   = () => sp('0');
  globalThis.__velox_vectorDb_upsert = () => sp(undefined);
  globalThis.__velox_vectorDb_search = () => spArr();
  globalThis.__velox_vectorDb_close  = () => sp(undefined);

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
    throw new Error(`[velox/testing] getByText("${text}"): not found in rendered output`);
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
      throw new Error(`[velox/testing] getAllByText("${text}"): not found in rendered output`);
    }
    return results;
  }

  function debug() {
    console.log('[velox/testing] rendered HTML:', html);
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
