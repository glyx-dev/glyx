// Minimal source map (v3) reader: maps a generated line/column in the app
// bundle back to the original file and line, for the CPU profiler.

import type { CpuProfile } from './model';

export interface SourceMap { version: number; sources: string[]; names?: string[]; mappings: string; sourceRoot?: string }

/** One mapping segment: generated column, source index, source line, source column (all 0-based). */
type Segment = [number, number, number, number];

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DIGIT = new Map([...B64].map((c, i) => [c, i]));

/** Decode the `mappings` string into segments per generated line. */
export function decodeMappings(mappings: string): Segment[][] {
  const lines: Segment[][] = [];
  let src = 0, srcLine = 0, srcCol = 0;
  for (const line of mappings.split(';')) {
    const out: Segment[] = [];
    let genCol = 0;
    if (line) for (const seg of line.split(',')) {
      if (!seg) continue;
      const v: number[] = [];
      let value = 0, shift = 0;
      for (const ch of seg) {
        const d = DIGIT.get(ch);
        if (d == null) break;
        value += (d & 31) << shift;
        if (d & 32) { shift += 5; continue; }
        v.push(value & 1 ? -(value >> 1) : value >> 1);
        value = 0; shift = 0;
      }
      genCol += v[0] ?? 0;
      if (v.length >= 4) {
        src += v[1]; srcLine += v[2]; srcCol += v[3];
        out.push([genCol, src, srcLine, srcCol]);
      }
    }
    lines.push(out);
  }
  return lines;
}

export interface Mapper { (line: number, col: number): { source: string; line: number; col: number } | null }

export function makeMapper(map: SourceMap): Mapper {
  const lines = decodeMappings(map.mappings);
  const sources = map.sources.map((s) => (map.sourceRoot ? map.sourceRoot + s : s));
  return (line, col) => {
    const segs = lines[line];
    if (!segs || !segs.length) return null;
    // Last segment starting at or before `col`.
    let lo = 0, hi = segs.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (segs[mid][0] <= col) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    const s = segs[best === -1 ? 0 : best];
    return { source: sources[s[1]] ?? '', line: s[2], col: s[3] };
  };
}

/** Readable source path: drop leading "../" and node_modules noise down to the package. */
export function prettySource(path: string): string {
  const p = path.replace(/\\/g, '/').replace(/^(\.\.\/)+/, '');
  const nm = p.lastIndexOf('node_modules/');
  return nm >= 0 ? p.slice(nm + 'node_modules/'.length) : p;
}

/**
 * A copy of `profile` with frames from the bundle (`bundleUrl`) pointing at
 * their original files and lines instead.
 */
export function mapProfile(profile: CpuProfile, map: SourceMap | null | undefined, bundleUrl: string): CpuProfile {
  if (!map) return profile;
  const mapper = makeMapper(map);
  return {
    ...profile,
    nodes: profile.nodes.map((n) => {
      const f = n.callFrame;
      if (f.url !== bundleUrl || f.lineNumber < 0) return n;
      const m = mapper(f.lineNumber, f.columnNumber);
      if (!m) return n;
      return { ...n, callFrame: { ...f, url: prettySource(m.source), lineNumber: m.line, columnNumber: m.col } };
    }),
  };
}
