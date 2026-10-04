import React, { useState, useEffect } from 'react';
import { View, Text, render, menubar, glyxWindow } from '@glyx-dev/react';

// A native menu bar. `menubar.set` describes it once; `onSelect` hears every
// choice, whether it came from the mouse, the keyboard (Alt+F) or an
// accelerator (Ctrl+N). Checkable items report their new state.

const MENU = [
  { label: '&File', children: [
    { id: 'file.new',  label: 'New',      accelerator: 'Ctrl+N' },
    { id: 'file.open', label: 'Open...',  accelerator: 'Ctrl+O' },
    { separator: true },
    { id: 'file.quit', label: 'Quit',     accelerator: 'Ctrl+Q' },
  ] },
  { label: '&Edit', children: [
    { id: 'edit.undo', label: 'Undo', accelerator: 'Ctrl+Z', enabled: false },
    { id: 'edit.redo', label: 'Redo', accelerator: 'Ctrl+Shift+Z', enabled: false },
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

const COLOR = { bg: '#0D0D14', panel: '#12131A', text: '#E6E8EF', muted: '#8A90A2', amber: '#F59E0B' };

function App() {
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);
  const [checks, setChecks] = useState({ 'view.grid': true, 'view.autosave': false });
  const [edits, setEdits] = useState(0);

  useEffect(() => {
    try {
      menubar.set(MENU);
    } catch (e) {
      setError(String(e.message || e));
      return undefined;
    }
    return menubar.onSelect(({ id, checked }) => {
      if (id === 'file.quit') { glyxWindow.quit(); return; }
      if (checked !== undefined) setChecks((c) => ({ ...c, [id]: checked }));
      if (id === 'file.new') {
        // Give Undo something to do once there is a change.
        setEdits((n) => n + 1);
        menubar.setEnabled('edit.undo', true);
      }
      if (id === 'edit.undo') {
        setEdits((n) => {
          const next = Math.max(0, n - 1);
          if (next === 0) menubar.setEnabled('edit.undo', false);
          return next;
        });
      }
      setLog((l) => [`${id}${checked === undefined ? '' : checked ? '  (checked)' : '  (unchecked)'}`, ...l].slice(0, 8));
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.bg, padding: 24 }}>
      <Text fontSize={22} style={{ color: COLOR.text, fontWeight: '600' }}>Menu bar demo</Text>
      <Text fontSize={13} style={{ color: COLOR.muted, marginTop: 4 }}>
        Use the menus above, Alt+F / Alt+E / Alt+V, or the accelerators (Ctrl+N, Ctrl+G, Ctrl+1).
      </Text>
      {error ? (
        <Text fontSize={14} style={{ color: '#f87171', marginTop: 20 }}>{error}</Text>
      ) : (
        <>
          <Text fontSize={13} style={{ color: COLOR.muted, marginTop: 18 }}>
            Grid {checks['view.grid'] ? 'on' : 'off'}  |  Autosave {checks['view.autosave'] ? 'on' : 'off'}  |  Changes {edits}
          </Text>
          <View style={{ marginTop: 14, backgroundColor: COLOR.panel, borderRadius: 10, padding: 14, flex: 1 }}>
            <Text fontSize={12} style={{ color: COLOR.amber, marginBottom: 8 }}>LAST CHOICES</Text>
            {log.length === 0
              ? <Text fontSize={13} style={{ color: COLOR.muted }}>Nothing chosen yet.</Text>
              : log.map((line, i) => (
                <Text key={i} fontSize={13} style={{ color: i === 0 ? COLOR.text : COLOR.muted, marginBottom: 4 }}>{line}</Text>
              ))}
          </View>
        </>
      )}
    </View>
  );
}

render(<App />);
