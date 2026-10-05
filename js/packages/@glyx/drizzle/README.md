# @glyx-dev/drizzle

Drizzle ORM adapter for Glyx SQLite bindings.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/drizzle drizzle-orm
# or npm install @glyx-dev/drizzle drizzle-orm
```

`drizzle-orm` (>=0.36.0) is a peer dependency and must be installed alongside this package.

## Usage

```js
import { createDrizzle } from '@glyx-dev/drizzle';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { db } from '@glyx-dev/react';

const handle = await db.open('myapp.db');
const drizzle = createDrizzle(handle);

const myTable = sqliteTable('my_table', {
  id: integer('id').primaryKey(),
  name: text('name'),
});

const rows = await drizzle.select().from(myTable);
```

## API

- `createDrizzle(dbHandle, schema?)` — creates a Drizzle `SqliteRemoteDatabase` backed by a Glyx SQLite handle (as returned by `db.open()` from `@glyx-dev/react`). Bridges Drizzle's `sqlite-proxy` driver to Glyx's `__glyx_db_query`/`__glyx_db_run` native bindings. Pass an optional Drizzle relational `schema` to enable the `.query.*` API.
