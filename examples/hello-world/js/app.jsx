import React from 'react';
import { View, Text, render } from '@velox/react';

function App() {
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
