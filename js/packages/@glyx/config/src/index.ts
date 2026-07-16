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
   * TinySkia can also be forced at runtime via GLYX_CPU_RENDER=1.
   */
  renderMode?:  'auto' | 'skia' | 'gpu' | 'cpu';
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
  shell?:           boolean;
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
  /** Path to a PNG image displayed centred on the splash background. */
  image?:      string;
  /** Hex background colour, e.g. '#1e1e2e'. Defaults to black. */
  background?: string;
  /** Minimum display time in ms before hideSplash() takes effect. */
  minimumMs?:  number;
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
