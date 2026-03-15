// Week 16 — Responsive layout + window controls demo.
//
// Features shown:
//   1. useWindowSize()  — root view fills the actual window; adapts on resize.
//   2. useMediaQuery()  — single-column below 900 px, two-column above.
//   3. veloxWindow API  — fullscreen / maximize / minimize buttons.
//   4. All prior demos: multi-line text, ScrollView, TextInput, Image.

import './polyfills.js';
import React, { useState } from 'react';
import {
  View, Text, Image, Pressable, TextInput, ScrollView, render,
  useWindowSize, useMediaQuery, veloxWindow,
} from '@velox/react';

// ── Palette data ──────────────────────────────────────────────────────────────

const ITEM_H   = 44;
const ITEM_GAP = 8;
const SV_PAD   = 8;

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

// ── Small reusable components ─────────────────────────────────────────────────

function WinBtn({ label, onPress, active = false }) {
  return (
    <Pressable
      onPress={onPress}
      width={96}
      height={30}
      style={{
        backgroundColor: active ? '#6c63ff' : '#313244',
        borderRadius: 6,
      }}
    >
      <Text fontSize={12} width={80} height={18} style={{ color: '#cdd6f4' }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Main app ─────────────────────────────────────────────────────────────────

function App() {
  // ── Responsive state ─────────────────────────────────────────────────────
  const { width: winW, height: winH } = useWindowSize();
  const isWide = useMediaQuery(900);   // two-column layout above 900 px

  // ── UI state ─────────────────────────────────────────────────────────────
  const [name, setName]           = useState('');
  const [greeted, setGreeted]     = useState(false);
  const [selected, setSelected]   = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [maximized, setMaximized]   = useState(false);

  const greet = () => setGreeted(true);
  const handleNameChange = (text) => { setName(text); setGreeted(false); };

  const toggleFullscreen = () => {
    const next = !fullscreen;
    veloxWindow.setFullscreen(next);
    setFullscreen(next);
  };
  const toggleMaximize = () => {
    const next = !maximized;
    veloxWindow.setMaximized(next);
    setMaximized(next);
  };
  const minimize = () => veloxWindow.setMinimized();

  // ── Layout math ──────────────────────────────────────────────────────────
  const HEADER_H  = 48;
  const PAD       = 16;
  const GAP       = 20;
  const contentW  = winW  - 2 * PAD;
  const contentH  = winH  - HEADER_H - 2 * PAD;

  // Two-column split: 44% left, rest right, minus gap between them.
  const leftW  = isWide ? Math.floor(contentW * 0.44) : contentW;
  const rightW = isWide ? (contentW - leftW - GAP)    : contentW;

  // Inner widths (subtract card padding = 24 each side).
  const leftInner  = leftW  - 48;
  const rightInner = rightW - 32;

  // ScrollView height adapts to remaining card space.
  const svH = Math.max(120, contentH - 220);

  // Content height for single-column stacking.
  const leftH  = isWide ? contentH : Math.floor(contentH * 0.55);
  const rightH = isWide ? contentH : Math.floor(contentH * 0.42);

  return (
    <View style={{ backgroundColor: '#1e1e2e' }} width={winW} height={winH}>

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection:   'row',
          backgroundColor: '#181825',
          borderWidth:     1,
          borderColor:     '#313244',
          alignItems:      'flex-start',
          justifyContent:  'flex-start',
          gap:             8,
          padding:         8,
        }}
        width={winW}
        height={HEADER_H}
      >
        <Text fontSize={13} width={220} height={28} style={{ color: '#cdd6f4' }}>
          {`Velox  ${winW} × ${winH} px`}
        </Text>

        <WinBtn
          label={fullscreen ? 'Exit Fullscr' : 'Fullscreen'}
          onPress={toggleFullscreen}
          active={fullscreen}
        />
        <WinBtn
          label={maximized ? 'Restore' : 'Maximize'}
          onPress={toggleMaximize}
          active={maximized}
        />
        <WinBtn label="Minimize" onPress={minimize} />
      </View>

      {/* ── Content area ────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection:  isWide ? 'row' : 'column',
          gap:            isWide ? GAP   : 12,
          padding:        PAD,
          justifyContent: 'flex-start',
          alignItems:     'flex-start',
        }}
        width={winW}
        height={winH - HEADER_H}
      >

        {/* ── Left card: interaction ──────────────────────────────────── */}
        <View
          style={{
            backgroundColor: '#2a2a3e',
            borderRadius:    16,
            borderWidth:     1,
            borderColor:     '#44446a',
            padding:         24,
            gap:             14,
            justifyContent:  'flex-start',
            alignItems:      'flex-start',
          }}
          width={leftW}
          height={leftH}
        >
          <Text fontSize={15} width={leftInner} height={24} style={{ color: '#cdd6f4' }}>
            {isWide ? 'Week 16 — Responsive + Window Controls' : 'Week 16 — Responsive (narrow)'}
          </Text>

          <Text fontSize={12} width={leftInner} style={{ color: '#a6adc8' }}>
            {isWide
              ? 'Wide layout active. Try resizing below 900 px to switch to single-column.'
              : 'Narrow layout active. Widen the window past 900 px to see two columns.'}
          </Text>

          <View style={{ backgroundColor: '#44446a' }} width={leftInner} height={1} />

          <TextInput
            value={name}
            onChangeText={handleNameChange}
            placeholder="Type your name..."
            fontSize={15}
            width={leftInner}
            height={44}
          />

          {greeted ? (
            <Text fontSize={16} width={leftInner} style={{ color: '#a6e3a1' }}>
              {name.trim() ? `Hello, ${name}!` : 'Hello, stranger!'}
            </Text>
          ) : (
            <Text fontSize={12} width={leftInner} style={{ color: '#585b70' }}>
              Hover the button, then press it.
            </Text>
          )}

          <Pressable
            onPress={greet}
            width={140}
            height={40}
            style={{ backgroundColor: '#6c63ff', borderRadius: 8 }}
          >
            <Text fontSize={14} width={120} height={22} style={{ color: '#ffffff' }}>
              Say Hello
            </Text>
          </Pressable>

          {name.length > 0 && (
            <Text fontSize={12} width={leftInner} style={{ color: '#6c7086' }}>
              {`${name.length} char${name.length === 1 ? '' : 's'} typed — no fixed height, wraps freely.`}
            </Text>
          )}

          <Text fontSize={12} width={leftInner} height={18} style={{ color: '#a6adc8' }}>
            Image demos (cover / contain / stretch):
          </Text>

          <Image
            src="C:/myweb/Apps/velox_project/sample.png"
            width={leftInner}
            height={Math.min(180, Math.floor(leftInner * 0.5))}
            resizeMode="cover"
            style={{ borderRadius: 8 }}
          />
        </View>

        {/* ── Right card: scrollable palette ──────────────────────────── */}
        <View
          style={{
            backgroundColor: '#2a2a3e',
            borderRadius:    16,
            borderWidth:     1,
            borderColor:     '#44446a',
            padding:         16,
            gap:             10,
            justifyContent:  'flex-start',
            alignItems:      'flex-start',
          }}
          width={rightW}
          height={rightH}
        >
          <Text fontSize={14} width={rightInner} height={20} style={{ color: '#cdd6f4' }}>
            Catppuccin palette — scroll and click a colour
          </Text>

          {selected !== null && (
            <Text fontSize={12} width={rightInner} height={18} style={{ color: '#a6e3a1' }}>
              {`Selected: ${PALETTE[selected].name}`}
            </Text>
          )}

          <ScrollView
            width={rightInner}
            height={svH}
            contentHeight={
              PALETTE.length * ITEM_H + (PALETTE.length - 1) * ITEM_GAP + 2 * SV_PAD
            }
            style={{
              gap:             ITEM_GAP,
              padding:         SV_PAD,
              backgroundColor: '#1a1a2e',
              borderRadius:    8,
            }}
          >
            {PALETTE.map((item, i) => (
              <Pressable
                key={i}
                onPress={() => setSelected(i)}
                width={rightInner - 16}
                height={ITEM_H}
                style={{ backgroundColor: item.bg, borderRadius: 6 }}
              >
                <Text
                  fontSize={13}
                  width={rightInner - 48}
                  height={20}
                  style={{ color: item.fg }}
                >
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text fontSize={11} width={rightInner} style={{ color: '#45475a' }}>
            Scroll then click to verify hit-test works while scrolled.
          </Text>
        </View>

      </View>
    </View>
  );
}

render(<App />);

__velox_log('Week 16: responsive layout + window controls loaded.');
