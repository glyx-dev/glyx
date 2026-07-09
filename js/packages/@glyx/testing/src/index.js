// @glyx/testing — Unit testing utilities for Glyx apps.
//
// Works with Bun's built-in test runner (`bun test`).
//
// Usage:
//   // In your test file:
//   import { render, screen, act, fireEvent } from '@glyx/testing';
//
//   test('Counter increments', async () => {
//     const { getByText } = await render(<Counter />);
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
//   • React is rendered using react-reconciler with a lightweight in-memory host,
//     so components receive real state/effects and event handlers are accessible.
//   • No actual GPU / wgpu / winit is required.

// ── Mock registry ─────────────────────────────────────────────────────────────

const _mocks = new Map();
const _mockOriginals = new Map();

/**
 * Register a custom mock for a `__glyx_*` binding.
 * The original value is saved and can be restored via `unmockBinding` or `restoreAllBindings`.
 *
 * @param {string}   name  The binding name (e.g. `"__glyx_fetch"`)
 * @param {function} impl  Mock implementation
 */
export function mockBinding(name, impl) {
  if (!_mockOriginals.has(name)) _mockOriginals.set(name, globalThis[name]);
  _mocks.set(name, impl);
  globalThis[name] = impl;
}

/**
 * Restore a single binding to its value before the most recent `mockBinding` call.
 * @param {string} name
 */
export function unmockBinding(name) {
  if (_mockOriginals.has(name)) {
    globalThis[name] = _mockOriginals.get(name);
    _mockOriginals.delete(name);
  }
  _mocks.delete(name);
}

/**
 * Restore all bindings that were overridden via `mockBinding`.
 * Call this in `afterEach` / `afterAll` to prevent test pollution.
 */
export function restoreAllBindings() {
  for (const [name, orig] of _mockOriginals) globalThis[name] = orig;
  _mockOriginals.clear();
  _mocks.clear();
}

// ── In-memory node tree ───────────────────────────────────────────────────────

let _nextId = 1;
// id → { id, type, props, children: id[] }
const _nodeTree = new Map();

function _resetTree() {
  _nodeTree.clear();
  _nextId = 1;
}

function _mkNode(type, props) {
  const id = _nextId++;
  _nodeTree.set(id, { id, type, props: Object.assign({}, props), children: [] });
  return id;
}

// Walk the tree depth-first, calling visitor(node). Return early on truthy result.
function _walk(rootId, visitor) {
  if (rootId == null) return undefined;
  const node = _nodeTree.get(rootId);
  if (!node) return undefined;
  const found = visitor(node);
  if (found !== undefined) return found;
  for (const childId of node.children) {
    const r = _walk(childId, visitor);
    if (r !== undefined) return r;
  }
  return undefined;
}

function _findAllNodes(rootId, predicate) {
  const results = [];
  _walk(rootId, (node) => { if (predicate(node)) results.push(node); });
  return results;
}

function _textContent(node) {
  if (!node) return '';
  const p = node.props;
  if (p && typeof p.children === 'string') return p.children;
  if (p && typeof p.children === 'number') return String(p.children);
  if (p && Array.isArray(p.children)) return p.children.map((c) => (typeof c === 'string' || typeof c === 'number') ? String(c) : '').join('');
  return '';
}

function _nodeContainsText(node, text) {
  const direct = _textContent(node);
  if (direct.includes(text)) return true;
  // Also accumulate all descendant text
  let acc = '';
  _walk(node.id, (n) => { acc += _textContent(n); });
  return acc.includes(text);
}

// ── Install default stubs ─────────────────────────────────────────────────────
//
// Call installStubs() in your test setup or import '@glyx/testing/setup'.
// Stubs are no-ops / sensible defaults so tests don't throw on missing bindings.

