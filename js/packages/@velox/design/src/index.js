// @velox/design — Design system for Velox apps
//
// Exports:
//   tokens, darkTokens — raw design token objects (colors, space, radius, fontSize, …)
//   ThemeProvider      — wraps your app with a theme context; handles light/dark/system
//   useTheme()         — hook that returns the current theme tokens
//   createTheme(base, overrides) — build a custom theme object
//   Button, Card, Divider, Label, Heading, Badge — pre-themed base components
//
// Quick-start:
//   import { ThemeProvider, useTheme, Button, Card } from '@velox/design';
//
//   render(
//     <ThemeProvider colorScheme="system">
//       <App />
//     </ThemeProvider>
//   );

export { tokens, darkTokens } from './tokens.js';
export { ThemeProvider, useTheme, createTheme } from './theme.js';
export { Button, Card, Divider, Label, Heading, Badge } from './components.js';
