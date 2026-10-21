import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, TextInput, render, useWindowSize,
} from '@glyx-dev/react';
import { Board, moveItem } from '@glyx-dev/drag-drop';
import type { BoardColumn, BoardMove } from '@glyx-dev/drag-drop';

type Card = {
  id: number;
  title: string;
  tag: string;
  points: number;
  tone: string;
};

const TONES = ['#7c8cff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];

function makeCard(id: number, title: string): Card {
  return {
    id,
    title,
    tag: ['Design', 'Engine', 'Copy', 'Bug'][id % 4],
    points: [1, 2, 3, 5][id % 4],
    tone: TONES[id % TONES.length],
  };
}

const INITIAL: Card[] = [
  makeCard(1, 'Draw the empty states'),
  makeCard(2, 'Keyboard reorder for long lists'),
  makeCard(3, 'Card detail sheet'),
  makeCard(4, 'Move a card between columns'),
  makeCard(5, 'Add the board toolbar'),
];

const COLORS = ['#7c8cff', '#22c55e', '#f59e0b'];

export default function App() {
  const { width, height } = useWindowSize();
  const nextId = useRef(6);
  const [columns, setColumns] = useState<BoardColumn<Card>[]>(() => [
    { id: 'todo', title: 'To do', color: COLORS[0], items: INITIAL.slice(0, 3) },
    { id: 'doing', title: 'In progress', color: COLORS[1], items: INITIAL.slice(3, 4) },
    { id: 'done', title: 'Done', color: COLORS[2], items: INITIAL.slice(4) },
  ]);

  const columnWidth = useMemo(() => {
    const available = width - 48 - 24;
    return Math.max(260, Math.min(340, Math.floor(available / 3)));
  }, [width]);

  const move = (m: BoardMove<Card>) => {
    setColumns((cols) => {
      if (m.from.column === m.to.column) {
        return cols.map((c) => c.id === m.from.column ? { ...c, items: moveItem(c.items, m.from.index, m.to.index) } : c);
      }
      const target = cols.find((c) => c.id === m.to.column);
      if (!target) return cols;
      const insertAt = Math.max(0, Math.min(target.items.length, m.to.index));
      return cols.map((c) => {
        if (c.id === m.from.column) return { ...c, items: c.items.filter((_, i) => i !== m.from.index) };
        if (c.id === m.to.column) {
          const items = c.items.slice();
          items.splice(insertAt, 0, m.item);
          return { ...c, items };
        }
        return c;
      });
    });
  };

  const addCard = (columnId: string, title: string) => {
    const text = title.trim();
    if (!text) return;
    const card = makeCard(nextId.current++, text);
    setColumns((cols) => cols.map((c) => c.id === columnId ? { ...c, items: [...c.items, card] } : c));
  };

  const removeCard = (columnId: string, cardId: number) => {
    setColumns((cols) => cols.map((c) => c.id === columnId ? { ...c, items: c.items.filter((x) => x.id !== cardId) } : c));
  };

  const reset = () => {
    nextId.current = 6;
    setColumns([
      { id: 'todo', title: 'To do', color: COLORS[0], items: INITIAL.slice(0, 3) },
      { id: 'doing', title: 'In progress', color: COLORS[1], items: INITIAL.slice(3, 4) },
      { id: 'done', title: 'Done', color: COLORS[2], items: INITIAL.slice(4) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f16', padding: 24, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#f0f0f8' }}>Product board</Text>
          <Text style={{ fontSize: 13, color: '#8888a8' }}>
            Drag a card to reorder it or move it to another column. Escape cancels.
          </Text>
        </View>
        <Pressable
          onPress={reset}
          style={{
            paddingHorizontal: 14, height: 32, alignItems: 'center', justifyContent: 'center',
            borderRadius: 7, borderWidth: 1, borderColor: '#2f2f44', backgroundColor: '#1a1a26',
          }}
        >
          <Text style={{ fontSize: 12, color: '#b8b8cc' }}>Reset</Text>
        </Pressable>
      </View>

      <Board<Card>
        columns={columns}
        getKey={(card) => card.id}
        onMove={move}
        columnWidth={columnWidth}
        height={Math.max(420, height - 120)}
        gap={14}
        cardGap={8}
        columnStyle={{ borderRadius: 12, borderColor: '#242436', backgroundColor: '#151520' }}
        renderCard={(card, state) => (
          <CardView
            card={card}
            dragging={state.dragging}
            onRemove={() => removeCard(state.columnId, card.id)}
          />
        )}
        renderEmpty={() => (
          <View style={{ paddingVertical: 22, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#5e5e78' }}>Drop a card here</Text>
          </View>
        )}
        renderColumnFooter={(column) => (
          <AddCard onAdd={(title) => addCard(column.id, title)} />
        )}
      />
    </View>
  );
}

function CardView({ card, dragging, onRemove }: { card: Card; dragging: boolean; onRemove: () => void }) {
  const [hover, setHover] = React.useState(false);
  return (
    <View
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        backgroundColor: dragging ? '#222236' : hover ? '#1f1f30' : '#1b1b28',
        borderRadius: 9,
        borderWidth: 1,
        borderColor: hover ? '#3d3d5c' : '#2a2a3e',
        borderLeftWidth: 3,
        borderLeftColor: card.tone,
        padding: 11,
        gap: 8,
        opacity: dragging ? 0.35 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 13, color: '#e8e8f4', lineHeight: 18 }}>{card.title}</Text>
        <Pressable
          onPress={onRemove}
          style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
        >
          <Text style={{ fontSize: 13, color: '#6c6c88' }}>×</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: `${card.tone}22` }}>
          <Text style={{ fontSize: 10, color: card.tone }}>{card.tag}</Text>
        </View>
        <Text style={{ fontSize: 10, color: '#6c6c88' }}>{card.points} pts</Text>
      </View>
    </View>
  );
}

function AddCard({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState('');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={{ height: 32, paddingHorizontal: 8, justifyContent: 'center', borderRadius: 6 }}
      >
        <Text style={{ fontSize: 12, color: '#8c8caa' }}>+ Add a card</Text>
      </Pressable>
    );
  }

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title);
    setTitle('');
    setOpen(false);
  };

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={submit}
        placeholder="Card title"
        placeholderTextColor="#5e5e78"
        autoFocus
        style={{
          flex: 1, height: 32, fontSize: 12, color: '#e8e8f4',
          backgroundColor: '#1b1b28', borderWidth: 1, borderColor: '#303048', borderRadius: 6,
          paddingHorizontal: 8,
        }}
      />
      <Pressable
        onPress={submit}
        style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#3949ab' }}
      >
        <Text style={{ fontSize: 14, color: '#fff' }}>+</Text>
      </Pressable>
    </View>
  );
}

render(<App />);
