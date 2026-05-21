// @velox/testing/setup — preload entry point for Bun test runner.
//
// Add to bunfig.toml in your project:
//   [test]
//   preload = ["@velox/testing/setup"]
//
// This installs all __velox_* stubs before any test file executes so
// components that import @velox/react don't throw on missing bindings.

import { installStubs } from './index.js';

installStubs();
