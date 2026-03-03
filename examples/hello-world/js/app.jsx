// Week 14 milestone — incremental layout + ScrollView.
//
// What this demo shows:
//   - Incremental layout: hover/scroll state changes skip Taffy entirely —
//     only visual props changed, so layout is not recomputed each frame.
//   - ScrollView: Catppuccin palette list clips children with a Vello layer
//     and shifts them by scrollOffsetY on each mouse-wheel tick.
//   - All Week 13 features still present: text cache, hover borders, TextInput.

import './polyfills.js';
import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, render } from '@velox/react';

// Layout constants — used both for rendering and for the scroll cap.
const ITEM_H   = 44;   // height of each palette swatch
const ITEM_GAP = 8;    // gap between swatches (ScrollView style.gap)
const SV_PAD   = 8;    // ScrollView padding (all sides)
const SV_H     = 290;  // visible height of the ScrollView

// Catppuccin Mocha palette — enough items to require scrolling.
const PALETTE = [
  { name: 'Rosewater', bg: '#dc8a78', fg: '#1e1e2e' },
  { name: 'Flamingo',  bg: '#dd7878', fg: '#1e1e2e' },
  { name: 'Pink',      bg: '#ea76cb', fg: '#1e1e2e' },
  { name: 'Mauve',     bg: '#8839ef', fg: '#ffffff' },
  { name: 'Red',       bg: '#d20f39', fg: '#ffffff' },
  { name: 'Maroon',    bg: '#e64553', fg: '#ffffff' },
  { name: 'Peach',     bg: '#fe640b', fg: '#1e1e2e' },
  { name: 'Yellow',    bg: '#df8e1d', fg: '#1e1e2e' },
  { name: 'Green',     bg: '#40a02b', fg: '#ffffff' },
  { name: 'Teal',      bg: '#179299', fg: '#ffffff' },
  { name: 'Sky',       bg: '#04a5e5', fg: '#1e1e2e' },
  { name: 'Sapphire',  bg: '#209fb5', fg: '#1e1e2e' },
  { name: 'Blue',      bg: '#1e66f5', fg: '#ffffff' },
  { name: 'Lavender',  bg: '#7287fd', fg: '#ffffff' },
];

function App() {
  const [name, setName]       = useState('');
  const [greeted, setGreeted] = useState(false);

  const greet = () => setGreeted(true);
  const handleNameChange = (text) => { setName(text); setGreeted(false); };

  return (
    <View
      style={{ backgroundColor: '#1e1e2e' }}
      width={1280}
      height={800}
    >
      {/* Two-column layout — backgroundColor prevents the default BRAND_GREEN fallback */}
      <View
        style={{ flexDirection: 'row', gap: 32, backgroundColor: '#1e1e2e' }}
        width={896}
        height={400}
      >

        {/* ── Left: interaction card (hover + border + TextInput) ─────── */}
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
          height={360}
        >
          <Text
            fontSize={18}
            width={336}
            height={28}
            style={{ color: '#cdd6f4' }}
          >
            Week 14 — ScrollView + Incremental Layout
          </Text>

          <TextInput
            value={name}
            onChangeText={handleNameChange}
            placeholder="Type your name..."
            fontSize={16}
            width={336}
            height={44}
          />

          {greeted ? (
            <Text
              fontSize={18}
              width={336}
              height={26}
              style={{ color: '#a6e3a1' }}
            >
              {name.trim() ? `Hello, ${name}!` : 'Hello, stranger!'}
            </Text>
          ) : (
            <Text
              fontSize={14}
              width={336}
              height={20}
              style={{ color: '#585b70' }}
            >
              Hover the button, then press it.
            </Text>
          )}

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

        {/* ── Right: scrollable palette list ──────────────────────────── */}
        <View
          style={{
            backgroundColor: '#2a2a3e',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#44446a',
            padding: 16,
            gap: 12,
          }}
          width={464}
          height={360}
        >
          <Text
            fontSize={15}
            width={432}
            height={22}
            style={{ color: '#cdd6f4' }}
          >
            Catppuccin palette — scroll with mouse wheel
          </Text>

          {/* ScrollView: contentHeight is explicit so the scroll cap is exact.
               Formula: n * ITEM_H + (n-1) * ITEM_GAP + 2 * SV_PAD */}
          <ScrollView
            width={432}
            height={SV_H}
            contentHeight={PALETTE.length * ITEM_H + (PALETTE.length - 1) * ITEM_GAP + 2 * SV_PAD}
            style={{ gap: ITEM_GAP, padding: SV_PAD, backgroundColor: '#1a1a2e', borderRadius: 8 }}
          >
            {PALETTE.map((item, i) => (
              <View
                key={i}
                style={{ backgroundColor: item.bg, borderRadius: 6 }}
                width={416}
                height={ITEM_H}
              >
                <Text
                  fontSize={14}
                  width={380}
                  height={22}
                  style={{ color: item.fg }}
                >
                  {item.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

      </View>
    </View>
  );
}

render(<App />);

__velox_log('Week 14: ScrollView + incremental layout ready.');
