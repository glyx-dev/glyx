// @glyx-dev/config — type-safe configuration helper for Glyx apps.
//
// Usage in glyx.config.ts:
//
//   import { defineConfig } from '@glyx-dev/config';
//   export default defineConfig({
//     window:       { title: 'My App', width: 1280, height: 800 },
//     capabilities: { fs: { read: ['**'] }, db: true },
//     dev:          { entry: 'js/app.tsx', output: 'js/app.js' },
//   });
//
// When the Glyx CLI executes this file via `bun run glyx.config.ts`,
// defineConfig prints the config as JSON to stdout and returns it.

export interface WindowConfig {
  title?:       string;
  width?:       number;
  height?:      number;
  /** 'windowed' | 'maximized' | 'fullscreen' */
  startupMode?: string;
  /** true = OS title bar (default). false = frameless / custom title bar. */
  decorations?: boolean;
  /** true = user can resize the window (default). false = fixed size, locked to width x height. */
  resizable?:   boolean;
  /**
   * GPU clear color before the first JS frame renders.
   * Format: '#rrggbb' or '#rrggbbaa'.
   * Match your app's root background to avoid a white flash on startup.
   */
  background?:  string;
  /**
   * Rendering backend.
   * - 'auto'    — pick per machine (default): tiny-skia on integrated/no GPU
   *               (software present, no wgpu), Vello on discrete GPUs.
   * - 'skia'    — tiny-skia CPU rasterizer + OS software present (~35 MB RSS).
   * - 'gpu'     — Vello GPU compute via wgpu (best visual quality; required
   *               up-front for Canvas3D-heavy apps, though Canvas3D also
   *               upgrades automatically from 'skia'/'auto').
   * - 'cpu'     — Vello's built-in CPU path.
   * - 'direct2d' — Windows-only, experimental. OS/driver-managed Direct2D —
   *               measured to stay near 'skia'-like flat memory instead of
   *               Vello's persistent scene-buffer pool. Never auto-selected;
   *               falls back to 'skia' with a warning on non-Windows.
   * TinySkia can also be forced at runtime via GLYX_CPU_RENDER=1.
   */
  renderMode?:  'auto' | 'skia' | 'gpu' | 'cpu' | 'direct2d';
  /** V8 heap cap in MB (16–512). Default: auto from bundle size. */
  maxJsHeapMb?: number;
  /**
   * When true, `glyxWindow.create({ title })` for a title that is already
   * open focuses the existing window and returns its handle instead of
   * opening a twin.  Per-call `allowDuplicate: true` bypasses this, and an
   * explicit per-call `key` dedupes regardless of this flag.  Child windows
   * with distinct titles are never affected.
   */
  preventDuplicateWindows?: boolean;
}

export interface FsCapability {
  read?:  string[];
  write?: string[];
}

export interface NetworkCapability {
  allow?: string[];
}

export interface EnvCapability {
  allow?: string[];
}

export interface DeeplinkCapability {
  scheme:          string;
  singleInstance?: boolean;
}

/** Scoped shell access (Tier 1) — explicit binary allowlist. Distinct from
 *  the `shell` capability below, which only permits `openExternal()`. */
export interface ShellExecCapability {
  /** Exact binary names (or absolute paths) the app may spawn, e.g. `['git', 'ffmpeg']`. */
  allow: string[];
}

/** Agent-style shell access (Tier 2) — no binary allowlist, but every
 *  spawned process is hard-scoped to `scopeDir` and every invocation must
 *  be shown via the native activity overlay. A much higher trust level than
 *  `shellExec` — meant for apps like an AI coding assistant that can't
 *  enumerate which binaries they'll need ahead of time.
 *
 *  Status: capability + security enforcement exist; the native activity
 *  overlay and streaming `shell.spawn()`/`shell.poll()` API are designed
 *  but not yet implemented. */
export interface ShellAgentCapability {
  /** The only filesystem root spawned processes' cwd may resolve within. */
  scopeDir: string;
}

export interface Capabilities {
  fs?:              FsCapability;
  network?:         NetworkCapability;
  env?:             EnvCapability;
  deeplink?:        DeeplinkCapability;
  db?:              boolean;
  dialog?:          boolean;
  clipboard?:       boolean;
  notification?:    boolean;
  battery?:         boolean;
  usb?:             boolean;
  /** Opens a URL/file via the OS (rundll32/open/xdg-open) — `openExternal()`.
   *  NOT the same capability as `shellExec`/`shellAgent` below. */
  shell?:           boolean;
  shellExec?:       ShellExecCapability;
  shellAgent?:      ShellAgentCapability;
  mdns?:            boolean;
  system?:          boolean;
  power?:           boolean;
  storage?:         boolean;
  gamepads?:        boolean;
  globalShortcuts?: boolean;
  credentials?:     boolean;
  audio?:           boolean;
  video?:           boolean;
  camera?:          boolean;
  microphone?:      boolean;
  /** Native OS-embedded webview (WebView2/WKWebView/WebKitGTK) via the <WebView> component. */
  webview?:         boolean;
  ai?:              boolean;
  hid?:             boolean;
  updater?:         boolean;
  crash?:           boolean;
}

