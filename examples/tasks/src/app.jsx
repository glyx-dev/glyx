import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
  View, Text, ScrollView, render, db, useWindowSize, DatePicker,
} from '@glyx-dev/react';
import { Router, Route, useNavigate, useRoute } from '@glyx-dev/router';
import {
  ThemeProvider, Button, IconButton, Card, TextField, Chip, Tabs, CheckboxRow, Empty, Spinner, useTheme,
  ToastProvider, useToast,
} from '@glyx-dev/design';

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const SchemeCtx = createContext({ scheme: 'system', toggle: () => {} });


function Header({ title, onAdd }) {
  const C = useTheme().colors;
  const { scheme, toggle } = useContext(SchemeCtx);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
<IconButton icon={scheme === 'dark' ? 'sun' : 'moon'} variant="ghost" label="Toggle theme" onPress={toggle} />
        <IconButton icon="plus" variant="primary" label="New task" onPress={onAdd} />
      </View>
    </View>
  );
}

function ListScreen() {
  const C = useTheme().colors;
  const navigate = useNavigate();
  const { width: winW } = useWindowSize();
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [prio, setPrio] = useState(null);

  const refresh = useCallback(() => {
    db.query('SELECT * FROM tasks ORDER BY done ASC, priority DESC, created_at DESC')
      .then(setTasks)
      .catch((e) => console.log('query err', e));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleDone = async (t) => {
    await db.run('UPDATE tasks SET done = ? WHERE id = ?', [t.done ? 0 : 1, t.id]);
    refresh();
  };
  const remove = async (t) => {
    await db.run('DELETE FROM tasks WHERE id = ?', [t.id]);
    refresh();
  };

  const visible = tasks.filter((t) => {
    if (filter === 'active' && t.done) return false;
    if (filter === 'done' && !t.done) return false;
    if (prio && t.priority !== prio) return false;
    return true;
  });

  const prioVariant = (p) => (p === 'urgent' ? 'error' : p === 'high' ? 'warning' : 'default');

  return (
    <View style={{ flex: 1, width: winW || undefined, backgroundColor: C.bg }}>
      <Header title="Tasks" onAdd={() => navigate('edit', { id: null })} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, flexWrap: 'wrap' }}>
        <Tabs items={[{ key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'done', label: 'Done' }]} value={filter} onChange={setFilter} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {PRIORITIES.map((p) => (
            <Chip key={p} label={p} variant={prio === p ? 'success' : 'default'} selected={prio === p} onPress={() => setPrio(prio === p ? null : p)} />
          ))}
        </View>
      </View>
      <ScrollView style={{ flex: 1, padding: 12 }}>
        {visible.length === 0 ? (
          <Empty icon="✓" title="No tasks" description="Add your first task to get started" action={() => navigate('edit', { id: null })} actionLabel="New task" />
        ) : visible.map((t) => (
          <Card key={t.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <CheckboxRow label="" checked={!!t.done} onChange={() => toggleDone(t)} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: t.done ? C.textMuted : C.text }}>{t.title}</Text>
                {t.due ? <Text style={{ fontSize: 12, color: C.textMuted }}>Due {t.due}</Text> : null}
                {t.body ? <Text style={{ fontSize: 12, color: C.textMuted }}>{String(t.body).slice(0, 80)}</Text> : null}
              </View>
              <Chip label={t.priority} variant={prioVariant(t.priority)} />
              <IconButton icon="edit" variant="ghost" label="Edit" onPress={() => navigate('edit', { id: t.id })} />
              <IconButton icon="trash" variant="danger" label="Delete" onPress={() => remove(t)} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

function EditScreen() {
  const C = useTheme().colors;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { params } = useRoute();
  const id = params && params.id != null ? params.id : null;
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('normal');
  const [due, setDue] = useState('');

  useEffect(() => {
    if (id == null) { setTitle(''); setNotes(''); setPriority('normal'); setDue(''); return; }
    db.query('SELECT * FROM tasks WHERE id = ?', [id]).then((rows) => {
      const t = rows[0];
      if (t) { setTitle(t.title || ''); setNotes(t.body || ''); setPriority(t.priority || 'normal'); setDue(t.due || ''); }
    });
  }, [id]);

  const save = async () => {
    if (!title.trim()) {
      showToast({ message: 'Title is required', variant: 'error' });
      return;
    }
    const now = Date.now();
    if (id == null) {
      await db.run('INSERT INTO tasks (title, body, done, priority, due, created_at) VALUES (?,?,0,?,?,?)',
        [title, notes, priority, due, now]);
    } else {
      await db.run('UPDATE tasks SET title=?, body=?, priority=?, due=? WHERE id=?',
        [title, notes, priority, due, id]);
    }
    showToast({ message: id == null ? 'Task created' : 'Task saved', variant: 'success' });
    navigate('back');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={id == null ? 'New task' : 'Edit task'} onAdd={() => {}} />
      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: 16, gap: 16 }}>
          <TextField label="Title" value={title} onChangeText={setTitle} placeholder="What needs doing?" />
          <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Details…" multiline style={{ minHeight: 120 }} />
          <View style={{ gap: 8 }}>
            <Text style={{ color: C.textMuted, fontSize: 13, fontWeight: '500' }}>Priority</Text>
            <Tabs items={PRIORITIES.map((p) => ({ key: p, label: p }))} value={priority} onChange={setPriority} />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: C.textMuted, fontSize: 13, fontWeight: '500' }}>Due date</Text>
            <DatePicker
              value={due || null}
              onValueChange={(d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setDue(`${y}-${m}-${day}`);
              }}
            />
          </View>
          <Button label="Save" variant="primary" onPress={save} style={{ alignSelf: 'flex-start' }} />
        </View>
      </ScrollView>
    </View>
  );
}

