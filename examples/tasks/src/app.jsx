import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  WindowControls, render, db, useWindowSize, DatePicker, Select,
} from '@glyx-dev/react';
import { ThemeProvider, ToastProvider, useToast } from '@glyx-dev/design';

// Fixed light palette — this example always uses the light stone theme
const P = {
  bg:          '#FAFAF9',
  surface:     '#FFFFFF',
  elevated:    '#F5F5F4',
  border:      '#E7E5E4',
  borderFaint: '#F5F5F4',
  text:        '#1C1917',
  muted:       '#78716C',
  faint:       '#A8A29E',
  accent:      '#000000',
  accentHover: '#292524',
  prioHigh:    '#EF4444',
  prioMed:     '#F97316',
  prioLow:     '#10B981',
};

const PRIO_COLOR = { high: P.prioHigh, medium: P.prioMed, low: P.prioLow };

const PRIO_OPTIONS = [
  { label: 'Low',    value: 'low'    },
  { label: 'Medium', value: 'medium' },
  { label: 'High',   value: 'high'   },
];

const RECUR_OPTIONS = [
  { label: 'None',    value: 'none'    },
  { label: 'Daily',   value: 'daily'   },
  { label: 'Weekly',  value: 'weekly'  },
  { label: 'Monthly', value: 'monthly' },
];

function formatDue(s) {
  if (!s) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(s); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (diff === 0) return { label: 'TODAY',    overdue: false };
  if (diff === 1) return { label: 'TOMORROW', overdue: false };
  if (diff < 0)  return { label: `${mo[d.getMonth()]} ${d.getDate()}`, overdue: true };
  return           { label: `${mo[d.getMonth()]} ${d.getDate()}`, overdue: false };
}

// ── Title bar ─────────────────────────────────────────────────────────────────
function TitleBar() {
  return (
    <View
      glyxDraggable
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        height: 40, paddingHorizontal: 12,
        backgroundColor: P.surface,
        borderBottomWidth: 1, borderBottomColor: P.border,
      }}
    >
      {/* Left: logo mark + app name */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{
          width: 16, height: 16, borderRadius: 3,
          backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, borderWidth: 1, borderColor: P.surface }} />
        </View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: P.text, letterSpacing: 0.2 }}>Tasks</Text>
      </View>

      {/* Right: window controls */}
      <WindowControls />
    </View>
  );
}

// ── Checkbox ──────────────────────────────────────────────────────────────────
function Checkbox({ checked, onPress }) {
  return (
    <Pressable onPress={onPress}>
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: checked ? P.accent : 'transparent',
        borderWidth: checked ? 0 : 2, borderColor: '#D6D3D1',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && (
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>✓</Text>
        )}
      </View>
    </Pressable>
  );
}

// ── TaskItem ──────────────────────────────────────────────────────────────────
function TaskItem({ task, onToggle, onDelete, onEdit }) {
  const due   = formatDue(task.due);
  const prioC = PRIO_COLOR[task.priority] || P.faint;

  return (
    <Pressable
      onPress={() => onEdit(task)}
      style={({ hovered }) => ({
        flexDirection: 'row', alignItems: 'center',
        padding: 20, borderRadius: 12, marginBottom: 10,
        backgroundColor: task.done ? P.elevated : P.surface,
        borderWidth: 1,
        borderColor: hovered && !task.done ? P.accent : task.done ? 'transparent' : P.border,
        opacity: task.done ? 0.65 : 1,
      })}
    >
      <View style={{ marginRight: 16 }}>
        <Checkbox checked={!!task.done} onPress={() => onToggle(task)} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: task.done ? P.muted : P.text }}>
          {task.title}
        </Text>
        {!!task.body && (
          <Text style={{ fontSize: 13, color: P.muted, marginTop: 3 }}>{task.body}</Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: prioC }} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: prioC, letterSpacing: 0.5 }}>
              {(task.priority || 'medium').toUpperCase()} PRIORITY
            </Text>
          </View>
          {due && (
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: due.overdue ? P.prioHigh : P.faint }}>
              {due.label}
            </Text>
          )}
          {task.recurring && task.recurring !== 'none' && (
            <Text style={{ fontSize: 10, fontWeight: '700', color: P.faint, letterSpacing: 0.5 }}>
              {task.recurring.toUpperCase()}
            </Text>
          )}
        </View>
      </View>

      <Pressable
        onPress={() => onDelete(task)}
        style={({ hovered }) => ({
          padding: 8, borderRadius: 8,
          backgroundColor: hovered ? '#FEE2E2' : 'transparent',
        })}
      >
        <Text style={{ fontSize: 14, color: P.faint }}>✕</Text>
      </Pressable>
    </Pressable>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
