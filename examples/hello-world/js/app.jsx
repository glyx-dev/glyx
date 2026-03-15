// Week 17B — Named-route router demo.
//
// Three screens wired through @velox/router:
//   home        — greeting, TextInput, Image, button to enter palette
//   palette     — scrollable Catppuccin palette, tap a colour → detail
//   colorDetail — full-card colour detail, ← Back to palette
//
// The header bar (window controls + dimensions) lives outside the router
// so it persists across screen transitions.

import './polyfills.js';
import React, { useState } from 'react';
import {
  View, Text, Image, Pressable, TextInput, ScrollView, render,
  useWindowSize, useMediaQuery, veloxWindow,
} from '@velox/react';
import { Router, Route, useNavigate, useRoute } from '@velox/router';

// ── Constants ─────────────────────────────────────────────────────────────────

const HEADER_H = 48;
const PAD      = 16;
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

// ── Shared sub-components ─────────────────────────────────────────────────────

function WinBtn({ label, onPress, active = false }) {
  return (
    <Pressable
      onPress={onPress}
      width={96}
      height={30}
      style={{ backgroundColor: active ? '#6c63ff' : '#313244', borderRadius: 6 }}
    >
      <Text fontSize={12} width={80} height={18} style={{ color: '#cdd6f4' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function BackBtn({ label = '← Back' }) {
  const navigate = useNavigate();
  return (
    <Pressable
      onPress={() => navigate('back')}
      width={90}
      height={30}
      style={{ backgroundColor: '#313244', borderRadius: 6 }}
    >
      <Text fontSize={12} width={74} height={18} style={{ color: '#cdd6f4' }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Screen: Home ─────────────────────────────────────────────────────────────

function HomeScreen() {
  const { width: winW, height: winH } = useWindowSize();
  const isWide   = useMediaQuery(900);
  const navigate = useNavigate();

  const [name, setName]       = useState('');
  const [greeted, setGreeted] = useState(false);

  const contentW = winW - 2 * PAD;
  const contentH = winH - HEADER_H - 2 * PAD;

  // Two-column when wide: left card 44%, right card fills rest.
  const GAP    = 20;
  const leftW  = isWide ? Math.floor(contentW * 0.44) : contentW;
  const rightW = isWide ? (contentW - leftW - GAP)    : contentW;
  const leftH  = isWide ? contentH : Math.floor(contentH * 0.55);
  const rightH = isWide ? contentH : Math.floor(contentH * 0.42);
  const leftIn = leftW  - 48;
  const rightIn = rightW - 32;

  return (
    <View
      style={{
        flexDirection:  isWide ? 'row' : 'column',
        gap:            isWide ? GAP   : 12,
        justifyContent: 'flex-start',
        alignItems:     'flex-start',
      }}
      width={contentW}
      height={contentH}
    >
      {/* ── Left: interaction card ── */}
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
        <Text fontSize={15} width={leftIn} height={24} style={{ color: '#cdd6f4' }}>
          Week 17B — Named-Route Router
        </Text>

        <Text fontSize={12} width={leftIn} style={{ color: '#a6adc8' }}>
          {isWide
            ? 'Three screens: Home → Palette → Colour Detail. Navigate with the button below.'
            : 'Narrow layout. Widen past 900 px for two columns.'}
        </Text>

        <View style={{ backgroundColor: '#44446a' }} width={leftIn} height={1} />

        <TextInput
          value={name}
          onChangeText={(t) => { setName(t); setGreeted(false); }}
          placeholder="Type your name..."
          fontSize={15}
          width={leftIn}
          height={44}
        />

        {greeted ? (
          <Text fontSize={16} width={leftIn} style={{ color: '#a6e3a1' }}>
            {name.trim() ? `Hello, ${name}!` : 'Hello, stranger!'}
          </Text>
        ) : (
          <Text fontSize={12} width={leftIn} style={{ color: '#585b70' }}>
            Hover the button, then press it.
          </Text>
        )}

        <Pressable
          onPress={() => setGreeted(true)}
          width={140}
          height={40}
          style={{ backgroundColor: '#6c63ff', borderRadius: 8 }}
        >
          <Text fontSize={14} width={120} height={22} style={{ color: '#ffffff' }}>
            Say Hello
          </Text>
        </Pressable>

        <View style={{ backgroundColor: '#44446a' }} width={leftIn} height={1} />

        {/* Navigate to palette screen */}
        <Pressable
          onPress={() => navigate('palette')}
          width={leftIn}
          height={40}
          style={{
            backgroundColor: '#313244',
            borderRadius:    8,
            borderWidth:     1,
            borderColor:     '#44446a',
          }}
        >
          <Text fontSize={13} width={leftIn - 20} height={20} style={{ color: '#cdd6f4' }}>
            View Colour Palette →
          </Text>
        </Pressable>

        <Image
          src="C:/myweb/Apps/velox_project/sample.png"
          width={leftIn}
          height={Math.min(160, Math.floor(leftIn * 0.5))}
          resizeMode="cover"
          style={{ borderRadius: 8 }}
        />
      </View>

      {/* ── Right: router info card (wide only) ── */}
      {isWide && (
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
          width={rightW}
          height={rightH}
        >
          <Text fontSize={14} width={rightIn} height={20} style={{ color: '#cdd6f4' }}>
            @velox/router
          </Text>

          <Text fontSize={12} width={rightIn} style={{ color: '#a6adc8' }}>
            {'Named-route history stack — no URL bar needed.\nPure React state, zero Rust changes.'}
          </Text>

          <View style={{ backgroundColor: '#44446a' }} width={rightIn} height={1} />

          <Text fontSize={12} width={rightIn} style={{ color: '#6c7086' }}>
            navigate("palette")
          </Text>
          <Text fontSize={12} width={rightIn} style={{ color: '#6c7086' }}>
            navigate("colorDetail", {"{ bg, fg, name }"}){'\n'}
          </Text>
          <Text fontSize={12} width={rightIn} style={{ color: '#6c7086' }}>
            navigate("back")
          </Text>

          <View style={{ backgroundColor: '#44446a' }} width={rightIn} height={1} />

          <Text fontSize={11} width={rightIn} style={{ color: '#45475a' }}>
            {'Router holds history as React state.\nEach navigate() call triggers a\nnormal React re-render — no magic.'}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Screen: Palette ───────────────────────────────────────────────────────────

function PaletteScreen() {
  const { width: winW, height: winH } = useWindowSize();
  const navigate = useNavigate();

  const contentW = winW - 2 * PAD;
  const contentH = winH - HEADER_H - 2 * PAD;
  const inner    = contentW - 32;
  const svH      = Math.max(120, contentH - 90);

  return (
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
      width={contentW}
      height={contentH}
    >
      {/* Header row */}
      <View
        style={{
          flexDirection:  'row',
          gap:            12,
          alignItems:     'flex-start',
          justifyContent: 'flex-start',
        }}
        width={inner}
        height={30}
      >
        <BackBtn />
        <Text fontSize={14} width={inner - 110} height={20} style={{ color: '#cdd6f4' }}>
          Catppuccin Palette
        </Text>
      </View>

      {/* Scrollable palette — tap a colour to navigate to its detail */}
      <ScrollView
        width={inner}
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
            onPress={() => navigate('colorDetail', { name: item.name, bg: item.bg, fg: item.fg })}
            width={inner - 16}
            height={ITEM_H}
            style={{ backgroundColor: item.bg, borderRadius: 6 }}
          >
            <Text fontSize={13} width={inner - 48} height={20} style={{ color: item.fg }}>
              {item.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text fontSize={11} width={inner} style={{ color: '#45475a' }}>
        Tap a colour to navigate to its detail screen (params demo).
      </Text>
    </View>
  );
}

// ── Screen: Colour Detail ─────────────────────────────────────────────────────

function ColorDetailScreen() {
  const { width: winW, height: winH } = useWindowSize();
  const { params } = useRoute();
  const navigate   = useNavigate();

  const contentW = winW - 2 * PAD;
  const contentH = winH - HEADER_H - 2 * PAD;
  const inner    = contentW - 64;

  const bg   = params.bg   ?? '#313244';
  const fg   = params.fg   ?? '#cdd6f4';
  const name = params.name ?? 'Unknown';

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius:    16,
        borderWidth:     2,
        borderColor:     fg + '33',
        padding:         32,
        gap:             20,
        justifyContent:  'flex-start',
        alignItems:      'flex-start',
      }}
      width={contentW}
      height={contentH}
    >
      <Text fontSize={32} width={inner} height={44} style={{ color: fg }}>
        {name}
      </Text>

      <View style={{ backgroundColor: fg + '22' }} width={inner} height={1} />

      <Text fontSize={15} width={inner} height={24} style={{ color: fg }}>
        {`Background  ${bg}`}
      </Text>
      <Text fontSize={15} width={inner} height={24} style={{ color: fg }}>
        {`Foreground   ${fg}`}
      </Text>

      <Text fontSize={12} width={inner} style={{ color: fg + 'aa' }}>
        {'Params were passed via navigate().\nuseRoute().params gives them back here.'}
      </Text>

      <View style={{ backgroundColor: fg + '22' }} width={inner} height={1} />

      {/* Back to palette */}
      <Pressable
        onPress={() => navigate('back')}
        width={130}
        height={40}
        style={{
          backgroundColor: '#00000033',
          borderRadius:    8,
          borderWidth:     1,
          borderColor:     fg + '55',
        }}
      >
        <Text fontSize={13} width={110} height={20} style={{ color: fg }}>
          ← Back to Palette
        </Text>
      </Pressable>

      {/* Jump home — demonstrates navigate(name, {}, { replace: false }) across 2 levels */}
      <Pressable
        onPress={() => navigate('home')}
        width={130}
        height={40}
        style={{
          backgroundColor: '#00000033',
          borderRadius:    8,
          borderWidth:     1,
          borderColor:     fg + '33',
        }}
      >
        <Text fontSize={13} width={110} height={20} style={{ color: fg + 'aa' }}>
          ⌂ Go Home
        </Text>
      </Pressable>
    </View>
  );
}

// ── App shell ─────────────────────────────────────────────────────────────────
//
// Header bar (window controls) lives outside the router — persists across
// screen transitions. Router manages only the content area below it.

function App() {
  const { width: winW, height: winH } = useWindowSize();
  const [fullscreen, setFullscreen]   = useState(false);
  const [maximized,  setMaximized]    = useState(false);

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

  return (
    <View style={{ backgroundColor: '#1e1e2e' }} width={winW} height={winH}>

      {/* ── Persistent header bar ── */}
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

      {/* ── Router content area ── */}
      <View
        style={{ padding: PAD, justifyContent: 'flex-start', alignItems: 'flex-start' }}
        width={winW}
        height={winH - HEADER_H}
      >
        <Router initialRoute="home">
          <Route name="home"        component={HomeScreen}       />
          <Route name="palette"     component={PaletteScreen}    />
          <Route name="colorDetail" component={ColorDetailScreen} />
        </Router>
      </View>

    </View>
  );
}

render(<App />);

__velox_log('Week 17B: named-route router loaded.');
