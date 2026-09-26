import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ConnStatus, RelayClient } from '../relay';
import { getSelection, onSelection, type Selection } from '../selection';
import { ObjectView } from './ObjectView';
import {
  LEVELS, capped, counts, formatTime, pushHistory, splitFirstLine, visible,
  type Entry, type Level, type Preview,
} from './model';

interface Props { client: RelayClient; status: ConnStatus; windowId: number | undefined }

const HISTORY_KEY = 'gx-devtools-repl-history';
let keySeq = 0;
const key = () => `e${++keySeq}`;

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
}

export function Console({ client, status, windowId }: Props) {
  const connected = status.state === 'connected';
  const [entries, setEntries] = useState<Entry[]>([]);
  const [levels, setLevels] = useState<Set<Level>>(new Set(LEVELS));
  const [search, setSearch] = useState('');
  const [preserve, setPreserve] = useState(() => { try { return localStorage.getItem('gx-devtools-preserve') === '1'; } catch { return false; } });
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [histPos, setHistPos] = useState<number | null>(null);
  const [selection, setSel] = useState<Selection | null>(getSelection());
  const [stuck, setStuck] = useState(true);  // following the bottom
  const [unread, setUnread] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const lastSeq = useRef(0);
  const appKey = useRef<string | undefined>(undefined);

  useEffect(() => onSelection(setSel), []);
  useEffect(() => { try { localStorage.setItem('gx-devtools-preserve', preserve ? '1' : '0'); } catch {} }, [preserve]);

  const append = (more: Entry[]) => {
    if (!more.length) return;
    setEntries((e) => capped([...e, ...more]));
    if (!stuckRef.current) setUnread((n) => n + more.length);
  };
  const stuckRef = useRef(stuck);
  stuckRef.current = stuck;

  // Backlog + live messages; a new app process starts a new sequence.
  useEffect(() => {
    if (!connected) return;
    const pid = status.handshake?.pid;
    const thisApp = `${status.key}:${pid}`;
    if (appKey.current && appKey.current !== thisApp) {
      lastSeq.current = 0;
      if (preserve) append([{ kind: 'separator', key: key(), text: 'App restarted', timestamp: Date.now() }]);
      else setEntries([]);
    }
    appKey.current = thisApp;

    const toEntry = (m: any): Entry => ({ kind: 'message', key: `m${m.seq}-${pid}`, seq: m.seq, level: m.level, text: m.text, timestamp: m.timestamp, windowId: m.windowId });
    const off = client.onEvent<any>('Console.messageAdded', (m, win) => {
      if (m.seq <= lastSeq.current) return;
      lastSeq.current = m.seq;
      append([toEntry({ ...m, windowId: win })]);
    });
    client.call('Console.enable');
    client.call<{ messages: any[] }>('Console.getMessages', { since: lastSeq.current }).then((r) => {
      const fresh = (r.result?.messages ?? []).filter((m) => m.seq > lastSeq.current);
      if (fresh.length) lastSeq.current = fresh[fresh.length - 1].seq;
      append(fresh.map(toEntry));
    });
    return () => { off(); client.call('Console.disable'); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, connected, status.key, status.handshake?.pid]);

  // Follow the bottom unless the user scrolled up.
  useEffect(() => {
    const el = list.current;
    if (el && stuck) el.scrollTop = el.scrollHeight;
  }, [entries, stuck]);
  const onScroll = () => {
    const el = list.current!;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom !== stuck) setStuck(atBottom);
    if (atBottom) setUnread(0);
  };

  const run = async () => {
    const code = input;
    if (!code.trim()) return;
    setHistory((h) => { const next = pushHistory(h, code); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {} return next; });
    setHistPos(null);
    setInput('');
    setStuck(true);
    append([{ kind: 'input', key: key(), text: code, timestamp: Date.now() }]);
    const r = await client.call<{ preview?: Preview; description?: string }>('Runtime.evaluate',
      { expression: code, ...(selection ? { selectedNodeId: selection.nodeId } : {}) }, windowId);
    append([r.error
      ? { kind: 'thrown', key: key(), text: r.error.message.replace(/^JS exception: /, ''), timestamp: Date.now() }
      : { kind: 'result', key: key(), preview: r.result?.preview, description: r.result?.description, timestamp: Date.now() }]);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); return; }
    const oneLine = !input.includes('\n');
    if (e.key === 'ArrowUp' && oneLine && history.length) {
      e.preventDefault();
      const pos = histPos == null ? history.length - 1 : Math.max(0, histPos - 1);
      setHistPos(pos); setInput(history[pos]);
    } else if (e.key === 'ArrowDown' && oneLine && histPos != null) {
      e.preventDefault();
      const pos = histPos + 1;
      if (pos >= history.length) { setHistPos(null); setInput(''); } else { setHistPos(pos); setInput(history[pos]); }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault(); clear();
    }
  };

  const clear = () => {
    setEntries([]);
    setUnread(0);
    client.call('Console.clear');
  };

  const shown = useMemo(() => visible(entries, levels, search), [entries, levels, search]);
  const c = useMemo(() => counts(entries), [entries]);
  const multiWindow = (status.handshake?.windows.length ?? 0) > 1;
  const toggleLevel = (l: Level) => setLevels((s) => {
    const next = new Set(s);
    if (next.has(l)) next.delete(l); else next.add(l);
    return next;
  });

  if (!connected && !entries.length) {
    return <section className="empty"><h1>Console</h1><p>Attach to an app to see its console.</p></section>;
  }

  return (
    <div className="console">
      <div className="toolbar">
        <div className="levels" role="group" aria-label="Levels">
          {LEVELS.map((l) => (
            <button key={l} className={`level-chip lv-${l}${levels.has(l) ? ' on' : ''}`} aria-pressed={levels.has(l)} onClick={() => toggleLevel(l)}>
              {l}<span className="level-count">{c[l]}</span>
            </button>
          ))}
        </div>
        <input className="search" type="search" placeholder="Filter messages" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Filter messages" />
        <label className="check"><input type="checkbox" checked={preserve} onChange={(e) => setPreserve(e.target.checked)} />Preserve log</label>
        <button className="button small" onClick={clear} title="Clear (Ctrl+L)">Clear</button>
      </div>

      <div className="log" ref={list} onScroll={onScroll} role="log" aria-live="polite" aria-label="Console messages">
        {shown.length === 0 && <p className="muted pad">{entries.length ? 'No messages match the filter.' : 'No messages yet. console.log in the app shows up here.'}</p>}
        {shown.map((e) => <Row key={e.key} e={e} multiWindow={multiWindow} />)}
      </div>
      {unread > 0 && !stuck && (
        <button className="new-messages" onClick={() => { setStuck(true); setUnread(0); }}>{unread} new message{unread === 1 ? '' : 's'} ↓</button>
      )}

      <div className="repl">
        <span className="prompt mono" aria-hidden="true">›</span>
        <textarea
          className="repl-input mono"
          rows={Math.min(8, input.split('\n').length)}
          value={input}
          onChange={(e) => { setInput(e.target.value); setHistPos(null); }}
          onKeyDown={onKey}
          placeholder={connected ? 'Run JavaScript in the app (Enter runs, Shift+Enter for a new line)' : 'Not attached'}
          disabled={!connected}
          aria-label="Run JavaScript in the app"
          spellCheck={false}
        />
        {selection && (
          <span className="dollar0" title={`$0 is the element selected in the Inspector: ${selection.id ?? selection.nodeId}`}>
            <code>$0</code> {selection.component ?? selection.type ?? `node ${selection.nodeId}`}
          </span>
        )}
      </div>
    </div>
  );
}

