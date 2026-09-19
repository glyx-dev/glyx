# @glyx-dev/design

Design tokens, theming, and base styles for Glyx apps.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/design
# or npm install @glyx-dev/design
```

## Usage

```jsx
import { ThemeProvider, Button, Card, TextField, Alert } from '@glyx-dev/design';
import { render } from '@glyx-dev/react';

render(
  <ThemeProvider colorScheme="system">
    <Card>
      <TextField label="Name" />
      <Button onPress={submit}>Save</Button>
      <Alert kind="success">Saved!</Alert>
    </Card>
  </ThemeProvider>
);
```

## API

- **Tokens / theming**: `tokens`, `darkTokens` (raw design token objects — colors, space, radius, fontSize, …), `ThemeProvider` (wraps the app, handles light/dark/system color scheme), `useTheme()` (hook returning current theme tokens), `createTheme(base, overrides)` (builds a custom theme object).
- **Base components**: `Button`, `IconButton`, `Card`, `Divider`, `Label`, `Heading`, `Badge`.
- **Form components**: `TextField`, `SwitchRow`, `CheckboxRow`, `NumberInput`, `SearchInput`.
- **Feedback components**: `Alert`, `ProgressBar`, `Spinner`, `Skeleton`, `ToastProvider`, `useToast()`.
- **Overlay components**: `Modal`, `ModalFooter`, `Tooltip`, `Sheet`.
- **Display components**: `Avatar`, `AvatarGroup`, `Chip`, `Empty`, `Stat`, `KVRow`.
- **Navigation components**: `Tabs`, `Accordion`, `Stepper`, `Breadcrumb`.
- **Window**: `WindowControls`.
