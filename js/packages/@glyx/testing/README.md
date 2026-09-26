# @glyx-dev/testing

Test utilities for Glyx apps — compatible with Bun's test runner.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add -d @glyx-dev/testing
# or npm install -D @glyx-dev/testing
```

## Usage

```js
// bunfig.toml
// [test]
// preload = ["@glyx-dev/testing/setup"]

import { render, screen, act, fireEvent } from '@glyx-dev/testing';

test('Counter increments', async () => {
  const { getByText } = await render(<Counter />);
  fireEvent.press(getByText('+'));
  expect(screen.getByText('1')).toBeTruthy();
});
```

Architecture: every `__glyx_*` native binding is mocked (via `installStubs`, run automatically by the `./setup` preload) so React components and packages that call Glyx APIs can run in a plain Bun process — no GPU, no wgpu, no winit, no running Glyx window. React is rendered with `react-reconciler` against a lightweight in-memory host, so components get real state/effects and their event handler props are inspectable in tests.

## API

- `./setup` (import as `@glyx-dev/testing/setup`, referenced from `bunfig.toml`'s `test.preload`) — installs all native binding stubs before tests run.
- `installStubs()` — installs stub implementations of every `__glyx_*` binding onto `globalThis`. Called automatically by `./setup`.
- `mockBinding(name, impl)` — overrides a single `__glyx_*` binding with a custom mock implementation, saving the original for restoration.
- `unmockBinding(name)` — restores a single binding to its pre-mock value.
- `restoreAllBindings()` — restores every mocked binding.
- `render(element)` — renders a Glyx/React element tree against the in-memory test host. Returns query helpers (`getByText`, `queryByText`, `getAllByText`, `getByTestId`, `queryByTestId`, `getAllByTestId`, …).
- `screen` — query helpers (`getByText`, `queryByText`, `getAllByText`, `getByTestId`, `queryByTestId`, `getAllByTestId`) bound to the most recently rendered tree.
- `act(callback)` — flushes React state updates/effects synchronously around `callback`, mirroring `react-dom/test-utils`' `act`.
- `fireEvent` — simulates events on a queried node's props, e.g. `fireEvent.press(node)` calls `node.onPress()`; `fireEvent.changeText(node, text)` calls `node.onChangeText(text)`.
- `waitFor(assertion, { timeout = 1000, interval = 50 })` — polls `assertion` until it stops throwing or the timeout elapses.
- `getNodeTree()` — returns the raw in-memory host tree for the last render, for advanced assertions.
