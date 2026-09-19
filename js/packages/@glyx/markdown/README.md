# @glyx-dev/markdown

Render Markdown as Glyx component trees.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/markdown
# or npm install @glyx-dev/markdown
```

## Usage

```jsx
import { Markdown } from '@glyx-dev/markdown';

<Markdown source={md} width={600} />;
```

Self-contained block parser with no external dependencies. Handles headings, paragraphs, ordered/unordered lists, fenced code blocks, blockquotes, and horizontal rules. Inline emphasis markers (`**bold**`, `*italic*`, `` `code` ``) are stripped to plain text — the underlying `Text` node doesn't yet support mixed inline spans.

## API

- `Markdown({ source, width, styles })` — parses `source` (a Markdown string) and renders it as a tree of `View`/`Text` nodes sized to `width`. `styles` lets you override the default per-block-type styling (`h1`–`h6`, `p`, `code`, `quote`).
- `lex(src)` — tokenizes a Markdown string into an array of block tokens (`heading`, `paragraph`, `code`, `quote`, `hr`, `list`). Exposed for advanced/custom rendering.
- `inline(s)` — strips inline emphasis markers (`**bold**`, `*italic*`, `` `code` ``, `[text](url)`) down to plain text.
