import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  Select, render, fs, dialog,
} from '@glyx-dev/react';
import { ThemeProvider, WindowControls } from '@glyx-dev/design';

// ── Dark palette (mirrors the glyx-design-kit "Log.Observer" feel) ─────────────
const P = {
  bg:          '#080809',
  surface:     '#0A0A0C',
  elevated:    '#16161A',
  border:      '#26262B',
  borderFaint: '#1A1A1F',
  text:        '#E6E6E6',
  message:     '#D1D1D1',
  muted:       '#9A9AA0',
  faint:       '#6B6B72',
  accent:      '#3B82F6',
  accentHover: '#2F6FE0',
  error:       '#F87171',
};

const LEVEL = {
  ERROR:   { color: '#F87171', label: 'ERROR'   },
  WARN:    { color: '#FBBF24', label: 'WARN'    },
  INFO:    { color: '#60A5FA', label: 'INFO'    },
  DEBUG:   { color: '#A78BFA', label: 'DEBUG'   },
  UNKNOWN: { color: '#88888B', label: 'UNKNOWN' },
};

const LEVEL_OPTIONS = [
  { label: 'All Levels', value: 'ALL'    },
  { label: 'Info',       value: 'INFO'   },
  { label: 'Warning',    value: 'WARN'   },
  { label: 'Error',      value: 'ERROR'  },
  { label: 'Debug',      value: 'DEBUG'  },
  { label: 'Unknown',    value: 'UNKNOWN' },
];

const PAGE_SIZE = 100;

// ── Log parsing (ported from glyx-design-kit/log-viewer) ──────────────────────
function parseLevel(levelStr) {
  const upper = String(levelStr).toUpperCase();
  if (upper.includes('ERR') || upper.includes('FATAL')) return 'ERROR';
  if (upper.includes('WARN')) return 'WARN';
  if (upper.includes('INFO')) return 'INFO';
  if (upper.includes('DEBUG') || upper.includes('TRACE')) return 'DEBUG';
  return 'UNKNOWN';
}

function parseLogLine(line, index) {
  // Try JSON first
  try {
    const parsed = JSON.parse(line);
    if (parsed && typeof parsed === 'object' && (parsed.message || parsed.msg || parsed.level)) {
      return {
        id:        'log-' + index,
        raw:       line,
        timestamp: parsed.timestamp || parsed.time || parsed.date || undefined,
        level:     parseLevel(parsed.level || 'UNKNOWN'),
        message:   parsed.message || parsed.msg || JSON.stringify(parsed),
      };
    }
  } catch (e) {
    // not JSON — fall through to regex
  }

  const levelMatch = line.match(/\b(INFO|ERROR|WARN|WARNING|DEBUG|TRACE|FATAL|ERR)\b/i);
  const level = parseLevel(levelMatch ? levelMatch[1] : 'UNKNOWN');

  const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)/);
  const timestamp = dateMatch ? dateMatch[1] : undefined;

  return {
    id:        'log-' + index,
    raw:       line,
    timestamp,
    level,
    message:   line,
  };
}

function parseLogs(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  return lines.map((l, i) => parseLogLine(l, i));
}

// ── Small bits ────────────────────────────────────────────────────────────────
function LevelDot({ level }) {
  const c = (LEVEL[level] || LEVEL.UNKNOWN).color;
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />;
}

function LevelBadge({ level }) {
  const info = LEVEL[level] || LEVEL.UNKNOWN;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <LevelDot level={level} />
      <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: info.color }}>
        {info.label}
      </Text>
    </View>
  );
}

function TitleBar({ onReset }) {
  return (
    <View
      glyxDraggable
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        height: 44, paddingHorizontal: 16,
        backgroundColor: P.surface,
        borderBottomWidth: 1, borderBottomColor: P.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{
          width: 18, height: 18, borderRadius: 5,
          backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{'›_'}</Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: '600', color: P.text, letterSpacing: 0.3 }}>
          Log Viewer
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 10, paddingVertical: 4,
          borderRadius: 999, borderWidth: 1, borderColor: P.border,
        }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: P.accent }} />
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: P.muted }}>
            LOCAL
          </Text>
        </View>
      </View>

      <WindowControls closeHoverBg="#e0413a" />
    </View>
  );
}

