// @glyx-dev/testing/setup — preload entry point for Bun test runner.
//
// Add to bunfig.toml in your project:
//   [test]
//   preload = ["@glyx-dev/testing/setup"]
//
// This installs all __glyx_* stubs before any test file executes so
// components that import @glyx-dev/react don't throw on missing bindings.

import { installStubs } from './index.js';

installStubs();
