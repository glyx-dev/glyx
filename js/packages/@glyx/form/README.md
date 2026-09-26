# @glyx-dev/form

Form orchestration: validation, errors, touched state (Zod-compatible).

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/form
# or npm install @glyx-dev/form
```

## Usage

```jsx
import { useForm, FormField } from '@glyx-dev/form';
import { TextInput } from '@glyx-dev/react';

function LoginForm() {
  const form = useForm({ defaultValues: { email: '' }, schema, onSubmit });

  return (
    <FormField form={form} name="email" label="Email">
      <TextInput
        value={form.values.email}
        onChangeText={(v) => form.setValue('email', v)}
        onBlur={() => form.setTouched('email')}
      />
    </FormField>
  );
}
```

`schema` is optional and schema-agnostic — any object with a `safeParse(values)` method works (Zod works directly). Without a schema, submission always passes.

## API

- `useForm({ defaultValues, schema, onSubmit })` — form state hook. Returns `{ values, errors, touched, submitting, setValue(field, value), setTouched(field), handleSubmit(), isValid, reset() }`. `isValid` is derived fresh from current `values` on every render, not from the `errors` state (which is only populated once a field is touched).
- `FormField({ form, name, label, children })` — layout wrapper that shows `label`, `children`, and the field's error message once it's `touched`.