// ── Dropzone (click to browse; design-kit "drag & drop" analogue) ─────────────
function Dropzone({ onPick }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <Pressable
        onPress={onPick}
        style={({ hovered }) => ({
          width: '100%', maxWidth: 560,
          alignItems: 'center', justifyContent: 'center',
          paddingVertical: 52, paddingHorizontal: 32,
          backgroundColor: P.surface,
          borderWidth: 2, borderStyle: 'dashed',
          borderColor: hovered ? P.accent : P.border,
          borderRadius: 16,
        })}
      >
        <View style={{
          width: 56, height: 56, borderRadius: 999,
          backgroundColor: P.elevated, borderWidth: 1, borderColor: P.border,
          alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <Text style={{ fontSize: 24, color: P.muted, fontWeight: '700' }}>{'↑'}</Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: '600', color: P.text, marginBottom: 8 }}>
          Upload a log file
        </Text>
        <Text style={{ fontSize: 13, color: P.muted, textAlign: 'center', maxWidth: 360 }}>
          Click to browse. Logs are parsed and viewed locally — nothing leaves your machine.
        </Text>
        <Text style={{ fontSize: 12, color: P.faint, marginTop: 16, fontWeight: '600', letterSpacing: 0.5 }}>
          .log · .txt · .json
        </Text>
      </Pressable>
    </View>
  );
}

// ── A single log row ──────────────────────────────────────────────────────────
function LogRow({ log }) {
  return (
    <Pressable
      style={({ hovered }) => ({
        flexDirection: 'row', alignItems: 'flex-start', gap: 14,
        paddingHorizontal: 20, paddingVertical: 11,
        backgroundColor: hovered ? P.elevated : 'transparent',
        borderBottomWidth: 1, borderBottomColor: P.borderFaint,
      })}
    >
      <View style={{ width: 96, flexShrink: 0 }}>
        <LevelBadge level={log.level} />
      </View>
      <Text
        style={{ width: 200, flexShrink: 0, fontSize: 12, color: P.muted, fontFamily: 'monospace' }}
        numberOfLines={1}
      >
        {log.timestamp || '—'}
      </Text>
      <Text style={{ flex: 1, fontSize: 12, color: P.message, fontFamily: 'monospace' }}>
        {log.message}
      </Text>
    </Pressable>
  );
}

