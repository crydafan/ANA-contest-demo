import { createDatabase, type DatabaseConnection } from "@ana-contest-demo/db";

const globalDatabase = globalThis as typeof globalThis & {
  anaDatabaseConnection?: DatabaseConnection;
};

export function getDatabaseConnection(): DatabaseConnection {
  if (globalDatabase.anaDatabaseConnection) {
    return globalDatabase.anaDatabaseConnection;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");

  const connection = createDatabase(databaseUrl);
  if (process.env.NODE_ENV !== "production") {
    globalDatabase.anaDatabaseConnection = connection;
  }
  return connection;
}
