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

import './polyfills.js';
import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, render, useWindowSize, useMediaQuery,
  db, vectorDb, fs, dialog, clipboard, notification, veloxWindow,
} from '@velox/react';
import { Router, Route, useNavigate, useRoute } from '@velox/router';

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
    body:  'Ideas for next velox feature: vector search UI, responsive layout improvements, cross-platform build. Plan rollout for Q2.',
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
      width={w}
      height={34}
      style={{
        backgroundColor: disabled ? C.surface : (filled ? C.overlay : C.surfaceAlt),
        borderRadius:     6,
        borderWidth:      1,
        borderColor:      disabled ? C.border : tone,
      }}
    >
      <Text fontSize={12} width={w - 16} height={18} style={{ color: disabled ? C.dim : tone }}>
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
  const panelGap = isWide ? 12 : 10;

  const contentW = winW - 2 * PAD;
  const contentH = winH - HEADER_H - 2 * PAD;
  const inner    = contentW - 32;
  const svContentH = displayed.length * 110 + 20;
  const heroH = isWide ? 124 : 188;
  const actionsH = isWide ? 34 : 78;
  const svH = Math.max(110, contentH - 40 - heroH - 40 - actionsH - 18 - 16);

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
            My Notes Workspace
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

      <View style={{ flexDirection: isWide ? 'row' : 'column', gap: panelGap }} width={inner} height={actionsH}>
        <View style={{ flexDirection: 'row', gap: 8 }} width={isWide ? 300 : inner} height={34}>
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
        </View>
        <Text fontSize={11} width={isWide ? inner - 308 : inner} height={16} style={{ color: C.dim }}>
          {'Tap a card to edit. Search narrows results instantly using SQL LIKE.'}
        </Text>
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
  const bodyH = isWide ? Math.max(220, contentH - 180) : Math.max(120, contentH - 320);
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
  const svH = isWide ? contentH - 150 : contentH - 250;
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

// ── App shell ─────────────────────────────────────────────────────────────────
//
// Initialises the DB and vector store once, provides them via context.
// The persistent header bar (window controls) lives outside the router.

function App() {
  const { width: winW, height: winH } = useWindowSize();
  const [fullscreen, setFullscreen] = useState(false);
  const [maximized,  setMaximized] = useState(false);
  const C = useThemeColors();

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
        return db.run(
          'CREATE TABLE IF NOT EXISTS notes (' +
          '  id         INTEGER PRIMARY KEY AUTOINCREMENT,' +
          '  title      TEXT    NOT NULL DEFAULT "",' +
          '  body       TEXT    NOT NULL DEFAULT "",' +
          '  created_at INTEGER NOT NULL,' +
          '  updated_at INTEGER NOT NULL' +
          ')'
        );
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
              style={{ backgroundColor: fullscreen ? C.surfaceAlt : C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.mauve }}
            >
              <Text fontSize={12} width={84} height={18} style={{ color: fullscreen ? C.mauve : C.text }}>
                {fullscreen ? 'Exit Full' : 'Fullscreen'}
              </Text>
            </Pressable>
            <Pressable
              onPress={toggleMaximize}
              width={96}
              height={30}
              style={{ backgroundColor: maximized ? C.surfaceAlt : C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.green }}
            >
              <Text fontSize={12} width={80} height={18} style={{ color: maximized ? C.green : C.text }}>
                {maximized ? 'Restore' : 'Maximize'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => veloxWindow.setMinimized()}
              width={84}
              height={30}
              style={{ backgroundColor: C.surface, borderRadius: 6, borderWidth: 1, borderColor: C.border }}
            >
              <Text fontSize={12} width={68} height={18} style={{ color: C.text }}>
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
              <Route name="list"   component={NoteListScreen}   />
              <Route name="edit"   component={NoteEditScreen}   />
              <Route name="search" component={NoteSearchScreen} />
            </Router>
          </View>

      </View>
    </NotesCtx.Provider>
  );
}

render(<App />);

__velox_log('Week 23: Notes reference app loaded.');
