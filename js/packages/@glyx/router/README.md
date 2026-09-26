# @glyx-dev/router

Named-route history-stack router for Glyx desktop apps.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/router
# or npm install @glyx-dev/router
```

## Usage

```jsx
import { Router, Route, useNavigate, useRoute } from '@glyx-dev/router';

<Router initialRoute="home">
  <Route name="home" component={HomeScreen} />
  <Route name="settings" component={SettingsScreen} />
  <Route name="detail" component={DetailScreen} />
</Router>;

function HomeScreen() {
  const navigate = useNavigate();
  const { name, params, canGoBack } = useRoute();
  return <Button onPress={() => navigate('detail', { id: 42 })}>Open</Button>;
}
```

Desktop apps have no URL bar, so this router keeps a simple in-memory history stack of `{ name, params }` entries — the same model as React Navigation for mobile, with zero native dependencies.

```js
navigate('detail', { id: 42 }); // push
navigate('back'); // pop
navigate('home', {}, { replace: true }); // replace top of stack
```

## API

- `Router({ children, initialRoute })` — scans its `<Route>` children to build a name → component map, and renders the component for the top of the history stack. Defaults to the first declared route if `initialRoute` is omitted.
- `Route({ name, component })` — declarative route definition; always renders `null` (its props are read by the parent `Router`).
- `useNavigate()` — returns the stable `navigate(name, params?, opts?)` function. Must be called inside a `<Router>`.
- `useRoute()` — returns `{ name, params, canGoBack }` for the current top-of-stack route. Must be called inside a `<Router>`.
