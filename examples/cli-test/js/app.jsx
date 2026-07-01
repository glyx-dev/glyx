import './polyfills.js';
import React, { useState } from 'react';
import { View, Text, Pressable, render, useWindowSize } from '@glyx/react';

function App() {
  const { width, height } = useWindowSize();
  const [count, setCount] = useState(0);

  return (
    <View
      width={width}
      height={height}
      style={{ backgroundColor: '#1e1e2e', justifyContent: 'center', alignItems: 'center', gap: 16 }}
    >
      <Text fontSize={32} style={{ color: '#cdd6f4' }}>
        cli-test ✓
      </Text>
      <Text fontSize={18} style={{ color: '#a6adc8' }}>
        AppConfig::from_config() is working
      </Text>
      <Text fontSize={16} style={{ color: '#6c7086' }}>
        count: {count}
      </Text>
      <Pressable
        onPress={() => setCount(c => c + 1)}
        style={{ backgroundColor: '#89b4fa', padding: 12, borderRadius: 8 }}
      >
        <Text fontSize={16} style={{ color: '#1e1e2e' }}>increment</Text>
      </Pressable>
    </View>
  );
}

render(<App />);
