// @glyx/command — command palette (Cmd/Ctrl+K) with fuzzy search.
//
//   import { CommandPalette, useCommands } from '@glyx/command';
//   useCommands([{ id:'new', label:'New Note', section:'Notes', action: newNote }]);
//   <CommandPalette />   // render once near the app root

import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, useWindowSize, input } from '@glyx/react';

const { useState, useEffect, useMemo } = React;

// Global registry shared across all useCommands() callers.
const registry = [];

export function useCommands(commands) {
  useEffect(() => {
    registry.push(...commands);
    return () => {
      for (const c of commands) {
        const i = registry.findIndex((r) => r.id === c.id);
        if (i !== -1) registry.splice(i, 1);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// Subsequence fuzzy match → score in [0,1] (0 = no match).
function fuzzy(query, cmd) {
  const text = [cmd.label, cmd.section, ...(cmd.keywords || [])].join(' ').toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 1;
  if (text.includes(q)) return 1;
  let score = 0, qi = 0;
  for (let i = 0; i < text.length && qi < q.length; i++) {
    if (text[i] === q[qi]) { score++; qi++; }
  }
  return qi === q.length ? score / text.length : 0;
}

export function CommandPalette({ accelerator = 'ctrl+k', placeholder = 'Type a command…', maxResults = 8 }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { width, height } = useWindowSize();

  useEffect(() => {
    const openId  = input.shortcut.register(accelerator, () => { setQuery(''); setOpen((o) => !o); });
    const escId   = input.shortcut.register('escape', () => setOpen(false));
    return () => { input.shortcut.unregister(openId); input.shortcut.unregister(escId); };
  }, [accelerator]);

  const results = useMemo(() => {
    if (!open) return [];
    return registry
      .map((cmd) => ({ cmd, score: fuzzy(query, cmd) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((r) => r.cmd);
  }, [open, query, maxResults]);

  if (!open) return null;
  const panelW = Math.min(560, width - 80);

  return React.createElement(
    View,
    {
      style: {
        position: 'absolute', left: 0, top: 0, width, height,
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9500,
        alignItems: 'center', paddingTop: Math.round(height * 0.18),
      },
    },
    React.createElement(
      View,
      {
        style: {
          width: panelW, backgroundColor: '#14141A', borderRadius: 12,
          borderWidth: 1, borderColor: '#00A878', overflow: 'hidden',
        },
      },
      React.createElement(View, { style: { padding: 10, borderBottomWidth: 1, borderColor: '#2A2A3A' } },
        React.createElement(TextInput, {
          value: query, onChangeText: setQuery, placeholder, fontSize: 16,
          width: panelW - 20, height: 34, autoFocus: true,
        })),
      React.createElement(
        ScrollView,
        { width: panelW, height: Math.min(results.length * 40 + 8, 320), contentHeight: results.length * 40 + 8 },
        ...results.map((cmd) => React.createElement(Pressable, {
          key: cmd.id,
          onPress: () => { setOpen(false); cmd.action?.(); },
          style: { paddingVertical: 9, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
        },
          cmd.section && React.createElement(Text, { fontSize: 10, style: { color: '#555', width: 70 } },
            String(cmd.section).toUpperCase()),
          React.createElement(Text, { fontSize: 14, style: { color: '#E0E0F0' } }, cmd.label),
        )),
        results.length === 0 && React.createElement(View, { style: { padding: 16 } },
          React.createElement(Text, { fontSize: 13, style: { color: '#666' } }, `No commands match “${query}”`)),
      ),
    ),
  );
}
