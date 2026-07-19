import React from 'react';
import { _webviewCallbacks, webview } from './api.js';

// ── WebView component ───────────────────────────────────────────────────────
//
// Embeds a native OS webview (WebView2 / WKWebView / WebKitGTK via `wry`) as
// a real child window, position-tracked to this node's layout rect. Requires
// `webview: true` in glyx.config.json (or the "webview" capability builds
// automatically when unspecified — see glyx-cli's read_capabilities_from_config).
//
// Frames/content never cross the JS bridge — only postMessage strings do.
//
// Usage:
//   <WebView src="https://example.com" style={{ width: 800, height: 600 }} />
//   <WebView html="<h1>hi</h1>" sandbox onMessage={(msg) => console.log(msg)} />
//   <WebView src="glyx-asset://index.html" assetsRoot="C:/app/assets" />
//
// Two-way messaging:
//   const ref = useRef();
//   <WebView ref={ref} src="..." onMessage={(msg) => ...} />
//   ref.current.postMessage('hello');   // JS → page (page reads via
//                                       //   window.addEventListener('message', e => e.data))
//   // page → JS: window.ipc.postMessage(str) inside the page → onMessage(str) here

export const WebView = React.forwardRef(function WebView(
  { src, html, sandbox = true, allowedOrigins, assetsRoot, onMessage, style, ...rest },
  ref
) {
  // Native id isn't known until after mount (_glyxOnMount pattern used by
  // Canvas/Camera/Video); postMessage needs it, so capture it via a ref.
  const nodeIdRef = React.useRef(null);

  // `_glyxOnMount` fires synchronously during the initial commit (see
  // hostConfig.js createInstance), so nodeIdRef.current is already set by
  // the time this effect runs on mount — it never changes again afterward.
  React.useEffect(() => {
    const id = nodeIdRef.current;
    if (id == null) return;
    _webviewCallbacks.set(id, { onMessage });
    return () => { _webviewCallbacks.delete(id); };
  }, [onMessage]);

  React.useImperativeHandle(ref, () => ({
    get nodeId() { return nodeIdRef.current; },
    postMessage(message) {
      if (nodeIdRef.current != null) webview.postMessage(nodeIdRef.current, message);
    },
  }), []);

  const opts = {};
  if (sandbox === false) opts.sandbox = false;
  if (allowedOrigins) opts.allowedOrigins = allowedOrigins;
  if (assetsRoot) opts.assetsRoot = assetsRoot;

  return React.createElement('webview', {
    webviewSrc: html ? undefined : src,
    webviewHtml: html,
    webviewOpts: Object.keys(opts).length ? JSON.stringify(opts) : undefined,
    style,
    _glyxOnMount: (id) => { nodeIdRef.current = id; },
    ...rest,
  });
});