export function installStubs() {
  const stub  = () => {};
  const sp    = (v) => Promise.resolve(v);
  const spArr = () => Promise.resolve('[]');

  // Core scene graph — stubs capture props into _nodeTree
  globalThis.__glyx_createNode   = (type) => _mkNode(type ?? 'View', {});
  globalThis.__glyx_appendChild  = (parentId, childId) => {
    const p = _nodeTree.get(parentId);
    if (p && !p.children.includes(childId)) p.children.push(childId);
  };
  globalThis.__glyx_insertBefore = (parentId, childId, beforeId) => {
    const p = _nodeTree.get(parentId);
    if (!p) return;
    p.children = p.children.filter((c) => c !== childId);
    const idx = p.children.indexOf(beforeId);
    if (idx >= 0) p.children.splice(idx, 0, childId);
    else p.children.push(childId);
  };
  globalThis.__glyx_updateNode   = (id, props) => {
    const n = _nodeTree.get(id);
    if (n) n.props = Object.assign({}, n.props, props);
  };
  globalThis.__glyx_removeNode   = (id) => { _nodeTree.delete(id); };
  globalThis.__glyx_setRoot      = (id) => { globalThis.__glyx_rootId = id; };
  globalThis.__glyx_pollEvents   = () => [];
  globalThis.__glyx_getLayout    = () => ({ x: 0, y: 0, width: 0, height: 0 });
  globalThis.__glyx_getTime      = () => Date.now();
  globalThis.__glyx_request_frame = stub;
  globalThis.__glyx_log          = () => {};
  globalThis.__glyx_createImage  = () => _nextId++;
  globalThis.__glyx_measure_text = (text, fontSize = 14) =>
    ({ width: String(text ?? '').length * fontSize * 0.6, height: fontSize * 1.2 });
  globalThis.__glyx_text_char_at_x = (text, _fontSize, _maxWidth, x) => {
    // Approximate: assume monospace 0.6em per char for testing purposes.
    const charW = (_fontSize ?? 14) * 0.6;
    return Math.min(Math.max(0, Math.round(x / charW)), String(text ?? '').length);
  };

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
  globalThis.__glyx_stat           = () => sp('{"size":0,"mtime":0,"isDir":false,"isFile":true}');
  globalThis.__glyx_rename         = () => sp(undefined);
  globalThis.__glyx_copyFile       = () => sp(undefined);

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
  globalThis.__glyx_credentials_get    = () => sp(null);
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
  globalThis.__glyx_canvas3d_load_gltf   = stub;
  globalThis.__glyx_canvas3d_unload_gltf = stub;

  // AI
  globalThis.__glyx_ai_embed             = () => sp('[]');
  globalThis.__glyx_ai_generate          = () => sp('');
  globalThis.__glyx_ai_transcribe        = () => sp('');
  globalThis.__glyx_ai_unload_embed      = stub;
  globalThis.__glyx_ai_unload_generate   = stub;
  globalThis.__glyx_ai_unload_transcribe = stub;

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
      log: () => {}, info: () => {}, warn: () => {}, error: () => {}, debug: () => {},
    };
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

let _React = null;
let _Reconciler = null;
let _glyxReconciler = null;

// Lazy-initialize the in-memory react-reconciler instance.
async function _getReconciler() {
  if (_glyxReconciler) return _glyxReconciler;

  if (!_React) _React = (await import('react')).default;

  try {
    _Reconciler = (await import('react-reconciler')).default;
  } catch {
    return null;
  }

  const HostConfig = {
    supportsMutation: true,
    supportsPersistence: false,
    supportsHydration: false,
    isPrimaryRenderer: false,
    noTimeout: -1,
    scheduleTimeout: setTimeout,
    cancelTimeout: clearTimeout,
    queueMicrotask: typeof queueMicrotask !== 'undefined' ? queueMicrotask : (cb) => Promise.resolve().then(cb),

    createInstance(type, props) {
      const id = _mkNode(type, props);
      return id;
    },
    createTextInstance(text) {
      const id = _mkNode('#text', { children: text });
      return id;
    },
    appendInitialChild(parentId, childId) {
      const p = _nodeTree.get(parentId);
      if (p) p.children.push(childId);
    },
    appendChild(parentId, childId) {
      const p = _nodeTree.get(parentId);
      if (p && !p.children.includes(childId)) p.children.push(childId);
    },
    appendChildToContainer(container, childId) { container.rootId = childId; },
    insertBefore(parentId, childId, beforeId) {
      const p = _nodeTree.get(parentId);
      if (!p) return;
      const idx = p.children.indexOf(beforeId);
      if (idx >= 0) p.children.splice(idx, 0, childId);
      else p.children.push(childId);
    },
    insertInContainerBefore(container, childId) { container.rootId = childId; },
    removeChild(parentId, childId) {
      const p = _nodeTree.get(parentId);
      if (p) p.children = p.children.filter((c) => c !== childId);
    },
    removeChildFromContainer(container) { container.rootId = null; },
    clearContainer(container) { container.rootId = null; },

    finalizeInitialChildren: () => false,
    prepareUpdate: (_inst, _type, _old, newProps) => newProps,
    commitUpdate(id, newProps) {
      const n = _nodeTree.get(id);
      if (n) n.props = Object.assign({}, newProps);
    },
    commitTextUpdate(id, _old, text) {
      const n = _nodeTree.get(id); if (n) n.props.children = text;
    },
    resetTextContent: () => {},
    shouldSetTextContent: () => false,
    getRootHostContext: () => null,
    getChildHostContext: (_ctx, _type) => null,
    getPublicInstance: (id) => id,
    prepareForCommit: () => null,
    resetAfterCommit: () => {},
    commitMount: () => {},
    detachDeletedInstance: (id) => { _nodeTree.delete(id); },
    getCurrentEventPriority: () => 0,
    getInstanceFromNode: () => null,
    beforeActiveInstanceBlur: () => {},
    afterActiveInstanceBlur: () => {},
    prepareScopeUpdate: () => {},
    getInstanceFromScope: () => null,
  };

  _glyxReconciler = _Reconciler(HostConfig);
  return _glyxReconciler;
}

