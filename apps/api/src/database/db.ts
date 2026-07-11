import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema.js";

export type Database = LibSQLDatabase<typeof schema>;

export const DATABASE_TOKEN = Symbol("DATABASE");

export function createDatabase(): Database {
  const url = process.env.DATABASE_URL ?? "file:./dashdash.db";
  const client = createClient({ url });
  return drizzle(client, { schema });
}
