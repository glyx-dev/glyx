// @glyx/router — Named-route history-stack router for Glyx desktop apps.
//
// Desktop apps have no URL bar. This router uses a simple in-memory history
// stack of { name, params } entries — the same model as React Navigation for
// mobile, but with zero native dependencies.
//
// Usage:
//   <Router initialRoute="home">
//     <Route name="home"     component={HomeScreen} />
//     <Route name="settings" component={SettingsScreen} />
//     <Route name="detail"   component={DetailScreen} />
//   </Router>
//
//   const navigate = useNavigate();
//   navigate('detail', { id: 42 })           // push
//   navigate('back')                          // pop
//   navigate('home', {}, { replace: true })  // replace top of stack
//
//   const { name, params, canGoBack } = useRoute();

import React, { createContext, useContext, useState, useCallback, Children, useMemo } from 'react';

// ── Contexts ───────────────────────────────────────────────────────────────────
// Split into two contexts so consumers that only need `navigate` don't re-render
// on every route change (RouteStateCtx changes; RouterActionsCtx is stable).

const RouteStateCtx   = createContext(null);
const RouterActionsCtx = createContext(null);

// ── Router ────────────────────────────────────────────────────────────────────
//
// Scans its children for <Route> elements to build a name → component map.
// Renders the component for the top-most history entry.

export function Router({ children, initialRoute }) {
  // Build route map from <Route name="…" component={…}> children.
  const routeMap = {};
  Children.forEach(children, (child) => {
    if (child && child.type === Route) {
      routeMap[child.props.name] = child.props.component;
    }
  });

  // Default to the first declared route if initialRoute is not given.
  const firstName = initialRoute ?? Object.keys(routeMap)[0] ?? null;

  const [history, setHistory] = useState([{ name: firstName, params: {} }]);

  // navigate is stable — setHistory is always the same reference,
  // and we use functional updates so we don't capture stale state.
  const navigate = useCallback((name, params = {}, opts = {}) => {
    if (name === 'back') {
      setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
    } else if (opts.replace) {
      setHistory((h) => [...h.slice(0, -1), { name, params }]);
    } else {
      setHistory((h) => [...h, { name, params }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const routeState = useMemo(() => {
    const current = history[history.length - 1] ?? { name: null, params: {} };
    return { routeName: current.name, params: current.params, canGoBack: history.length > 1 };
  }, [history]);

  const Screen = routeState.routeName ? routeMap[routeState.routeName] : null;

  return React.createElement(
    RouterActionsCtx.Provider,
    { value: navigate },
    React.createElement(
      RouteStateCtx.Provider,
      { value: routeState },
      Screen ? React.createElement(Screen) : null,
    ),
  );
}

// ── Route ─────────────────────────────────────────────────────────────────────
//
// Declarative route definition. Router reads its props via Children.forEach;
// Route itself always renders null.

export function Route(_props) {
  return null;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Returns the navigate(name, params?, opts?) function. Stable across renders. */
export function useNavigate() {
  const navigate = useContext(RouterActionsCtx);
  if (!navigate) throw new Error('useNavigate must be used inside <Router>');
  return navigate;
}

/**
 * Returns the current route state.
 * @returns {{ name: string|null, params: object, canGoBack: boolean }}
 */
export function useRoute() {
  const state = useContext(RouteStateCtx);
  if (!state) throw new Error('useRoute must be used inside <Router>');
  return state;
}
