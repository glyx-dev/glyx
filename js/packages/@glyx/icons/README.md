# @glyx-dev/icons

Icon set for Glyx apps — Lucide icons rendered as inline SVG.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/icons
# or npm install @glyx-dev/icons
```

## Usage

```jsx
import { Icon } from '@glyx-dev/icons';

<Icon name="arrow-right" size={20} color="#fff" />
<Icon name="check-circle" size={24} color="#00A878" strokeWidth={1.5} />
```

Icons are rendered as inline SVG data URIs (via `@glyx-dev/react`'s `Image`), so they work without any asset-bundling step and support runtime color/size changes. Lucide icons are MIT licensed (https://lucide.dev).

## API

- `Icon({ name, size = 24, color = '#000000', strokeWidth = 2, style })` — renders the named icon. Logs a warning and renders nothing if `name` is not found in the registry.
- `iconNames()` — returns an array of all available icon name strings (arrows, chevrons, basic actions, status/feedback, UI/navigation, file/storage, communication, date/time, media, globe/network, theme, and misc icons — see `src/index.js` for the full list).
