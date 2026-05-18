/**
 * @velox/drizzle — Drizzle ORM adapter for Velox SQLite
 *
 * Usage:
 *   import { createDrizzle } from '@velox/drizzle';
 *   import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
 *
 *   const handle = await db.open('myapp.db');
 *   const drizzle = createDrizzle(handle);
 *   const rows = await drizzle.select().from(myTable);
 *
 * The adapter bridges Drizzle's sqlite-proxy driver to Velox's
 * __velox_db_query / __velox_db_run native bindings.
 * drizzle-orm must be installed as a peer dependency.
 */

import { drizzle } from 'drizzle-orm/sqlite-proxy';

/**
 * Create a Drizzle database instance backed by a Velox SQLite handle.
 *
 * @param {number} dbHandle  - Handle returned by db.open()
 * @param {object} [schema]  - Optional Drizzle relational schema for .query.* API
 * @returns Drizzle SqliteRemoteDatabase
 */
export function createDrizzle(dbHandle, schema) {
  return drizzle(
    async (sql, params, method) => {
      if (method === 'run') {
        // INSERT / UPDATE / DELETE / DDL — result not needed by Drizzle
        await __velox_db_run(dbHandle, sql, JSON.stringify(params));
        return { rows: [] };
      }

      // SELECT — returns array of row objects from Velox binding
      const rowsJson = await __velox_db_query(dbHandle, sql, JSON.stringify(params));
      const rows = JSON.parse(rowsJson);

      if (method === 'values') {
        // Drizzle's .toValues() path expects arrays of values, not objects.
        // Object.values() preserves SQLite column order (V8 insertion-order guarantee).
        return { rows: rows.map(r => Object.values(r)) };
      }

      // 'get' (single row) and 'all' (full result set) — objects are fine
      return { rows };
    },
    schema ? { schema } : undefined,
  );
}
