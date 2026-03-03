// Week 13 milestone — text cache + hover states + border support.
//
// What this demo shows:
//   - Text shaping cache: Parley shapes each unique string once, reused every frame
//   - Hover states: Pressable shows a border when the cursor enters/leaves
//   - Border support: borderWidth + borderColor on any View node
//   - TextInput border brightens on focus

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
      {/* Card — now has a visible border */}
      <View
        style={{
          backgroundColor: '#2a2a3e',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#44446a',
          padding: 32,
          gap: 20,
        }}
        width={400}
        height={300}
      >
        {/* Title */}
        <Text
          fontSize={22}
          width={340}
          height={30}
          style={{ color: '#cdd6f4' }}
        >
          Week 13 — Hover + Border Demo
        </Text>

        {/* Text input — border brightens on focus */}
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
            Hover the button, then press it.
          </Text>
        )}

        {/* Pressable button — style lives directly on Pressable so
            hover/press borders are visible on the same node as the fill */}
        <Pressable
          onPress={greet}
          width={160}
          height={44}
          style={{ backgroundColor: '#6c63ff', borderRadius: 8 }}
        >
          <Text fontSize={16} width={140} height={24} style={{ color: '#ffffff' }}>
            Say Hello
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

render(<App />);

__velox_log('Week 13: text cache + hover states + border support ready.');
