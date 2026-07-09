// @glyx/config — type-safe configuration helper for Glyx apps.
//
// Usage in glyx.config.ts:
//
//   import { defineConfig } from '@glyx/config';
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
   * - 'gpu'  — GPU compute via wgpu (default, best performance).
   * - 'cpu'  — Vello's built-in CPU path; runs without a discrete GPU.
   * Can also be forced at runtime via GLYX_CPU_RENDER=1.
   */
  renderMode?:  'gpu' | 'cpu';
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

export interface GlyxConfig {
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
  /** App version string, e.g. '1.2.0'. Exposed via updater.getVersion(). */
  version?:      string;
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
export function defineConfig(config: GlyxConfig): GlyxConfig {
  console.log(JSON.stringify(config));
  return config;
}
