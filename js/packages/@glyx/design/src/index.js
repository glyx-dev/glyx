// @glyx/design — Design system for Glyx apps
//
// Exports:
//   tokens, darkTokens — raw design token objects (colors, space, radius, fontSize, …)
//   ThemeProvider      — wraps your app with a theme context; handles light/dark/system
//   useTheme()         — hook that returns the current theme tokens
//   createTheme(base, overrides) — build a custom theme object
//
// Base components (components.js):
//   Button, IconButton, Card, Divider, Label, Heading, Badge
//
// Form components (form.js):
//   TextField, SwitchRow, CheckboxRow, NumberInput, SearchInput
//
// Feedback components (feedback.js):
//   Alert, ProgressBar, Spinner, Skeleton, ToastProvider, useToast
//
// Overlay components (overlay.js):
//   Modal, ModalFooter, Tooltip, Sheet
//
// Display components (display.js):
//   Avatar, AvatarGroup, Chip, Empty, Stat, KVRow
//
// Navigation components (navigation.js):
//   Tabs, Accordion, Stepper, Breadcrumb
//
// Quick-start:
//   import { ThemeProvider, Button, Card, TextField, Alert } from '@glyx/design';
//
//   render(
//     <ThemeProvider colorScheme="system">
//       <App />
//     </ThemeProvider>
//   );

export { tokens, darkTokens } from './tokens.js';
export { ThemeProvider, useTheme, createTheme } from './theme.js';
export { Button, IconButton, Card, Divider, Label, Heading, Badge } from './components.js';
export { TextField, SwitchRow, CheckboxRow, NumberInput, SearchInput } from './form.js';
export { Alert, ProgressBar, Spinner, Skeleton, ToastProvider, useToast } from './feedback.js';
export { Modal, ModalFooter, Tooltip, Sheet } from './overlay.js';
export { Avatar, AvatarGroup, Chip, Empty, Stat, KVRow } from './display.js';
export { Tabs, Accordion, Stepper, Breadcrumb } from './navigation.js';
