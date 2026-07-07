import { test, expect } from 'bun:test';
// Importing proves the module and its drizzle-orm dependency resolve.
import { createDrizzle } from './index.js';

test('createDrizzle is exported and importable', () => {
  expect(typeof createDrizzle).toBe('function');
});