function FilterTabs({ value, onChange }) {
  const tabs = [
    { key: 'all',    label: 'All'   },
    { key: 'active', label: 'To Do' },
    { key: 'done',   label: 'Done'  },
  ];
  return (
    <View style={{
      flexDirection: 'row', backgroundColor: P.elevated,
      borderRadius: 8, padding: 4, borderWidth: 1, borderColor: P.borderFaint,
    }}>
      {tabs.map(t => (
        <Pressable
          key={t.key}
          onPress={() => onChange(t.key)}
          style={{
            paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6,
            backgroundColor: value === t.key ? P.surface : 'transparent',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '500', color: value === t.key ? P.text : P.faint }}>
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── TaskForm — shared for add and edit ────────────────────────────────────────
function TaskForm({ initial, onSubmit, onCancel }) {
  const [title,     setTitle]     = useState(initial?.title     || '');
  const [body,      setBody]      = useState(initial?.body      || '');
  const [priority,  setPriority]  = useState(initial?.priority  || 'medium');
  const [recurring, setRecurring] = useState(initial?.recurring || 'none');
  const [due,       setDue]       = useState(initial?.due       || '');

  const isEdit    = !!initial?.id;
  const dueDateObj = due
    ? (() => { const d = new Date(due); d.setHours(12); return d; })()
    : null;

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), body: body.trim(), priority, recurring, due });
  };

  return (
    <View style={{ backgroundColor: P.elevated, borderRadius: 16, padding: 4, marginBottom: 28 }}>
      <View style={{ backgroundColor: P.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: P.border }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Task title..."
          placeholderTextColor={P.faint}
          autoFocus
          style={{ alignSelf: 'stretch', fontSize: 17, fontWeight: '500', color: P.text }}
        />
        <View style={{ height: 1, backgroundColor: P.border, marginTop: 4, marginBottom: 12 }} />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Description (optional)"
          placeholderTextColor={P.faint}
          style={{ alignSelf: 'stretch', fontSize: 14, color: P.muted }}
        />
        <View style={{ height: 1, backgroundColor: P.borderFaint, marginTop: 4, marginBottom: 20 }} />

        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: P.faint, letterSpacing: 1 }}>DUE DATE</Text>
            <DatePicker
              value={dueDateObj}
              onValueChange={(d) => {
                if (!d) { setDue(''); return; }
                const y   = d.getFullYear();
                const mon = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setDue(`${y}-${mon}-${day}`);
              }}
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: P.faint, letterSpacing: 1 }}>PRIORITY</Text>
            <Select options={PRIO_OPTIONS} value={priority} onValueChange={setPriority} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: P.faint, letterSpacing: 1 }}>RECURRING</Text>
            <Select options={RECUR_OPTIONS} value={recurring} onValueChange={setRecurring} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          <Pressable
            onPress={onCancel}
            style={({ hovered }) => ({
              paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8,
              backgroundColor: hovered ? P.elevated : P.borderFaint,
            })}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: P.muted }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            style={({ hovered }) => ({
              paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8,
              backgroundColor: hovered ? P.accentHover : P.accent,
            })}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
              {isEdit ? 'Save changes' : 'Add Task'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
function TasksScreen() {
  const { width: winW } = useWindowSize();
  const { showToast }   = useToast();

  const [tasks,      setTasks]      = useState([]);
  const [filter,     setFilter]     = useState('all');
  const [prioFilter, setPrioFilter] = useState('all');
  const [search,     setSearch]     = useState('');
  const [addOpen,    setAddOpen]    = useState(false);
  const [editTask,   setEditTask]   = useState(null);

  // Center content up to 800px
  const hPad = winW ? Math.max(24, Math.min(Math.floor((winW - 800) / 2), 96)) : 48;

  const refresh = useCallback(() => {
    db.query('SELECT * FROM tasks ORDER BY done ASC, priority DESC, created_at DESC')
      .then(setTasks)
      .catch(console.error);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = tasks.filter(t => {
    if (filter === 'active' && t.done)  return false;
    if (filter === 'done'   && !t.done) return false;
    if (prioFilter !== 'all' && t.priority !== prioFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    todo: tasks.filter(t => !t.done).length,
    done: tasks.filter(t =>  t.done).length,
  };

  const handleAdd = async ({ title, body, priority, recurring, due }) => {
    await db.run(
      'INSERT INTO tasks (title, body, done, priority, recurring, due, created_at) VALUES (?,?,0,?,?,?,?)',
      [title, body, priority, recurring, due, Date.now()],
    );
    setAddOpen(false);
    refresh();
    showToast({ message: 'Task added', variant: 'success' });
  };

  const handleSaveEdit = async ({ title, body, priority, recurring, due }) => {
    await db.run(
      'UPDATE tasks SET title=?, body=?, priority=?, recurring=?, due=? WHERE id=?',
      [title, body, priority, recurring, due, editTask.id],
    );
    setEditTask(null);
    refresh();
    showToast({ message: 'Saved', variant: 'success' });
  };

  const toggleDone = async (t) => {
    await db.run('UPDATE tasks SET done=? WHERE id=?', [t.done ? 0 : 1, t.id]);
    refresh();
  };

  const deleteTask = async (t) => {
    await db.run('DELETE FROM tasks WHERE id=?', [t.id]);
    if (editTask?.id === t.id) setEditTask(null);
    refresh();
  };

  const openEdit = (task) => {
    setAddOpen(false);
    setEditTask(task);
  };

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <TitleBar />
      <ScrollView style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: hPad, paddingTop: 48, paddingBottom: 80 }}>

        {/* ── Header ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-start',
          justifyContent: 'space-between', marginBottom: 48,
        }}>
          <View>
            <Text style={{ fontSize: 38, fontWeight: '300', color: P.text, letterSpacing: -1 }}>
              Tasks
            </Text>
            <Text style={{ fontSize: 14, color: P.muted, marginTop: 4 }}>
              Manage your daily workload and recurring priorities.
            </Text>
          </View>

          <View style={{
            flexDirection: 'row', backgroundColor: P.surface,
            borderRadius: 10, borderWidth: 1, borderColor: P.border,
          }}>
            <View style={{ paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '300', color: P.text }}>{stats.todo}</Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: P.faint, letterSpacing: 1 }}>TO DO</Text>
            </View>
            <View style={{ width: 1, backgroundColor: P.border, marginVertical: 8 }} />
            <View style={{ paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '300', color: P.text }}>{stats.done}</Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: P.faint, letterSpacing: 1 }}>DONE</Text>
            </View>
          </View>
        </View>

        {/* ── Controls ── */}
        <View style={{
          backgroundColor: P.surface, borderRadius: 12,
          borderWidth: 1, borderColor: P.border,
          padding: 16, marginBottom: 28,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search tasks..."
                placeholderTextColor={P.faint}
                style={{
                  alignSelf: 'stretch',
                  backgroundColor: P.elevated, borderRadius: 8,
                  borderWidth: 1, borderColor: P.borderFaint,
                  fontSize: 14, color: P.text,
                }}
              />
            </View>
            <FilterTabs value={filter} onChange={setFilter} />
            <Select
              options={[{ label: 'All Priorities', value: 'all' }, ...PRIO_OPTIONS]}
              value={prioFilter}
              onValueChange={setPrioFilter}
              style={{ width: 148 }}
            />
          </View>
        </View>

        {/* ── Add / Edit inline ── */}
        {addOpen ? (
          <TaskForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} />
        ) : editTask ? (
          <TaskForm initial={editTask} onSubmit={handleSaveEdit} onCancel={() => setEditTask(null)} />
        ) : (
          <Pressable
            onPress={() => setAddOpen(true)}
            style={({ hovered }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 10,
              padding: 20, borderRadius: 12, marginBottom: 28,
              backgroundColor: hovered ? '#ECEAE8' : P.elevated,
            })}
          >
            <Text style={{ fontSize: 20, color: P.muted, lineHeight: 20 }}>+</Text>
            <Text style={{ fontSize: 15, fontWeight: '500', color: P.muted }}>Add new task...</Text>
          </Pressable>
        )}

        {/* ── Empty state ── */}
        {filtered.length === 0 && (
          <View style={{
            alignItems: 'center', paddingVertical: 48,
            backgroundColor: P.surface, borderRadius: 12,
            borderWidth: 1, borderColor: P.border,
          }}>
            <Text style={{ fontSize: 32, color: P.faint }}>✓</Text>
            <Text style={{ fontSize: 17, fontWeight: '600', color: P.text, marginTop: 12 }}>
              No tasks found
            </Text>
            <Text style={{ fontSize: 14, color: P.muted, marginTop: 4 }}>
              {search ? 'Try adjusting your search or filters.' : 'You are all caught up!'}
            </Text>
          </View>
        )}

        {/* ── Task list ── */}
        {filtered.map(t =>
          editTask?.id === t.id ? null : (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={toggleDone}
              onDelete={deleteTask}
              onEdit={openEdit}
            />
          )
        )}

      </View>
      </ScrollView>
    </View>
  );
}

// ── DB init ───────────────────────────────────────────────────────────────────
function App() {
  const [ready, setReady] = useState(false);
  const [err,   setErr]   = useState(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const now   = Date.now();

    db.open('tasks.db')
      .then(() => db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          title      TEXT NOT NULL DEFAULT '',
          body       TEXT NOT NULL DEFAULT '',
          done       INTEGER DEFAULT 0,
          priority   TEXT DEFAULT 'medium',
          recurring  TEXT DEFAULT 'none',
          due        TEXT DEFAULT '',
          created_at INTEGER
        )
      `))
      .then(() => db.run(`ALTER TABLE tasks ADD COLUMN recurring TEXT DEFAULT 'none'`).catch(() => {}))
      .then(() => db.query('SELECT count(*) AS cnt FROM tasks'))
      .then(rows => {
        if (rows[0]?.cnt) return;
        return db.transaction([
          { sql: 'INSERT INTO tasks (title, body, priority, due, created_at) VALUES (?,?,?,?,?)',
            params: ['Welcome to Tasks', 'Click a task to edit. Tap the circle to mark it done.', 'medium', today, now] },
          { sql: 'INSERT INTO tasks (title, body, priority, due, created_at) VALUES (?,?,?,?,?)',
            params: ['Ship the docs page', 'Add examples to veloxkit-docs.', 'high', today, now] },
          { sql: 'INSERT INTO tasks (title, body, priority, recurring, created_at) VALUES (?,?,?,?,?)',
            params: ['Daily standup', 'Team sync at 9am.', 'low', 'daily', now] },
        ]);
      })
      .then(() => setReady(true))
      .catch(e => setErr(String(e?.message ?? e)));
  }, []);

  if (err) return (
    <View style={{ flex: 1, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: P.prioHigh, fontSize: 14 }}>DB error: {err}</Text>
    </View>
  );

  if (!ready) return (
    <View style={{ flex: 1, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '300', color: P.muted }}>Loading…</Text>
    </View>
  );

  return <TasksScreen />;
}

render(
  <ThemeProvider colorScheme="light">
    <ToastProvider>
      <App />
    </ToastProvider>
  </ThemeProvider>
);
