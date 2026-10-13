// What the Glyx JS runtime (V8 or QuickJS, no DOM, no Node) provides as globals, for the packages'
// own type-check. Deliberately small: it is not lib.dom. Anything missing here that the code uses is
// a real question ("does the runtime have this?"), so add it only once that is answered.

declare const console: {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
};

type TimerHandle = number;
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): TimerHandle;
declare function clearTimeout(handle: TimerHandle | undefined): void;
declare function setInterval(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): TimerHandle;
declare function clearInterval(handle: TimerHandle | undefined): void;
declare function queueMicrotask(callback: () => void): void;

declare const performance: { now(): number };

declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare class TextDecoder {
  constructor(label?: string, options?: { fatal?: boolean });
  decode(input?: ArrayBuffer | ArrayBufferView): string;
}

// Replaced by the bundler (`--define process.env.NODE_ENV`), but written as `process.env.NODE_ENV` in source.
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };

// Browser objects the code probes for (`typeof window !== 'undefined'`) to tell the runtime from a web build.
// They are not provided by Glyx: typed `any` so a probe compiles, not so they can be used.
declare var window: any;
declare var document: any;
declare var navigator: any;
declare var self: any;
declare var crypto: any;

// Probed (and polyfilled) by @glyx-dev/react: the runtimes may or may not have it.
declare var MessageChannel: any;

// Replaced by the bundler (`--define __GLYX_STRIP_TEST_IDS__=true`) in release builds; absent otherwise.
declare const __GLYX_STRIP_TEST_IDS__: boolean | undefined;
