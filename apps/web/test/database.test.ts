import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getAppDataDirectory } from "../src/server/app-data";
import { initializeDatabase, readDatabaseStatus } from "../src/server/db/core";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "xuanshu-db-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("app data paths", () => {
  it("uses LOCALAPPDATA on Windows", () => {
    expect(
      getAppDataDirectory({
        platform: "win32",
        homeDirectory: "C:\\Users\\demo",
        environment: { LOCALAPPDATA: "D:\\LocalData" },
      }),
    ).toBe("D:\\LocalData\\XuanshuAI");
  });

  it("allows an explicit data directory override", () => {
    expect(
      getAppDataDirectory({
        platform: "win32",
        homeDirectory: "C:\\Users\\demo",
        environment: { XUANSHU_AI_DATA_DIR: "D:\\Private\\Xuanshu" },
      }),
    ).toBe("D:\\Private\\Xuanshu");
  });

  it("uses XDG_DATA_HOME with POSIX separators on Linux", () => {
    expect(
      getAppDataDirectory({
        platform: "linux",
        homeDirectory: "/home/demo",
        environment: { XDG_DATA_HOME: "/var/lib/demo" },
      }),
    ).toBe("/var/lib/demo/XuanshuAI");
  });
});

describe("database migrations", () => {
  it("creates the local schema with WAL and foreign keys", async () => {
    const directory = await createTemporaryDirectory();
    const database = initializeDatabase({
      directory,
      migrationsFolder: join(process.cwd(), "drizzle"),
    });
    expect(database.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(String(database.sqlite.pragma("journal_mode", { simple: true }))).toBe("wal");
    database.sqlite.close();

    const status = await readDatabaseStatus(directory);
    expect(status).toMatchObject({ initialized: true, journalMode: "wal" });
    expect(status.initialized && status.tableCount).toBeGreaterThanOrEqual(7);
  });

  it("cascades profile deletion to charts, consultations, and messages", async () => {
    const directory = await createTemporaryDirectory();
    const { sqlite } = initializeDatabase({
      directory,
      migrationsFolder: join(process.cwd(), "drizzle"),
    });
    const now = "2026-07-15T23:30:00+08:00";
    sqlite
      .prepare(
        `INSERT INTO profiles (
          id, display_name, calendar_type, birth_date, birth_time, chart_sex,
          location_name, time_zone, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("profile-1", "测试档案", "solar", "1990-05-18", "23:30", "male", "上海市", "Asia/Shanghai", now, now);
    sqlite
      .prepare(
        `INSERT INTO chart_snapshots (
          id, profile_id, system, input_hash, engine_version, rule_set_id,
          rule_set_version, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("chart-1", "profile-1", "bazi", "a".repeat(64), "0.1.0", "bazi-ziping-v1", "1.0.0", "{}", now);
    sqlite
      .prepare("INSERT INTO consultations (id, profile_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run("consult-1", "profile-1", "测试咨询", now, now);
    sqlite
      .prepare("INSERT INTO messages (id, consultation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)")
      .run("message-1", "consult-1", "user", "测试", now);

    sqlite.prepare("DELETE FROM profiles WHERE id = ?").run("profile-1");
    for (const table of ["chart_snapshots", "consultations", "messages"]) {
      expect(sqlite.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get()).toBe(0);
    }
    sqlite.close();
  });
});
