// Week 23 — Reference App: Notes
//
// A real-world notes app demonstrating Velox's full API surface:
//   • SQLite persistence (db.run / db.query / db.transaction)
//   • Vector search with keyword embeddings (vectorDb)
//   • File export via save dialog (dialog.saveFile + fs.writeFile)
//   • Clipboard integration (clipboard.writeText)
//   • Desktop notifications (notification.send)
//   • Dynamic window title (veloxWindow.setTitle)
//   • Multi-screen navigation (@velox/router)
//   • Responsive layout (useWindowSize)
//
// Screens:
//   list   → NoteListScreen   — browse, filter (SQL LIKE), create
//   edit   → NoteEditScreen   — create / edit a note, save / delete / copy / export
//   search → NoteSearchScreen — semantic search via keyword-vector cosine similarity

import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, render, useWindowSize, useMediaQuery, measureText,
  db, vectorDb, fs, dialog, clipboard, notification, veloxWindow, fetch, ws, mdns, ipc,
  battery, system, power, storage, input, perf, deeplink, credentials, crash,
  Checkbox, Switch, RadioGroup, Radio, FileInput, audio,
  Slider, Select, DatePicker,
  Canvas, Canvas3D,
  ai, camera, microphone, Camera,
  Video, Image,
} from '@velox/react';
import { Router, Route, useNavigate, useRoute } from '@velox/router';
import { createKeychain, createTypedKeychain } from '@velox/keychain';
import { initStore, createStore } from '@velox/store';
import { Scene, PerspectiveCamera, AmbientLight, DirectionalLight, PointLight, SpotLight, Mesh, Model } from '@velox/three';
import { createDrizzle } from '@velox/drizzle';
import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { desc, eq, gt } from 'drizzle-orm';

// ── Drizzle schema (used by DrizzleScreen) ────────────────────────────────────
const drzProducts = sqliteTable('drz_products', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  name:       text('name').notNull(),
  price:      real('price').notNull(),
  created_at: integer('created_at').notNull(),
});

// ── Constants ─────────────────────────────────────────────────────────────────

const HEADER_H = 48;
const PAD      = 16;

const C = {
  bg:          '#171923',
  surface:     '#1f2333',
  surfaceAlt:  '#262b3f',
  overlay:     '#2b3148',
  border:      '#3c4464',
  text:        '#e7ecff',
  subtle:      '#b7c0dd',
  dim:         '#7d87ab',
  accent:      '#7aa2f7',
  green:       '#9ece6a',
  red:         '#f7768e',
  yellow:      '#e0af68',
  mauve:       '#bb9af7',
  teal:        '#7dcfff',
  sapphire:    '#2ac3de',
  header:      '#141824',
};

function getAccentBands(theme) {
  return [theme.accent, theme.mauve, theme.teal, theme.green, theme.yellow];
}

// ── Semantic embedding ────────────────────────────────────────────────────────
//
// Notes are embedded as 20-dimensional keyword-presence vectors.
// Simple but effective for topic clustering: notes about "meetings"
// cluster near each other, "todo" notes cluster together, etc.

const VOCAB = [
  'todo',  'meeting',   'idea',    'project', 'code',
  'buy',   'call',      'email',   'read',    'write',
  'fix',   'important', 'urgent',  'task',    'review',
  'update','check',     'plan',    'done',    'note',
];

function embedNote(title, body) {
  const text = (title + ' ' + body).toLowerCase();
  const vec  = VOCAB.map(w => (text.includes(w) ? 1.0 : 0.0));
  const mag  = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return mag > 0 ? vec.map(v => v / mag) : vec;
}

// ── Seed data ─────────────────────────────────────────────────────────────────
// Inserted on first launch (when the notes table is empty).

const SEED_NOTES = [
  {
    title: 'Project Ideas',
    body:  'Ideas for next velox feature: vector search UI, nice responsive layout improvements, cross-platform build. Plan rollout for Q2.',
  },
  {
    title: 'Team Meeting Notes',
    body:  'Meeting agenda: review sprint goals, check blockers, update roadmap, plan next release. Schedule call with design team.',
  },
  {
    title: 'Code Review Checklist',
    body:  'Review open PRs: fix memory leak in runtime, update bindings, code cleanup. Check test coverage and update docs.',
  },
  {
    title: 'Shopping List',
    body:  'Buy groceries: milk, eggs, coffee, bread, cheese. Also check hardware store for a new monitor stand and USB cables.',
  },
  {
    title: 'Email Draft — Q2 Update',
    body:  'Write email to stakeholders about project update. Important: include timeline, budget note, blockers, and next steps.',
  },
  {
    title: 'Daily Todo',
    body:  'Todo: fix CLI bug, review PR, write unit tests, update docs, check build pipeline, plan sprint tasks for tomorrow.',
  },
  {
    title: 'Release v0.5 Checklist',
    body:  'Important urgent tasks: fix crash on startup, update version number, write changelog, review release notes, plan rollout.',
  },
  {
    title: 'Reading List',
    body:  'Books to read: Programming Rust, Clean Code, Designing Data-Intensive Applications. Note: write blog post about key ideas.',
  },
];

// ── Shared context ────────────────────────────────────────────────────────────
//
// Opened once in App, shared down so all screens use the same DB handle
// and vectorDb store. `refreshNotes` reloads the list from SQLite.

const NotesCtx = createContext({
  vdb:          null,
  dbReady:      false,
  notes:        [],
  refreshNotes: () => {},
  initStatus:   'Loading…',
});

function useNotesCtx() { return useContext(NotesCtx); }
function useThemeColors() { return C; }

function formatShortDate(ms) {
  const d = new Date(ms);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

function countWords(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// ── Shared components ─────────────────────────────────────────────────────────

function Btn({ label, onPress, width: w = 100, color, disabled = false, filled = false }) {
  const C = useThemeColors();
  const tone = color ?? C.accent;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      height={34}
      style={{
        backgroundColor: disabled ? C.surface : (filled ? C.overlay : C.surfaceAlt),
        borderRadius:     6,
        borderWidth:      1,
        borderColor:      disabled ? C.border : tone,
        flexDirection:   'row',
        alignItems:      'center',
        justifyContent:  'center',
        paddingHorizontal: 14,
        flexShrink:      0,    // buttons keep their content width in tight rows
        minWidth:        w,    // grows past this to fit the label (auto-width Text)
      }}
    >
      <Text fontSize={12} style={{ color: disabled ? C.dim : tone }}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatPill({ label, value, tone, width = 118 }) {
  const C = useThemeColors();
  const pillTone = tone ?? C.accent;
  return (
    <View
      style={{
        backgroundColor: C.surfaceAlt,
        borderRadius:    8,
        borderWidth:     1,
        borderColor:     C.border,
        padding:         10,
        gap:             2,
      }}
      width={width}
      height={52}
    >
      <Text fontSize={10} width={width - 22} height={12} style={{ color: C.dim }}>
        {label}
      </Text>
      <Text fontSize={15} width={width - 22} height={20} style={{ color: pillTone }}>
        {value}
      </Text>
    </View>
  );
}

// Defined at module level to avoid unmount/remount on parent re-renders.
// (Defining components inside render functions creates a new type each render,
//  causing React to unmount+remount subtrees and breaking drag state.)
function FormSection({ title, children }) {
  const C = useThemeColors();
  const { width: winW } = useWindowSize();
  const w = winW - PAD * 2;
  return (
    <View style={{ gap: 10, alignItems: 'flex-start' }} width={w}>
      <Text fontSize={11} width={w} height={16} style={{ color: C.dim }}>{title}</Text>
      {children}
      <View style={{ backgroundColor: C.border }} width={w} height={1} />
    </View>
  );
}

function NoteCard({ note, onPress, width: w, index = 0 }) {
  const C = useThemeColors();
  const ACCENT_BANDS = getAccentBands(C);
  const band    = ACCENT_BANDS[index % ACCENT_BANDS.length];
  const inner   = w - 42;
  const preview = (note.body || '').slice(0, 110);
  const date    = formatShortDate(note.updated_at);
  const words   = countWords(note.body);
  return (
    <Pressable
      onPress={onPress}
      width={w}
      height={102}
      style={{
        backgroundColor: C.surface,
        borderRadius:     10,
        borderWidth:      1,
        borderColor:      C.border,
        padding:          0,
        gap:              0,
        justifyContent:   'flex-start',
        alignItems:       'flex-start',
      }}
    >
      <View style={{ flexDirection: 'row', gap: 0 }} width={w} height={100}>
        <View style={{ backgroundColor: band }} width={6} height={100} />
        <View
          style={{
            padding:        12,
            gap:            6,
            justifyContent: 'flex-start',
            alignItems:     'flex-start',
          }}
          width={w - 8}
          height={100}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 8 }} width={inner} height={20}>
            <Text fontSize={14} width={inner - 60} height={20} style={{ color: C.text }}>
              {note.title || '(untitled)'}
            </Text>
            <Text fontSize={10} width={52} height={14} style={{ color: C.dim }}>
              {date}
            </Text>
          </View>
          <Text fontSize={11} width={inner} height={32} style={{ color: C.subtle }}>
            {preview.length > 0 ? preview + (note.body.length > 110 ? '…' : '') : '(empty)'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }} width={inner} height={16}>
            <Text fontSize={10} width={88} height={14} style={{ color: band }}>
              {'#' + note.id}
            </Text>
            <Text fontSize={10} width={96} height={14} style={{ color: C.dim }}>
              {words + ' words'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SectionLabel({ label, width: w }) {
  const C = useThemeColors();
  return (
    <Text fontSize={11} width={w} height={16} style={{ color: C.dim }}>
      {label}
    </Text>
  );
}

function Divider({ width: w }) {
  const C = useThemeColors();
  return <View style={{ backgroundColor: C.border }} width={w} height={1} />;
}

function BackBtn() {
  const navigate = useNavigate();
  const C = useThemeColors();
  return <Btn label="← Back" onPress={() => navigate('back')} width={84} color={C.subtle} />;
}

// ── Screen: Note List ─────────────────────────────────────────────────────────
//
// Browse all notes, filter with a live SQL LIKE search, navigate to edit
// an existing note, create a new one, or jump to semantic search.

function NoteListScreen() {
  const { width: winW, height: winH } = useWindowSize();
  const isWide = useMediaQuery(1180);
  const C = useThemeColors();
  const { notes, dbReady, refreshNotes, initStatus } = useNotesCtx();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);   // null = show context notes
  const [status, setStatus] = useState('');

  // Update window title on mount
  useEffect(() => { veloxWindow.setTitle('Notes'); }, []);

  // Live SQL filter as user types
  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    db.query(
      'SELECT * FROM notes WHERE title LIKE ? OR body LIKE ? ORDER BY updated_at DESC',
      [`%${query}%`, `%${query}%`]
    )
      .then((rows) => {
        setResults(rows);
        setStatus(rows.length === 0 ? 'No notes match.' : `${rows.length} match${rows.length === 1 ? '' : 'es'}`);
      })
      .catch((e) => setStatus('Search error: ' + e.message));
  }, [query]);

  const displayed = results ?? notes;
  const selectedHint = query ? (status || 'Searching…') : (dbReady ? `${notes.length} notes in your workspace` : initStatus);
  const wordTotal = useMemo(
    () => notes.reduce((sum, n) => sum + countWords(n.title) + countWords(n.body), 0),
    [notes]
  );
  const latestDate = notes.length > 0 ? formatShortDate(notes[0].updated_at) : 'N/A';


  const contentW = winW - 2 * PAD;
  const contentH = winH - HEADER_H - 2 * PAD;
  const inner    = contentW - 32;
  const svContentH = displayed.length * 110 + 20;
  const heroH = isWide ? 124 : 188;
  const actionsH = 76;
  const svH = Math.max(110, contentH - heroH - 174);

  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius:    16,
        borderWidth:     1,
        borderColor:     C.border,
        padding:         16,
        gap:             10,
        justifyContent:  'flex-start',
        alignItems:      'flex-start',
      }}
      width={contentW}
      height={contentH}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          alignItems: 'flex-start',
          backgroundColor: C.overlay,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: C.border,
          padding: 12,
        }}
        width={inner}
        height={heroH}
      >
        <View style={{ gap: 6, justifyContent: 'flex-start', alignItems: 'flex-start' }} width={isWide ? inner - 420 : inner} height={98}>
          <Text fontSize={22} width={isWide ? inner - 430 : inner - 8} height={30} style={{ color: C.text }}>
            My Notes Workspace Demo
          </Text>
          <Text fontSize={12} width={isWide ? inner - 430 : inner - 8} style={{ color: C.subtle }}>
            {'Capture ideas, write drafts, and rediscover them instantly with semantic search.'}
          </Text>
          <Text fontSize={11} width={isWide ? inner - 430 : inner - 8} height={16} style={{ color: C.dim }}>
            {selectedHint}
          </Text>
        </View>

        {isWide && (
          <View style={{ flexDirection: 'row', gap: 8 }} width={390} height={60}>
            <StatPill label="Notes" value={String(notes.length)} tone={C.accent} />
            <StatPill label="Words" value={String(wordTotal)} tone={C.teal} />
            <StatPill label="Updated" value={latestDate} tone={C.mauve} />
          </View>
        )}
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by title or content..."
        fontSize={13}
        width={inner}
        height={36}
      />

      <View style={{ gap: 8 }} width={inner} height={actionsH}>
        <Text fontSize={11} width={inner} height={16} style={{ color: C.dim }}>
          {'Tap a card to edit. Search narrows results instantly using SQL LIKE.'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} width={inner} height={52}>
          <Btn
            label="+ New"
            onPress={() => navigate('edit', { noteId: null })}
            width={80}
            color={C.green}
            disabled={!dbReady}
            filled
          />
          <Btn
            label="Semantic"
            onPress={() => navigate('search')}
            width={95}
            color={C.mauve}
            disabled={!dbReady}
          />
          <Btn
            label="Refresh"
            onPress={refreshNotes}
            width={90}
            color={C.accent}
            disabled={!dbReady}
          />
          <Btn
            label="Network"
            onPress={() => navigate('network')}
            width={90}
            color={C.teal}
          />
          <Btn
            label="Sys APIs"
            onPress={() => navigate('sysapi')}
            width={90}
            color={C.yellow}
          />
          <Btn
            label="Forms"
            onPress={() => navigate('forms')}
            width={74}
            color={C.mauve}
          />
          <Btn
            label="Audio"
            onPress={() => navigate('audio')}
            width={74}
            color={C.teal}
          />
          <Btn
            label="Canvas"
            onPress={() => navigate('canvas')}
            width={80}
            color={C.sapphire}
          />
          <Btn
            label="AI"
            onPress={() => navigate('ai')}
            width={52}
            color={C.mauve}
          />
          <Btn
            label="Media"
            onPress={() => navigate('media')}
            width={64}
            color={C.teal}
          />
          <Btn
            label="Drizzle"
            onPress={() => navigate('drizzle')}
            width={68}
            color={C.green}
          />
          <Btn
            label="Packages"
            onPress={() => navigate('packages')}
            width={84}
            color={C.mauve}
          />
        </View>
      </View>

      {displayed.length === 0 ? (
        <View style={{ justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8 }} width={inner} height={120}>
          <Text fontSize={13} width={inner} height={20} style={{ color: C.dim }}>
            {dbReady ? (query ? 'No notes match your filter.' : 'No notes yet.') : 'Initialising database…'}
          </Text>
          {dbReady && !query && (
            <Btn
              label="+ Create First Note"
              onPress={() => navigate('edit', { noteId: null })}
              width={160}
              color={C.green}
              filled
            />
          )}
        </View>
      ) : (
        <ScrollView
          width={inner}
          height={Math.max(80, svH)}
          contentHeight={svContentH}
          style={{ gap: 10, padding: 0 }}
        >
          {displayed.map((note, i) => (
            <NoteCard
              key={note.id}
              note={note}
              width={inner}
              index={i}
              onPress={() => navigate('edit', { noteId: note.id })}
            />
          ))}
        </ScrollView>
      )}

      <Text fontSize={10} width={inner} height={14} style={{ color: C.dim }}>
        {'Beautiful by default • SQL filtering • Semantic search powered by your Velox vector store'}
      </Text>
    </View>
  );
}

