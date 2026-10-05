// Automatic element IDs for devtools (GDP M2.5).
//
// Every host node gets an ID built from the CODE, never from text or screen
// position, so it is the same in every language and survives text/data
// changes, restyling, relaunches and re-renders:
//
//   App › NoteList › NoteCard[42] › Pressable#0
//   └─ app components ─┘  └ key ┘   └ Glyx component + per-type slot ┘
//
//  - App components (not Glyx's own) are path segments, each `Name[key]` or
//    `Name#n` (n = nth component of that name inside its parent segment).
//  - The node itself is named after the nearest Glyx component that renders
//    it (`Pressable#0`, `TextInput#1`), slot counted per name inside its app
//    component; extra hosts inside that component add `/text#0`. With no Glyx
//    component, the host type is used (`view#2`).
//  - An explicit `testID` replaces the ID (`pinned`).
//
// One depth-first pass over React's current fiber tree computes every ID
// (O(n)); hostConfig.js caches the result for large trees.

const HOST_COMPONENT = 5; // React 18 fiber tag

/** The function behind a component fiber (function/class, forwardRef), or null. */
function componentFn(f) {
  const t = f.type;
  if (typeof t === 'function') return t;
  if (t && typeof t === 'object' && typeof t.render === 'function') return t.render; // forwardRef
  return null; // host, memo wrapper (its child carries the function), context, …
}

function componentName(f, fn) {
  const t = f.type;
  return (t && t.displayName) || fn.displayName || fn.name || 'Anonymous';
}

/** Post-increment a per-name counter. */
function bump(counts, key) {
  const n = counts.get(key) || 0;
  counts.set(key, n + 1);
  return n;
}

const segment = (name, key, n) => (key != null ? `${name}[${key}]` : `${name}#${n}`);

function newScope(prefix) {
  return { prefix, app: new Map(), lib: new Map(), host: new Map() };
}

/**
 * IDs for every host node under `rootFiber` (the HostRoot's current fiber).
 * `isLibrary(fn)` says whether a component is Glyx's own.
 * Returns `Map<nodeId, { id, pinned? }>`; IDs are unique (`~2` suffix on the
 * rare collision, e.g. duplicate keys or a reused testID).
 */
export function computeIds(rootFiber, isLibrary) {
  const out = new Map();
  const seen = new Map();
  if (!rootFiber) return out;

  // Iterative DFS: frames of { fiber, scope, lib } (lib = nearest Glyx
  // component's label + its own host counters, or null).
  const stack = [];
  const pushChildren = (f, scope, lib) => {
    const kids = [];
    for (let c = f.child; c; c = c.sibling) kids.push(c);
    for (let i = kids.length - 1; i >= 0; i--) stack.push({ fiber: kids[i], scope, lib });
  };
  pushChildren(rootFiber, newScope(''), null);

  while (stack.length) {
    const { fiber: f, scope, lib } = stack.pop();
    const fn = componentFn(f);
    if (fn) {
      const name = componentName(f, fn);
      if (isLibrary(fn) || isLibrary(f.type)) {
        const label = scope.prefix + segment(name, f.key, bump(scope.lib, name));
        pushChildren(f, scope, { label, hosts: new Map(), first: true });
      } else {
        const seg = segment(name, f.key, bump(scope.app, name));
        pushChildren(f, newScope(scope.prefix + seg + ' › '), null);
      }
      continue;
    }
    if (f.tag === HOST_COMPONENT) {
      let auto;
      if (lib) {
        const n = bump(lib.hosts, f.type);
        auto = lib.first ? lib.label : `${lib.label}/${f.type}#${n}`;
        lib.first = false;
      } else {
        auto = scope.prefix + segment(f.type, f.key, bump(scope.host, f.type));
      }
      const nodeId = f.stateNode && f.stateNode.id;
      if (nodeId != null && nodeId !== -1) {
        const tid = f.memoizedProps && f.memoizedProps.testID;
        const pinned = tid != null && tid !== '';
        let id = pinned ? String(tid) : auto;
        const dup = bump(seen, id);
        if (dup > 0) id += '~' + (dup + 1);
        out.set(nodeId, pinned ? { id, pinned: true } : { id });
      }
    }
    pushChildren(f, scope, lib);
  }
  return out;
}
