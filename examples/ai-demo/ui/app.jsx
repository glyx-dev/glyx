import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, render, ai } from '@glyx-dev/react';

// One panel per local model. Embed and transcribe run once at startup (they are quick once their model is cached), generate runs on a
// button press because it is slow on a CPU, and streams its answer. Every result shows how long it took.
//
// Point SAMPLE_DIR at a folder holding the same speech as glyx_speech.wav, .mp3, .flac and .ogg (any recording works).

const SAMPLE_DIR = 'C:/Users/USER/AppData/Local/Temp';
const SAMPLE_WAV = `${SAMPLE_DIR}/glyx_speech.wav`;
const FORMATS = ['wav', 'mp3', 'flac', 'ogg'];

const cosine = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

function Panel({ title, children }) {
  return (
    <View style={{ gap: 6, padding: 12, borderRadius: 8, backgroundColor: '#1d1d26' }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#f5f5fa' }}>{title}</Text>
      {children}
    </View>
  );
}

const Line = ({ children, dim }) => (
  <Text style={{ fontSize: 13, color: dim ? '#8a8a99' : '#d8d8e4' }}>{children}</Text>
);

function Button({ label, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={{ padding: 10, borderRadius: 6, backgroundColor: disabled ? '#33333f' : '#3a3a5e', alignSelf: 'flex-start' }}>
      <Text style={{ color: '#fff' }}>{label}</Text>
    </Pressable>
  );
}

async function timed(fn) {
  const t = Date.now();
  try { return { value: await fn(), ms: Date.now() - t }; }
  catch (e) { return { error: String((e && e.message) || e), ms: Date.now() - t }; }
}

function App() {
  const [embed, setEmbed] = useState('running…');
  const [speech, setSpeech] = useState('running…');
  const [formats, setFormats] = useState([]);
  const [wavPath, setWavPath] = useState(SAMPLE_WAV);
  const [prompt, setPrompt] = useState('Instruct: Name the capital of France in one sentence.\nOutput:');
  const [gen, setGen] = useState('press Generate (slow on a CPU; the first call downloads 1.7 GB)');
  const [busy, setBusy] = useState(false);

  const runEmbed = useCallback(async () => {
    const texts = ['A cat sits on the mat.', 'A kitten is resting on the rug.', 'Stock markets fell sharply on Tuesday.'];
    const first = await timed(() => ai.embed(texts[0]));
    if (first.error) return setEmbed('error: ' + first.error);
    const [kitten, stock] = await Promise.all([ai.embed(texts[1]), ai.embed(texts[2])]);
    setEmbed(`${first.value.length} numbers, first call ${first.ms} ms (includes loading). cat~kitten ${cosine(first.value, kitten).toFixed(3)}, cat~stock ${cosine(first.value, stock).toFixed(3)}`);
  }, []);

  const runSpeech = useCallback(async (path) => {
    setSpeech('running…');
    const r = await timed(() => ai.transcribe(path, { language: '' }));
    setSpeech(r.error ? `error: ${r.error}` : `${r.ms} ms: "${r.value}"`);
  }, []);

  // The answer is shown as the model writes it (ai.generateStream), with the time to the first words and to the end.
  const runGenerate = useCallback(async () => {
    setBusy(true);
    setGen('generating…');
    const started = Date.now();
    let first = null;
    let text = '';
    try {
      for await (const piece of ai.generateStream(prompt, { maxTokens: 60, temperature: 0 })) {
        if (first === null) first = Date.now() - started;
        text += piece;
        setGen(`first words after ${(first / 1000).toFixed(1)} s, writing…
${text}`);
      }
      setGen(`${((Date.now() - started) / 1000).toFixed(1)} s (first words after ${(first / 1000).toFixed(1)} s): ${JSON.stringify(text)}`);
    } catch (e) {
      setGen(`error: ${String((e && e.message) || e)}`);
    }
    setBusy(false);
  }, [prompt]);

  // The same speech in every format the model reads, one after the other (the model runs one call at a time).
  const runFormats = useCallback(async () => {
    for (const ext of FORMATS) {
      const r = await timed(() => ai.transcribe(`${SAMPLE_DIR}/glyx_speech.${ext}`, { language: 'en' }));
      const line = r.error ? `${ext}: error: ${r.error}` : `${ext}: ${r.ms} ms: "${r.value}"`;
      setFormats((all) => [...all, line]);
    }
  }, []);

  useEffect(() => { runEmbed(); runSpeech(SAMPLE_WAV).then(runFormats); }, [runEmbed, runSpeech, runFormats]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#131318' }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>Local AI</Text>

      <Panel title="ai.embed">
        <Line>{embed}</Line>
      </Panel>

      <Panel title="ai.transcribe (WAV, MP3, FLAC, OGG)">
        <TextInput value={wavPath} onChangeText={setWavPath} style={{ color: '#fff', padding: 6, backgroundColor: '#26263a' }} />
        <Button label="Transcribe" onPress={() => runSpeech(wavPath)} />
        <Line>{speech}</Line>
        {formats.map((line) => <Line key={line} dim>{line}</Line>)}
      </Panel>

      <Panel title="ai.generate">
        <TextInput value={prompt} onChangeText={setPrompt} style={{ color: '#fff', padding: 6, backgroundColor: '#26263a' }} />
        <Button label={busy ? 'Generating…' : 'Generate'} onPress={runGenerate} disabled={busy} />
        <Line>{gen}</Line>
      </Panel>
    </ScrollView>
  );
}

render(<App />);
