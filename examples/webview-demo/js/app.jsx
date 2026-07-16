import React, { useRef, useState } from 'react';
import { View, Text, Pressable, WebView, render } from '@glyx-dev/react';

// Self-contained page (no network dependency) that exercises BOTH halves of
// the postMessage bridge:
//   - page → JS: the button below calls window.ipc.postMessage(str), which
//     wry injects automatically — glyx-cap-webview queues it, glyx-core
//     drains it into WebviewEvents, __glyx_webview_poll delivers it to the
//     <WebView onMessage> callback.
//   - JS → page: window.addEventListener('message', ...) receives whatever
//     the React side sends via ref.current.postMessage(...).
const PAGE_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: system-ui, sans-serif; background: #eeeeee; margin: 0; padding: 24px; }
  button { font-size: 14px; padding: 8px 16px; cursor: pointer; }
  #log { margin-top: 16px; font-size: 13px; color: #333; white-space: pre-wrap; }
</style></head>
<body>
  <h2>WebView postMessage test page</h2>
  <button id="send">Send message to JS</button>
  <div id="log">(no messages from JS yet)</div>
  <script>
    let n = 0;
    document.getElementById('send').addEventListener('click', () => {
      n += 1;
      window.ipc.postMessage('hello from page #' + n);
    });
    window.addEventListener('message', (e) => {
      document.getElementById('log').textContent = 'from JS: ' + e.data;
    });
  </script>
</body>
</html>`;

function App() {
  const [lastFromPage, setLastFromPage] = useState(null);
  const [sentCount, setSentCount] = useState(0);
  const webviewRef = useRef(null);

  const sendToPage = () => {
    const next = sentCount + 1;
    setSentCount(next);
    webviewRef.current?.postMessage('hello from JS #' + next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f14' }}>
      <View
        style={{
          height: 64,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          backgroundColor: '#17171f',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e8e8f0' }}>
          WebView Demo
        </Text>
        <Pressable
          onPress={sendToPage}
          style={{
            marginLeft: 16,
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: '#2e3555',
            borderRadius: 6,
          }}
        >
          <Text style={{ fontSize: 13, color: '#e8e8f0' }}>Send message to page</Text>
        </Pressable>
        {lastFromPage && (
          <Text style={{ fontSize: 12, color: '#9aa0b6', marginLeft: 16 }}>
            from page: {lastFromPage}
          </Text>
        )}
      </View>

      <WebView
        ref={webviewRef}
        html={PAGE_HTML}
        style={{ flex: 1 }}
        onMessage={(msg) => setLastFromPage(msg)}
      />
    </View>
  );
}

render(<App />);