// ── Viewer ────────────────────────────────────────────────────────────────────
function LogViewer({ logs, fileName, onReset }) {
  const [search, setSearch] = useState('');
  const [level,  setLevel]  = useState('ALL');
  const [page,   setPage]   = useState(1);

  const counts = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, UNKNOWN: 0 };
  for (const l of logs) counts[l.level] = (counts[l.level] || 0) + 1;

  const filtered = logs.filter(l => {
    const matchesLevel = level === 'ALL' || l.level === level;
    const matchesSearch = search === '' || l.raw.toLowerCase().includes(search.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageLogs = filtered.slice(start, start + PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, level]);

  const prevDisabled = page === 1;
  const nextDisabled = page === totalPages;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <TitleBar onReset={onReset} />

      <View style={{ flex: 1, padding: 24 }}>
        {/* File header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <Text style={{ fontSize: 15, color: P.text, fontWeight: '500' }} numberOfLines={1}>
            {fileName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
              backgroundColor: P.elevated, borderWidth: 1, borderColor: P.border,
            }}>
              <Text style={{ fontSize: 12, color: P.muted }}>
                {logs.length} entries
              </Text>
            </View>
            <Pressable
              onPress={onReset}
              style={({ hovered }) => ({
                paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
                borderWidth: 1, borderColor: P.border,
                backgroundColor: hovered ? P.elevated : 'transparent',
              })}
            >
              <Text style={{ fontSize: 12, color: P.muted }}>Upload New File</Text>
            </Pressable>
          </View>
        </View>

        {/* Level count chips */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {['ERROR', 'WARN', 'INFO', 'DEBUG', 'UNKNOWN'].map(lv => (
            <View key={lv} style={{
              flexDirection: 'row', alignItems: 'center', gap: 7,
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
              backgroundColor: P.surface, borderWidth: 1, borderColor: P.border,
            }}>
              <LevelDot level={lv} />
              <Text style={{ fontSize: 12, color: P.muted }}>{lv}</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: P.text }}>{counts[lv]}</Text>
            </View>
          ))}
        </View>

        {/* Toolbar */}
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            fontSize={13}
            placeholder="Search logs (e.g. status:500)"
            style={{
              flex: 1,
              backgroundColor: P.surface, borderWidth: 1, borderColor: P.border,
              borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
              fontSize: 13, color: P.text, fontFamily: 'monospace',
            }}
          />
          <Select options={LEVEL_OPTIONS} value={level} onValueChange={setLevel} style={{ width: 160 }} />
        </View>

        {/* Table card */}
        <View style={{
          flex: 1, backgroundColor: P.surface,
          borderWidth: 1, borderColor: P.border, borderRadius: 12,
        }}>
          {/* Column header */}
          <View style={{
            flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 11,
            borderBottomWidth: 1, borderBottomColor: P.border, backgroundColor: P.surface,
            flexShrink: 0,
          }}>
            <Text style={{ width: 96, fontSize: 11, fontWeight: '700', color: P.faint, letterSpacing: 0.8 }}>
              LEVEL
            </Text>
            <Text style={{ width: 200, fontSize: 11, fontWeight: '700', color: P.faint, letterSpacing: 0.8 }}>
              TIMESTAMP
            </Text>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: P.faint, letterSpacing: 0.8 }}>
              MESSAGE
            </Text>
          </View>

          {/* Rows */}
          <ScrollView style={{ flex: 1 }}>
            {filtered.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 56 }}>
                <Text style={{ fontSize: 14, color: P.muted }}>No logs match your current filters.</Text>
              </View>
            ) : (
              pageLogs.map(log => <LogRow key={log.id} log={log} />)
            )}
          </ScrollView>
        </View>

        {/* Pagination */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 12,
        }}>
          <Text style={{ fontSize: 12, color: P.muted }}>
            Showing {start + 1}&ndash;{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pressable
              onPress={() => { if (!prevDisabled) setPage(p => p - 1); }}
              style={{ opacity: prevDisabled ? 0.4 : 1, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: P.border }}
            >
              <Text style={{ fontSize: 12, color: P.muted }}>Prev</Text>
            </Pressable>
            <Text style={{ fontSize: 12, color: P.text, paddingHorizontal: 8 }}>
              Page {page} of {totalPages}
            </Text>
            <Pressable
              onPress={() => { if (!nextDisabled) setPage(p => p + 1); }}
              style={{ opacity: nextDisabled ? 0.4 : 1, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: P.border }}
            >
              <Text style={{ fontSize: 12, color: P.muted }}>Next</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function App() {
  const [logs,      setLogs]      = useState(null);
  const [fileName,  setFileName]  = useState('');
  const [processing, setProcessing] = useState(false);
  const [err,       setErr]       = useState(null);

  const pick = async () => {
    try {
      const paths = await dialog.openFile({
        filters: [{ name: 'Log files', extensions: ['log', 'txt', 'json'] }],
      });
      const path = Array.isArray(paths) ? paths[0] : paths;
      if (!path) return;

      setProcessing(true);
      setErr(null);

      const text = await fs.readFile(path);
      const parsed = parseLogs(text);

      setFileName(String(path).split(/[\\/]/).pop());
      setLogs(parsed);
      setProcessing(false);
    } catch (e) {
      setProcessing(false);
      setErr(String(e?.message ?? e));
    }
  };

  const reset = () => { setLogs(null); setFileName(''); };

  if (err) return (
    <View style={{ flex: 1, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: P.error, fontSize: 14 }}>Error: {err}</Text>
    </View>
  );

  if (logs) {
    return <LogViewer logs={logs} fileName={fileName} onReset={reset} />;
  }

  if (processing) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 15, color: P.muted }}>Processing log file…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <TitleBar onReset={reset} />
      <Dropzone onPick={pick} />
    </View>
  );
}

render(
  <ThemeProvider colorScheme="dark">
    <App />
  </ThemeProvider>,
);
