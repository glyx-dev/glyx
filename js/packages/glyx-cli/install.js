// glyx-cli postinstall — downloads the platform `glyx` binary from GitHub
// Releases into this package's bin/ directory.  The version downloaded
// matches this package's version (tag v<version>), falling back to latest.
//
// Skip with GLYX_SKIP_DOWNLOAD=1 (e.g. CI that only needs the JS packages).
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO = 'glyx-dev/glyx';
const VERSION = require('./package.json').version;

function target() {
  const { platform, arch } = process;
  if (platform === 'win32'  && arch === 'x64')   return 'x86_64-pc-windows-msvc';
  if (platform === 'darwin' && arch === 'arm64') return 'aarch64-apple-darwin';
  if (platform === 'darwin' && arch === 'x64')   return 'x86_64-apple-darwin';
  if (platform === 'linux'  && arch === 'x64')   return 'x86_64-unknown-linux-gnu';
  return null;
}

// Follows redirects (GitHub release downloads redirect to S3).
function download(url, dest, redirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'glyx-cli-installer' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(download(res.headers.location, dest, redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  if (process.env.GLYX_SKIP_DOWNLOAD === '1') {
    console.log('glyx-cli: GLYX_SKIP_DOWNLOAD=1 — skipping binary download');
    return;
  }
  const t = target();
  if (!t) {
    console.warn(`glyx-cli: no prebuilt binary for ${process.platform}/${process.arch}.`);
    console.warn('Build from source: https://github.com/' + REPO);
    return; // don't fail the whole npm install
  }
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const artifact = `glyx-${t}${suffix}`;
  const dest = path.join(__dirname, 'bin', `glyx-bin${suffix}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const urls = [
    `https://github.com/${REPO}/releases/download/v${VERSION}/${artifact}`,
    `https://github.com/${REPO}/releases/latest/download/${artifact}`,
  ];
  for (const url of urls) {
    try {
      console.log(`glyx-cli: downloading ${artifact}…`);
      await download(url, dest);
      if (process.platform !== 'win32') fs.chmodSync(dest, 0o755);
      console.log('glyx-cli: installed ✓');
      return;
    } catch (e) {
      console.warn(`glyx-cli: ${e.message}`);
    }
  }
  console.warn('glyx-cli: download failed — run `node ' + path.join(__dirname, 'install.js') + '` to retry,');
  console.warn('or install directly: https://github.com/' + REPO + '/releases');
}

main().catch((e) => { console.warn('glyx-cli install error:', e.message); });
