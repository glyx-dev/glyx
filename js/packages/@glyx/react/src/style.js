// Style helpers: `style` may be an object, a falsy value, or a (nested) array
// of those, as in React Native: style={[base, active && highlighted]}.

/**
 * Merge a style, or an array of styles, into one object. Later entries win,
 * falsy entries (`false`, `null`, `undefined`) are skipped, arrays may nest.
 * A plain object is returned as is, so the common case allocates nothing.
 */
export function flattenStyle(style) {
  if (!style) return undefined;
  if (!Array.isArray(style)) return style;
  let out;
  for (let i = 0; i < style.length; i++) {
    const part = flattenStyle(style[i]);
    if (part) out = out ? Object.assign(out, part) : Object.assign({}, part);
  }
  return out;
}

export const StyleSheet = {
  /** Returns the styles unchanged. It exists to define them once, outside render, and to type-check keys. */
  create: (styles) => styles,
  flatten: flattenStyle,
  /** `compose(a, b)` is `[a, b]`, kept as a single flat object when either is empty. */
  compose: (a, b) => (a && b ? [a, b] : a || b),
  /** Position and size that fill the parent. */
  absoluteFill: Object.freeze({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }),
};
