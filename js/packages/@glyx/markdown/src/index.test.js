import { test, expect } from 'bun:test';
import { lex, inline } from './index.js';

test('inline strips emphasis markers to plain text', () => {
  expect(inline('**bold** and *italic* and `code`')).toBe('bold and italic and code');
  expect(inline('[label](https://example.com)')).toBe('label');
});

test('lex tokenizes headings, paragraphs, and lists', () => {
  const toks = lex('# Title\n\nSome paragraph\ntext here.\n\n- one\n- two\n');
  expect(toks).toEqual([
    { type: 'heading', depth: 1, text: 'Title' },
    { type: 'paragraph', text: 'Some paragraph text here.' },
    { type: 'list', ordered: false, items: ['one', 'two'] },
  ]);
});

test('lex handles fenced code blocks without inline stripping', () => {
  const toks = lex('```\nconst x = **not bold**;\n```');
  expect(toks).toEqual([{ type: 'code', text: 'const x = **not bold**;' }]);
});

test('lex handles blockquotes, hr, and ordered lists', () => {
  const toks = lex('> quoted\n\n---\n\n1. first\n2. second');
  expect(toks[0]).toEqual({ type: 'quote', text: 'quoted' });
  expect(toks[1]).toEqual({ type: 'hr' });
  expect(toks[2]).toEqual({ type: 'list', ordered: true, items: ['first', 'second'] });
});

test('lex normalizes CRLF input', () => {
  const toks = lex('# A\r\n\r\nB');
  expect(toks).toEqual([
    { type: 'heading', depth: 1, text: 'A' },
    { type: 'paragraph', text: 'B' },
  ]);
});
