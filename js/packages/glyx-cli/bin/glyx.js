#!/usr/bin/env node
// Thin launcher: executes the platform `glyx` binary downloaded by install.js.
'use strict';

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const suffix = process.platform === 'win32' ? '.exe' : '';
const bin = path.join(__dirname, `glyx-bin${suffix}`);

if (!fs.existsSync(bin)) {
  // Postinstall may have been skipped (--ignore-scripts, offline) — retry once.
  console.log('glyx: binary not found, downloading…');
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'install.js')], { stdio: 'inherit' });
  if (r.status !== 0 || !fs.existsSync(bin)) {
    console.error('glyx: could not install the binary.');
    console.error('Install directly: https://github.com/glyx-dev/glyx/releases');
    process.exit(1);
  }
}

const result = spawnSync(bin, process.argv.slice(2), { stdio: 'inherit' });
process.exit(result.status ?? 1);