// ── Screen: Note Edit ─────────────────────────────────────────────────────────
//
// Create or edit a note. On save, writes to SQLite and upserts a keyword
// embedding vector into the vector store for semantic search.

function NoteEditScreen() {
  const { width: winW, height: winH } = useWindowSize();
  const isWide = useMediaQuery(1080);
  const C = useThemeColors();
  const { vdb, dbReady, refreshNotes } = useNotesCtx();
  const { params } = useRoute();
  const navigate = useNavigate();

  const noteId = params?.noteId ?? null;
  const isNew  = noteId === null;

  const [title,    setTitle]    = useState('');
  const [body,     setBody]     = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [status,   setStatus]   = useState(isNew ? 'New note' : 'Loading…');

  // Load existing note on mount
  useEffect(() => {
    if (!isNew) {
      db.query('SELECT * FROM notes WHERE id=?', [noteId])
        .then(([note]) => {
          if (note) {
            setTitle(note.title);
            setBody(note.body);
            setStatus('');
            veloxWindow.setTitle(note.title || 'Edit Note');
          } else {
            setStatus('Note not found.');
          }
        })
        .catch((e) => setStatus('Load error: ' + e.message));
    } else {
      veloxWindow.setTitle('New Note');
    }
  }, [noteId, isNew]);

  const save = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    setStatus('Saving…');
    try {
      const now = Date.now();
      let savedId = noteId;

      if (isNew) {
        await db.run(
          'INSERT INTO notes (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)',
          [title, body, now, now]
        );
        const [row] = await db.query('SELECT last_insert_rowid() as id');
        savedId = row.id;
      } else {
        await db.run(
          'UPDATE notes SET title=?, body=?, updated_at=? WHERE id=?',
          [title, body, now, noteId]
        );
      }

      // Upsert vector embedding
      if (vdb) {
        const vec = embedNote(title, body);
        await vdb.upsert('notes', String(savedId), vec, {
          title,
          preview: body.slice(0, 60),
        });
      }

      await refreshNotes();
      veloxWindow.setTitle(title || 'Note');
      notification.send({ title: 'Notes', body: `"${title || 'Untitled'}" saved.` })
        .catch(() => {});  // notifications are best-effort

      setStatus('Saved ✓');
      if (isNew) {
        // Replace history so Back returns to list, not a second "new" screen
        navigate('edit', { noteId: savedId }, { replace: true });
      }
    } catch (e) {
      setStatus('Save error: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  }, [title, body, noteId, isNew, vdb, refreshNotes, navigate, isSaving]);

  const deleteNote = useCallback(async () => {
    if (isNew) { navigate('back'); return; }
    setStatus('Deleting…');
    try {
      await db.run('DELETE FROM notes WHERE id=?', [noteId]);
      // Remove vector (upsert a zero vector — store doesn't have DELETE yet,
      // so we mark it by removing from search results via zero magnitude)
      await refreshNotes();
      navigate('back');
    } catch (e) {
      setStatus('Delete error: ' + e.message);
    }
  }, [isNew, noteId, refreshNotes, navigate]);

  const copyToClipboard = useCallback(() => {
    const content = title ? `${title}\n\n${body}` : body;
    clipboard.writeText(content)
      .then(() => setStatus('Copied to clipboard ✓'))
      .catch((e) => setStatus('Clipboard error: ' + e.message));
  }, [title, body]);

  const exportNote = useCallback(async () => {
    try {
      const path = await dialog.saveFile({
        defaultName: (title || 'note').replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.txt',
        filters: [{ name: 'Text Files', extensions: ['txt'] }],
      });
      if (!path) { setStatus('Export cancelled.'); return; }
      const content = `${title}\n${'─'.repeat(Math.min(title.length, 60))}\n\n${body}`;
      await fs.writeFile(path, content);
      setStatus('Exported to ' + path.split(/[/\\]/).pop());
    } catch (e) {
      setStatus('Export error: ' + e.message);
    }
  }, [title, body]);

  const contentW = winW - 2 * PAD;
  const contentH = winH - HEADER_H - 2 * PAD;
  const inner = contentW - 32;
  const sideW = isWide ? 260 : inner;
  const editorW = isWide ? inner - sideW - 16 : inner;
  const bodyH = isWide ? Math.max(220, contentH - 260) : Math.max(120, contentH - 486);
  const titleWords = countWords(title);
  const bodyWords = countWords(body);
  const statusTone = status.toLowerCase().includes('error') ? C.red : C.green;

  return (
    <View
      style={{
        backgroundColor: C.overlay,
        borderRadius:    16,
        borderWidth:     1,
        borderColor:     C.border,
        padding:         16,
        gap:             10,
        justifyContent:  'flex-start',
        alignItems:      'flex-start',
      }}
      width={contentW}
      height={contentH}
    >
      <View
        style={{
          flexDirection: isWide ? 'row' : 'column',
          gap: 16,
          alignItems: 'flex-start',
        }}
        width={inner}
        height={isWide ? contentH - 32 : contentH - 32}
      >
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.border,
            padding: 14,
            gap: 10,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
          }}
          width={sideW}
          height={isWide ? contentH - 32 : 210}
        >
          <BackBtn />
          <Text fontSize={18} width={sideW - 28} height={24} style={{ color: C.text }}>
            {isNew ? 'Compose a new note' : 'Refine your note'}
          </Text>
          <Text fontSize={11} width={sideW - 28} style={{ color: C.subtle }}>
            {'Use this space to capture ideas, polish drafts, and export finished thoughts.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }} width={sideW - 28} height={52}>
            <StatPill label="Title words" value={String(titleWords)} tone={C.accent} width={110} />
            <StatPill label="Body words" value={String(bodyWords)} tone={C.teal} width={110} />
          </View>
          <StatPill label="Characters" value={String(body.length)} tone={C.mauve} width={sideW - 28} />
          <Divider width={sideW - 28} />
          <Btn
            label={isSaving ? 'Saving…' : 'Save Note'}
            onPress={save}
            width={sideW - 28}
            color={C.green}
            disabled={isSaving || !dbReady}
            filled
          />
          <Btn label="⎘ Copy" onPress={copyToClipboard} width={sideW - 28} color={C.accent} />
          <Btn label="↓ Export" onPress={exportNote} width={sideW - 28} color={C.yellow} />
          <Btn
            label={isNew ? 'Discard Draft' : 'Delete Note'}
            onPress={deleteNote}
            width={sideW - 28}
            color={C.red}
          />
          <Text fontSize={11} width={sideW - 28} style={{ color: statusTone }}>
            {status}
          </Text>
          <Text fontSize={10} width={sideW - 28} style={{ color: C.dim }}>
            {'Saving also refreshes semantic embeddings for search.'}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: C.overlay,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.border,
            padding: 16,
            gap: 12,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
          }}
          width={editorW}
          height={isWide ? contentH - 32 : contentH - 258}
        >
          <View
            style={{
              backgroundColor: C.surfaceAlt,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: C.accent,
              padding: 12,
              gap: 4,
            }}
            width={editorW - 32}
            height={72}
          >
            <Text fontSize={14} width={editorW - 56} height={20} style={{ color: C.text }}>
              {isNew ? 'Writing Canvas' : 'Editing Canvas'}
            </Text>
            <Text fontSize={11} width={editorW - 56} style={{ color: C.subtle }}>
              {'A cleaner composition with stronger spacing, theme-aware accents, and clearer hierarchy.'}
            </Text>
          </View>

          <SectionLabel label="TITLE" width={editorW - 32} />
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Note title…"
            fontSize={16}
            width={editorW - 32}
            height={44}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 8 }} width={editorW - 32} height={16}>
            <SectionLabel label="BODY" width={editorW - 120} />
            <Text fontSize={10} width={112} height={14} style={{ color: C.dim }}>
              {body.length + ' chars  •  ' + bodyWords + ' words'}
            </Text>
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Start writing…"
            fontSize={13}
            multiline
            width={editorW - 32}
            height={bodyH}
          />
        </View>
      </View>
    </View>
  );
}

// ── Screen: Semantic Search ───────────────────────────────────────────────────
//
// Enter a query phrase. It is embedded using the same keyword-presence
// function as notes, then cosine-similarity ranked against all stored
// note vectors. Top-5 results are shown with their score.

