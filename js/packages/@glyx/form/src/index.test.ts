import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useForm, FormField } from './index.js';

// Hooks need a render pass; SSR gives us the initial render without a window.
function Probe({ onReady, ...opts }) {
  const form = useForm(opts);
  onReady(form);
  return null;
}

function getForm(opts) {
  let form;
  renderToStaticMarkup(React.createElement(Probe, { ...opts, onReady: (f) => { form = f; } }));
  return form;
}

test('useForm starts with defaults, no errors, valid', () => {
  const form = getForm({ defaultValues: { email: 'a@b.c', name: '' } });
  expect(form.values).toEqual({ email: 'a@b.c', name: '' });
  expect(form.errors).toEqual({});
  expect(form.isValid).toBe(true);
  expect(form.submitting).toBe(false);
});

test('handleSubmit blocks submission when the schema rejects', async () => {
  const schema = {
    safeParse: () => ({
      success: false,
      error: { issues: [{ path: ['email'], message: 'Invalid email' }] },
    }),
  };
  let submitted = false;
  const form = getForm({ defaultValues: { email: 'nope' }, schema, onSubmit: () => { submitted = true; } });
  await form.handleSubmit();
  expect(submitted).toBe(false);
});

test('handleSubmit calls onSubmit with values when valid', async () => {
  const schema = { safeParse: () => ({ success: true }) };
  let got = null;
  const form = getForm({ defaultValues: { email: 'a@b.c' }, schema, onSubmit: (v) => { got = v; } });
  await form.handleSubmit();
  expect(got).toEqual({ email: 'a@b.c' });
});

test('FormField renders its label', () => {
  const form = getForm({ defaultValues: { email: '' } });
  const html = renderToStaticMarkup(
    React.createElement(FormField, { form, name: 'email', label: 'Email Address' },
      React.createElement('text', null, 'child'))
  );
  expect(html).toContain('Email Address');
});
