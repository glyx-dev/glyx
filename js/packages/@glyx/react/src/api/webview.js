// @glyx-dev/react — native OS-embedded webview postMessage bridge.

// ── WebView (native OS-embedded webview) ────────────────────────────────────
//
// Declarative — `<WebView>` (see webview.js) sets `webviewSrc`/`webviewHtml`/
// `webviewOpts` node props; glyx-core creates/positions/destroys the native
// child webview automatically based on layout. This module is just the
// postMessage bridge: page→JS (poll) and JS→page (post).

// nodeId → { onMessage }
export const _webviewCallbacks = new Map();
export function _pollWebview() {
  if (typeof __glyx_webview_poll === 'undefined') return;
  const events = JSON.parse(__glyx_webview_poll());
  for (const ev of events) {
    const cbs = _webviewCallbacks.get(ev.id);
    if (cbs && cbs.onMessage) cbs.onMessage(ev.message);
  }
}

export const webview = {
  /** Post a message INTO the page at `nodeId` (delivered as a `message` event on `window`). */
  postMessage(nodeId, message) {
    if (typeof __glyx_webview_post_message === 'undefined') return;
    __glyx_webview_post_message(nodeId, typeof message === 'string' ? message : JSON.stringify(message));
  },
};
