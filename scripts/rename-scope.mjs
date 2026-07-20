// One-shot: rename npm scope @glyx/* -> @glyx-dev/* while preserving
// filesystem paths (the folder js/packages/@glyx is unchanged).
import fs from 'fs';
import path from 'path';

const exts = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.mdx', '.rs', '.txt', '.yml']);
const skip = new Set(['node_modules', 'dist', 'target', '.git', 'vendor']);
let changed = 0, scanned = 0;

function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!skip.has(e.name)) walk(path.join(d, e.name)); continue; }
    if (!exts.has(path.extname(e.name))) continue;
    const p = path.join(d, e.name); scanned++;
    let s = fs.readFileSync(p, 'utf8');
    if (!s.includes('@glyx/')) continue;
    const orig = s;
    // Pass 1: rename the npm scope everywhere.
    s = s.split('@glyx/').join('@glyx-dev/');
    // Pass 2: revert FILESYSTEM path strings (folder is still @glyx on disk).
    s = s.split('js/packages/@glyx-dev/').join('js/packages/@glyx/');
    s = s.split('js\\packages\\@glyx-dev\\').join('js\\packages\\@glyx\\');
    s = s.split('packages/@glyx-dev/*').join('packages/@glyx/*');
    if (s !== orig) { fs.writeFileSync(p, s); changed++; }
  }
}

for (const dir of process.argv.slice(2)) walk(dir);
console.log('scanned', scanned, 'changed', changed);
