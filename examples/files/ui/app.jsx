import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, Video, render, useWindowSize, fs, dialog,
} from '@glyx-dev/react';
import {
  ThemeProvider, IconButton, Button, Empty, useTheme,
} from '@glyx-dev/design';
import { Icon } from '@glyx-dev/icons';
import { SplitPane } from '@glyx-dev/split-pane';
import { RichTextEditor, RichTextToolbar, docFromPlainText, docToPlainText } from '@glyx-dev/rich-text';

function basename(p) { return (p || '').split(/[\\/]/).pop() || p; }
function parentOf(p) { return (p || '').split(/[\\/]/).slice(0, -1).join('/'); }
function extOf(p) { return (basename(p).split('.').pop() || '').toLowerCase(); }

const TEXT_EXT  = ['txt', 'md', 'log'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const VIDEO_EXT = ['mp4', 'webm', 'mov', 'mkv'];

// Only images, video, and plain/markdown/log text are openable in this demo
// — deliberately narrow, to show off Image/Video/RichTextEditor together
// rather than being a general-purpose file viewer.
function kindOf(p) {
  const ext = extOf(p);
  if (TEXT_EXT.includes(ext))  return 'text';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'video';
  return null;
}

function Explorer() {
  const C = useTheme().colors;
  const { width, height } = useWindowSize();
  const [root, setRoot] = useState(null);
  const [current, setCurrent] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [kind, setKind] = useState(null);
  const [doc, setDoc] = useState(() => docFromPlainText(''));
  const [status, setStatus] = useState('Open a folder to begin');
  const saveTimer = useRef(null);
  const paneW = Math.max(200, Math.round(width * 0.7) - 48);
  const paneH = Math.max(200, height - 140);

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
    const k = kindOf(path);
    if (!k) return; // unsupported type — not openable in this demo
    setSelected(path);
    setKind(k);
    if (k === 'text') {
      try {
        const c = await fs.readFile(path);
        setDoc(docFromPlainText(c));
        setStatus('Opened ' + basename(path));
      } catch (e) { setStatus('Read error: ' + (e && e.message ? e.message : e)); }
    } else {
      // Image/Video components read the file themselves via their own
      // capability-scoped path resolution — nothing to load here.
      setStatus('Opened ' + basename(path));
    }
  };

  const save = async () => {
    if (!selected || kind !== 'text') return;
    await fs.writeFile(selected, docToPlainText(doc));
    setStatus('Saved ' + basename(selected));
  };

  const newFile = async () => {
    if (!current) return;
    const path = await dialog.saveFile({
      defaultName: 'Untitled.txt',
      filters: [{ name: 'Text', extensions: ['txt', 'md'] }],
    });
    if (!path) return;
    try {
      await fs.writeFile(path, '');
      // Open first (the state change that actually matters to the user) and
      // let the sidebar listing refresh separately, not chained right after
      // it — two back-to-back full-tree state transitions in the same tick
      // is exactly the kind of thing that can race with the native layout
      // tree's root bookkeeping (this framework rebuilds the whole layout
      // tree per render rather than diffing incrementally).
      await openFile(path);
      setStatus('Created ' + basename(path));
      list(parentOf(path) || current);
    } catch (e) { setStatus('Create error: ' + (e && e.message ? e.message : e)); }
  };

  const del = async () => {
    if (!selected) return;
    await fs.deleteFile(selected);
    setSelected(null); setKind(null);
    setStatus('Deleted ' + basename(selected));
  };

  const onChangeDoc = (d) => {
    setDoc(d);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (selected) saveTimer.current = setTimeout(() => {
      fs.writeFile(selected, docToPlainText(d)).then(() => setStatus('Autosaved ' + basename(selected))).catch(() => {});
    }, 600);
  };

  const left = (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <IconButton icon="folder" variant="primary" label="Open folder" onPress={openFolder} />
        {current ? (
          <IconButton icon="plus" variant="secondary" label="New file" onPress={newFile} />
        ) : null}
        {current && current !== root ? (
          <IconButton icon="arrow-left" variant="ghost" label="Up" onPress={() => setCurrent(parentOf(current))} />
        ) : null}
        <Text style={{ color: C.textMuted, fontSize: 12, flex: 1 }}>{current || 'No folder'}</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: 8 }}>
        {entries.length === 0 ? (
          <Empty icon="📁" title="No folder open" description="Use the folder button to pick a directory" action={openFolder} actionLabel="Open folder" />
        ) : entries.filter((e) => e.isDir || kindOf(e.name) != null).map((e) => {
          return (
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
          );
        })}
      </ScrollView>
    </View>
  );

  const right = (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ color: C.text, flex: 1, fontSize: 13 }}>{selected ? basename(selected) : 'No file selected'}</Text>
        {selected ? (
          <>
            {kind === 'text' ? <IconButton icon="save" variant="secondary" label="Save" onPress={save} /> : null}
            <IconButton icon="trash" variant="danger" label="Delete" onPress={del} />
          </>
        ) : null}
      </View>
      <View style={{ flex: 1, padding: 12 }}>
        {!selected ? (
          <Empty icon="📁" title="Nothing open" description="Pick an image, video, or .txt/.md/.log file from the left" />
        ) : kind === 'image' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Image src={selected} resizeMode="contain" style={{ width: paneW, height: paneH }} />
          </View>
        ) : kind === 'video' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Video src={selected} style={{ width: paneW, height: paneH }} />
          </View>
        ) : (
          <RichTextEditor
            key={selected}
            value={doc}
            onChange={onChangeDoc}
            width={paneW}
            height={paneH}
            color={C.text}
            placeholder="Start typing…"
            autoFocus
            style={{ backgroundColor: C.surface, borderRadius: 8, padding: 12 }}
          >
            <RichTextToolbar />
          </RichTextEditor>
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
        <Text style={{ color: C.textMuted }}>Images, video, and rich-text notes</Text>
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