function NoteSearchScreen() {
  const { width: winW, height: winH } = useWindowSize();
  const isWide = useMediaQuery(1080);
  const C = useThemeColors();
  const { vdb, dbReady } = useNotesCtx();
  const navigate = useNavigate();

  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState([]);
  const [isSearching,setIsSearching]= useState(false);
  const [status,     setStatus]     = useState('Enter a phrase and press Search.');

  useEffect(() => { veloxWindow.setTitle('Notes — Semantic Search'); }, []);

  const search = useCallback(async () => {
    if (!vdb || !query.trim()) return;
    setIsSearching(true);
    setStatus('Searching…');
    try {
      const vec  = embedNote(query, '');
      const hits = await vdb.search('notes', vec, 8);

      // Filter hits with a meaningful score (>0 means at least one vocab word matched)
      const meaningful = hits.filter(h => h.score > 0);

      if (meaningful.length === 0) {
        setResults([]);
        setStatus('No semantic matches. Try topic words like "meeting", "todo", "code"…');
        return;
      }

      // Load full note rows for each hit
      const rows = await Promise.all(
        meaningful.map(async (hit) => {
          const [note] = await db.query('SELECT * FROM notes WHERE id=?', [parseInt(hit.id)]);
          return note ? { ...note, score: hit.score } : null;
        })
      );
      const found = rows.filter(Boolean);
      setResults(found);
      setStatus(`${found.length} result${found.length === 1 ? '' : 's'} by cosine similarity`);
    } catch (e) {
      setStatus('Search error: ' + e.message);
    } finally {
      setIsSearching(false);
    }
  }, [vdb, query]);

  const contentW = winW - 2 * PAD;
  const contentH = winH - HEADER_H - 2 * PAD;
  const inner = contentW - 32;
  const sideW = isWide ? 250 : inner;
  const resultsW = isWide ? inner - sideW - 16 : inner;
  const svH = isWide ? contentH - 260 : contentH - 496;
  const svContentH = results.length * 94 + 16;

  return (
    <View
      style={{
        backgroundColor: C.overlay,
        borderRadius:    16,
        borderWidth:     1,
        borderColor:     C.border,
        padding:         16,
        gap:             10,
        justifyContent:  'flex-start',
        alignItems:      'flex-start',
      }}
      width={contentW}
      height={contentH}
    >
      <View
        style={{
          flexDirection: isWide ? 'row' : 'column',
          gap: 16,
          alignItems: 'flex-start',
        }}
        width={inner}
        height={contentH - 32}
      >
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.border,
            padding: 14,
            gap: 10,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
          }}
          width={sideW}
          height={isWide ? contentH - 32 : 220}
        >
          <BackBtn />
          <Text fontSize={18} width={sideW - 28} height={24} style={{ color: C.mauve }}>
            Semantic Search
          </Text>
          <Text fontSize={11} width={sideW - 28} style={{ color: C.subtle }}>
            {'Search by meaning instead of exact wording. Topic words like meeting, todo, code, or idea work best.'}
          </Text>
          <StatPill label="Results" value={String(results.length)} tone={C.mauve} width={sideW - 28} />
          <StatPill label="Status" value={isSearching ? 'Working' : 'Ready'} tone={C.teal} width={sideW - 28} />
          <Divider width={sideW - 28} />
          <Text fontSize={10} width={sideW - 28} style={{ color: C.dim }}>
            {'Embedding: 20-dim keyword presence vector.\nRanking: cosine similarity across stored note vectors.'}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: C.overlay,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.border,
            padding: 16,
            gap: 12,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
          }}
          width={resultsW}
          height={isWide ? contentH - 32 : contentH - 268}
        >
          <View
            style={{
              backgroundColor: C.surfaceAlt,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: C.mauve,
              padding: 12,
              gap: 6,
            }}
            width={resultsW - 32}
            height={80}
          >
            <Text fontSize={14} width={resultsW - 56} height={20} style={{ color: C.text }}>
              Discovery Mode
            </Text>
            <Text fontSize={11} width={resultsW - 56} style={{ color: C.subtle }}>
              {'Find notes that feel related, even when they do not share the exact same words.'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }} width={resultsW - 32} height={36}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="e.g. meeting agenda, code review, shopping…"
              fontSize={13}
              width={resultsW - 130}
              height={36}
            />
            <Btn
              label={isSearching ? 'Searching…' : 'Search'}
              onPress={search}
              width={88}
              color={C.mauve}
              disabled={isSearching || !vdb || !query.trim()}
              filled
            />
          </View>

          <Text fontSize={11} width={resultsW - 32} height={16} style={{ color: C.dim }}>
            {status}
          </Text>

          {results.length > 0 ? (
            <>
              <SectionLabel label="RESULTS" width={resultsW - 32} />
              <ScrollView
                width={resultsW - 32}
                height={Math.max(80, svH)}
                contentHeight={svContentH}
                style={{ gap: 10 }}
              >
                {results.map((note) => (
                  <View
                    key={note.id}
                    style={{
                      flexDirection: 'row',
                      gap: 12,
                      alignItems: 'flex-start',
                      backgroundColor: C.surface,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: C.border,
                      padding: 12,
                    }}
                    width={resultsW - 32}
                    height={84}
                  >
                    <View
                      style={{ backgroundColor: C.surfaceAlt, borderRadius: 8, borderWidth: 1, borderColor: C.mauve, padding: 8 }}
                      width={58}
                      height={58}
                    >
                      <Text fontSize={16} width={40} height={22} style={{ color: C.mauve }}>
                        {(note.score * 100).toFixed(0)}
                      </Text>
                      <Text fontSize={9} width={40} height={12} style={{ color: C.dim }}>
                        {'% match'}
                      </Text>
                    </View>
                    <View
                      style={{ gap: 5, justifyContent: 'flex-start', alignItems: 'flex-start' }}
                      width={resultsW - 114}
                      height={58}
                    >
                      <Pressable
                        onPress={() => navigate('edit', { noteId: note.id })}
                        width={resultsW - 114}
                        height={20}
                      >
                        <Text fontSize={14} width={resultsW - 120} height={20} style={{ color: C.accent }}>
                          {note.title || '(untitled)'}
                        </Text>
                      </Pressable>
                      <Text fontSize={11} width={resultsW - 114} height={30} style={{ color: C.subtle }}>
                        {(note.body || '').slice(0, 96) + (note.body?.length > 96 ? '…' : '')}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </>
          ) : (
            <View
              style={{
                backgroundColor: C.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: C.border,
                padding: 16,
              }}
              width={resultsW - 32}
              height={92}
            >
              <Text fontSize={12} width={resultsW - 64} height={18} style={{ color: C.subtle }}>
                {'No semantic results yet.'}
              </Text>
              <Text fontSize={10} width={resultsW - 64} style={{ color: C.dim }}>
                {'Try topic-driven queries like "project idea", "shopping", or "release review".'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Screen: Sys API Demo ──────────────────────────────────────────────────────
//
// Phase 15A — demonstrates battery, system info, power sleep guard, storage
// drives, gamepad events, and app-focused keyboard shortcuts.

function SysApiScreen() {
  const { width: winW, height: winH } = useWindowSize();
  const navigate = useNavigate();
  const C = useThemeColors();
  const inner = winW - PAD * 2;

  const [battInfo,    setBattInfo]    = useState(null);
  const [sysInfo,     setSysInfo]     = useState(null);
  const [drives,      setDrives]      = useState([]);
  const [gamepadLog,  setGamepadLog]  = useState([]);
  const [shortcutLog, setShortcutLog] = useState([]);
  const [sleepGuard,  setSleepGuard]  = useState(null);

  // Sync reads — cheap enough to call on every render.
  const darkMode      = system.getDarkMode();
  const batterySaver  = system.isBatterySaverActive();

  // perf.snapshot() is synchronous — read it inline each render instead of
  // using setInterval (which Velox's V8 context does not polyfill).
  const perfSnap = perf.snapshot();

  // Load OS data once on mount (async).
  useEffect(() => {
    battery.getStatus().then(b => setBattInfo(b));
    system.getInfo().then(s => setSysInfo(s));
    storage.getDrives().then(d => setDrives(d));
  }, []);

  // Register a gamepad listener.
  useEffect(() => {
    const unsub = input.gamepads.onInput((ev) => {
      setGamepadLog(prev => [`${ev.event?.type ?? '?'} @ ${ev.name ?? ev.id}`, ...prev].slice(0, 6));
    });
    return unsub;
  }, []);

  // Register an app-focused shortcut: Ctrl+G.
  useEffect(() => {
    const id = input.shortcut.register('ctrl+g', () => {
      setShortcutLog(prev => ['Ctrl+G fired!', ...prev].slice(0, 6));
    });
    return () => input.shortcut.unregister(id);
  }, []);

  function toggleSleepGuard() {
    if (sleepGuard) {
      power.allowSleep(sleepGuard);
      setSleepGuard(null);
    } else {
      const g = power.preventSleep('SysApiScreen demo');
      setSleepGuard(g);
    }
  }

  const Row = ({ label, value, tone }) => (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }} width={inner} height={22}>
      <Text fontSize={11} width={160} height={16} style={{ color: C.dim }}>{label}</Text>
      <Text fontSize={12} width={inner - 176} height={16} style={{ color: tone ?? C.text }}>{String(value ?? '—')}</Text>
    </View>
  );

  const Section = ({ title, children }) => (
    <View style={{ gap: 6, justifyContent: 'flex-start', alignItems: 'flex-start' }} width={inner}>
      <Text fontSize={13} width={inner} height={18} style={{ color: C.accent }}>{title}</Text>
      {children}
      <View style={{ backgroundColor: C.border }} width={inner} height={1} />
    </View>
  );

  return (
    <ScrollView
      width={inner}
      height={winH - HEADER_H - PAD * 2}
      contentHeight={900}
      style={{ gap: 16, justifyContent: 'flex-start', alignItems: 'flex-start' }}
    >
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }} width={inner} height={32}>
        <BackBtn />
        <Text fontSize={16} width={200} height={22} style={{ color: C.yellow }}>OS System APIs</Text>
      </View>

      <Section title="Battery">
        {battInfo ? (
          <>
            <Row label="Level"          value={`${Math.round(battInfo.level * 100)}%`} tone={battInfo.charging ? C.green : C.accent} />
            <Row label="Charging"       value={battInfo.charging ? 'Yes' : 'No'} />
            <Row label="Time remaining" value={battInfo.timeRemainingSecs != null ? `${Math.round(battInfo.timeRemainingSecs / 60)} min` : 'Unknown'} />
          </>
        ) : (
          <Row label="Status" value="No battery detected (desktop?)" tone={C.dim} />
        )}
      </Section>

      <Section title="System Info">
        <Row label="Color scheme"   value={darkMode}     tone={darkMode === 'dark' ? C.mauve : C.yellow} />
        <Row label="Battery saver"  value={batterySaver ? 'Active' : 'Off'} tone={batterySaver ? C.green : C.dim} />
        {sysInfo ? (
          <>
            <Row label="CPU"       value={sysInfo.cpuName}    />
            <Row label="Cores"     value={sysInfo.cpuCores}   />
            <Row label="RAM total" value={`${sysInfo.memoryTotalMb} MB`} />
            <Row label="RAM used"  value={`${sysInfo.memoryUsedMb} MB`} tone={C.yellow} />
            <Row label="OS"        value={`${sysInfo.osName} ${sysInfo.osVersion}`} />
          </>
        ) : <Row label="Loading…" value="" />}
      </Section>

      <Section title="Storage Drives">
        {drives.length === 0
          ? <Row label="No drives found" value="" tone={C.dim} />
          : drives.map((d, i) => (
              <Row
                key={i}
                label={`${d.name} (${d.mountPoint})`}
                value={`${(d.availableBytes / 1e9).toFixed(1)} GB free / ${(d.totalBytes / 1e9).toFixed(1)} GB`}
                tone={C.teal}
              />
            ))
        }
      </Section>

      <Section title="Performance Snapshot">
        {perfSnap ? (
          <>
            <Row label="FPS"          value={perfSnap.fps?.toFixed(1)}       tone={C.green}  />
            <Row label="Frame time"   value={`${perfSnap.frameTime?.toFixed(2)} ms`}   />
            <Row label="Frame P99"    value={`${perfSnap.frameTimeP99?.toFixed(2)} ms`} tone={C.yellow} />
            <Row label="JS time"      value={`${perfSnap.jsTime?.toFixed(2)} ms`}      />
            <Row label="Layout time"  value={`${perfSnap.layoutTime?.toFixed(2)} ms`}  />
            <Row label="Heap JS"      value={`${perfSnap.memoryJS?.toFixed(1)} MB`}    />
            <Row label="Nodes"        value={perfSnap.nodeCount}                        />
          </>
        ) : <Row label="Loading…" value="" />}
      </Section>

      <Section title="Sleep Prevention">
        <Row label="Guard active" value={sleepGuard ? 'Yes — system will not sleep' : 'No'} tone={sleepGuard ? C.green : C.dim} />
        <Btn
          label={sleepGuard ? 'Allow Sleep' : 'Prevent Sleep'}
          onPress={toggleSleepGuard}
          width={130}
          color={sleepGuard ? C.red : C.accent}
        />
      </Section>

      <Section title="Gamepad Events (connect a controller)">
        {gamepadLog.length === 0
          ? <Row label="No events yet" value="" tone={C.dim} />
          : gamepadLog.map((e, i) => <Row key={i} label={`Event ${i + 1}`} value={e} tone={C.mauve} />)
        }
      </Section>

      <Section title="App-focused Shortcut (Ctrl+G)">
        <Row label="Press Ctrl+G while this screen is open" value="" tone={C.dim} />
        {shortcutLog.length === 0
          ? <Row label="No shortcut fired yet" value="" tone={C.dim} />
          : shortcutLog.map((e, i) => <Row key={i} label={`Fire ${i + 1}`} value={e} tone={C.green} />)
        }
      </Section>
    </ScrollView>
  );
}

// ── Screen: Form Fields Demo ──────────────────────────────────────────────────
//
// Phase 16E + 16F — Checkbox, Switch, RadioGroup/Radio, FileInput, Slider, Select, DatePicker.

function FormDemoScreen() {
  const { width: winW, height: winH } = useWindowSize();
  const navigate = useNavigate();
  const C = useThemeColors();
  const inner = winW - PAD * 2;

  const [checked,    setChecked]    = useState(false);
  const [switched,   setSwitched]   = useState(false);
  const [radioVal,   setRadioVal]   = useState('option_a');
  const [pickedFile, setPickedFile] = useState(null);
  const [credStatus, setCredStatus] = useState('');
  const [sliderVal,  setSliderVal]  = useState(0.4);
  const [selectVal,  setSelectVal]  = useState(null);
  const [dateVal,    setDateVal]    = useState(null);

  async function testCredentials() {
    try {
      await credentials.set('demo-token', 'velox-secret-1234');
      const val = await credentials.get('demo-token');
      setCredStatus('Stored & retrieved: ' + val);
      await credentials.delete('demo-token');
    } catch (e) {
      setCredStatus('Error: ' + e);
    }
  }

  return (
    <ScrollView width={winW} height={winH - HEADER_H - PAD} contentHeight={1400}>
      <View style={{ gap: 20, padding: PAD, alignItems: 'flex-start', justifyContent: 'flex-start' }} width={inner}>

        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }} width={inner} height={34}>
          <BackBtn />
          <Text fontSize={16} width={inner - 100} height={22} style={{ color: C.text }}>Form Fields</Text>
        </View>

        <FormSection title="CHECKBOX">
          <Checkbox
            checked={checked}
            onChange={setChecked}
            label={checked ? 'Checked ✓' : 'Unchecked'}
          />
          <Checkbox checked={true} disabled label="Disabled (checked)" />
          <Checkbox checked={false} disabled label="Disabled (unchecked)" />
        </FormSection>

        <FormSection title="SWITCH">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} width={inner} height={28}>
            <Switch value={switched} onValueChange={setSwitched} />
            <Text fontSize={13} width={inner - 64} height={18} style={{ color: C.subtle }}>
              {switched ? 'On' : 'Off'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} width={inner} height={28}>
            <Switch value={true} disabled />
            <Text fontSize={13} width={inner - 64} height={18} style={{ color: C.dim }}>Disabled (on)</Text>
          </View>
        </FormSection>

        <FormSection title="RADIO GROUP">
          <RadioGroup value={radioVal} onValueChange={setRadioVal}>
            <Radio value="option_a" label="Option A" />
            <Radio value="option_b" label="Option B" />
            <Radio value="option_c" label="Option C" />
            <Radio value="option_d" label="Disabled option" disabled />
          </RadioGroup>
          <Text fontSize={12} width={inner} height={18} style={{ color: C.dim }}>
            {'Selected: ' + radioVal}
          </Text>
        </FormSection>

        <FormSection title="FILE INPUT (requires dialog capability)">
          <FileInput
            accept=".txt,.md,.json"
            onFilesSelected={paths => setPickedFile(paths[0])}
            label="Pick a text file…"
          />
          {pickedFile != null && (
            <Text fontSize={11} width={inner} height={16} style={{ color: C.teal }}>
              {pickedFile}
            </Text>
          )}
          <FileInput disabled label="Disabled picker" />
        </FormSection>

        <FormSection title="CREDENTIALS (OS keychain)">
          <Btn label="Test set / get / delete" onPress={testCredentials} width={200} color={C.mauve} />
          {credStatus ? (
            <Text fontSize={11} width={inner} height={16} style={{ color: C.green }}>{credStatus}</Text>
          ) : null}
        </FormSection>

        <FormSection title="SLIDER">
          <Slider
            value={sliderVal}
            onValueChange={setSliderVal}
            min={0} max={1} step={0.05}
            style={{ width: inner - 60 }}
          />
          <Text fontSize={12} width={inner} height={18} style={{ color: C.dim }}>
            {'Value: ' + sliderVal.toFixed(2)}
          </Text>
          <Slider value={0.6} disabled style={{ width: inner - 60 }} />
          <Text fontSize={11} width={inner} height={16} style={{ color: C.dim }}>Disabled</Text>
        </FormSection>

        <FormSection title="SELECT">
          <Select
            value={selectVal}
            options={[
              { label: 'Catppuccin Mocha', value: 'mocha' },
              { label: 'Catppuccin Latte', value: 'latte' },
              { label: 'Tokyo Night',      value: 'tokyo' },
              { label: 'Gruvbox Dark',     value: 'gruvbox' },
            ]}
            onValueChange={setSelectVal}
            placeholder="Pick a theme…"
            style={{ width: 300 }}
          />
          {selectVal && (
            <Text fontSize={12} width={inner} height={18} style={{ color: C.teal }}>
              {'Selected: ' + selectVal}
            </Text>
          )}
          <Select disabled placeholder="Disabled select" style={{ width: 300 }} />
        </FormSection>

        <FormSection title="DATE PICKER">
          <DatePicker
            value={dateVal}
            onValueChange={setDateVal}
            style={{ width: 300 }}
          />
          {dateVal && (
            <Text fontSize={12} width={inner} height={18} style={{ color: C.teal }}>
              {'Picked: ' + dateVal.toDateString()}
            </Text>
          )}
        </FormSection>

      </View>
    </ScrollView>
  );
}

