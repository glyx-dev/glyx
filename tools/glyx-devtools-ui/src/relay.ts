// Client for the DevTools relay (`glyx inspect`, crates/glyx-devtools
// relay.rs): lists running apps, attaches to one, and carries GDP requests,
// responses and events. Reconnects to the relay if it restarts, and the
// relay itself reattaches to an app that restarts.

export interface AppEntry {
  key: string;
  name: string;
  engine: string;
  pid: number;
  port: number;
}

export interface WindowInfo {
  windowId: number;
  title: string;
  width: number;
  height: number;
  main: boolean;
}

export interface Handshake {
  protocolVersion: number;
  engine: string;
  pid: number;
  windows: WindowInfo[];
  methods: string[];
  events: string[];
}

export type ConnState =
  | 'connecting'    // reaching the relay
  | 'relay-lost'    // the relay went away; retrying
  | 'no-app'        // relay up, not attached
  | 'attaching'
  | 'connected'
  | 'reconnecting'  // the app went away; the relay is waiting for it
  | 'error';

export interface ConnStatus {
  state: ConnState;
  key?: string;
  message?: string;
  handshake?: Handshake;
}

export interface GdpError { code: number; message: string }
export type GdpResult<T = any> = { result: T; error?: undefined } | { result?: undefined; error: GdpError };

type Listener<T> = (value: T) => void;

export class RelayClient {
  apps: AppEntry[] = [];
  status: ConnStatus = { state: 'connecting' };

  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, (r: GdpResult) => void>();
  private eventListeners = new Map<string, Set<Listener<any>>>();
  private appListeners = new Set<Listener<AppEntry[]>>();
  private statusListeners = new Set<Listener<ConnStatus>>();
  private wanted: string | null;
  private closed = false;

  constructor(private url: string, private secret: string, preferredApp: string | null) {
    this.wanted = preferredApp;
    this.open();
  }

  // ── Subscriptions ───────────────────────────────────────────────────────

  onApps(fn: Listener<AppEntry[]>): () => void {
    this.appListeners.add(fn);
    fn(this.apps);
    return () => this.appListeners.delete(fn);
  }

  onStatus(fn: Listener<ConnStatus>): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  /** A GDP event (`Console.messageAdded`, …). Subscribe on the app with the
   *  domain's `enable` call; re-send it after every reconnect. */
  onEvent<T = any>(name: string, fn: (params: T, windowId?: number) => void): () => void {
    let set = this.eventListeners.get(name);
    if (!set) this.eventListeners.set(name, (set = new Set()));
    const wrapped = fn as Listener<any>;
    set.add(wrapped);
    return () => set!.delete(wrapped);
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  attach(key: string) {
    this.wanted = key;
    try { localStorage.setItem('gx-devtools-app', key); } catch {}
    this.setStatus({ state: 'attaching', key });
    this.send({ type: 'attach', key });
  }

  detach() {
    this.wanted = null;
    this.send({ type: 'detach' });
  }

  refreshApps() { this.send({ type: 'apps' }); }

  /** Call a GDP method on the attached app: `call('Runtime.ping')`. */
  call<T = any>(name: string, params: object = {}, windowId?: number, timeoutMs = 15000): Promise<GdpResult<T>> {
    const [domain, method] = name.split('.');
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) resolve({ error: { code: -1, message: 'no reply (timed out)' } });
      }, timeoutMs);
      this.pending.set(id, (r) => { clearTimeout(timer); resolve(r); });
      const ok = this.send({ id, domain, method, params, ...(windowId != null ? { windowId } : {}) });
      if (!ok) {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({ error: { code: -1, message: 'not connected' } });
      }
    });
  }

  supports(method: string): boolean {
    return !!this.status.handshake?.methods.includes(method);
  }

  close() {
    this.closed = true;
    this.ws?.close();
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private open() {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', secret: this.secret }));
    ws.onmessage = (m) => this.receive(JSON.parse(String(m.data)));
    ws.onclose = () => {
      this.ws = null;
      this.failPending('lost the DevTools server');
      if (this.closed) return;
      this.setStatus({ state: 'relay-lost', message: 'Lost the DevTools server; retrying…' });
      setTimeout(() => this.open(), 1000);
    };
  }

  private send(msg: object): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  private receive(msg: any) {
    if (msg.type === 'apps') {
      this.apps = msg.apps;
      this.appListeners.forEach((fn) => fn(this.apps));
      this.autoAttach();
      return;
    }
    if (msg.type === 'status') {
      if (msg.state === 'reconnecting' || msg.state === 'detached') this.failPending('the app disconnected');
      this.setStatus({
        state: msg.state === 'detached' ? 'no-app' : msg.state,
        key: msg.key,
        message: msg.message,
        handshake: msg.handshake,
      });
      return;
    }
    if (msg.event) {
      this.eventListeners.get(msg.event)?.forEach((fn) => fn(msg.params, msg.windowId));
      return;
    }
    if (msg.id != null) {
      const done = this.pending.get(msg.id);
      if (done) {
        this.pending.delete(msg.id);
        done(msg.error ? { error: msg.error } : { result: msg.result });
      }
    }
  }

  /** Attach to the preferred app when it appears; with exactly one app
   *  running and no preference, attach to it. */
  private autoAttach() {
    const s = this.status.state;
    if (s === 'connected' || s === 'attaching' || s === 'reconnecting') return;
    const target = (this.wanted && this.apps.find((a) => a.key === this.wanted))
      ?? (!this.wanted && this.apps.length === 1 ? this.apps[0] : undefined);
    if (target) this.attach(target.key);
    else if (s === 'connecting') this.setStatus({ state: 'no-app' });
  }

  private setStatus(s: ConnStatus) {
    // Retries repeat the same status: don't re-render the page for those.
    const prev = this.status;
    if (prev && prev.state === s.state && prev.key === s.key && prev.message === s.message && prev.handshake === s.handshake) return;
    // A fresh status without a handshake keeps the last one's window list
    // out of the UI (it would be stale).
    this.status = s;
    this.statusListeners.forEach((fn) => fn(s));
    // After an error, wait for the app list to change rather than retrying
    // in a loop (autoAttach runs again on every `apps` message).
    if (s.state === 'no-app') this.autoAttach();
  }

  private failPending(message: string) {
    for (const done of this.pending.values()) done({ error: { code: -1, message } });
    this.pending.clear();
  }
}

/** Relay address + session secret from the page URL (`#s=…&app=…`). */
export function readLaunchParams(loc: Location = location) {
  const frag = new URLSearchParams(loc.hash.replace(/^#/, ''));
  const saved = (() => { try { return localStorage.getItem('gx-devtools-app'); } catch { return null; } })();
  return {
    url: `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/relay`,
    secret: frag.get('s') ?? '',
    app: frag.get('app') ?? saved,
    theme: frag.get('theme'), // set by the VS Code panel
    panel: frag.get('panel'), // set by "Glyx: Open DevTools on <panel>"
  };
}
