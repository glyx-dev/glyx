// Week 12 milestone — style system + event system + Pressable + TextInput.
//
// What this demo shows:
//   - backgroundColor / borderRadius / padding / gap on View nodes
//   - Pressable button with press feedback (visual state change)
//   - TextInput with focus detection and live typing
//   - Text colour via the color style prop

import './polyfills.js';
import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, render } from '@velox/react';

function App() {
  const [name, setName]       = useState('');
  const [greeted, setGreeted] = useState(false);

  const greet = () => setGreeted(true);
  const handleNameChange = (text) => { setName(text); setGreeted(false); };

  return (
    <View
      style={{ backgroundColor: '#1e1e2e', borderRadius: 0 }}
      width={1280}
      height={800}
    >
      {/* Card */}
      <View
        style={{
          backgroundColor: '#2a2a3e',
          borderRadius: 16,
          padding: 32,
          gap: 20,
        }}
        width={400}
        height={280}
      >
        {/* Title */}
        <Text
          fontSize={22}
          width={340}
          height={30}
          style={{ color: '#cdd6f4' }}
        >
          Week 12 — Velox Input Demo
        </Text>

        {/* Text input */}
        <TextInput
          value={name}
          onChangeText={handleNameChange}
          placeholder="Type your name..."
          fontSize={16}
          width={340}
          height={44}
        />

        {/* Greeting message */}
        {greeted ? (
          <Text
            fontSize={18}
            width={340}
            height={26}
            style={{ color: '#a6e3a1' }}
          >
            {name.trim() ? `Hello, ${name}!` : 'Hello, stranger!'}
          </Text>
        ) : (
          <Text
            fontSize={14}
            width={340}
            height={20}
            style={{ color: '#585b70' }}
          >
            Press the button to greet yourself.
          </Text>
        )}

        {/* Pressable button */}
        <Pressable onPress={greet} width={160} height={44}>
          <View
            style={{ backgroundColor: '#6c63ff', borderRadius: 8 }}
            width={160}
            height={44}
          >
            <Text fontSize={16} width={140} height={24} style={{ color: '#ffffff' }}>
              Say Hello
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

render(<App />);

__velox_log('Week 12: style system + events + Pressable + TextInput ready.');
