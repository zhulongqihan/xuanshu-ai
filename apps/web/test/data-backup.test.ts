import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../src/server/db/core";
import {
  deleteAllData,
  exportBackup,
  restoreBackup,
} from "../src/server/data/core";
import { createProfileRepository } from "../src/server/profiles/core";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createTemporaryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "xuanshu-backup-"));
  temporaryDirectories.push(directory);
  return initializeDatabase({
    directory,
    migrationsFolder: join(process.cwd(), "drizzle"),
  });
}

function birthInput() {
  return {
    schemaVersion: 1,
    calendarDate: { kind: "solar", date: "1990-05-18" },
    time: { kind: "exact", value: "23:30" },
    chartSex: "male",
    location: {
      label: "上海市",
      timeZoneId: "Asia/Shanghai",
      timeZoneSource: "user",
      timeZoneConfirmed: true,
      coordinates: { latitude: 31.2304, longitude: 121.4737 },
    },
    trueSolarTimeMode: "compare",
  };
}

function count(sqlite: ReturnType<typeof initializeDatabase>["sqlite"], table: string) {
  return sqlite.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get();
}

describe("local data backup", () => {
  it("restores profiles and linked records after a full clear", async () => {
    const { db, sqlite } = await createTemporaryDatabase();
    const repository = createProfileRepository(db, {
      createId: (() => {
        const ids = ["profile-1", "birth-record-1"];
        return () => ids.shift() ?? "unexpected-id";
      })(),
      now: () => "2026-08-21T12:00:00+08:00",
    });
    const profile = repository.create({ displayName: "备份测试", birthInput: birthInput() });
    const now = "2026-08-21T12:00:00+08:00";

    sqlite
      .prepare(
        `INSERT INTO chart_snapshots (
          id, profile_id, birth_record_id, system, input_hash, engine_version,
          rule_set_id, rule_set_version, payload_json, warnings_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "chart-1",
        profile.id,
        profile.birthRecord.id,
        "bazi",
        profile.birthRecord.inputHash,
        "0.2.0",
        "bazi-ziping-v1",
        "1.0.0",
        "{}",
        "[]",
        now,
      );
    sqlite
      .prepare(
        "INSERT INTO consultations (id, profile_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run("consult-1", profile.id, "备份咨询", now, now);
    sqlite
      .prepare(
        "INSERT INTO messages (id, consultation_id, role, content, claims_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run("message-1", "consult-1", "assistant", "可复算回答", "[]", now);
    sqlite
      .prepare(
        `INSERT INTO liuyao_cases (
          id, profile_id, question, method, lines_json, audit_json, cast_at,
          time_zone, location_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "liuyao-1",
        profile.id,
        "备份问题",
        "manual_lines",
        "[7,8,7,8,7,8]",
        "{}",
        now,
        "Asia/Shanghai",
        "上海市",
        now,
      );
    sqlite
      .prepare("INSERT INTO app_metadata (key, value, updated_at) VALUES (?, ?, ?)")
      .run("backup-test", "enabled", now);

    const backup = exportBackup(sqlite, () => now);
    expect(backup.schemaVersion).toBe(1);
    expect(backup.tables.profiles).toHaveLength(1);
    expect(backup.tables.messages).toHaveLength(1);

    deleteAllData(sqlite);
    for (const table of [
      "profiles",
      "profile_birth_records",
      "chart_snapshots",
      "consultations",
      "messages",
      "liuyao_cases",
      "app_metadata",
    ]) {
      expect(count(sqlite, table)).toBe(0);
    }

    restoreBackup(sqlite, backup);
    expect(count(sqlite, "profiles")).toBe(1);
    expect(count(sqlite, "profile_birth_records")).toBe(1);
    expect(count(sqlite, "chart_snapshots")).toBe(1);
    expect(count(sqlite, "consultations")).toBe(1);
    expect(count(sqlite, "messages")).toBe(1);
    expect(count(sqlite, "liuyao_cases")).toBe(1);
    expect(count(sqlite, "app_metadata")).toBe(1);
    expect(repository.get(profile.id)?.displayName).toBe("备份测试");
    sqlite.close();
  });

  it("rejects malformed rows before clearing existing data", async () => {
    const { db, sqlite } = await createTemporaryDatabase();
    const repository = createProfileRepository(db, {
      createId: (() => {
        const ids = ["profile-1", "birth-record-1"];
        return () => ids.shift() ?? "unexpected-id";
      })(),
      now: () => "2026-08-21T12:00:00+08:00",
    });
    const profile = repository.create({ displayName: "保留测试", birthInput: birthInput() });
    const backup = exportBackup(sqlite, () => "2026-08-21T12:00:00+08:00");
    backup.tables.profiles[0] = {
      ...backup.tables.profiles[0],
      unexpected: "not-allowed",
    };

    expect(() => restoreBackup(sqlite, backup)).toThrow("字段不匹配");
    expect(count(sqlite, "profiles")).toBe(1);
    expect(repository.get(profile.id)?.displayName).toBe("保留测试");
    sqlite.close();
  });

  it("rejects a future backup version without touching existing data", async () => {
    const { db, sqlite } = await createTemporaryDatabase();
    const repository = createProfileRepository(db, {
      createId: (() => {
        const ids = ["profile-1", "birth-record-1"];
        return () => ids.shift() ?? "unexpected-id";
      })(),
      now: () => "2026-08-21T12:00:00+08:00",
    });
    const profile = repository.create({ displayName: "版本测试", birthInput: birthInput() });
    const backup = exportBackup(sqlite, () => "2026-08-21T12:00:00+08:00");
    const futureBackup = { ...backup, schemaVersion: 2 };

    expect(() => restoreBackup(sqlite, futureBackup)).toThrow();
    expect(count(sqlite, "profiles")).toBe(1);
    expect(repository.get(profile.id)?.displayName).toBe("版本测试");
    sqlite.close();
  });
});
