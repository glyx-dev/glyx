# @glyx-dev/split-pane

Resizable split-pane layouts with a draggable divider.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/split-pane
# or npm install @glyx-dev/split-pane
```

## Usage

```jsx
import { SplitPane } from '@glyx-dev/split-pane';

<SplitPane direction="horizontal" defaultSizes={[30, 70]} width={W} height={H}>
  <Sidebar />
  <Editor />
</SplitPane>;
```

## API

- `SplitPane({ direction = 'horizontal', defaultSizes = [40, 60], minSizes = [80, 80], dividerSize = 8, dividerColor, dividerHoverColor, dividerActiveColor, children, width, height })` — lays out exactly two children (`children[0]`, `children[1]`) along `direction` (`'horizontal'` or `'vertical'`), separated by a draggable divider. `defaultSizes` is a `[a, b]` percentage pair used to seed the initial split (stored internally as a fraction so it survives container resize); `minSizes` are minimum pixel sizes for each pane. The divider shows hover/active affordance colors and sets the resize cursor while dragging.
