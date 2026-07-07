// @glyx/markdown — render Markdown as Glyx component trees.
//
// Self-contained block parser (no external deps). Handles headings, paragraphs,
// ordered/unordered lists, fenced code blocks, blockquotes, and horizontal
// rules. Inline emphasis markers (**bold**, *italic*, `code`) are stripped to
// plain text — the renderer's Text node doesn't yet support mixed inline spans.
//
//   import { Markdown } from '@glyx/markdown';
//   <Markdown source={md} width={600} />

import React from 'react';
import { View, Text } from '@glyx/react';

const DEFAULT = {
  h1: { fontSize: 26, color: '#E0E0F0', bold: true,  mb: 12 },
  h2: { fontSize: 21, color: '#E0E0F0', bold: true,  mb: 10 },
  h3: { fontSize: 17, color: '#E0E0F0', bold: true,  mb: 8  },
  p:  { fontSize: 14, color: '#A0A0B2', mb: 12 },
  code: { fontSize: 13, color: '#C8F0E0' },
  quote: { fontSize: 14, color: '#A0A0B2' },
};

// Strip inline emphasis to plain text (no rich spans yet).
export function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*(?!\*)(.+?)\*/g, '$1$2')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1');
}

// Tokenize markdown into block tokens.
export function lex(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const toks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {              // fenced code
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      toks.push({ type: 'code', text: buf.join('\n') });
      continue;
    }
    if (/^\s*$/.test(line)) { i++; continue; }                 // blank
    if (/^#{1,3}\s/.test(line)) {                              // heading
      const depth = line.match(/^#+/)[0].length;
      toks.push({ type: 'heading', depth, text: inline(line.replace(/^#+\s/, '')) });
      i++; continue;
    }
    if (/^>\s?/.test(line)) {                                  // blockquote
      toks.push({ type: 'quote', text: inline(line.replace(/^>\s?/, '')) });
      i++; continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {          // hr
      toks.push({ type: 'hr' }); i++; continue;
    }
    if (/^\s*([-*+]|\d+\.)\s/.test(line)) {                    // list
      const items = [];
      const ordered = /^\s*\d+\./.test(line);
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s/.test(lines[i])) {
        items.push(inline(lines[i].replace(/^\s*([-*+]|\d+\.)\s/, '')));
        i++;
      }
      toks.push({ type: 'list', ordered, items });
      continue;
    }
    // paragraph (consume consecutive non-blank lines)
    const buf = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,3}\s|>\s?|```|\s*([-*+]|\d+\.)\s)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    toks.push({ type: 'paragraph', text: inline(buf.join(' ')) });
  }
  return toks;
}

export function Markdown({ source, width, styles = {} }) {
  const s = { ...DEFAULT, ...styles };
  const toks = lex(source || '');

  const nodes = toks.map((t, i) => {
    switch (t.type) {
      case 'heading': {
        const hs = s[`h${t.depth}`] || s.h3;
        return React.createElement(Text, { key: i, fontSize: hs.fontSize, width,
          style: { color: hs.color, fontWeight: hs.bold ? '700' : '400', marginBottom: hs.mb } }, t.text);
      }
      case 'paragraph':
        return React.createElement(Text, { key: i, fontSize: s.p.fontSize, width,
          style: { color: s.p.color, marginBottom: s.p.mb, lineHeight: 1.6 } }, t.text);
      case 'code':
        return React.createElement(View, { key: i, width,
          style: { backgroundColor: '#14141A', borderRadius: 6, padding: 12, marginBottom: 12 } },
          React.createElement(Text, { fontSize: s.code.fontSize, width: width - 24,
            style: { color: s.code.color, fontFamily: 'monospace' } }, t.text));
      case 'quote':
        return React.createElement(View, { key: i, width,
          style: { borderLeftWidth: 3, borderLeftColor: '#00A878', paddingLeft: 12, marginBottom: 12 } },
          React.createElement(Text, { fontSize: s.quote.fontSize, width: width - 16, style: { color: s.quote.color } }, t.text));
      case 'hr':
        return React.createElement(View, { key: i, width, style: { height: 1, backgroundColor: '#2A2A3A', marginVertical: 12 } });
      case 'list':
        return React.createElement(View, { key: i, width, style: { gap: 4, marginBottom: 12 } },
          ...t.items.map((item, j) => React.createElement(View, { key: j, width, style: { flexDirection: 'row', gap: 8 } },
            React.createElement(Text, { fontSize: 14, width: 18, style: { color: '#00A878' } }, t.ordered ? `${j + 1}.` : '•'),
            React.createElement(Text, { fontSize: 14, width: width - 26, style: { color: s.p.color } }, item))));
      default:
        return null;
    }
  });

  return React.createElement(View, { width, style: { gap: 0 } }, ...nodes);
}
