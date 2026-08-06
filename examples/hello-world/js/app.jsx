import React, { useEffect } from 'react';
import { View, Text, render, glyxWindow } from '@glyx-dev/react';

function App() {
  // Simulates "the app did some initial work, now it's ready" — the
  // recommended way to dismiss the splash (glyxWindow.hideSplash()), rather
  // than relying on the safety-net timeout. `minimumMs` in glyx.config.json
  // still guarantees the splash shows for at least that long even though
  // this fires almost immediately.
  useEffect(() => {
    glyxWindow.hideSplash();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f0f14',
      }}
    >
      <Text style={{ fontSize: 32, fontWeight: '700', color: '#e8e8f0' }}>
        Hello, World!
      </Text>
    </View>
  );
}

render(<App />);
