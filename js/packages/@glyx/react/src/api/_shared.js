// @glyx-dev/react — internal helpers shared by several domains.

/**
 * Whether the Rust host was built with the `a11y` Cargo feature enabled.
 * Setting `role`/`ariaLabel`/etc props is harmless either way, but this lets
 * an app branch on it (e.g. skip building an accessibility-tree-heavy UI
 * variant, or show a settings toggle) instead of guessing.
 */
export function hasAccessibility() {
  return typeof __glyx_hasA11y !== 'undefined' && __glyx_hasA11y();
}

export const _noBinding = (name) => Promise.reject(new Error(`${name}: binding not available`));