export interface SplashConfig {
  /**
   * Path to an image displayed centred on the splash background — a static
   * PNG/JPEG/WebP/BMP, or an animated GIF (detected from the file
   * extension; no separate flag needed). The splash appears the instant
   * the app window opens — before the GPU backend or JS engine have
   * initialized — so it's shown via a small, separate native window first,
   * then handed off seamlessly once the real window is ready.
   */
  image?:      string;
  /** Hex background colour, e.g. '#1e1e2e'. Defaults to black. */
  background?: string;
  /**
   * Minimum display time in ms before `glyxWindow.hideSplash()` actually
   * dismisses the splash — `hideSplash()` is still the recommended way to
   * say "the app is ready" (e.g. after an initial data fetch); this only
   * sets a floor so a very fast-loading app doesn't flash the splash for a
   * single frame. If `hideSplash()` is never called at all, the splash is
   * dismissed automatically after a short safety-net timeout instead of
   * staying up indefinitely.
   */
  minimumMs?:  number;
  /**
   * Max fraction (0.0-1.0) of the smaller window dimension `image` may
   * occupy. Default 0.5 — keeps a full-bleed source image (e.g. an app
   * icon with no transparent margin) from filling the whole window and
   * swallowing `background`. Set closer to 1.0 for an image intentionally
   * designed as a full splash background.
   */
  imageScale?: number;
}

/**
 * Auto-updater target: where `updater.check()`/`updater.update()` look for
 * new GitHub Releases. Requires the `updater` capability to also be enabled.
 * Read at startup from `glyx.config.json` — this is app metadata, not a
 * capability toggle, so it lives here rather than under `capabilities`.
 */
export interface UpdaterConfig {
  /** GitHub organization or username. */
  owner:   string;
  /** Repository name. */
  repo:    string;
  /** Release asset filename prefix — matches `{binName}-{platform}`
   *  (`.exe` appended automatically on Windows), which is exactly what
   *  `glyx package` produces. */
  binName: string;
}

export interface PluginConfig {
  /** Path to the plugin JS entry point (bundled at startup). */
  entry:         string;
  /** Optional namespace prefix for the plugin's exported commands. */
  name?:         string;
  /** Capabilities the plugin requires. */
  capabilities?: string[];
}

export interface DevConfig {
  entry?:   string;
  output?:  string;
  watch?:   string[];
  /** Enable the Chrome DevTools Protocol inspector in `glyx dev`.
   *  `true` uses the default port (9229). Pass a number to use a custom port.
   *  Equivalent to `glyx dev --inspect` on the command line. */
  inspect?: boolean | number;
}

export interface AppConfig {
  /** Publisher / company name. Used in installer metadata (NSIS, DMG). */
  publisher?:   string;
  /** Short description of the app. Shown in installer and OS app listings. */
  description?: string;
  /** App website URL, e.g. 'https://myapp.com'. Embedded in installer metadata. */
  website?:     string;
  /** Path to a license file (relative to project root), e.g. 'LICENSE.txt'.
   *  Included in the installation directory. */
  license?:     string;
}

export interface GlyxConfig {
  /** Machine-readable app identifier. Used as the binary filename, installer slug,
   *  and bundle ID. No spaces — use hyphens, e.g. 'my-notes'. */
  name?:         string;
  /**
   * JsRuntime backend. Mutually exclusive — a build links exactly one.
   * - 'v8'      — default. Full-featured, larger binary (~58 MB floor).
   * - 'quickjs' — smaller binary (~3x), no JIT (suits mobile / size-constrained
   *               targets). See glyx_rough_docs/QUICKJS_PERFORMANCE_PLAN.md
   *               for the current perf/feature-parity tradeoffs.
   */
  engine?:       'v8' | 'quickjs';
  /** App version string, e.g. '1.2.0'. Exposed via updater.getVersion(). */
  version?:      string;
  /** Installer and store metadata (publisher, description, website, license). */
  app?:          AppConfig;
  window?:       WindowConfig;
  capabilities?: Capabilities;
  dev?:          DevConfig;
  /** Path to a PNG icon (512×512 or 1024×1024 recommended). */
  icon?:         string;
  /** Splash screen shown during JS startup. */
  splash?:       SplashConfig;
  /** Auto-updater target repo. Requires `capabilities.updater: true` too. */
  updater?:      UpdaterConfig;
  /** JS plugin extensions. Each plugin's exported async functions are
   *  callable via backend.<name>.<fn>() from JS. */
  plugins?:      PluginConfig[];
  /** Preferred package manager. Auto-detected from lockfile when omitted. */
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  /** ICU locales to bundle. Controls which locales `Intl.*` /
   *  `toLocaleString()` format correctly (numbers, dates, currency, plurals).
   *  Defaults to `['en']`. Glyx trims the bundled ICU data to just these
   *  locales at build time, keeping packaged apps light. */
  locales?: string[];
}

/**
 * Define a Glyx app configuration with full TypeScript type safety.
 *
 * When executed by the Glyx CLI (`bun run glyx.config.ts`), this function
 * prints the resolved config as JSON to stdout, which the CLI reads and uses
 * for building, embedding, and runtime capability checks.
 *
 * @returns The config object (identical to input — useful for type inference).
 */
export function defineConfig(config: GlyxConfig): never {
  console.log(JSON.stringify(config));
  // Exit immediately so bun (v1.1+) does not treat the default-exported object
  // as a server config and attempt to call Bun.serve() on it.
  ;(globalThis as any).process?.exit(0) ?? (globalThis as any).Bun?.exit(0);
  throw new Error('unreachable');
}