// ── Screen: Audio Demo ────────────────────────────────────────────────────────
//
// Phase 16G — audio.play, pause, resume, stop, volume.

function AudioDemoScreen() {
  const { width: winW, height: winH } = useWindowSize();
  const navigate = useNavigate();
  const C = useThemeColors();
  const inner = winW - PAD * 2;

  const [player,  setPlayer]  = useState(null);
  const [playing, setPlaying] = useState(false);
  const [volume,  setVolume]  = useState(1.0);
  const [log,     setLog]     = useState([]);

  function addLog(msg) {
    setLog(prev => [msg, ...prev].slice(0, 10));
  }

  async function pickAndPlay() {
    try {
      const paths = await dialog.openFile({ filters: [{ name: 'Audio', extensions: ['mp3', 'flac', 'ogg', 'wav'] }], multiple: false });
      if (!paths || paths.length === 0) return;
      const src = paths[0];
      addLog('Playing: ' + src.split(/[\\/]/).pop());
      const p = await audio.play(src, {
        volume,
        onEnded: () => { setPlaying(false); addLog('Playback ended.'); },
      });
      setPlayer(p);
      setPlaying(true);
    } catch (e) {
      addLog('Error: ' + e);
    }
  }

  function handlePause() {
    if (!player) return;
    player.pause();
    setPlaying(false);
    addLog('Paused.');
  }

  function handleResume() {
    if (!player) return;
    player.resume();
    setPlaying(true);
    addLog('Resumed.');
  }

  function handleStop() {
    if (!player) return;
    player.stop();
    setPlayer(null);
    setPlaying(false);
    addLog('Stopped.');
  }

  function adjustVolume(delta) {
    const v = Math.max(0, Math.min(2, volume + delta));
    setVolume(v);
    if (player) player.setVolume(v);
    addLog('Volume: ' + Math.round(v * 100) + '%');
  }

  return (
    <ScrollView width={winW} height={winH - HEADER_H - PAD} contentHeight={600}>
      <View style={{ gap: 16, padding: PAD, alignItems: 'flex-start', justifyContent: 'flex-start' }} width={inner}>

        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }} width={inner} height={34}>
          <BackBtn />
          <Text fontSize={16} width={inner - 100} height={22} style={{ color: C.text }}>Audio Playback</Text>
        </View>

        <Text fontSize={12} width={inner} height={18} style={{ color: C.dim }}>
          Requires <Text fontSize={12} style={{ color: C.accent }}>audio: true</Text> + <Text fontSize={12} style={{ color: C.accent }}>dialog: true</Text> in velox.config.json
        </Text>

        {/* Transport controls */}
        <View style={{ flexDirection: 'row', gap: 8 }} width={inner} height={36}>
          <Btn label="Open file" onPress={pickAndPlay} width={100} color={C.teal} />
          <Btn label="Pause"  onPress={handlePause}  width={72} color={C.yellow} disabled={!playing} />
          <Btn label="Resume" onPress={handleResume} width={80} color={C.green}  disabled={playing || !player} />
          <Btn label="Stop"   onPress={handleStop}   width={72} color={C.red}    disabled={!player} />
        </View>

        {/* Volume control */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} width={inner} height={34}>
          <Text fontSize={12} width={60} height={18} style={{ color: C.subtle }}>Volume</Text>
          <Btn label="-10%" onPress={() => adjustVolume(-0.1)} width={60} color={C.dim} />
          <Text fontSize={13} width={48} height={18} style={{ color: C.text }}>{Math.round(volume * 100) + '%'}</Text>
          <Btn label="+10%" onPress={() => adjustVolume(+0.1)} width={60} color={C.dim} />
        </View>

        {/* Status */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }} width={inner} height={20}>
          <Text fontSize={11} width={60} height={16} style={{ color: C.dim }}>Status:</Text>
          <Text fontSize={11} width={inner - 72} height={16} style={{ color: player ? (playing ? C.green : C.yellow) : C.dim }}>
            {player ? (playing ? 'Playing' : 'Paused') : 'Stopped'}
          </Text>
        </View>

        {/* Log */}
        <View style={{ backgroundColor: C.surface, borderRadius: 6, padding: 10, gap: 4 }} width={inner}>
          <Text fontSize={10} width={inner - 20} height={14} style={{ color: C.dim }}>Log (newest first):</Text>
          {log.length === 0
            ? <Text fontSize={11} width={inner - 20} height={16} style={{ color: C.dim }}>No events yet.</Text>
            : log.map((l, i) => (
              <Text key={i} fontSize={11} width={inner - 20} height={16} style={{ color: C.subtle }}>{l}</Text>
            ))
          }
        </View>

      </View>
    </ScrollView>
  );
}

// ── Screen: Network Test ──────────────────────────────────────────────────────
//
// Demonstrates Phase 12 fetch binding.  Fires a GET and a POST request
// against the public JSONPlaceholder API and shows the raw response.

function NetworkTestScreen() {
  const { width: winW, height: winH } = useWindowSize();
  const navigate = useNavigate();
  const C = useThemeColors();

  const inner = winW - PAD * 2;
  const [getResult,  setGetResult]  = useState('');
  const [postResult, setPostResult] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  async function runGet() {
    setLoading(true); setError(''); setGetResult('');
    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/todos/1');
      const data = await res.json();
      setGetResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setError('GET failed: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function runPost() {
    setLoading(true); setError(''); setPostResult('');
    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Velox test', body: 'Hello from Velox fetch!', userId: 1 }),
      });
      const data = await res.json();
      setPostResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setError('POST failed: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      style={{ justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12 }}
      width={winW}
      height={winH - HEADER_H - PAD * 2}
    >
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }} width={inner} height={32}>
        <BackBtn />
        <Text fontSize={16} width={180} height={22} style={{ color: C.teal }}>Network Test (fetch)</Text>
        {loading && <Text fontSize={12} width={80} height={18} style={{ color: C.yellow }}>Loading…</Text>}
      </View>

      {error !== '' && (
        <Text fontSize={12} width={inner} height={18} style={{ color: C.red }}>{error}</Text>
      )}

      <Divider />

      {/* GET test */}
      <Text fontSize={13} width={inner} height={18} style={{ color: C.subtle }}>
        GET https://jsonplaceholder.typicode.com/todos/1
      </Text>
      <Btn label="Run GET" onPress={runGet} width={100} color={C.accent} disabled={loading} />
      {getResult !== '' && (
        <ScrollView width={inner} height={180} contentHeight={Math.max(180, getResult.split('\n').length * 18)}>
          <Text fontSize={12} width={inner - 12} height={getResult.split('\n').length * 18} style={{ color: C.text }}>
            {getResult}
          </Text>
        </ScrollView>
      )}

      <Divider />

      {/* POST test */}
      <Text fontSize={13} width={inner} height={18} style={{ color: C.subtle }}>
        POST https://jsonplaceholder.typicode.com/posts
      </Text>
      <Btn label="Run POST" onPress={runPost} width={110} color={C.mauve} disabled={loading} />
      {postResult !== '' && (
        <ScrollView width={inner} height={180} contentHeight={Math.max(180, postResult.split('\n').length * 18)}>
          <Text fontSize={12} width={inner - 12} height={postResult.split('\n').length * 18} style={{ color: C.text }}>
            {postResult}
          </Text>
        </ScrollView>
      )}

      {/* WebSocket echo test */}
      <Divider />
      <Text fontSize={13} width={inner} height={18} style={{ color: C.subtle }}>
        WebSocket echo test — wss://echo.websocket.org
      </Text>
      <WsTestBox width={inner} />

      {/* mDNS discovery test */}
      <Divider />
      <Text fontSize={13} width={inner} height={18} style={{ color: C.subtle }}>
        mDNS service discovery — browse local network services
      </Text>
      <MdnsTestBox width={inner} />

      {/* Multi-window + IPC test (Phase 13) */}
      <Divider />
      <Text fontSize={13} width={inner} height={18} style={{ color: C.subtle }}>
        Multi-window + IPC — open a child window and exchange messages
      </Text>
      <MultiWindowTestBox width={inner} />

      {/* TextInput test (Phase 11B) */}
      <Divider />
      <Text fontSize={13} width={inner} height={18} style={{ color: C.subtle }}>
        TextInput selection test (Phase 11B) — try Ctrl+A, Ctrl+C, Ctrl+V, arrows, shift+arrow
      </Text>
      <TextInputTestBox width={inner} />
    </View>
  );
}

function WsTestBox({ width }) {
  const C = useThemeColors();
  const [socket,   setSocket]   = useState(null);
  const [log,      setLog]      = useState([]);
  const [msgInput, setMsgInput] = useState('Hello from Velox WebSocket!');
  const [status,   setStatus]   = useState('disconnected');

  function addLog(line) {
    setLog(prev => [...prev.slice(-19), line]); // keep last 20 lines
  }

  async function connect() {
    setStatus('connecting…');
    try {
      const sock = await ws.connect('wss://echo.websocket.org', {
        onmessage: (ev) => addLog('← ' + ev.data),
        onclose:   ()   => { setStatus('disconnected'); setSocket(null); addLog('— connection closed'); },
      });
      setSocket(sock);
      setStatus('connected');
      addLog('— connected to wss://echo.websocket.org');
    } catch (e) {
      setStatus('error: ' + (e?.message ?? String(e)));
    }
  }

  function send() {
    if (!socket) return;
    socket.send(msgInput);
    addLog('→ ' + msgInput);
  }

  function disconnect() {
    socket?.close();
  }

  const logText = log.join('\n');
  const logLines = log.length;

  return (
    <View style={{ gap: 8, alignItems: 'flex-start' }} width={width} height={230}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }} width={width} height={30}>
        <Text fontSize={12} width={120} height={18} style={{ color: status === 'connected' ? C.green : C.dim }}>
          {status}
        </Text>
        {!socket ? (
          <Btn label="Connect" onPress={connect} width={90} color={C.teal} />
        ) : (
          <Btn label="Disconnect" onPress={disconnect} width={100} color={C.red} />
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }} width={width} height={36}>
        <TextInput
          value={msgInput}
          onChangeText={setMsgInput}
          placeholder="Message to send…"
          fontSize={13}
          width={width - 110}
          height={36}
        />
        <Btn label="Send" onPress={send} width={90} color={C.accent} disabled={!socket} />
      </View>
      <ScrollView width={width} height={140} contentHeight={Math.max(140, logLines * 18)}>
        <Text fontSize={12} width={width - 12} height={Math.max(140, logLines * 18)} style={{ color: C.text }}>
          {logText || '(no messages yet)'}
        </Text>
      </ScrollView>
    </View>
  );
}

