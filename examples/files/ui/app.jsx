import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, render, useWindowSize, fs, dialog,
} from '@glyx/react';
import {
  ThemeProvider, IconButton, Button, Empty, useTheme,
} from '@glyx/design';
import { Icon } from '@glyx/icons';
import { SplitPane } from '@glyx/split-pane';
import { Markdown } from '@glyx/markdown';

function basename(p) { return (p || '').split(/[\\/]/).pop() || p; }
function parentOf(p) { return (p || '').split(/[\\/]/).slice(0, -1).join('/'); }

function Explorer() {
  const C = useTheme().colors;
  const { width, height } = useWindowSize();
  const [root, setRoot] = useState(null);
  const [current, setCurrent] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState('Open a folder to begin');
  const saveTimer = useRef(null);
  const paneW = Math.max(200, Math.round(width * 0.7) - 48);

  const openFolder = async () => {
    const p = await dialog.openFolder();
    if (p) { setRoot(p); setCurrent(p); }
  };

  const list = useCallback(async (dir) => {
    if (!dir) return;
    try {
      const es = await fs.listDir(dir);
      es.sort((a, b) => (Number(b.isDir) - Number(a.isDir)) || a.name.localeCompare(b.name));
      setEntries(es);
      setCurrent(dir);
    } catch (e) { setStatus('List error: ' + (e && e.message ? e.message : e)); }
  }, []);

  useEffect(() => { if (current) list(current); }, [current, list]);

  const openFile = async (path) => {
    try {
      const c = await fs.readFile(path);
      setText(c);
      setSelected(path);
      setPreview(!/\.md$/i.test(path));
      setStatus('Opened ' + basename(path));
    } catch (e) { setStatus('Read error: ' + (e && e.message ? e.message : e)); }
  };

  const save = async () => {
    if (!selected) return;
    await fs.writeFile(selected, text);
    setStatus('Saved ' + basename(selected));
  };

  const del = async () => {
    if (!selected) return;
    await fs.deleteFile(selected);
    setSelected(null); setText('');
    setStatus('Deleted ' + basename(selected));
  };

  const onChangeText = (v) => {
    setText(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (selected) saveTimer.current = setTimeout(() => {
      fs.writeFile(selected, v).then(() => setStatus('Autosaved ' + basename(selected))).catch(() => {});
    }, 600);
  };

  const left = (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <IconButton icon="folder" variant="primary" label="Open folder" onPress={openFolder} />
        {current && current !== root ? (
          <IconButton icon="arrow-left" variant="ghost" label="Up" onPress={() => setCurrent(parentOf(current))} />
        ) : null}
        <Text style={{ color: C.textMuted, fontSize: 12, flex: 1 }}>{current || 'No folder'}</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: 8 }}>
        {entries.length === 0 ? (
          <Empty icon="📁" title="No folder open" description="Use the folder button to pick a directory" action={openFolder} actionLabel="Open folder" />
        ) : entries.map((e) => (
          <Pressable
            key={e.name}
            onPress={() => e.isDir ? list(current + '/' + e.name) : openFile(current + '/' + e.name)}
            style={({ hovered, pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 6,
              backgroundColor: pressed ? C.surfaceRaised : hovered ? C.surfaceHover || C.surfaceRaised : 'transparent',
            })}
          >
            <Icon name={e.isDir ? 'folder' : 'file-text'} size={16} color={C.textMuted} />
            <Text style={{ color: e.isDir ? C.primary : C.text, flex: 1 }}>{e.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const right = (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ color: C.text, flex: 1, fontSize: 13 }}>{selected ? basename(selected) : 'No file selected'}</Text>
        {selected ? (
          <>
            <IconButton icon={preview ? 'edit' : 'eye'} variant="ghost" label={preview ? 'Edit' : 'Preview'} onPress={() => setPreview(!preview)} />
            <IconButton icon="save" variant="secondary" label="Save" onPress={save} />
            <IconButton icon="trash" variant="danger" label="Delete" onPress={del} />
          </>
        ) : null}
      </View>
      <View style={{ flex: 1, padding: 12 }}>
        {!selected ? (
          <Empty icon="📝" title="Nothing open" description="Pick a file from the left to view or edit it" />
        ) : (preview && /\.md$/i.test(selected)) ? (
          <ScrollView style={{ flex: 1 }} width={paneW}>
            <Markdown source={text} width={paneW} />
          </ScrollView>
        ) : (
          <TextInput value={text} onChangeText={onChangeText} multiline placeholder="Start typing…" style={{ flex: 1, minHeight: Math.max(200, height - 140), color: C.text, backgroundColor: C.surface, borderRadius: 8, padding: 12, fontFamily: 'monospace' }} />
        )}
      </View>
      <View style={{ padding: 8, borderTopWidth: 1, borderTopColor: C.border }}>
        <Text style={{ color: C.textMuted, fontSize: 12 }}>{status}</Text>
      </View>
    </View>
  );

  if (!root) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={{ color: C.textMuted }}>File explorer + Markdown notes</Text>
        <Button label="Open folder" variant="primary" onPress={openFolder} />
      </View>
    );
  }

  return (
    <SplitPane direction="horizontal" defaultSizes={[30, 70]} width={width} height={height - 40}>
      {left}
      {right}
    </SplitPane>
  );
}

function Root() {
  return (
    <ThemeProvider colorScheme="system">
      <Explorer />
    </ThemeProvider>
  );
}

render(<Root />);
