// @glyx-dev/testing/setup — bun test preload.
//
// Installs stub implementations of every __glyx_* native binding so React
// components and packages that touch Glyx APIs can run in a plain Bun
// process. Referenced from the workspace root bunfig.toml:
//
//   [test]
//   preload = ["./js/packages/@glyx/testing/setup.js"]

import { installStubs } from './src/index.js';

installStubs();
