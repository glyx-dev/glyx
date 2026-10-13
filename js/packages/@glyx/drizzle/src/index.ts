/**
 * @glyx-dev/drizzle — Drizzle ORM adapter for Glyx SQLite
 *
 * Usage:
 *   import { createDrizzle } from '@glyx-dev/drizzle';
 *   import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
 *
 *   const handle = await db.open('myapp.db');
 *   const drizzle = createDrizzle(handle);
 *   const rows = await drizzle.select().from(myTable);
 *
 * The adapter bridges Drizzle's sqlite-proxy driver to Glyx's
 * __glyx_db_query / __glyx_db_run native bindings.
 * drizzle-orm must be installed as a peer dependency.
 */

import { drizzle } from 'drizzle-orm/sqlite-proxy';

/**
 * Create a Drizzle database instance backed by a Glyx SQLite handle.
 *
 * @param dbHandle  Handle returned by db.open()
 * @param schema    Optional Drizzle relational schema for the .query.* API
 * @returns A Drizzle SqliteRemoteDatabase
 */
export function createDrizzle(dbHandle: number, schema?: Record<string, unknown>) {
  return drizzle(
    async (sql: string, params: unknown[], method: string) => {
      if (method === 'run') {
        // INSERT / UPDATE / DELETE / DDL — result not needed by Drizzle
        await __glyx_db_run(dbHandle, sql, JSON.stringify(params));
        return { rows: [] };
      }

      // SELECT — Glyx returns JSON objects; sqlite-proxy expects positional arrays.
      // Object.values() preserves column order (V8 insertion-order = SQLite column order).
      const rowsJson = await __glyx_db_query(dbHandle, sql, JSON.stringify(params));
      const rows: Array<Record<string, unknown>> = JSON.parse(rowsJson);
      return { rows: rows.map((r) => Object.values(r)) };
    },
    schema ? { schema } : undefined,
  );
}
