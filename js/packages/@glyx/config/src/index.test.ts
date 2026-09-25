import { test, expect, spyOn } from 'bun:test';
import { defineConfig } from './index.ts';

// `defineConfig` is the CLI's protocol, not a normal function: when the CLI
// runs `bun run glyx.config.ts`, it prints the resolved config as JSON and
// exits the process (see index.ts). Calling it for real inside a test exited
// the TEST RUNNER — `bun test js/packages` (what CI runs) stopped right here
// with exit 0, so every package scheduled after this one silently never ran.
// Intercept the exit and stdout instead, and assert on the protocol itself.
class ExitCalled extends Error {
  constructor(public code: number | undefined) { super(`exit(${code})`); }
}

function runDefineConfig(config: Parameters<typeof defineConfig>[0]) {
  const logs: string[] = [];
  const logSpy  = spyOn(console, 'log').mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(' ')); });
  const exitSpy = spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new ExitCalled(code); }) as never);
  try {
    defineConfig(config);
  } catch (e) {
    if (e instanceof ExitCalled) return { logs, code: e.code };
    throw e;
  } finally {
    logSpy.mockRestore();
    exitSpy.mockRestore();
  }
  throw new Error('defineConfig returned without exiting');
}

test('defineConfig prints the config as JSON and exits 0 (the CLI protocol)', () => {
  const config = {
    window: { title: 'Test App', width: 900, height: 600 },
    capabilities: { db: true, fs: { read: ['**'] } },
    dev: { entry: 'js/app.tsx', output: 'js/app.js' },
  };
  const { logs, code } = runDefineConfig(config);
  expect(code).toBe(0);
  expect(logs).toHaveLength(1);
  expect(JSON.parse(logs[0])).toEqual(config);
});

test('defineConfig accepts an empty config', () => {
  const { logs, code } = runDefineConfig({});
  expect(code).toBe(0);
  expect(JSON.parse(logs[0])).toEqual({});
});
