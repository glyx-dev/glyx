// @velox/config — type-safe configuration helper for Velox apps.
//
// Usage in velox.config.ts:
//
//   import { defineConfig } from '@velox/config';
//   export default defineConfig({
//     window:       { title: 'My App', width: 1280, height: 800 },
//     capabilities: { fs: { read: ['**'] }, db: true },
//     dev:          { entry: 'js/app.tsx', output: 'js/app.js', watch: ['js'] },
//   });
//
// When the Velox CLI executes this file via `bun run velox.config.ts`,
// defineConfig prints the config as JSON to stdout and returns it.

export interface WindowConfig {
  title?:       string;
  width?:       number;
  height?:      number;
  /** 'windowed' | 'maximized' | 'fullscreen' */
  startupMode?: string;
}

export interface FsCapability {
  read?:  string[];
  write?: string[];
}

export interface NetworkCapability {
  allow?: string[];
}

export interface DeeplinkCapability {
  scheme:          string;
  singleInstance?: boolean;
}

export interface Capabilities {
  fs?:             FsCapability;
  network?:        NetworkCapability;
  db?:             boolean;
  dialog?:         boolean;
  clipboard?:      boolean;
  notification?:   boolean;
  mdns?:           boolean;
  battery?:        boolean;
  system?:         boolean;
  power?:          boolean;
  storage?:        boolean;
  gamepads?:       boolean;
  globalShortcuts?: boolean;
  deeplink?:       DeeplinkCapability;
}

export interface DevConfig {
  entry?:  string;
  output?: string;
  watch?:  string[];
}

export interface VeloxConfig {
  window?:       WindowConfig;
  capabilities?: Capabilities;
  dev?:          DevConfig;
}

/**
 * Define a Velox app configuration with full TypeScript type safety.
 *
 * When executed by the Velox CLI (`bun run velox.config.ts`), this function
 * prints the resolved config as JSON to stdout, which the CLI reads and uses
 * for building, embedding, and runtime capability checks.
 *
 * @returns The config object (identical to input — useful for type inference).
 */
export function defineConfig(config: VeloxConfig): VeloxConfig {
  // Output JSON to stdout so the CLI can consume it.
  console.log(JSON.stringify(config));
  return config;
}
