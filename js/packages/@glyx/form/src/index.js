// @glyx/form — form orchestration: values, validation, errors, touched.
//
// Schema-agnostic: pass any object with a `safeParse(values)` method (Zod works
// directly). Without a schema, submission always passes.
//
//   import { useForm, FormField } from '@glyx/form';
//   const form = useForm({ defaultValues:{email:''}, schema, onSubmit });
//   <FormField form={form} name="email" label="Email">
//     <TextInput value={form.values.email}
//                onChangeText={v => form.setValue('email', v)}
//                onBlur={() => form.setTouched('email')} />
//   </FormField>

import React from 'react';
import { View, Text } from '@glyx/react';

const { useState, useCallback } = React;

function collectErrors(result) {
  // Zod-style: result.error.issues[{ path:[field], message }]
  const errs = {};
  const issues = result?.error?.issues || result?.error?.errors || [];
  for (const issue of issues) {
    const key = Array.isArray(issue.path) ? issue.path[0] : issue.path;
    if (key != null && errs[key] == null) errs[key] = issue.message;
  }
  return errs;
}

export function useForm({ defaultValues, schema, onSubmit }) {
  const [values, setValues]   = useState(defaultValues || {});
  const [errors, setErrors]   = useState({});
  const [touched, setTouchedS] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validateAll = useCallback((vals) => {
    if (!schema) return {};
    const result = schema.safeParse(vals);
    return result.success ? {} : collectErrors(result);
  }, [schema]);

  const setValue = useCallback((field, value) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      if (schema) {
        setErrors((e) => {
          const all = validateAll(next);
          return { ...e, [field]: all[field] }; // refresh just this field
        });
      }
      return next;
    });
  }, [schema, validateAll]);

  const setTouched = useCallback((field) => {
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

  const isValid = Object.values(errors).every((e) => !e);

  return { values, errors, touched, submitting, setValue, setTouched, handleSubmit, isValid, reset: () => {
    setValues(defaultValues || {}); setErrors({}); setTouchedS({}); setSubmitting(false);
  } };
}

export function FormField({ form, name, label, children }) {
  const error   = form.errors[name];
  const touched = form.touched[name];
  return React.createElement(View, { style: { gap: 4, marginBottom: 16 } },
    label && React.createElement(Text, { fontSize: 12, style: { color: '#A0A0B2' } }, label),
    children,
    touched && error && React.createElement(Text, { fontSize: 11, style: { color: '#E05060' } }, error),
  );
}