function App() {
  const C = useTheme().colors;
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Opening database…');

  useEffect(() => {
    db.open('tasks.db')
      .then(() => db.run('CREATE TABLE IF NOT EXISTS tasks (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL DEFAULT "",' +
        'body TEXT NOT NULL DEFAULT "", done INTEGER DEFAULT 0,' +
        'priority TEXT DEFAULT "normal", due TEXT DEFAULT "", created_at INTEGER)'))
      .then(() => db.query('SELECT count(*) AS cnt FROM tasks'))
      .then((rows) => {
        const cnt = rows[0] ? rows[0].cnt : 0;
        if (cnt === 0) {
          const now = Date.now();
          return db.transaction([
            { sql: 'INSERT INTO tasks (title, body, priority, created_at) VALUES (?,?,?,?)', params: ['Welcome to Tasks', 'Toggle me, edit me, delete me.', 'normal', now] },
            { sql: 'INSERT INTO tasks (title, body, priority, created_at) VALUES (?,?,?,?)', params: ['Ship the docs page', 'Add these examples to veloxkit-docs.', 'high', now] },
            { sql: 'INSERT INTO tasks (title, body, priority, created_at) VALUES (?,?,?,?)', params: ['Try the 3D viewer', 'Box, sphere, plane + lights.', 'low', now] },
          ]);
        }
      })
      .then(() => { setReady(true); setStatus('Ready'); })
      .catch((e) => setStatus('Init error: ' + (e && e.message ? e.message : String(e))));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Spinner />
        <Text style={{ color: C.textMuted }}>{status}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Router initialRoute="list">
        <Route name="list" component={ListScreen} />
        <Route name="edit" component={EditScreen} />
      </Router>
    </View>
  );
}

function Root() {
  const [scheme, setScheme] = useState('system');
  const toggle = () => setScheme((s) => (s === 'dark' ? 'light' : 'dark'));
  return (
    <SchemeCtx.Provider value={{ scheme, toggle }}>
      <ThemeProvider colorScheme={scheme}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    </SchemeCtx.Provider>
  );
}

render(<Root />);
