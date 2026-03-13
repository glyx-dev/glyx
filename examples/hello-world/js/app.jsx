// Week 15A milestone — multi-line text + ScrollView nested Pressable hit-test.
//
// What this demo shows:
//   1. Multi-line text: paragraphs with no explicit `height` prop — Taffy
//      calls the measure function, Parley shapes and wraps the text, and the
//      container expands to fit the measured height automatically.
//   2. ScrollView nested Pressable: each palette row is now a <Pressable>,
//      verifying that hit-testing works correctly at any scroll position
//      (scroll-adjusted Y values are now written into the layout cache).
//   3. All Week 14 features: incremental layout, text cache, TextInput, scroll cap.

import './polyfills.js';
import React, { useState } from 'react';
import { View, Text, Image, Pressable, TextInput, ScrollView, render } from '@velox/react';

// Layout constants for the scrollable list.
const ITEM_H   = 44;
const ITEM_GAP = 8;
const SV_PAD   = 8;
const SV_H     = 260;

// Catppuccin Mocha palette — each row is now a Pressable.
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
  const [name, setName]         = useState('');
  const [greeted, setGreeted]   = useState(false);
  const [selected, setSelected] = useState(null);

  const greet = () => setGreeted(true);
  const handleNameChange = (text) => { setName(text); setGreeted(false); };

  return (
    <View
      style={{ backgroundColor: '#1e1e2e' }}
      width={1280}
      height={800}
    >
      {/* Two-column layout */}
      <View
        style={{ flexDirection: 'row', gap: 32, backgroundColor: '#1e1e2e' }}
        width={960}
        height={700}
      >

        {/* ── Left: interaction card ───────────────────────────────────── */}
        <View
          style={{
            backgroundColor: '#2a2a3e',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#44446a',
            padding: 24,
            gap: 16,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
          }}
          width={420}
          height={660}
        >
          {/* Static title — explicit height (single line) */}
          <Text
            fontSize={18}
            width={372}
            height={28}
            style={{ color: '#cdd6f4' }}
          >
            Week 15A — Multi-line Text + Nested Pressable
          </Text>

          {/* ── Multi-line paragraph — NO explicit height prop ────────────
               Taffy calls the measure function; Parley shapes and wraps the
               text at max_width = 372 px; the node grows to fit.         */}
          <Text
            fontSize={13}
            width={372}
            style={{ color: '#a6adc8' }}
          >
            This paragraph has no height prop. The layout engine calls Parley
            to measure its wrapped height automatically. The surrounding
            container adapts without any fixed height on this Text node.
          </Text>

          {/* Divider */}
          <View
            style={{ backgroundColor: '#44446a' }}
            width={372}
            height={1}
          />

          <TextInput
            value={name}
            onChangeText={handleNameChange}
            placeholder="Type your name..."
            fontSize={16}
            width={372}
            height={44}
          />

          {greeted ? (
            <Text
              fontSize={17}
              width={372}
              style={{ color: '#a6e3a1' }}
            >
              {name.trim() ? `Hello, ${name}!` : 'Hello, stranger!'}
            </Text>
          ) : (
            <Text
              fontSize={13}
              width={372}
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
            <Text fontSize={15} width={140} height={24} style={{ color: '#ffffff' }}>
              Say Hello
            </Text>
          </Pressable>

          {/* Dynamic multi-line label — updates as user types, no fixed height */}
          {name.length > 0 && (
            <Text
              fontSize={12}
              width={372}
              style={{ color: '#6c7086' }}
            >
              {`You typed ${name.length} character${name.length === 1 ? '' : 's'}. This label also has no fixed height and wraps freely.`}
            </Text>
          )}

          <Text
            fontSize={13}
            width={372}
            height={20}
            style={{ color: '#a6adc8' }}
          >
            Week 15B image demo:
          </Text>

          <Image
            src="C:/myweb/Apps/velox_project/sample.png"
            width={372}
            height={209}
            resizeMode="cover"
            style={{ borderRadius: 8 }}
          />

          <View
            style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-start', alignItems: 'flex-start' }}
            width={372}
            height={84}
          >
            <Image
              src="C:/myweb/Apps/velox_project/sample.png"
              width={118}
              height={84}
              resizeMode="contain"
              style={{ borderRadius: 6, borderWidth: 1, borderColor: '#45475a' }}
            />
            <Image
              src="C:/myweb/Apps/velox_project/sample.png"
              width={118}
              height={84}
              resizeMode="cover"
              style={{ borderRadius: 6, borderWidth: 1, borderColor: '#45475a' }}
            />
            <Image
              src="C:/myweb/Apps/velox_project/sample.png"
              width={118}
              height={84}
              resizeMode="stretch"
              style={{ borderRadius: 6, borderWidth: 1, borderColor: '#45475a' }}
            />
          </View>
        </View>

        {/* ── Right: scrollable Pressable list ─────────────────────────── */}
        <View
          style={{
            backgroundColor: '#2a2a3e',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#44446a',
            padding: 16,
            gap: 12,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
          }}
          width={476}
          height={660}
        >
          <Text
            fontSize={15}
            width={444}
            height={22}
            style={{ color: '#cdd6f4' }}
          >
            Catppuccin palette — scroll and click any colour
          </Text>

          {selected !== null && (
            <Text
              fontSize={13}
              width={444}
              height={20}
              style={{ color: '#a6e3a1' }}
            >
              {`Selected: ${PALETTE[selected].name} — nested hit-test works while scrolled`}
            </Text>
          )}

          {/* Each palette row is a Pressable — verifies nested hit-testing */}
          <ScrollView
            width={444}
            height={SV_H}
            contentHeight={PALETTE.length * ITEM_H + (PALETTE.length - 1) * ITEM_GAP + 2 * SV_PAD}
            style={{ gap: ITEM_GAP, padding: SV_PAD, backgroundColor: '#1a1a2e', borderRadius: 8 }}
          >
            {PALETTE.map((item, i) => (
              <Pressable
                key={i}
                onPress={() => setSelected(i)}
                width={428}
                height={ITEM_H}
                style={{ backgroundColor: item.bg, borderRadius: 6 }}
              >
                <Text
                  fontSize={14}
                  width={392}
                  height={22}
                  style={{ color: item.fg }}
                >
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Auto-sized hint text */}
          <Text
            fontSize={12}
            width={444}
            style={{ color: '#45475a' }}
          >
            Scroll the list, then click a colour while scrolled. The selection
            label above should update — confirming scroll-adjusted hit-testing.
          </Text>
        </View>

      </View>
    </View>
  );
}

render(<App />);

__velox_log('Week 15B: image support loaded.');
