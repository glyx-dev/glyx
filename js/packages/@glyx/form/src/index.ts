// @glyx-dev/form — form orchestration: values, validation, errors, touched.
//
// Schema-agnostic: pass any object with a `safeParse(values)` method (Zod works
// directly). Without a schema, submission always passes.
//
//   import { useForm, FormField } from '@glyx-dev/form';
//   const form = useForm({ defaultValues:{email:''}, schema, onSubmit });
//   <FormField form={form} name="email" label="Email">
//     <TextInput value={form.values.email}
//                onChangeText={v => form.setValue('email', v)}
//                onBlur={() => form.setTouched('email')} />
//   </FormField>

import React from 'react';
import { View, Text } from '@glyx-dev/react';

const { useState, useCallback } = React;

/** One validation problem, Zod-style. */
export interface FormIssue {
  path: string | number | Array<string | number>;
  message: string;
}

/** Any validator with a `safeParse(values)` method (Zod works as it is). */
export interface FormSchema<V> {
  safeParse(values: V): { success: boolean; error?: { issues?: FormIssue[]; errors?: FormIssue[] } };
}

export interface UseFormOptions<V extends Record<string, unknown>> {
  defaultValues?: V;
  schema?: FormSchema<V>;
  onSubmit?: (values: V) => void | Promise<void>;
}

export interface FormApi<V extends Record<string, unknown>> {
  values: V;
  /** A message per invalid field. */
  errors: Partial<Record<keyof V & string, string | undefined>>;
  /** Which fields have been blurred or submitted. */
  touched: Partial<Record<keyof V & string, boolean>>;
  submitting: boolean;
  setValue<K extends keyof V & string>(field: K, value: V[K]): void;
  setTouched(field: keyof V & string): void;
  handleSubmit(): Promise<void>;
  /** Whether the current values pass the schema (true without one). */
  isValid: boolean;
  reset(): void;
}

function collectErrors(result: { error?: { issues?: FormIssue[]; errors?: FormIssue[] } } | undefined): Record<string, string> {
  // Zod-style: result.error.issues[{ path:[field], message }]
  const errs: Record<string, string> = {};
  const issues = result?.error?.issues || result?.error?.errors || [];
  for (const issue of issues) {
    const key = Array.isArray(issue.path) ? issue.path[0] : issue.path;
    if (key != null && errs[key] == null) errs[key] = issue.message;
  }
  return errs;
}

export function useForm<V extends Record<string, unknown> = Record<string, unknown>>({ defaultValues, schema, onSubmit }: UseFormOptions<V>): FormApi<V> {
  const [values, setValues]   = useState<V>(defaultValues || ({} as V));
  const [errors, setErrors]   = useState<Record<string, string | undefined>>({});
  const [touched, setTouchedS] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const validateAll = useCallback((vals: V): Record<string, string | undefined> => {
    if (!schema) return {};
    const result = schema.safeParse(vals);
    return result.success ? {} : collectErrors(result);
  }, [schema]);

  const setValue = useCallback((field: string, value: unknown) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value } as V;
      if (schema) {
        setErrors((e) => {
          const all = validateAll(next);
          return { ...e, [field]: all[field] }; // refresh just this field
        });
      }
      return next;
    });
  }, [schema, validateAll]);

  const setTouched = useCallback((field: string) => {
    setTouchedS((prev) => ({ ...prev, [field]: true }));
    if (schema) setErrors((e) => ({ ...e, [field]: validateAll(values)[field] }));
  }, [schema, validateAll, values]);

  const handleSubmit = useCallback(async () => {
    const all = validateAll(values);
    const hasErr = Object.values(all).some(Boolean);
    if (hasErr) {
      setErrors(all);
      setTouchedS(Object.fromEntries(Object.keys(values).map((k) => [k, true])));
      return;
    }
    setSubmitting(true);
    try { await onSubmit?.(values); }
    finally { setSubmitting(false); }
  }, [values, validateAll, onSubmit]);

  // Derived fresh from the current values every render — not from `errors`,
  // which only gets populated once a field is touched/blurred/submitted and
  // would otherwise report `true` for a schema-invalid initial/default state.
  const isValid = schema
    ? Object.values(validateAll(values)).every((e) => !e)
    : true;

  return { values, errors, touched, submitting, setValue, setTouched, handleSubmit, isValid, reset: () => {
    setValues(defaultValues || ({} as V)); setErrors({}); setTouchedS({}); setSubmitting(false);
  } } as FormApi<V>;
}

export interface FormFieldProps<V extends Record<string, unknown>> {
  form: FormApi<V>;
  name: keyof V & string;
  label?: string;
  children?: React.ReactNode;
}

export function FormField<V extends Record<string, unknown>>({ form, name, label, children }: FormFieldProps<V>): React.ReactElement {
  const error   = form.errors[name];
  const touched = form.touched[name];
  return React.createElement(View, { style: { gap: 4, marginBottom: 16 } },
    label && React.createElement(Text, { fontSize: 12, style: { color: '#A0A0B2' } }, label),
    children,
    touched && error && React.createElement(Text, { fontSize: 11, style: { color: '#E05060' } }, error),
  );
}