// Build query helpers for a given tree root.
function _buildQueries(rootId) {
  function getByText(text) {
    const matches = _findAllNodes(rootId, (n) => _nodeContainsText(n, text));
    if (matches.length === 0) throw new Error(`[glyx/testing] getByText("${text}"): not found`);
    // Return the innermost match (deepest node whose text matches).
    return matches[matches.length - 1].props;
  }
  function queryByText(text) {
    const matches = _findAllNodes(rootId, (n) => _nodeContainsText(n, text));
    return matches.length > 0 ? matches[matches.length - 1].props : null;
  }
  function getAllByText(text) {
    const matches = _findAllNodes(rootId, (n) => _nodeContainsText(n, text));
    if (matches.length === 0) throw new Error(`[glyx/testing] getAllByText("${text}"): not found`);
    return matches.map((n) => n.props);
  }
  function getByTestId(testId) {
    const matches = _findAllNodes(rootId, (n) => n.props.testID === testId);
    if (matches.length === 0) throw new Error(`[glyx/testing] getByTestId("${testId}"): not found`);
    return matches[0].props;
  }
  function queryByTestId(testId) {
    const matches = _findAllNodes(rootId, (n) => n.props.testID === testId);
    return matches.length > 0 ? matches[0].props : null;
  }
  function getAllByTestId(testId) {
    const matches = _findAllNodes(rootId, (n) => n.props.testID === testId);
    if (matches.length === 0) throw new Error(`[glyx/testing] getAllByTestId("${testId}"): not found`);
    return matches.map((n) => n.props);
  }
  function debug() {
    function _dump(id, depth) {
      const n = _nodeTree.get(id);
      if (!n) return;
      const pad = '  '.repeat(depth);
      const text = _textContent(n);
      const tid = n.props.testID ? ` testID="${n.props.testID}"` : '';
      console.log(`${pad}<${n.type}${tid}${text ? ` text="${text}"` : ''}>`);
      for (const c of n.children) _dump(c, depth + 1);
    }
    _dump(rootId, 0);
  }
  return { getByText, queryByText, getAllByText, getByTestId, queryByTestId, getAllByTestId, debug };
}

/**
 * Render a React element and return query utilities.
 * Uses react-reconciler with a lightweight in-memory host so event handlers are accessible.
 *
 * @param {React.ReactElement} element
 * @returns {Promise<{ container, getByText, queryByText, getAllByText, debug, unmount }>}
 */