function Row({ e, multiWindow }: { e: Entry; multiWindow: boolean }) {
  const [open, setOpen] = useState(false);
  const time = <span className="time mono">{formatTime(e.timestamp)}</span>;
  switch (e.kind) {
    case 'separator':
      return <div className="entry separator">{e.text}</div>;
    case 'input':
      return <div className="entry input">{time}<span className="glyph" aria-hidden="true">›</span><pre className="mono text">{e.text}</pre></div>;
    case 'result':
      return <div className="entry result">{time}<span className="glyph" aria-hidden="true">‹</span><div className="mono text"><ObjectView p={e.preview} open /></div></div>;
    case 'thrown': {
      const [first, rest] = splitFirstLine(e.text);
      return (
        <div className="entry error">{time}<span className="glyph" aria-hidden="true">✕</span>
          <div className="mono text">
            {rest ? <button className="stack-toggle" onClick={() => setOpen(!open)} aria-expanded={open}><span className={`caret${open ? ' open' : ''}`} aria-hidden="true" />{first}</button> : first}
            {open && <pre className="stack">{rest}</pre>}
          </div>
        </div>
      );
    }
    case 'message': {
      const [first, rest] = splitFirstLine(e.text);
      const long = rest !== '' && (e.level === 'error' || rest.split('\n').length > 3);
      return (
        <div className={`entry lv-${e.level}`}>
          {time}
          <span className={`badge lv-${e.level}`}>{e.level}</span>
          {multiWindow && e.windowId != null && <span className="win-tag">w{e.windowId}</span>}
          <div className="mono text">
            {long
              ? <><button className="stack-toggle" onClick={() => setOpen(!open)} aria-expanded={open}><span className={`caret${open ? ' open' : ''}`} aria-hidden="true" />{first}</button>{open && <pre className="stack">{rest}</pre>}</>
              : <pre>{e.text}</pre>}
          </div>
        </div>
      );
    }
  }
}
