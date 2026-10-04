import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, MenuBar, render, menubar, glyxWindow } from '@glyx-dev/react';

// A menu bar, two ways. `menubar.set` shows the native bar (Windows, macOS);
// `<MenuBar>` draws the same menu itself, for Linux and frameless windows.
// Both take the same description and report choices the same way. The Edit
// items use `role`, so Copy, Paste and Select All act on the text field below.

const MENU = [
  { label: '&File', children: [
    { id: 'file.new',  label: 'New',      accelerator: 'Ctrl+N' },
    { id: 'file.open', label: 'Open...',  accelerator: 'Ctrl+O' },
    { separator: true },
    { id: 'file.quit', label: 'Quit',     accelerator: 'Ctrl+Q' },
  ] },
  { label: '&Edit', children: [
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { separator: true },
    { role: 'selectAll' },
  ] },
  { label: '&View', children: [
    { id: 'view.grid',     label: 'Show grid', checked: true, accelerator: 'Ctrl+G' },
    { id: 'view.autosave', label: 'Autosave',  checked: false },
    { label: 'Zoom', children: [
      { id: 'zoom.in',    label: 'Zoom in',    accelerator: 'Ctrl+1' },
      { id: 'zoom.out',   label: 'Zoom out',   accelerator: 'Ctrl+2' },
      { id: 'zoom.reset', label: 'Actual size' },
    ] },
  ] },
];

const COLOR = { bg: '#0D0D14', panel: '#12131A', text: '#E6E8EF', muted: '#8A90A2', amber: '#F59E0B', field: '#1B1C26' };

function App() {
  const nativeOk = menubar.supported;
  const [inApp, setInApp] = useState(!nativeOk);
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);
  const [checks, setChecks] = useState({ 'view.grid': true, 'view.autosave': false });
  const [note, setNote] = useState('');

  const onSelect = ({ id, checked, role }) => {
    if (id === 'file.quit') { glyxWindow.quit(); return; }
    if (checked !== undefined) setChecks((c) => ({ ...c, [id]: checked }));
    const suffix = role ? '  (edit: ' + role + ')' : checked === undefined ? '' : checked ? '  (checked)' : '  (unchecked)';
    setLog((l) => [id + suffix, ...l].slice(0, 6));
  };

  // The native bar is set here; the in-app one is rendered below.
  useEffect(() => {
    if (inApp) { try { menubar.clear(); } catch (e) { /* none set */ } return undefined; }
    try {
      menubar.set(MENU);
      setError(null);
    } catch (e) {
      setError(String(e.message || e));
      return undefined;
    }
    return menubar.onSelect(onSelect);
  }, [inApp]);

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.bg }}>
      {inApp ? <MenuBar items={MENU} onSelect={onSelect} /> : null}
      <View style={{ flex: 1, padding: 24 }}>
        <Text fontSize={22} style={{ color: COLOR.text, fontWeight: '600' }}>Menu bar demo</Text>
        <Text fontSize={13} style={{ color: COLOR.muted, marginTop: 4 }}>
          {inApp ? 'Drawn by Glyx (MenuBar).' : 'Native menu bar.'} Try Alt+F, Ctrl+N, Ctrl+G, and Edit with the field below selected.
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <Pressable
            ariaLabel="Switch menu bar"
            onPress={() => setInApp((v) => !v)}
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, backgroundColor: COLOR.field }}
          >
            <Text fontSize={13} style={{ color: COLOR.text }}>{inApp ? 'Use the native bar' : 'Use the in-app bar'}</Text>
          </Pressable>
        </View>
        {error ? (
          <Text fontSize={14} style={{ color: '#f87171', marginTop: 16 }}>{error}</Text>
        ) : null}
        <Text fontSize={13} style={{ color: COLOR.muted, marginTop: 16 }}>
          Grid {checks['view.grid'] ? 'on' : 'off'}  |  Autosave {checks['view.autosave'] ? 'on' : 'off'}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Type here, then use the Edit menu"
          style={{ marginTop: 14, width: 420 }}
        />
        <View style={{ marginTop: 14, backgroundColor: COLOR.panel, borderRadius: 10, padding: 14, flex: 1 }}>
          <Text fontSize={12} style={{ color: COLOR.amber, marginBottom: 8 }}>LAST CHOICES</Text>
          {log.length === 0
            ? <Text fontSize={13} style={{ color: COLOR.muted }}>Nothing chosen yet.</Text>
            : log.map((line, i) => (
              <Text key={i} fontSize={13} style={{ color: i === 0 ? COLOR.text : COLOR.muted, marginBottom: 4 }}>{line}</Text>
            ))}
        </View>
      </View>
    </View>
  );
}

render(<App />);
