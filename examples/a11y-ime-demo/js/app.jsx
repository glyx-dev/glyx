import React, { useState } from 'react';
import {
  View, Text, TextInput, Checkbox, Switch, RadioGroup, Radio, Select,
  Slider, DatePicker, render,
} from '@glyx-dev/react';

// Manual test surface for:
//  1. IME composition — focus the TextInput and switch to a CJK (or any
//     composing) input method; the in-progress text should show an
//     underline while composing, and commit correctly on confirm.
//  2. Accessibility — turn on a screen reader (Narrator/VoiceOver/Orca) and
//     Tab through the controls below. Each should announce its role
//     (button/checkbox/switch/radio/combobox/slider/textbox), its label,
//     and its current state (checked/toggled/value) — not just "control."
//
// Neither of these is verifiable by a sighted developer just looking at the
// screen — the visual state lines below are a sanity check for the person
// running this manually, not a substitute for actually testing with an IME
// and a screen reader.

function Section({ title, children }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#9aa0b6', marginBottom: 8 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function App() {
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [choice, setChoice] = useState('b');
  const [selected, setSelected] = useState('two');
  const [volume, setVolume] = useState(50);
  const [date, setDate] = useState(null);

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f14', padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#e8e8f0', marginBottom: 4 }}>
        A11y + IME Demo
      </Text>
      <Text style={{ fontSize: 12, color: '#6c7086', marginBottom: 20 }}>
        Type below with an IME to test composition. Tab through with a screen
        reader on to test roles/labels/state announcements.
      </Text>

      <Section title="TextInput (IME composition test)">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type here — try a CJK IME…"
          style={{ width: '100%' }}
        />
        <Text style={{ fontSize: 12, color: '#6c7086', marginTop: 6 }}>
          value: {text || '(empty)'}
        </Text>
      </Section>

      <Section title="Checkbox">
        <Checkbox checked={checked} onChange={setChecked} label="Subscribe to updates" />
        <Text style={{ fontSize: 12, color: '#6c7086', marginTop: 6 }}>
          checked: {String(checked)}
        </Text>
      </Section>

      <Section title="Switch">
        <Switch value={enabled} onValueChange={setEnabled} />
        <Text style={{ fontSize: 12, color: '#6c7086', marginTop: 6 }}>
          enabled: {String(enabled)}
        </Text>
      </Section>

      <Section title="RadioGroup">
        <RadioGroup value={choice} onValueChange={setChoice}>
          <Radio value="a" label="Option A" />
          <Radio value="b" label="Option B" />
          <Radio value="c" label="Option C" />
        </RadioGroup>
        <Text style={{ fontSize: 12, color: '#6c7086', marginTop: 6 }}>
          choice: {choice}
        </Text>
      </Section>

      <Section title="Select (combobox)">
        <Select
          value={selected}
          onValueChange={setSelected}
          options={[
            { label: 'One',   value: 'one' },
            { label: 'Two',   value: 'two' },
            { label: 'Three', value: 'three' },
          ]}
        />
        <Text style={{ fontSize: 12, color: '#6c7086', marginTop: 6 }}>
          selected: {selected}
        </Text>
      </Section>

      <Section title="Slider">
        <Slider value={volume} onValueChange={setVolume} min={0} max={100} step={1} />
        <Text style={{ fontSize: 12, color: '#6c7086', marginTop: 6 }}>
          volume: {Math.round(volume)}
        </Text>
      </Section>

      <Section title="DatePicker">
        <DatePicker value={date} onValueChange={setDate} />
        <Text style={{ fontSize: 12, color: '#6c7086', marginTop: 6 }}>
          date: {date ? new Date(date).toDateString() : '(none)'}
        </Text>
      </Section>
    </View>
  );
}

render(<App />);
