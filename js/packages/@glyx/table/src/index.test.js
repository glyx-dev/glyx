import { test, expect } from 'bun:test';
import { DataTable } from './index.js';

// DataTable depends on live layout (measureText, VirtualizedList viewport),
// so a full render needs a running window — this guards the module contract.
test('DataTable is exported and importable under stubs', () => {
  expect(typeof DataTable).toBe('function');
});
