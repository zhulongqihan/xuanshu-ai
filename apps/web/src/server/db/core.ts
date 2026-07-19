import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { getAppDataDirectory } from "../app-data";
import * as schema from "./schema";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

type DatabaseOptions = {
  directory?: string;
  migrationsFolder?: string;
};

export function getDatabasePath(directory = getAppDataDirectory()) {
  return join(directory, "data", "xuanshu.db");
}

export function initializeDatabase({
  directory = getAppDataDirectory(),
  migrationsFolder = join(process.cwd(), "drizzle"),
}: DatabaseOptions = {}) {
  const databasePath = getDatabasePath(directory);
  mkdirSync(join(directory, "data"), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });

  return { db, sqlite, path: databasePath };
}

export async function readDatabaseStatus(directory = getAppDataDirectory()) {
  const path = getDatabasePath(directory);
  try {
    await access(path);
  } catch {
    return { initialized: false as const, path };
  }

  const sqlite = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const journalMode = sqlite.pragma("journal_mode", { simple: true });
    const tableCount = sqlite
      .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'")
      .pluck()
      .get() as number;
    return {
      initialized: true as const,
      path,
      journalMode: String(journalMode),
      tableCount,
    };
  } finally {
    sqlite.close();
  }
}