export async function render(element) {
  _resetTree();
  globalThis.__glyx_rootId = null;

  const reconciler = await _getReconciler();

  if (reconciler) {
    const container = { rootId: null };
    const root = reconciler.createContainer(
      container, /* tag=Concurrent */ 1, null, false, null, '', {}, null,
    );
    await new Promise((resolve) => {
      reconciler.updateContainer(element, root, null, resolve);
    });
    // Flush sync work
    reconciler.flushSync(() => {});

    const rootId = container.rootId;
    const queries = _buildQueries(rootId);

    const result = {
      container,
      ...queries,
      unmount() { reconciler.updateContainer(null, root, null, () => {}); _resetTree(); },
    };
    _lastRender = result;
    return result;
  }

  // Fallback: SSR via react-dom/server (no event handlers).
  if (!_React) _React = (await import('react')).default;
  let _ReactDOMServer = null;
  try { _ReactDOMServer = (await import('react-dom/server')).default; } catch {}

  let html = _ReactDOMServer ? _ReactDOMServer.renderToStaticMarkup(element) : '';

  function getByText(text) {
    if (html.includes(text)) return { textContent: text };
    throw new Error(`[glyx/testing] getByText("${text}"): not found in rendered output`);
  }
  function queryByText(text) { return html.includes(text) ? { textContent: text } : null; }
  function getAllByText(text) {
    if (!html.includes(text)) throw new Error(`[glyx/testing] getAllByText("${text}"): not found`);
    return [{ textContent: text }];
  }
  function getByTestId(testId) { throw new Error(`[glyx/testing] getByTestId: not available in SSR fallback`); }
  function queryByTestId(_testId) { return null; }
  function getAllByTestId(testId) { throw new Error(`[glyx/testing] getAllByTestId: not available in SSR fallback`); }
  function debug() { console.log('[glyx/testing] rendered HTML:', html); }

  const result = { container: html, getByText, queryByText, getAllByText, getByTestId, queryByTestId, getAllByTestId, debug, unmount: () => {} };
  _lastRender = result;
  return result;
}

// ── screen ────────────────────────────────────────────────────────────────────

// Always reflects the most recently rendered tree (set by render()).
let _lastRender = null;

/**
 * Query helpers for the most recently rendered element.
 * Mirrors @testing-library/react's `screen` object.
 */
export const screen = {
  getByText:   (text) => {
    if (!_lastRender) throw new Error('[glyx/testing] screen: no component has been rendered yet');
    return _lastRender.getByText(text);
  },
  queryByText: (text) => _lastRender?.queryByText(text) ?? null,
  getAllByText: (text) => {
    if (!_lastRender) throw new Error('[glyx/testing] screen: no component has been rendered yet');
    return _lastRender.getAllByText(text);
  },
  getByTestId: (testId) => {
    if (!_lastRender) throw new Error('[glyx/testing] screen: no component has been rendered yet');
    return _lastRender.getByTestId(testId);
  },
  queryByTestId: (testId) => _lastRender?.queryByTestId(testId) ?? null,
  getAllByTestId: (testId) => {
    if (!_lastRender) throw new Error('[glyx/testing] screen: no component has been rendered yet');
    return _lastRender.getAllByTestId(testId);
  },
  debug: () => _lastRender?.debug(),
};

// ── act ───────────────────────────────────────────────────────────────────────

/**
 * Wrap state updates and async operations so React can flush them before assertions.
 *
 * @param {function(): Promise<void>|void} callback
 */
export async function act(callback) {
  await callback();
  // Give React a microtask tick to flush pending state updates.
  await new Promise((r) => setTimeout(r, 0));
}

// ── fireEvent ─────────────────────────────────────────────────────────────────

/**
 * Simulate user interactions. Each method accepts the props object returned by
 * `getByText()` / `screen.getByText()`. Because `render()` uses an in-memory
 * reconciler, the returned props include real event handler functions.
 */
export const fireEvent = {
  /**
   * Simulate a press (tap / click).
   * @param {object} node  Props object from getByText()
   */
  press(node) {
    if (node && typeof node.onPress === 'function') node.onPress();
  },

  /**
   * Simulate a text change.
   * @param {object} node
   * @param {string} text  New text value
   */
  changeText(node, text) {
    if (node && typeof node.onChangeText === 'function') node.onChangeText(text);
    if (node && typeof node.onChange === 'function') node.onChange({ target: { value: text } });
  },

  /**
   * Simulate a submit (Enter key in TextInput).
   * @param {object} node
   */
  submitEditing(node) {
    if (node && typeof node.onSubmitEditing === 'function') node.onSubmitEditing();
  },

  /**
   * Simulate a scroll.
   * @param {object} node
   * @param {{ x?: number, y?: number }} offset
   */
  scroll(node, offset = {}) {
    if (node && typeof node.onScroll === 'function') node.onScroll({ nativeEvent: { contentOffset: offset } });
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

// ── getNodeTree ───────────────────────────────────────────────────────────────

/**
 * Return a plain-object snapshot of the current in-memory node tree.
 * Each entry: `{ id, type, props, children: id[] }`.
 * Useful for snapshot tests or inspecting tree structure.
 *
 * @returns {Map<number, {id:number, type:string, props:object, children:number[]}>}
 */
export function getNodeTree() {
  return new Map(_nodeTree);
}
