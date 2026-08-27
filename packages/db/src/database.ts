import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { waterQualityRelations } from "./schema";

export type Database = NodePgDatabase<typeof waterQualityRelations>;

export interface DatabaseConnection {
  database: Database;
  close: () => Promise<void>;
}

export function createDatabase(connectionString: string): DatabaseConnection {
  if (!connectionString) {
    throw new Error("A PostgreSQL connection string is required.");
  }

  const pool = new Pool({ connectionString });
  return {
    database: drizzle({ client: pool, relations: waterQualityRelations }),
    close: () => pool.end(),
  };
}
