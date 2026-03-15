// Week 18 — Data Layer demo (+ Week 17B router still present).
//
// Screens:
//   home        — greeting, TextInput, Image, → palette, → data demo
//   palette     — scrollable Catppuccin palette, tap a colour → detail
//   colorDetail — full-card colour detail, ← Back to palette
//   data        — Week 18: file system (write/read/list) + SQLite (run/query/transaction)
//
// The header bar (window controls + dimensions) lives outside the router.

import './polyfills.js';
import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, Pressable, TextInput, ScrollView, render,
  useWindowSize, useMediaQuery, veloxWindow, fs, db,
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

/** Small action button used in the Data screen. */
function SmallBtn({ label, onPress, width: w = 118 }) {
  return (
    <Pressable
      onPress={onPress}
      width={w}
      height={32}
      style={{ backgroundColor: '#313244', borderRadius: 6, borderWidth: 1, borderColor: '#44446a' }}
    >
      <Text fontSize={11} width={w - 20} height={18} style={{ color: '#cdd6f4' }}>
        {label}
      </Text>
    </Pressable>
  );
}

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

// ── Screen: Data (Week 18 — File System + SQLite) ─────────────────────────────

function DataScreen() {
  const { width: winW, height: winH } = useWindowSize();
  const navigate = useNavigate();

  // ── FS state ──────────────────────────────────────────────────────────────
  const [noteText,   setNoteText]   = useState('');
  const [loadedNote, setLoadedNote] = useState('');
  const [fileList,   setFileList]   = useState([]);

  // ── DB state ──────────────────────────────────────────────────────────────
  const [itemName, setItemName] = useState('');
  const [dbItems,  setDbItems]  = useState([]);
  const [dbReady,  setDbReady]  = useState(false);

  // ── Status ────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState('Initialising…');

  // Open DB and create table on mount.
  useEffect(() => {
    db.open('velox_demo.db')
      .then(async () => {
        await db.run(
          'CREATE TABLE IF NOT EXISTS items ' +
          '(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)'
        );
        const rows = await db.query('SELECT * FROM items ORDER BY id DESC');
        setDbItems(rows);
        setDbReady(true);
        setStatus('DB ready. Try writing a note or adding an item.');
      })
      .catch((e) => setStatus('DB error: ' + e.message));
  }, []);

  // ── FS handlers ───────────────────────────────────────────────────────────
  const saveNote = () =>
    fs.writeFile('velox-note.txt', noteText)
      .then(() => setStatus('Note saved to velox-note.txt'))
      .catch((e) => setStatus('Save error: ' + e.message));

  const loadNote = () =>
    fs.readFile('velox-note.txt')
      .then((t) => { setLoadedNote(t); setStatus('Note loaded.'); })
      .catch((e) => setStatus('Load error: ' + e.message));

  const listFiles = () =>
    fs.listDir('.')
      .then((entries) => {
        setFileList(entries.slice(0, 10));
        setStatus(`${entries.length} entries in working dir`);
      })
      .catch((e) => setStatus('List error: ' + e.message));

  // ── DB handlers ───────────────────────────────────────────────────────────
  const addItem = () => {
    if (!itemName.trim()) return;
    db.run('INSERT INTO items (name) VALUES (?)', [itemName.trim()])
      .then(() => db.query('SELECT * FROM items ORDER BY id DESC'))
      .then((rows) => { setDbItems(rows); setItemName(''); setStatus('Item added.'); })
      .catch((e) => setStatus('Insert error: ' + e.message));
  };

  const refreshItems = () =>
    db.query('SELECT * FROM items ORDER BY id DESC')
      .then((rows) => { setDbItems(rows); setStatus(`${rows.length} items loaded.`); })
      .catch((e) => setStatus('Query error: ' + e.message));

  const clearItems = () =>
    // Demo: use transaction() even for a single statement
    db.transaction([{ sql: 'DELETE FROM items', params: [] }])
      .then(() => { setDbItems([]); setStatus('All items deleted.'); })
      .catch((e) => setStatus('Clear error: ' + e.message));

  // ── Layout ────────────────────────────────────────────────────────────────
  const contentW = winW - 2 * PAD;
  const contentH = winH - HEADER_H - 2 * PAD;
  const inner    = contentW - 32;
  const svH      = contentH - 70;   // card height minus header row + status

  return (
    <View
      style={{
        backgroundColor: '#2a2a3e',
        borderRadius:    16,
        borderWidth:     1,
        borderColor:     '#44446a',
        padding:         16,
        gap:             8,
        justifyContent:  'flex-start',
        alignItems:      'flex-start',
      }}
      width={contentW}
      height={contentH}
    >
      {/* Header row */}
      <View
        style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
        width={inner}
        height={32}
      >
        <BackBtn />
        <Text fontSize={14} width={inner - 110} height={20} style={{ color: '#cdd6f4' }}>
          Week 18 — File System + SQLite
        </Text>
      </View>

      {/* Status bar */}
      <Text fontSize={11} width={inner} height={16} style={{ color: '#a6e3a1' }}>
        {status}
      </Text>

      {/* Scrollable content */}
      <ScrollView
        width={inner}
        height={svH}
        contentHeight={800}
        style={{ gap: 10, padding: 4 }}
      >
        {/* ── File System ─────────────────────────────────────────────── */}
        <Text fontSize={13} width={inner} height={20} style={{ color: '#89b4fa' }}>
          File System  (fs.write + fs.read)
        </Text>

        <TextInput
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Type a note to save…"
          fontSize={13}
          width={inner}
          height={40}
        />

        <View
          style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}
          width={inner}
          height={34}
        >
          <SmallBtn label="Save Note"  onPress={saveNote}  />
          <SmallBtn label="Load Note"  onPress={loadNote}  />
          <SmallBtn label="List Dir"   onPress={listFiles} />
        </View>

        {loadedNote ? (
          <Text fontSize={12} width={inner} style={{ color: '#a6adc8' }}>
            {'Loaded: ' + loadedNote}
          </Text>
        ) : null}

        {fileList.map((e, i) => (
          <Text key={i} fontSize={11} width={inner} height={15} style={{ color: '#6c7086' }}>
            {(e.isDir ? '▸ ' : '  ') + e.name}
          </Text>
        ))}

        {/* ── Divider ────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: '#44446a' }} width={inner} height={1} />

        {/* ── SQLite ──────────────────────────────────────────────────── */}
        <Text fontSize={13} width={inner} height={20} style={{ color: '#89b4fa' }}>
          {dbReady ? 'SQLite  (velox_demo.db)' : 'SQLite — opening…'}
        </Text>

        <TextInput
          value={itemName}
          onChangeText={setItemName}
          placeholder="Item name…"
          fontSize={13}
          width={inner}
          height={40}
        />

        <View
          style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}
          width={inner}
          height={34}
        >
          <SmallBtn label="Add Item"     onPress={addItem}      />
          <SmallBtn label="Refresh"      onPress={refreshItems} />
          <SmallBtn label="Clear All"    onPress={clearItems}   />
        </View>

        {dbItems.length === 0 ? (
          <Text fontSize={11} width={inner} height={16} style={{ color: '#45475a' }}>
            {dbReady ? 'No items yet — add one above.' : ''}
          </Text>
        ) : null}

        {dbItems.map((row, i) => (
          <Text key={i} fontSize={12} width={inner} height={18} style={{ color: '#cdd6f4' }}>
            {'#' + row.id + '   ' + row.name}
          </Text>
        ))}

        {/* ── Transaction note ─────────────────────────────────────────── */}
        <View style={{ backgroundColor: '#44446a' }} width={inner} height={1} />
        <Text fontSize={11} width={inner} style={{ color: '#45475a' }}>
          {'"Clear All" uses db.transaction([{sql, params}]) — atomic batch.\n' +
           '"Add Item" / "Refresh" use db.run() / db.query() without a handle\n' +
           '(default set automatically by the first db.open() call).'}
        </Text>
      </ScrollView>
    </View>
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

        {/* Navigate to data demo screen */}
        <Pressable
          onPress={() => navigate('data')}
          width={leftIn}
          height={40}
          style={{
            backgroundColor: '#1a2a3e',
            borderRadius:    8,
            borderWidth:     1,
            borderColor:     '#2a4a6e',
          }}
        >
          <Text fontSize={13} width={leftIn - 20} height={20} style={{ color: '#89b4fa' }}>
            File System + SQLite Demo →
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
          <Route name="data"        component={DataScreen}       />
        </Router>
      </View>

    </View>
  );
}

render(<App />);

__velox_log('Week 18: file system + SQLite data layer loaded.');
