import { z } from "zod";
import type Database from "better-sqlite3";

const backupRowSchema = z.record(z.string(), z.unknown());

export const backupSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string().datetime({ offset: true }),
  tables: z.object({
    profiles: z.array(backupRowSchema),
    profileBirthRecords: z.array(backupRowSchema),
    chartSnapshots: z.array(backupRowSchema),
    consultations: z.array(backupRowSchema),
    messages: z.array(backupRowSchema),
    liuyaoCases: z.array(backupRowSchema),
    appMetadata: z.array(backupRowSchema),
  }).strict(),
}).strict();

export type BackupDocument = z.infer<typeof backupSchema>;

const TABLES = {
  profiles: {
    name: "profiles",
    columns: ["id", "display_name", "calendar_type", "birth_date", "birth_time", "is_leap_month", "chart_sex", "location_name", "latitude", "longitude", "time_zone", "uncertainty_minutes", "created_at", "updated_at"],
  },
  profileBirthRecords: {
    name: "profile_birth_records",
    columns: ["id", "profile_id", "revision", "is_current", "raw_input_json", "canonical_input_json", "input_hash", "input_schema_version", "normalized_json", "normalized_schema_version", "normalizer_version", "dependencies_json", "source_refs_json", "warnings_json", "created_at"],
  },
  chartSnapshots: {
    name: "chart_snapshots",
    columns: ["id", "profile_id", "birth_record_id", "system", "input_hash", "engine_version", "rule_set_id", "rule_set_version", "payload_json", "warnings_json", "created_at"],
  },
  consultations: {
    name: "consultations",
    columns: ["id", "profile_id", "title", "created_at", "updated_at"],
  },
  messages: {
    name: "messages",
    columns: ["id", "consultation_id", "role", "content", "claims_json", "created_at"],
  },
  liuyaoCases: {
    name: "liuyao_cases",
    columns: ["id", "profile_id", "question", "method", "lines_json", "audit_json", "cast_at", "time_zone", "location_name", "created_at"],
  },
  appMetadata: {
    name: "app_metadata",
    columns: ["key", "value", "updated_at"],
  },
} as const;

type BackupTable = keyof typeof TABLES;

function readTable(sqlite: Database.Database, table: BackupTable) {
  return sqlite.prepare(`SELECT ${TABLES[table].columns.join(", ")} FROM ${TABLES[table].name}`).all() as Array<Record<string, unknown>>;
}

export function exportBackup(sqlite: Database.Database, now = () => new Date().toISOString()) {
  return backupSchema.parse({
    schemaVersion: 1,
    exportedAt: now(),
    tables: Object.fromEntries(
      (Object.keys(TABLES) as BackupTable[]).map((table) => [table, readTable(sqlite, table)]),
    ),
  });
}

function validateRow(table: BackupTable, row: Record<string, unknown>) {
  const columns = TABLES[table].columns;
  const actual = Object.keys(row).sort();
  const expected = [...columns].sort();
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new TypeError(`备份表 ${table} 的字段不匹配`);
  }
  for (const column of columns) {
    const value = row[column];
    if (value !== null && typeof value !== "string" && typeof value !== "number") {
      throw new TypeError(`备份表 ${table}.${column} 含有不支持的值`);
    }
  }
}

function clearTables(sqlite: Database.Database) {
  sqlite.prepare("DELETE FROM messages").run();
  sqlite.prepare("DELETE FROM consultations").run();
  sqlite.prepare("DELETE FROM liuyao_cases").run();
  sqlite.prepare("DELETE FROM chart_snapshots").run();
  sqlite.prepare("DELETE FROM profile_birth_records").run();
  sqlite.prepare("DELETE FROM profiles").run();
  sqlite.prepare("DELETE FROM app_metadata").run();
}

export function deleteAllData(sqlite: Database.Database) {
  sqlite.transaction(() => clearTables(sqlite))();
}

export function restoreBackup(sqlite: Database.Database, input: unknown) {
  const backup = backupSchema.parse(input);
  const tables = Object.keys(TABLES) as BackupTable[];
  for (const table of tables) {
    for (const row of backup.tables[table]) validateRow(table, row);
  }
  try {
    sqlite.transaction(() => {
      clearTables(sqlite);
      for (const table of tables) {
        const columns = TABLES[table].columns;
        const statement = sqlite.prepare(
          `INSERT INTO ${TABLES[table].name} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
        );
        for (const row of backup.tables[table]) statement.run(...columns.map((column) => row[column]));
      }
    })();
  } catch {
    throw new TypeError("备份内容不符合当前数据库约束，现有数据未被恢复");
  }
  return backup;
}
