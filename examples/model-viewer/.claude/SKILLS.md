# Project Skills for Claude Code

These skills help Claude work with this Glyx app.

## /add-capability

Add a new capability to this app.

1. Open `glyx.config.ts` and add the capability key to the `capabilities` block
2. For `fs`, add glob patterns to `read`, `write`, or `delete` arrays
3. Import the API in your component: `import { fs, db, clipboard, ... } from '@glyx/react'`
4. Glyx will enforce the capability at runtime — calls outside declared globs throw `CapabilityDenied`

Common capabilities: `fs`, `db`, `dialog`, `clipboard`, `notification`, `audio`, `network`, `credentials`, `storage`, `updater`

## /scaffold-component

Create a new React component for this app.

1. Create the file in `src/components/` (JS-only) or `ui/components/` (native project)
2. Use `@glyx/react` primitives — `View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `Image`
3. Use `@glyx/design` for themed UI — `Button`, `Card`, `TextField`, `Modal`, `Alert`, `Tabs`
4. Style with object props (React Native-style, not CSS strings)

## /scaffold-plugin

Add a JS plugin to extend this app with custom backend commands.

1. Create `src/plugins/<name>.plugin.js`
2. Export async functions — they become `backend.<name>.<fn>()` in React
3. Register in `glyx.config.ts`: `plugins: [{ entry: 'src/plugins/<name>.plugin.js', name: '<name>', capabilities: [...] }]`
4. Plugins can use any capability their `capabilities` array declares (must be granted to the app too)

```js
// src/plugins/example.plugin.js
import { db } from '@glyx/react'

export async function getAll() {
  return db.query('SELECT * FROM items ORDER BY created_at DESC')
}
```

## /explain-error

Common errors in Glyx apps:

**CapabilityDenied** — the JS code called a gated API but the capability is missing from `glyx.config.ts`.
Fix: add the capability key to the `capabilities` block.

**fs path not allowed** — the `fs.*` call used a path outside the declared globs.
Fix: widen the `read`/`write`/`delete` globs, or use `dialog.showOpenDialog()` (dialog results are pre-authorized).

**plugin capability not granted** — a plugin's `capabilities` array lists something the app hasn't declared.
Fix: add the capability to the app's top-level `capabilities` block first.

**Canvas ctx is null** — `canvasRef.current` is accessed before the `Canvas` mounts.
Fix: guard with `if (!ctx) return` inside the `useEffect`, or use `_veloxOnMount` callback.
