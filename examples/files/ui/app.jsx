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
    list(current);
  };

  const onChangeDoc = (d) => {
    setDoc(d);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (selected) saveTimer.current = setTimeout(() => {
      fs.writeFile(selected, docToPlainText(d)).then(() => setStatus('Autosaved ' + basename(selected))).catch(() => {});
    }, 600);
  };

  const shown = entries.filter((e) => e.isDir || kindOf(e.name) != null);
  const look = (name, isDir) => {
    if (isDir) return { icon: 'folder', color: C.warning };
    const k = kindOf(name);
    if (k === 'image') return { icon: 'image', color: C.success };
    if (k === 'video') return { icon: 'play', color: C.error };
    return { icon: 'file-text', color: C.primary };
  };

  // A row: a fixed-size icon slot that never shrinks (so a narrow pane can't
  // squeeze the icon away) and a name that truncates with an ellipsis.
  const row = ({ key, icon, color, name, active, muted, onPress }) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ hovered, pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingVertical: 7, paddingRight: 10, borderRadius: 6, marginBottom: 2,
        backgroundColor: active || pressed ? C.surfaceRaised : hovered ? C.surfaceHover : 'transparent',
      })}
    >
      <View style={{ width: 3, height: 16, borderRadius: 2, flexShrink: 0, backgroundColor: active ? C.primary : 'transparent' }} />
      <View style={{ width: 18, height: 18, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} color={color} />
      </View>
      <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 13, color: muted ? C.textMuted : C.text, fontWeight: active ? '600' : '400' }}>{name}</Text>
    </Pressable>
  );

  const left = (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, gap: 4, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: C.text, fontSize: 14, fontWeight: '700' }}>{basename(current) || 'Files'}</Text>
          <IconButton icon="plus" variant="ghost" size={28} label="New file" onPress={newFile} />
          <IconButton icon="refresh-cw" variant="ghost" size={28} label="Refresh" onPress={() => list(current)} />
          <IconButton icon="folder" variant="ghost" size={28} label="Open folder" onPress={openFolder} />
        </View>
        <Text numberOfLines={1} style={{ color: C.textMuted, fontSize: 11 }}>{current || ''}</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: 6 }}>
        {current && current !== root
          ? row({ key: '..', icon: 'arrow-left', color: C.textMuted, name: 'Up one level', muted: true, onPress: () => setCurrent(parentOf(current)) })
          : null}
        {shown.length === 0 ? (
          <View style={{ padding: 14 }}>
            <Text style={{ color: C.textMuted, fontSize: 12 }}>No images, videos or text files here.</Text>
          </View>
        ) : shown.map((e) => {
          const path = current + '/' + e.name;
          const { icon, color } = look(e.name, e.isDir);
          return row({
            key: e.name, icon, color, name: e.name,
            active: !e.isDir && selected === path,
            onPress: () => (e.isDir ? list(path) : openFile(path)),
          });
        })}
      </ScrollView>
      <View style={{ height: 30, justifyContent: 'center', paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: C.border }}>
        <Text numberOfLines={1} style={{ color: C.textMuted, fontSize: 11 }}>
          {shown.length} item{shown.length === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );

  // The right pane is a render function: SplitPane passes its real size, so
  // the editor and previews follow the divider instead of the window.
  const right = ({ width: pw, height: ph }) => {
    const bodyW = Math.max(120, pw - 32);
    const bodyH = Math.max(120, ph - 56 - 30 - 32);
    const cur = selected ? look(selected, false) : null;
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
          {cur ? (
            <View style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={cur.icon} size={16} color={cur.color} />
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{selected ? basename(selected) : 'No file selected'}</Text>
            {selected ? <Text numberOfLines={1} style={{ color: C.textMuted, fontSize: 11 }}>{extOf(selected).toUpperCase() + ' ' + kind}</Text> : null}
          </View>
          {selected && kind === 'text' ? <IconButton icon="save" variant="ghost" size={30} label="Save" onPress={save} /> : null}
          {selected ? <IconButton icon="trash" variant="ghost" size={30} label="Delete" onPress={del} /> : null}
        </View>
        <View style={{ flex: 1, padding: 16 }}>
          {!selected ? (
            <Empty icon="📄" title="Nothing open" description="Pick an image, video, or .txt/.md/.log file from the left" />
          ) : kind === 'image' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderRadius: 10 }}>
              <Image src={selected} resizeMode="contain" style={{ width: bodyW - 24, height: bodyH - 24 }} />
            </View>
          ) : kind === 'video' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000', borderRadius: 10 }}>
              <Video src={selected} style={{ width: bodyW, height: bodyH }} />
            </View>
          ) : (
            <RichTextEditor
              key={selected}
              value={doc}
              onChange={onChangeDoc}
              width={bodyW}
              height={bodyH}
              color={C.text}
              placeholder="Start typing…"
              autoFocus
              style={{ backgroundColor: C.surface, borderRadius: 10, padding: 14 }}
            >
              <RichTextToolbar />
            </RichTextEditor>
          )}
        </View>
        <View style={{ height: 30, justifyContent: 'center', paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: C.border }}>
          <Text numberOfLines={1} style={{ color: C.textMuted, fontSize: 11 }}>{status}</Text>
        </View>
      </View>
    );
  };

  if (!root) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="folder" size={30} color={C.warning} />
        </View>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>Files</Text>
        <Text style={{ color: C.textMuted, fontSize: 13 }}>Browse images, video, and rich-text notes</Text>
        <Button label="Open folder" variant="primary" onPress={openFolder} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SplitPane direction="horizontal" defaultSizes={[28, 72]} minSizes={[160, 280]}
        dividerColor={C.border} dividerHoverColor={C.textMuted} dividerActiveColor={C.primary}
        width={width} height={height}>
        {left}
        {right}
      </SplitPane>
    </View>
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