function MdnsTestBox({ width }) {
  const C          = useThemeColors();
  const [busy,     setBusy]     = useState(false);
  const [svcType,  setSvcType]  = useState('_http._tcp.local.');
  const [timeout,  setTimeout_] = useState('4000');
  const [results,  setResults]  = useState(null);
  const [error,    setError]    = useState('');

  async function discover() {
    setBusy(true);
    setResults(null);
    setError('');
    try {
      const found = await mdns.discover(svcType.trim(), { timeout: Number(timeout) || 4000 });
      setResults(found);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const rowStyle = { flexDirection: 'row', alignItems: 'center', gap: 8 };

  return (
    <View style={{ gap: 8 }}>
      <View style={rowStyle}>
        <Text fontSize={12} width={70} height={20} style={{ color: C.subtle }}>Service:</Text>
        <TextInput
          value={svcType}
          onChangeText={setSvcType}
          width={width - 170}
          height={28}
          fontSize={12}
          style={{ flex: 1 }}
        />
        <Text fontSize={12} width={40} height={20} style={{ color: C.subtle }}>ms:</Text>
        <TextInput
          value={timeout}
          onChangeText={setTimeout_}
          width={60}
          height={28}
          fontSize={12}
        />
        <Pressable
          onPress={discover}
          style={{
            backgroundColor: busy ? C.dim : C.accent,
            borderRadius: 5,
            padding: 6,
          }}
        >
          <Text fontSize={12} height={16} style={{ color: '#fff' }}>
            {busy ? 'Scanning…' : 'Browse'}
          </Text>
        </Pressable>
      </View>

      {error ? (
        <Text fontSize={11} width={width} height={16} style={{ color: '#ff6b6b' }}>{error}</Text>
      ) : null}

      {results !== null && (
        results.length === 0 ? (
          <Text fontSize={12} width={width} height={18} style={{ color: C.dim }}>
            No services found
          </Text>
        ) : (
          <ScrollView width={width} height={120} style={{ backgroundColor: C.overlay, borderRadius: 6 }}>
            {results.map((s, i) => (
              <View key={i} style={{ padding: 6, gap: 2 }}>
                <Text fontSize={12} width={width - 20} height={16} style={{ color: C.text }}>
                  {s.name}
                </Text>
                <Text fontSize={11} width={width - 20} height={14} style={{ color: C.subtle }}>
                  {s.hostname}:{s.port} — {s.addresses.join(', ')}
                </Text>
              </View>
            ))}
          </ScrollView>
        )
      )}
    </View>
  );
}

// Multi-window IPC demo (Phase 13)
//
// Opens a child window running the same app. The main window sends a 'ping'
// IPC message to the child; the child's own MultiWindowTestBox auto-pongs
// back to handle 0, demonstrating bidirectional IPC.

function MultiWindowTestBox({ width }) {
  const C = useThemeColors();
  const [winHandle, setWinHandle] = useState(null);
  const [status,    setStatus]    = useState('not created');
  const [log,       setLog]       = useState([]);
  const [msgText,   setMsgText]   = useState('Hello from main window!');

  // Register IPC listener for the lifetime of this component.
  useEffect(() => {
    const unsub = ipc.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { msg = null; }

      if (msg && msg.type === 'ping') {
        // Auto-pong back to whichever window sent the ping.
        setLog(l => [...l, `← ping from ${msg.from}: "${msg.data}"`]);
        ipc.send(msg.from, JSON.stringify({ type: 'pong', from: 'child', data: 'Pong from child window!' }));
      } else {
        setLog(l => [...l, `← ${raw}`]);
      }
    });
    return unsub;
  }, []);

  async function openWindow() {
    setStatus('opening…');
    setLog([]);
    try {
      const win = await veloxWindow.create({ title: 'Velox IPC Child', width: 520, height: 460 });
      setWinHandle(win);
      setStatus(`opened (handle ${win.id})`);
      setLog(l => [...l, `Window opened (id=${win.id}). Sending ping…`]);
      win.send(JSON.stringify({ type: 'ping', from: 0, data: 'Hello from main window!' }));
    } catch (e) {
      setStatus('error: ' + String(e));
    }
  }

  function sendMsg() {
    if (!winHandle) return;
    winHandle.send(msgText);
    setLog(l => [...l, `→ ${msgText}`]);
  }

  const rowStyle = { flexDirection: 'row', alignItems: 'center', gap: 8 };

  return (
    <View style={{ gap: 8 }}>
      <View style={rowStyle}>
        <Btn
          label={winHandle ? 'Window open' : 'Open Child Window'}
          onPress={openWindow}
          width={160}
          color={winHandle ? C.dim : C.mauve}
          disabled={!!winHandle}
        />
        <Text fontSize={12} width={width - 176} height={20} style={{ color: C.subtle }}>{status}</Text>
      </View>

      {winHandle && (
        <View style={rowStyle}>
          <TextInput
            value={msgText}
            onChangeText={setMsgText}
            width={width - 96}
            height={28}
            fontSize={12}
          />
          <Btn label="Send" onPress={sendMsg} width={80} color={C.accent} />
        </View>
      )}

      {log.length > 0 && (
        <ScrollView
          width={width}
          height={Math.min(120, log.length * 18 + 12)}
          contentHeight={log.length * 18 + 12}
          style={{ backgroundColor: C.overlay, borderRadius: 6, padding: 6 }}
        >
          {log.map((line, i) => (
            <Text key={i} fontSize={11} width={width - 24} height={18} style={{ color: C.text }}>
              {line}
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function TextInputTestBox({ width }) {
  const C = useThemeColors();
  const [val, setVal] = useState('Hello, Velox! Edit me and try Ctrl+A to select all.');
  return (
    <TextInput
      value={val}
      onChangeText={setVal}
      placeholder="Type here to test cursor and selection…"
      fontSize={14}
      width={width}
      height={40}
    />
  );
}

// ── Screen: Canvas Demo ───────────────────────────────────────────────────────

// Isolated 3D canvas — angle3d state lives HERE so only this subtree
// re-renders at 30 fps.  The parent CanvasDemoScreen (Text, BackBtn, 2D
// canvas) is completely unaffected by the 3D animation loop.
// Exercises the upgraded 3D pipeline: multiple dynamic lights (ambient +
// directional + an orbiting point light + a spot light from above), a sphere
// (new UV vertex format), and an optional textured GLTF model. Set
// VELOX_DEMO_GLB to an absolute .glb/.gltf path to smoke-test the textured
// model path; otherwise the primitives alone validate the shader + light loop.
const DEMO_GLB = null; // e.g. 'C:/path/to/model.glb'

function Canvas3DDemo() {
  const c3dRef = React.useRef(null);
  const [angle3d, setAngle3d] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setAngle3d((a) => a + 0.02), 33);
    return () => clearInterval(id);
  }, []);

  // Orbiting point light position.
  const px = Math.cos(angle3d) * 1.8;
  const pz = Math.sin(angle3d) * 1.8;

  return (
    <Canvas3D
      ref={c3dRef}
      width={300}
      height={220}
      style={{ borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: '#0f1120' }}
    >
      <Scene canvasRef={c3dRef} background={[0.06, 0.067, 0.125, 1.0]}>
        <PerspectiveCamera position={[0, 1.4, 4.0]} target={[0, 0, 0]} fov={55} near={0.1} far={100} />
        <AmbientLight color={[1.0, 1.0, 1.0]} intensity={0.18} />
        <DirectionalLight direction={[-0.5, -1, -0.8]} color={[0.7, 0.7, 0.85]} intensity={0.5} />
        {/* Orbiting point light — warm, with distance falloff. */}
        <PointLight position={[px, 1.0, pz]} color={[1.0, 0.6, 0.3]} intensity={2.2} range={6} />
        {/* Spot light from above pointing down — cool cone. */}
        <SpotLight position={[0, 3.0, 0]} direction={[0, -1, 0]} color={[0.4, 0.7, 1.0]}
                   intensity={2.5} range={8} innerDeg={18} outerDeg={30} />
        <Mesh geometry="box"    position={[-0.9, 0, 0]} rotation={[0, angle3d, 0]} color={[0.39, 0.55, 1.0, 1.0]} />
        <Mesh geometry="sphere" position={[ 0.9, 0, 0]} scale={0.7}                color={[0.9, 0.9, 0.95, 1.0]} />
        <Mesh geometry="plane"  position={[0, -0.5, 0]} scale={[4, 1, 4]}          color={[0.157, 0.176, 0.275, 1.0]} />
        {DEMO_GLB && <Model src={DEMO_GLB} position={[0, 0, 0]} scale={1} rotation={[0, angle3d, 0]} />}
      </Scene>
    </Canvas3D>
  );
}

function CanvasDemoScreen() {
  const { width: winW } = useWindowSize();
  const inner = winW - PAD * 2;

  // 2D canvas — imperative, never triggers React re-renders.
  const canvasRef = React.useRef(null);
  const angleRef  = React.useRef(0);

  useEffect(() => {
    let raf;
    function loop() {
      const ctx = canvasRef.current;
      if (ctx) {
        const t = angleRef.current;
        angleRef.current += 0.04;

        ctx.clear();

        // Background grid
        ctx.strokeStyle = '#1e2030';
        ctx.lineWidth   = 1;
        for (let x = 0; x <= 300; x += 30)  ctx.strokeLine(x, 0, x, 200);
        for (let y = 0; y <= 200; y += 30)  ctx.strokeLine(0, y, 300, y);

        // Rotating coloured rectangles
        const cx = 150 + Math.cos(t) * 60;
        const cy = 100 + Math.sin(t) * 40;
        ctx.fillStyle   = [100, 140, 255, 200];
        ctx.fillRect(cx - 20, cy - 15, 40, 30);

        const cx2 = 150 + Math.cos(t + 2) * 60;
        const cy2 = 100 + Math.sin(t + 2) * 40;
        ctx.fillStyle   = [255, 100, 140, 200];
        ctx.fillRect(cx2 - 20, cy2 - 15, 40, 30);

        // Pulsing circle
        const r = 18 + Math.sin(t * 2) * 8;
        ctx.fillStyle   = [120, 220, 160, 220];
        ctx.fillCircle(150, 100, r);

        // Spoke lines from centre
        ctx.strokeStyle = [255, 200, 80, 180];
        ctx.lineWidth   = 2;
        for (let i = 0; i < 6; i++) {
          const a = t + i * Math.PI / 3;
          ctx.strokeLine(150, 100, 150 + Math.cos(a) * 70, 100 + Math.sin(a) * 70);
        }

        // Stroke circle outline
        ctx.strokeStyle = [200, 200, 255, 120];
        ctx.lineWidth   = 1;
        ctx.strokeCircle(150, 100, 70);

        // ── Path API: filled area wave along the bottom ──
        ctx.beginPath();
        ctx.moveTo(0, 200);
        for (let x = 0; x <= 300; x += 10) {
          ctx.lineTo(x, 172 + Math.sin(x * 0.045 + t * 2) * 12);
        }
        ctx.lineTo(300, 200);
        ctx.closePath();
        ctx.fillStyle = [80, 160, 255, 90];
        ctx.fill();

        // Path API: animated pie wedge via arc()
        ctx.beginPath();
        ctx.moveTo(40, 40);
        ctx.arc(40, 40, 26, -Math.PI / 2, -Math.PI / 2 + (1.4 + Math.sin(t) * 0.9));
        ctx.closePath();
        ctx.fillStyle = [255, 180, 80, 220];
        ctx.fill();

        // Path API: smooth bezier stroke
        ctx.beginPath();
        ctx.moveTo(215, 38);
        ctx.bezierCurveTo(248, 10 + Math.sin(t) * 12, 270, 66, 296, 34);
        ctx.strokeStyle = [160, 240, 200, 230];
        ctx.lineWidth   = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle   = [220, 230, 255, 255];
        ctx.fillText('Canvas 2D + paths', 6, 6, 13);

        ctx.flush();
      }
      raf = setTimeout(loop, 16);
    }
    loop();
    return () => clearTimeout(raf);
  }, []);

  return (
    <ScrollView width={inner} height={600} style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackBtn />
        <Text fontSize={18} height={24} style={{ color: C.text }}>Canvas Demo</Text>
      </View>

      {/* 2D Canvas */}
      <Text fontSize={13} width={inner} height={18} style={{ color: C.dim }}>
        2D Canvas — Vello primitives, animated each frame
      </Text>
      <Canvas
        ref={canvasRef}
        width={300}
        height={200}
        style={{ borderRadius: 8, borderWidth: 1, borderColor: C.border }}
      />

      {/* 3D Canvas — isolated component so its 30 fps state updates don't
          re-render the 2D canvas, header, or Text nodes above. */}
      <Text fontSize={13} width={inner} height={18} style={{ color: C.dim }}>
        3D Canvas — declarative @velox/three (R3F-style)
      </Text>
      <Canvas3DDemo />
    </ScrollView>
  );
}

// ── Screen: AI Demo ───────────────────────────────────────────────────────────

const AI_TABS = ['Embed', 'Generate', 'Transcribe'];

function AiDemoScreen() {
  const { width: winW } = useWindowSize();
  const inner = winW - PAD * 2;
  const C = useThemeColors();

  const [tab,      setTab]      = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState('');
  const [error,    setError]    = useState('');

  // Embed tab
  const [embedText, setEmbedText] = useState('The quick brown fox jumps over the lazy dog.');

  // Generate tab
  const [prompt,      setPrompt]      = useState('Write a haiku about a Rust crate that renders UI:');
  const [maxTokens,   setMaxTokens]   = useState(80);
  const [temperature, setTemperature] = useState(0.7);

  // Transcribe tab
  const [audioPath, setAudioPath] = useState('');

  function reset() { setResult(''); setError(''); }

  async function runEmbed() {
    reset(); setLoading(true);
    try {
      const vec = await ai.embed(embedText);
      const preview = vec.slice(0, 8).map(v => v.toFixed(4)).join(', ');
      setResult(`384-dim vector (first 8):\n[${preview}, …]\n\nL2 norm ≈ ${Math.sqrt(vec.reduce((s, v) => s + v * v, 0)).toFixed(6)}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runGenerate() {
    reset(); setLoading(true);
    try {
      const text = await ai.generate(prompt, { maxTokens, temperature });
      setResult(text);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runTranscribe() {
    if (!audioPath) { setError('Pick an audio file first.'); return; }
    reset(); setLoading(true);
    try {
      const transcript = await ai.transcribe(audioPath);
      setResult(transcript || '(no speech detected)');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function pickAudio() {
    try {
      const paths = await dialog.openFile({ title: 'Pick audio file', multiple: false });
      if (paths && paths.length > 0) setAudioPath(paths[0]);
    } catch (e) { /* ignore */ }
  }

  return (
    <ScrollView width={inner} height={620} style={{ gap: 16 }}>
      <Text fontSize={18} width={inner} height={24} style={{ color: C.text }}>
        Local AI Demo
      </Text>
      <Text fontSize={12} width={inner} height={16} style={{ color: C.dim }}>
        Models download from HuggingFace Hub on first call and cache locally.
      </Text>

      {/* Tab bar */}
      <View style={{ flexDirection: 'row', gap: 8 }} width={inner} height={34}>
        {AI_TABS.map((label, i) => (
          <Pressable
            key={label}
            onPress={() => { setTab(i); reset(); }}
            width={100}
            height={32}
            style={{
              backgroundColor: tab === i ? C.accent : C.surface,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: tab === i ? C.accent : C.border,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text fontSize={13} width={84} height={18} style={{ color: tab === i ? C.bg : C.text }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Embed tab */}
      {tab === 0 && (
        <View style={{ gap: 10 }} width={inner} height={280}>
          <Text fontSize={12} width={inner} height={16} style={{ color: C.dim }}>
            MiniLM-L6-v2 · 384 dims · ~22 MB · ~1s after first download
          </Text>
          <TextInput
            value={embedText}
            onChangeText={setEmbedText}
            placeholder="Text to embed…"
            width={inner}
            height={60}
            multiline
            style={{ backgroundColor: C.surface, borderRadius: 6, borderColor: C.border, borderWidth: 1, padding: 8, color: C.text, fontSize: 13 }}
          />
          <Pressable
            onPress={runEmbed}
            width={120}
            height={32}
            style={{ backgroundColor: loading ? C.border : C.accent, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text fontSize={13} width={100} height={18} style={{ color: C.bg }}>
              {loading ? 'Embedding…' : 'Embed'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Generate tab */}
      {tab === 1 && (
        <View style={{ gap: 10 }} width={inner} height={280}>
          <Text fontSize={12} width={inner} height={16} style={{ color: C.dim }}>
            Phi-2 Q4_K_M · CPU · ~1.7 GB · 10-30s per 200 tokens
          </Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Prompt…"
            width={inner}
            height={70}
            multiline
            style={{ backgroundColor: C.surface, borderRadius: 6, borderColor: C.border, borderWidth: 1, padding: 8, color: C.text, fontSize: 13 }}
          />
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }} width={inner} height={28}>
            <Text fontSize={12} width={80} height={16} style={{ color: C.dim }}>
              {`Tokens: ${maxTokens}`}
            </Text>
            <Slider
              value={maxTokens}
              onValueChange={v => setMaxTokens(Math.round(v))}
              min={20} max={400} step={10}
              style={{ flex: 1 }}
            />
            <Text fontSize={12} width={80} height={16} style={{ color: C.dim }}>
              {`Temp: ${temperature.toFixed(2)}`}
            </Text>
            <Slider
              value={temperature}
              onValueChange={v => setTemperature(Math.round(v * 100) / 100)}
              min={0} max={1.5} step={0.05}
              style={{ flex: 1 }}
            />
          </View>
          <Pressable
            onPress={runGenerate}
            width={140}
            height={32}
            style={{ backgroundColor: loading ? C.border : C.green, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text fontSize={13} width={120} height={18} style={{ color: C.bg }}>
              {loading ? 'Generating…' : 'Generate'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Transcribe tab */}
      {tab === 2 && (
        <View style={{ gap: 10 }} width={inner} height={280}>
          <Text fontSize={12} width={inner} height={16} style={{ color: C.dim }}>
            Whisper-tiny · ~75 MB · ~5s for 30s clip · 16kHz WAV preferred
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }} width={inner} height={34}>
            <Pressable
              onPress={pickAudio}
              width={130}
              height={30}
              style={{ backgroundColor: C.surface, borderRadius: 6, borderColor: C.border, borderWidth: 1, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text fontSize={12} width={110} height={16} style={{ color: C.accent }}>
                Pick Audio File
              </Text>
            </Pressable>
            <Text fontSize={11} width={inner - 148} height={16} style={{ color: C.dim }}>
              {audioPath || 'No file selected'}
            </Text>
          </View>
          <Pressable
            onPress={runTranscribe}
            width={130}
            height={32}
            style={{ backgroundColor: loading ? C.border : C.teal, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text fontSize={13} width={110} height={18} style={{ color: C.bg }}>
              {loading ? 'Transcribing…' : 'Transcribe'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Result / error area */}
      {(result || error) && (
        <View
          style={{
            backgroundColor: error ? '#2a1018' : C.surface,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: error ? C.red : C.border,
            padding: 12,
          }}
          width={inner}
          height={140}
        >
          <ScrollView width={inner - 24} height={116}>
            <Text fontSize={12} width={inner - 32} height={0} style={{ color: error ? C.red : C.text }}>
              {error || result}
            </Text>
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

// ── Screen: Media (Camera + Microphone) ───────────────────────────────────────

const MEDIA_TABS = ['Camera', 'Microphone', 'Video'];

function MediaDemoScreen() {
  const { width: winW } = useWindowSize();
  const inner = winW - PAD * 2;
  const C = useThemeColors();

  const [tab, setTab] = useState(0);

  // ── Camera tab ───────────────────────────────────────────────────────────────
  const camRef = React.useRef(null);
  const [devices,   setDevices]   = useState([]);
  const [camOpen,   setCamOpen]   = useState(false);
  const [mirror,    setMirror]    = useState(false);
  const [recording, setRecording] = useState(false);
  const [photoPath, setPhotoPath] = useState('');
  const [videoPath, setVideoPath] = useState('');
  const [camError,  setCamError]  = useState('');

  useEffect(() => {
    camera.listDevices().then(setDevices).catch(() => {});
  }, []);

  async function startCamera() {
    setCamError(''); setPhotoPath(''); setVideoPath('');
    try {
      await camRef.current.start(0);
      setCamOpen(true);
    } catch (e) { setCamError(String(e)); }
  }

  function stopCamera() {
    if (recording) handleStopRecord().catch(() => {});
    if (camRef.current) camRef.current.stop();
    setCamOpen(false); setRecording(false);
  }

  async function handleCapture() {
    setCamError(''); setPhotoPath('');
    try {
      const path = await camRef.current.capture();
      setPhotoPath(path);
    } catch (e) { setCamError(String(e)); }
  }

  function handleStartRecord() {
    const ts  = Date.now();
    const dir = typeof __velox_tmp_dir !== 'undefined' ? __velox_tmp_dir : '/tmp';
    const out = `${dir}/velox_rec_${ts}.mp4`;
    setCamError(''); setVideoPath('');
    try {
      camRef.current.startRecord(out);
      setRecording(true);
    } catch (e) { setCamError(String(e)); }
  }

  async function handleStopRecord() {
    try {
      const path = await camRef.current.stopRecord();
      setVideoPath(path);
      setRecording(false);
      // Auto-switch to Video tab so the user can preview the recording.
      setVidSrc(path);
      setVidInput(path);
      setTab(2);
    } catch (e) { setCamError(String(e)); setRecording(false); }
  }

  // ── Microphone tab ───────────────────────────────────────────────────────────
  const [micLoading, setMicLoading] = useState(false);
  const [micPath,    setMicPath]    = useState('');
  const [micError,   setMicError]   = useState('');
  // Mic audio player state
  const micPlayerRef              = React.useRef(null);
  const micSeekingRef             = React.useRef(false); // suppress poll snapback during seek
  const [micPaused,  setMicPaused]   = useState(true);
  const [micTime,    setMicTime]     = useState(0);
  const [micDur,     setMicDur]      = useState(-1);
  const [micVolume,  setMicVolume]   = useState(1.0);

  // Poll audio position while playing (250ms recursive setTimeout)
  React.useEffect(() => {
    if (!micPaused && micPlayerRef.current) {
      let active = true;
      const poll = () => {
        if (!active || !micPlayerRef.current) return;
        if (!micSeekingRef.current) setMicTime(micPlayerRef.current.getTime());
        setTimeout(poll, 250);
      };
      const id = setTimeout(poll, 250);
      return () => { active = false; clearTimeout(id); };
    }
  }, [micPaused]);

  // ── Video tab ─────────────────────────────────────────────────────────────────
  const vidRef            = React.useRef(null);
  const vidSeekingRef     = React.useRef(false); // suppress timeupdate snapback during seek
  const [vidSrc,          setVidSrc]          = useState('');
  const [vidInput,        setVidInput]        = useState('');
  const [vidStatus,       setVidStatus]       = useState('');
  const [vidError,        setVidError]        = useState('');
  const [vidMeta,         setVidMeta]         = useState(null);
  const [vidCurrentTime,  setVidCurrentTime]  = useState(0);
  const [vidVolume,       setVidVolume]       = useState(1.0);
  const [vidPaused,       setVidPaused]       = useState(false);

  async function recordMic() {
    setMicLoading(true); setMicError(''); setMicPath('');
    // Stop any existing player first
    if (micPlayerRef.current) { micPlayerRef.current.stop(); micPlayerRef.current = null; }
    setMicPaused(true); setMicTime(0); setMicDur(-1);
    try {
      const path = await microphone.record(5000);
      setMicPath(path);
    } catch (e) { setMicError(String(e)); }
    finally { setMicLoading(false); }
  }

  async function playMic() {
    if (!micPath) return;
    try {
      if (micPlayerRef.current) { micPlayerRef.current.stop(); micPlayerRef.current = null; }
      setMicTime(0); setMicDur(-1); setMicPaused(true); // ensure true before transition
      const player = await audio.play(micPath, {
        onEnded: () => { setMicPaused(true); micPlayerRef.current = null; setMicTime(0); },
      });
      micPlayerRef.current = player;
      let dur = -1;
      try { dur = await player.getDuration(); } catch (_) {}
      // Fallback: microphone records exactly 5 seconds; use that if getDuration() fails.
      if (!(dur > 0)) dur = 5.0;
      setMicDur(dur);
      setMicPaused(false); // now the effect fires with micPlayerRef.current already set
    } catch (e) { setMicError(String(e)); setMicPaused(true); }
  }

  function pauseResumeMic() {
    if (!micPlayerRef.current) return;
    if (micPaused) { micPlayerRef.current.play(); setMicPaused(false); }
    else           { micPlayerRef.current.pause(); setMicPaused(true); }
  }

  function stopMic() {
    if (micPlayerRef.current) { micPlayerRef.current.stop(); micPlayerRef.current = null; }
    setMicPaused(true); setMicTime(0);
  }

  return (
    <ScrollView width={inner} height={650}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} width={inner} height={28}>
        <BackBtn />
        <Text fontSize={18} height={24} style={{ color: C.text }}>Media</Text>
      </View>

      {/* Tab row */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }} width={inner} height={36}>
        {MEDIA_TABS.map((t, i) => (
          <Pressable key={i} onPress={() => setTab(i)} width={110} height={32}
            style={{ backgroundColor: tab === i ? C.accent : C.surface, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
            <Text fontSize={13} width={98} height={18} style={{ color: tab === i ? C.bg : C.text }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Camera tab ── */}
      {tab === 0 && (
        <View style={{ gap: 10, alignItems: 'flex-start' }} width={inner} height={620}>

          {/* Live preview */}
          <Camera ref={camRef} mirror={mirror}
            style={{ width: inner, height: 400, borderRadius: 8, backgroundColor: '#000' }} />

          {/* Controls row 1: start/stop + mirror */}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }} width={inner} height={34}>
            <Pressable onPress={startCamera} width={70} height={30}
              style={{ backgroundColor: camOpen ? C.border : C.green, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text fontSize={12} width={58} height={16} style={{ color: C.bg }}>Start</Text>
            </Pressable>
            <Pressable onPress={stopCamera} width={70} height={30}
              style={{ backgroundColor: camOpen ? C.red : C.border, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text fontSize={12} width={58} height={16} style={{ color: C.bg }}>Stop</Text>
            </Pressable>
            <Pressable onPress={() => setMirror(m => !m)} width={90} height={30}
              style={{ backgroundColor: mirror ? C.accent : C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }}>
              <Text fontSize={12} width={78} height={16} style={{ color: mirror ? C.bg : C.text }}>
                {mirror ? 'Mirror ON' : 'Mirror OFF'}
              </Text>
            </Pressable>
            <Text fontSize={11} width={inner - 258} height={16} style={{ color: C.dim }}>
              {devices.length > 0 ? devices[0].name : 'No cameras'}
            </Text>
          </View>

          {/* Controls row 2: photo + record */}
          <View style={{ flexDirection: 'row', gap: 8 }} width={inner} height={34}>
            <Pressable onPress={handleCapture} width={100} height={30}
              style={{ backgroundColor: camOpen ? C.sapphire : C.border, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text fontSize={12} width={88} height={16} style={{ color: C.bg }}>Take Photo</Text>
            </Pressable>
            {!recording ? (
              <Pressable onPress={handleStartRecord} width={110} height={30}
                style={{ backgroundColor: camOpen ? C.mauve : C.border, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
                <Text fontSize={12} width={98} height={16} style={{ color: C.bg }}>Record MP4</Text>
              </Pressable>
            ) : (
              <Pressable onPress={handleStopRecord} width={110} height={30}
                style={{ backgroundColor: C.red, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
                <Text fontSize={12} width={98} height={16} style={{ color: C.bg }}>Stop Record</Text>
              </Pressable>
            )}
          </View>

          {/* Photo preview */}
          {photoPath ? (
            <View style={{ gap: 6 }} width={inner} height={246}>
              <Text fontSize={11} width={inner} height={14} style={{ color: C.teal }}>
                Captured: {photoPath}
              </Text>
              <Image src={photoPath} width={inner} height={228} resizeMode="contain" />
            </View>
          ) : null}
          {/* Video recorded — tap Stop Record to auto-switch to Video tab */}
          {videoPath ? (
            <Text fontSize={11} width={inner} height={14} style={{ color: C.teal }}>
              Recorded: {videoPath} (switched to Video tab)
            </Text>
          ) : null}
          {camError ? (
            <Text fontSize={12} width={inner} height={20} style={{ color: C.red }}>{camError}</Text>
          ) : null}
        </View>
      )}

      {/* ── Microphone tab ── */}
      {tab === 1 && (
        <View style={{ gap: 12, alignItems: 'flex-start' }} width={inner} height={480}>
          <Text fontSize={14} width={inner} height={20} style={{ color: C.text }}>
            Record 5 seconds from the default microphone, then play it back.
          </Text>

          {/* Record button */}
          <Pressable onPress={recordMic} width={110} height={32}
            style={{ backgroundColor: micLoading ? C.border : C.teal, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
            <Text fontSize={13} width={96} height={18} style={{ color: C.bg }}>
              {micLoading ? 'Recording…' : 'Record 5s'}
            </Text>
          </Pressable>

          {/* Player (shown once a recording exists) */}
          {micPath ? (() => {
            const hasDur = micDur > 0;
            const fmtT   = s => { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
            const isActive = !!micPlayerRef.current;
            return (
              <View style={{ gap: 8 }} width={inner} height={164}>
                {/* File path */}
                <Text fontSize={11} width={inner} height={14} style={{ color: C.dim }}>{micPath}</Text>

                {/* Progress slider — draggable pin, click to seek */}
                <Slider
                  value={micTime}
                  min={0} max={micDur > 0 ? micDur : 5} step={0}
                  disabled={!micPlayerRef.current}
                  onChange={v => {
                    micSeekingRef.current = true;
                    clearTimeout(micSeekingRef._t);
                    micSeekingRef._t = setTimeout(() => { micSeekingRef.current = false; }, 500);
                    micPlayerRef.current?.seek(v);
                    setMicTime(v);
                  }}
                  width={inner} height={24}
                />

                {/* Time label */}
                <Text fontSize={11} width={inner} height={14} style={{ color: C.dim }}>
                  {hasDur ? `${fmtT(micTime)} / ${fmtT(micDur)}` : micTime > 0 ? fmtT(micTime) : '0:00'}
                </Text>

                {/* Transport row: Play, Pause/Resume, Stop, -10s, +10s */}
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }} width={inner} height={32}>
                  {/* Play (fresh start) */}
                  <Pressable onPress={playMic} width={56} height={30}
                    style={{ backgroundColor: C.green, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
                    <Text fontSize={12} width={44} height={16} style={{ color: C.bg }}>Play</Text>
                  </Pressable>
                  {/* Pause / Resume */}
                  <Pressable onPress={pauseResumeMic} width={70} height={30}
                    style={{ backgroundColor: isActive ? C.accent : C.border, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
                    <Text fontSize={12} width={58} height={16} style={{ color: C.bg }}>
                      {micPaused ? 'Resume' : 'Pause'}
                    </Text>
                  </Pressable>
                  {/* Stop */}
                  <Pressable onPress={stopMic} width={52} height={30}
                    style={{ backgroundColor: isActive ? C.red : C.border, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
                    <Text fontSize={12} width={40} height={16} style={{ color: C.bg }}>Stop</Text>
                  </Pressable>
                  {/* -10s */}
                  <Pressable onPress={async () => { if (micPlayerRef.current) { const t = Math.max(0, micTime - 10); await micPlayerRef.current.seek(t); setMicTime(t); } }}
                    width={44} height={30}
                    style={{ backgroundColor: C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }}>
                    <Text fontSize={12} width={36} height={16} style={{ color: C.text }}>-10s</Text>
                  </Pressable>
                  {/* +10s */}
                  <Pressable onPress={async () => { if (micPlayerRef.current) { const t = micTime + 10; await micPlayerRef.current.seek(t); setMicTime(t); } }}
                    width={44} height={30}
                    style={{ backgroundColor: C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }}>
                    <Text fontSize={12} width={36} height={16} style={{ color: C.text }}>+10s</Text>
                  </Pressable>
                </View>

                {/* Volume row */}
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }} width={inner} height={28}>
                  <Text fontSize={12} width={52} height={16} style={{ color: C.dim }}>Vol</Text>
                  <Slider
                    value={micVolume}
                    min={0} max={1} step={0.05}
                    onChange={v => {
                      setMicVolume(v);
                      micPlayerRef.current?.setVolume(v);
                    }}
                    width={inner - 62} height={28}
                  />
                  <Text fontSize={11} width={32} height={16} style={{ color: C.dim }}>
                    {Math.round(micVolume * 100)}%
                  </Text>
                </View>
              </View>
            );
          })() : null}

          {micError ? (
            <Text fontSize={12} width={inner} height={20} style={{ color: C.red }}>{micError}</Text>
          ) : null}
        </View>
      )}

      {/* ── Video tab ── */}
      {tab === 2 && (
        <View style={{ gap: 10, alignItems: 'flex-start' }} width={inner} height={660}>
          <Text fontSize={13} width={inner} height={18} style={{ color: C.dim }}>
            Pick a video file or type a URL. Requires velox-media DLL.
          </Text>

          {/* File picker + URL input row */}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }} width={inner} height={36}>
            <Pressable
              onPress={async () => {
                try {
                  const paths = await dialog.openFile({
                    filters: [
                      { name: 'Video', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v'] },
                      { name: 'All files', extensions: ['*'] },
                    ],
                  });
                  if (paths && paths.length > 0) {
                    setVidError(''); setVidStatus(''); setVidMeta(null);
                    setVidInput(paths[0]);
                    setVidSrc(paths[0]);
                  }
                } catch (e) { setVidError(String(e)); }
              }}
              width={90} height={32}
              style={{ backgroundColor: C.sapphire, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text fontSize={13} width={78} height={18} style={{ color: C.bg }}>Browse…</Text>
            </Pressable>
            <TextInput
              value={vidInput}
              onChangeText={v => { setVidInput(v); }}
              placeholder="or paste a URL / path"
              width={inner - 186} height={32}
              style={{ backgroundColor: C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.border, paddingHorizontal: 8 }}
            />
            <Pressable
              onPress={() => { setVidError(''); setVidStatus(''); setVidMeta(null); setVidSrc(vidInput.trim()); }}
              width={78} height={32}
              style={{ backgroundColor: C.accent, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text fontSize={13} width={66} height={18} style={{ color: C.bg }}>Load</Text>
            </Pressable>
          </View>

          {/* Native video node — frames stay in Rust, JS only manages lifecycle */}
          <Video
            ref={vidRef}
            src={vidSrc || undefined}
            autoPlay
            loop={false}
            onMetadata={m => { setVidMeta(m); setVidCurrentTime(0); setVidPaused(false); }}
            onTimeUpdate={t => { if (!vidSeekingRef.current) setVidCurrentTime(t); }}
            onEnded={() => { setVidStatus('Playback ended'); setVidPaused(true); }}
            onError={e => setVidError(String(e))}
            style={{ width: inner, height: 360, borderRadius: 8, backgroundColor: '#000' }}
          />

          {/* Progress slider + time */}
          {(() => {
            const dur    = vidMeta?.durationSecs ?? -1;
            const hasDur = dur > 0;
            const fmtT   = s => { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2,'0')}`; };
            return (
              <View style={{ gap: 6 }} width={inner} height={38}>
                {/* Draggable seek slider */}
                <Slider
                  value={vidCurrentTime}
                  min={0} max={Math.max(dur > 0 ? dur : 7200, vidCurrentTime + 1)} step={0}
                  disabled={!vidRef.current?.handle}
                  onChange={v => {
                    vidSeekingRef.current = true;
                    clearTimeout(vidSeekingRef._t);
                    vidSeekingRef._t = setTimeout(() => { vidSeekingRef.current = false; }, 500);
                    vidRef.current?.seek(v);
                    setVidCurrentTime(v);
                  }}
                  width={inner} height={24}
                />
                {/* Time label */}
                <Text fontSize={11} width={inner} height={14} style={{ color: C.dim }}>
                  {hasDur
                    ? `${fmtT(vidCurrentTime)} / ${fmtT(dur)}`
                    : vidCurrentTime > 0 ? fmtT(vidCurrentTime) : ''}
                </Text>
              </View>
            );
          })()}

          {/* Transport + volume row */}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} width={inner} height={36}>
            {/* Pause / Play */}
            <Pressable
              onPress={() => {
                if (vidPaused) { vidRef.current?.play();  setVidPaused(false); }
                else           { vidRef.current?.pause(); setVidPaused(true);  }
              }}
              width={62} height={30}
              style={{ backgroundColor: C.accent, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text fontSize={12} width={50} height={16} style={{ color: C.bg }}>
                {vidPaused ? 'Play' : 'Pause'}
              </Text>
            </Pressable>
            {/* −15s */}
            <Pressable onPress={() => vidRef.current?.seek(Math.max(0, vidCurrentTime - 15))}
              width={44} height={30}
              style={{ backgroundColor: C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }}>
              <Text fontSize={12} width={36} height={16} style={{ color: C.text }}>-15s</Text>
            </Pressable>
            {/* +15s */}
            <Pressable onPress={() => vidRef.current?.seek(vidCurrentTime + 15)}
              width={44} height={30}
              style={{ backgroundColor: C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }}>
              <Text fontSize={12} width={36} height={16} style={{ color: C.text }}>+15s</Text>
            </Pressable>
            {/* Volume label + slider */}
            <Text fontSize={11} width={28} height={16} style={{ color: C.dim }}>Vol</Text>
            <Slider
              min={0} max={1} step={0.05}
              value={vidVolume}
              onChange={v => {
                setVidVolume(v);
                vidRef.current?.setVolume(v);
              }}
              style={{ width: 100, height: 30 }}
            />
            <Text fontSize={11} width={28} height={16} style={{ color: C.dim }}>
              {Math.round(vidVolume * 100)}%
            </Text>
            {/* Close */}
            <Pressable
              onPress={() => { vidRef.current?.close(); setVidSrc(''); setVidStatus(''); setVidMeta(null); setVidCurrentTime(0); setVidPaused(false); }}
              width={52} height={30}
              style={{ backgroundColor: C.red, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text fontSize={12} width={40} height={16} style={{ color: C.bg }}>Close</Text>
            </Pressable>
          </View>

          {/* Metadata / status */}
          {vidMeta ? (
            <Text fontSize={11} width={inner} height={14} style={{ color: C.dim }}>
              {`${vidMeta.width ?? '?'}×${vidMeta.height ?? '?'}  ${(vidMeta.fps ?? 0).toFixed(1)}fps`}
            </Text>
          ) : null}
          {vidStatus ? (
            <Text fontSize={12} width={inner} height={18} style={{ color: C.teal }}>{vidStatus}</Text>
          ) : null}
          {vidError ? (
            <Text fontSize={12} width={inner} height={20} style={{ color: C.red }}>{vidError}</Text>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

// ── Screen: Packages Demo (@velox/keychain + @velox/store) ────────────────────

// Module-level singletons — created once, shared across all renders.
const appChain   = createTypedKeychain('demo', { apiKey: null, sessionToken: null });
const useCounter = createStore('counter', { count: 0, lastReset: '' });

function PackagesDemoScreen() {
  const { width: winW } = useWindowSize();
  const inner = winW - PAD * 2;
  const C = useThemeColors();

  // ── @velox/keychain demo ───────────────────────────────────────────────────
  const [kcInput,  setKcInput]  = useState('');
  const [kcStored, setKcStored] = useState(null);
  const [kcStatus, setKcStatus] = useState('');

  async function kcSave() {
    setKcStatus('');
    try {
      await appChain.set('apiKey', kcInput.trim());
      setKcStatus('Saved to OS keychain ✓');
      setKcInput('');
    } catch (e) { setKcStatus('Save error: ' + String(e)); }
  }

  async function kcLoad() {
    setKcStatus('');
    try {
      const val = await appChain.get('apiKey');
      setKcStored(val);
      setKcStatus(val === null ? 'No value stored yet.' : 'Loaded from OS keychain ✓');
    } catch (e) { setKcStatus('Load error: ' + String(e)); }
  }

  async function kcClear() {
    try {
      await appChain.clear();
      setKcStored(null);
      setKcStatus('Cleared ✓');
    } catch (e) { setKcStatus('Clear error: ' + String(e)); }
  }

  // ── @velox/store demo ──────────────────────────────────────────────────────
  const { state: ctr, set: setCtr, reset: resetCtr, hydrated } = useCounter();

  return (
    <ScrollView width={inner} height={600} style={{ gap: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} width={inner} height={28}>
        <BackBtn />
        <Text fontSize={18} height={24} style={{ color: C.text }}>Packages</Text>
      </View>

      {/* @velox/keychain ────────────────────────────────────────────────── */}
      <Text fontSize={15} width={inner} height={20} style={{ color: C.accent }}>@velox/keychain</Text>
      <Text fontSize={12} width={inner} height={16} style={{ color: C.dim }}>
        Typed namespace-scoped wrapper over the OS credential store (DPAPI / Keychain / Secret Service).
      </Text>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }} width={inner} height={34}>
        <TextInput
          value={kcInput}
          onChangeText={setKcInput}
          placeholder="Enter a value to store as apiKey…"
          width={inner - 100} height={32}
          style={{ backgroundColor: C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.border, paddingHorizontal: 8 }}
        />
        <Pressable onPress={kcSave} width={84} height={32}
          style={{ backgroundColor: C.accent, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
          <Text fontSize={13} width={72} height={18} style={{ color: C.bg }}>Save</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }} width={inner} height={32}>
        <Pressable onPress={kcLoad} width={100} height={32}
          style={{ backgroundColor: C.sapphire, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
          <Text fontSize={13} width={88} height={18} style={{ color: C.bg }}>Load apiKey</Text>
        </Pressable>
        <Pressable onPress={kcClear} width={80} height={32}
          style={{ backgroundColor: C.red, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
          <Text fontSize={13} width={68} height={18} style={{ color: C.bg }}>Clear all</Text>
        </Pressable>
      </View>

      {kcStatus ? (
        <Text fontSize={12} width={inner} height={16} style={{ color: C.teal }}>{kcStatus}</Text>
      ) : null}
      {kcStored !== null ? (
        <Text fontSize={12} width={inner} height={16} style={{ color: C.text }}>
          {`apiKey = "${kcStored}"`}
        </Text>
      ) : null}

      {/* @velox/store ───────────────────────────────────────────────────── */}
      <Text fontSize={15} width={inner} height={20} style={{ color: C.accent }}>@velox/store</Text>
      <Text fontSize={12} width={inner} height={16} style={{ color: C.dim }}>
        Persistent reactive store backed by SQLite. State survives app restarts.
        {hydrated ? '' : '  (hydrating…)'}
      </Text>

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }} width={inner} height={40}>
        <Pressable onPress={() => setCtr('count', ctr.count - 1)} width={40} height={40}
          style={{ backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }}>
          <Text fontSize={20} width={28} height={28} style={{ color: C.text }}>−</Text>
        </Pressable>
        <Text fontSize={24} width={60} height={32} style={{ color: C.text, textAlign: 'center' }}>
          {ctr.count}
        </Text>
        <Pressable onPress={() => setCtr('count', ctr.count + 1)} width={40} height={40}
          style={{ backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }}>
          <Text fontSize={20} width={28} height={28} style={{ color: C.text }}>+</Text>
        </Pressable>
        <Pressable
          onPress={() => resetCtr()}
          width={70} height={32}
          style={{ backgroundColor: C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }}>
          <Text fontSize={12} width={58} height={16} style={{ color: C.dim }}>Reset</Text>
        </Pressable>
      </View>
      <Text fontSize={11} width={inner} height={14} style={{ color: C.dim }}>
        Increment, close the app, reopen — counter persists.
      </Text>
    </ScrollView>
  );
}

// ── Screen: Drizzle ORM ────────────────────────────────────────────────────────

const SEED_PRODUCTS = [
  { name: 'Velox Pro',        price: 49.99  },
  { name: 'Velox Starter',    price: 9.99   },
  { name: 'Velox Enterprise', price: 299.99 },
];

function DrizzleScreen() {
  const { width: winW } = useWindowSize();
  const C = useThemeColors();

  const [driz,    setDriz]    = useState(null);
  const [rows,    setRows]    = useState([]);
  const [name,    setName]    = useState('');
  const [price,   setPrice]   = useState('');
  const [status,  setStatus]  = useState('Initialising…');
  const [filterGt, setFilterGt] = useState('0');

  // Open in-memory DB, create table, seed data, build Drizzle instance
  useEffect(() => {
    let handle;
    (async () => {
      try {
        handle = await db.open(':memory:');
        await db.run(handle,
          `CREATE TABLE drz_products (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             name TEXT NOT NULL,
             price REAL NOT NULL,
             created_at INTEGER NOT NULL
           )`
        );
        const d = createDrizzle(handle);
        await d.insert(drzProducts).values(
          SEED_PRODUCTS.map(s => ({ ...s, created_at: Date.now() }))
        );
        setDriz(d);
        const initial = await d.select().from(drzProducts).orderBy(desc(drzProducts.id));
        setRows(initial);
        setStatus('Drizzle ORM — in-memory SQLite via Velox bindings');
      } catch (e) {
        setStatus('Error: ' + e.message);
      }
    })();
    return () => { if (handle != null) db.close(handle); };
  }, []);

  const refresh = async (d = driz, minPrice = Number(filterGt) || 0) => {
    if (!d) return;
    const result = minPrice > 0
      ? await d.select().from(drzProducts)
          .where(gt(drzProducts.price, minPrice))
          .orderBy(desc(drzProducts.id))
      : await d.select().from(drzProducts).orderBy(desc(drzProducts.id));
    setRows(result);
  };

  const handleInsert = async () => {
    if (!driz || !name.trim()) return;
    const p = parseFloat(price) || 0;
    await driz.insert(drzProducts).values({
      name: name.trim(), price: p, created_at: Date.now(),
    });
    setName(''); setPrice('');
    await refresh();
  };

  const handleDelete = async (id) => {
    if (!driz) return;
    await driz.delete(drzProducts).where(eq(drzProducts.id, id));
    await refresh();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentPadding={PAD}>
      <BackBtn />
      <Text fontSize={20} style={{ color: C.text, marginBottom: 4 }}>Drizzle ORM</Text>
      <Text fontSize={12} style={{ color: C.dim, marginBottom: 16 }}>{status}</Text>

      {/* Insert row */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <TextInput
          value={name} onChangeText={setName}
          placeholder="Product name"
          style={{ flex: 1, minWidth: 140, backgroundColor: C.surface, borderRadius: 6,
                   paddingHorizontal: 10, height: 36, color: C.text, fontSize: 13 }}
        />
        <TextInput
          value={price} onChangeText={setPrice}
          placeholder="Price"
          style={{ width: 80, backgroundColor: C.surface, borderRadius: 6,
                   paddingHorizontal: 10, height: 36, color: C.text, fontSize: 13 }}
        />
        <Pressable
          onPress={handleInsert}
          style={{ backgroundColor: C.accent, borderRadius: 6, paddingHorizontal: 16,
                   height: 36, justifyContent: 'center' }}
        >
          <Text fontSize={13} style={{ color: C.bg }}>Insert</Text>
        </Pressable>
      </View>

      {/* Filter */}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <Text fontSize={12} style={{ color: C.dim }}>Price &gt;</Text>
        <TextInput
          value={filterGt} onChangeText={v => { setFilterGt(v); refresh(driz, Number(v) || 0); }}
          style={{ width: 70, backgroundColor: C.surface, borderRadius: 6,
                   paddingHorizontal: 10, height: 30, color: C.text, fontSize: 12 }}
        />
        <Text fontSize={11} style={{ color: C.dim }}>
          {`drizzle.select().from(products).where(gt(price, ${Number(filterGt)||0})).orderBy(desc(id))`}
        </Text>
      </View>

      {/* Results */}
      <View style={{ backgroundColor: C.surface, borderRadius: 8, overflow: 'hidden' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', backgroundColor: C.overlay,
                       paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text fontSize={11} style={{ color: C.dim, width: 36 }}>ID</Text>
          <Text fontSize={11} style={{ color: C.dim, flex: 1 }}>Name</Text>
          <Text fontSize={11} style={{ color: C.dim, width: 72 }}>Price</Text>
          <Text fontSize={11} style={{ color: C.dim, width: 32 }}></Text>
        </View>
        {rows.length === 0 ? (
          <Text fontSize={12} style={{ color: C.dim, padding: 16 }}>No results</Text>
        ) : rows.map(row => (
          <View key={row.id}
            style={{ flexDirection: 'row', alignItems: 'center',
                     paddingHorizontal: 12, paddingVertical: 10,
                     borderTopWidth: 1, borderTopColor: C.border }}
          >
            <Text fontSize={12} style={{ color: C.dim, width: 36 }}>{row.id}</Text>
            <Text fontSize={13} style={{ color: C.text, flex: 1 }}>{row.name}</Text>
            <Text fontSize={13} style={{ color: C.green, width: 72 }}>
              ${row.price.toFixed(2)}
            </Text>
            <Pressable onPress={() => handleDelete(row.id)}
              style={{ width: 32, alignItems: 'center' }}>
              <Text fontSize={13} style={{ color: C.red }}>✕</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Text fontSize={10} style={{ color: C.dim, marginTop: 12, lineHeight: 16 }}>
        {'Typed insert / select / delete / where / orderBy — zero raw SQL in the screen. ' +
         'Drizzle generates the SQL; @velox/drizzle routes it through __velox_db_* bindings.'}
      </Text>
    </ScrollView>
  );
}

// ── App shell ─────────────────────────────────────────────────────────────────
//
// Initialises the DB and vector store once, provides them via context.
// The persistent header bar (window controls) lives outside the router.

// ── Deep-link handler (must live inside Router to call useNavigate) ───────────
function DeeplinkHandler({ url }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!url) return;
    // notes://note/42  → edit screen for note 42
    // notes://new      → new note
    // notes://search   → search screen
    const m = url.match(/^notes:\/\/note\/(\d+)/);
    if (m) {
      navigate('edit', { noteId: Number(m[1]) });
    } else if (url.startsWith('notes://new')) {
      navigate('edit', { noteId: null });
    } else if (url.startsWith('notes://search')) {
      navigate('search');
    }
  }, [url]);
  return null;
}

function App() {
  const { width: winW, height: winH } = useWindowSize();
  const [fullscreen, setFullscreen] = useState(false);
  const [maximized,  setMaximized] = useState(false);
  const C = useThemeColors();

  // Track the latest deep-link URL so DeeplinkHandler (inside Router) can navigate.
  const [pendingDeeplink, setPendingDeeplink] = useState(null);
  useEffect(() => deeplink.onOpen((url) => setPendingDeeplink(url)), []);

  // Crash report banner — shown once on startup if a previous session crashed.
  const [crashReports, setCrashReports] = useState([]);
  useEffect(() => {
    crash.getReports().then((reports) => {
      if (reports && reports.length > 0) setCrashReports(reports);
    }).catch(() => {});
  }, []);

  // ── Notes context state ────────────────────────────────────────────────────
  const [vdb,        setVdb]        = useState(null);
  const [dbReady,    setDbReady]    = useState(false);
  const [notes,      setNotes]      = useState([]);
  const [initStatus, setInitStatus] = useState('Opening database…');

  const refreshNotes = useCallback(() =>
    db.query('SELECT * FROM notes ORDER BY updated_at DESC')
      .then(setNotes)
      .catch(() => {}),
  []);

  // One-time initialisation: open DB → create schema → seed if empty →
  // open vector store → seed vectors → mark ready.
  useEffect(() => {
    let store;
    db.open('notes.db')
      .then(() => {
        setInitStatus('Creating schema…');
        return Promise.all([
          db.run(
            'CREATE TABLE IF NOT EXISTS notes (' +
            '  id         INTEGER PRIMARY KEY AUTOINCREMENT,' +
            '  title      TEXT    NOT NULL DEFAULT "",' +
            '  body       TEXT    NOT NULL DEFAULT "",' +
            '  created_at INTEGER NOT NULL,' +
            '  updated_at INTEGER NOT NULL' +
            ')'
          ),
          initStore(),  // creates velox_store table in the same notes.db
        ]);
      })
      .then(() => db.query('SELECT count(*) AS cnt FROM notes'))
      .then(([{ cnt }]) => {
        if (cnt === 0) {
          setInitStatus('Seeding example notes…');
          const now = Date.now();
          return db.transaction(
            SEED_NOTES.map((n) => ({
              sql:    'INSERT INTO notes (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)',
              params: [n.title, n.body, now, now],
            }))
          );
        }
      })
      .then(() => {
        setInitStatus('Opening vector store…');
        return vectorDb.open('notes-vectors.db');
      })
      .then(async (s) => {
        store = s;
        setInitStatus('Syncing embeddings…');
        const allNotes = await db.query('SELECT * FROM notes');
        await Promise.all(
          allNotes.map((n) =>
            s.upsert('notes', String(n.id), embedNote(n.title, n.body), {
              title:   n.title,
              preview: n.body.slice(0, 60),
            })
          )
        );
        setNotes(allNotes);
        setVdb(store);
        setDbReady(true);
        setInitStatus('Ready');
      })
      .catch((e) => {
        setInitStatus('Init error: ' + (e?.message ?? String(e)));
      });
  }, []);

  // ── Window controls ────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    const next = !fullscreen;
    veloxWindow.setFullscreen(next);
    setFullscreen(next);
  };
  const toggleMaximize = () => {
    const next = !maximized;
    veloxWindow.setMaximized(next);
    setMaximized(next);
  };

  const ctx = { vdb, dbReady, notes, refreshNotes, initStatus };
  return (
    <NotesCtx.Provider value={ctx}>
      <View style={{ backgroundColor: C.bg }} width={winW} height={winH}>

          {/* Crash report banner */}
          {crashReports.length > 0 && (
            <View
              style={{
                flexDirection:   'row',
                alignItems:      'center',
                justifyContent:  'space-between',
                backgroundColor: '#4d1a1a',
                borderWidth:     1,
                borderColor:     '#e06c75',
                padding:         8,
                gap:             8,
              }}
              width={winW}
            >
              <Text style={{ color: '#e06c75', fontSize: 12, flex: 1 }}>
                {'⚠ Crash detected in previous session: ' +
                  (crashReports[0]?.message || crashReports[0]?.error || 'Unknown error') +
                  (crashReports.length > 1 ? ` (+${crashReports.length - 1} more)` : '')}
              </Text>
              <Pressable
                onPress={() => { crash.clearReports().catch(() => {}); setCrashReports([]); }}
                style={{ padding: 4 }}
              >
                <Text style={{ color: '#e06c75', fontSize: 14 }}>✕</Text>
              </Pressable>
            </View>
          )}

          {/* Persistent header bar */}
          <View
            style={{
              flexDirection:   'row',
              backgroundColor: C.header,
              borderWidth:     1,
              borderColor:     C.border,
              alignItems:      'flex-start',
              justifyContent:  'flex-start',
              gap:             10,
              padding:         8,
            }}
            width={winW}
            height={HEADER_H}
          >
            <View
              style={{
                backgroundColor: C.surfaceAlt,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: C.accent,
                padding: 8,
              }}
              width={220}
              height={30}
            >
              <Text fontSize={12} width={200} height={16} style={{ color: C.accent }}>
                {`Velox Notes  •  ${winW} × ${winH}`}
              </Text>
            </View>

            <Text fontSize={11} width={120} height={28} style={{ color: C.dim }}>
              {'Focused writing mode'}
            </Text>

            <Pressable
              onPress={toggleFullscreen}
              width={100}
              height={30}
              style={{ backgroundColor: fullscreen ? C.surfaceAlt : C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.mauve, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text fontSize={12} height={18} style={{ color: fullscreen ? C.mauve : C.text }}>
                {fullscreen ? 'Exit Full' : 'Fullscreen'}
              </Text>
            </Pressable>
            <Pressable
              onPress={toggleMaximize}
              width={96}
              height={30}
              style={{ backgroundColor: maximized ? C.surfaceAlt : C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text fontSize={12} height={18} style={{ color: maximized ? C.green : C.text }}>
                {maximized ? 'Restore' : 'Maximize'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => veloxWindow.setMinimized()}
              width={84}
              height={30}
              style={{ backgroundColor: C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text fontSize={12} height={18} style={{ color: C.text }}>
                Minimize
              </Text>
            </Pressable>
          </View>

          {/* Router content area */}
          <View
            style={{ padding: PAD, justifyContent: 'flex-start', alignItems: 'flex-start' }}
            width={winW}
            height={winH - HEADER_H}
          >
            <Router initialRoute="list">
              <DeeplinkHandler url={pendingDeeplink} />
              <Route name="list"    component={NoteListScreen}    />
              <Route name="edit"    component={NoteEditScreen}    />
              <Route name="search"  component={NoteSearchScreen}  />
              <Route name="network" component={NetworkTestScreen} />
              <Route name="sysapi"  component={SysApiScreen}      />
              <Route name="forms"   component={FormDemoScreen}    />
              <Route name="audio"   component={AudioDemoScreen}   />
              <Route name="canvas"  component={CanvasDemoScreen}  />
              <Route name="ai"      component={AiDemoScreen}      />
              <Route name="media"   component={MediaDemoScreen}   />
              <Route name="drizzle"   component={DrizzleScreen}      />
              <Route name="packages"  component={PackagesDemoScreen} />
            </Router>
          </View>

      </View>
    </NotesCtx.Provider>
  );
}

render(<App />);

__velox_log('Week 23: Notes reference app loaded.');
