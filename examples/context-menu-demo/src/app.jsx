// Right-click a card: its context menu opens at the pointer. The first two cards use the menu Glyx draws (icons, shortcut labels, a check mark,
// a submenu); the last two use the operating system's own menu (`native`). Each choice reports itself below, so you can see the right one ran.
import React from 'react';
import { View, Text, render } from '@glyx-dev/react';
import { ContextMenu } from '@glyx-dev/context-menu';

const NOTES = [
  { name: 'Project ideas', native: false },
  { name: 'Team meeting', native: false },
  { name: 'Code review checklist', native: true },
  { name: 'Reading list', native: true },
];

function App() {
  const [last, setLast] = React.useState('(nothing yet: right-click a card)');
  const [pinned, setPinned] = React.useState({});
  return (
    <View style={{ flex: 1, backgroundColor: '#12121a', padding: 24, gap: 12 }}>
      <Text fontSize={20} style={{ color: '#e0e0f0' }}>Context menu</Text>
      {NOTES.map(({ name, native }) => (
        <ContextMenu
          key={name}
          native={native}
          items={[
            { label: 'Open', icon: '↗', accelerator: 'Ctrl+O', action: () => setLast(`Open "${name}"`) },
            { label: 'Rename', icon: '✎', accelerator: 'F2', action: () => setLast(`Rename "${name}"`) },
            { label: 'Pinned', checked: !!pinned[name], action: (on) => { setPinned((p) => ({ ...p, [name]: on })); setLast(`Pinned "${name}": ${on}`); } },
            { label: 'Share', icon: '⇪', children: [
              { label: 'Copy link', action: () => setLast(`Copy link of "${name}"`) },
              { label: 'Email…', action: () => setLast(`Email "${name}"`) },
              { label: 'More', children: [{ label: 'Export as PDF', action: () => setLast(`Export "${name}" as PDF`) }] },
            ] },
            { label: 'Archive (not available)', disabled: true },
            { separator: true },
            { label: 'Delete', icon: '🗑', accelerator: 'Del', action: () => setLast(`Delete "${name}"`), destructive: true },
          ]}
        >
          <View style={{ backgroundColor: '#1c1c26', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#2a2a3a' }}>
            <Text fontSize={15} style={{ color: '#c8c8e0' }}>{name}{native ? '   (native menu)' : '   (drawn menu)'}{pinned[name] ? '   📌' : ''}</Text>
          </View>
        </ContextMenu>
      ))}
      <Text fontSize={14} style={{ color: '#8a8aa0', marginTop: 8 }}>Last action: {last}</Text>
    </View>
  );
}

render(<App />);
