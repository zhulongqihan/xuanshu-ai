import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../src/server/db/core";
import { createProfileRepository } from "../src/server/profiles/core";
import { createZiweiSnapshotRepository } from "../src/server/ziwei/core";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "xuanshu-ziwei-snapshot-"));
  temporaryDirectories.push(directory);
  return directory;
}

function birthInput(time: "12:00" | "unknown" = "12:00") {
  return {
    schemaVersion: 1,
    calendarDate: { kind: "solar" as const, date: "1990-05-18" },
    time: time === "unknown" ? { kind: "unknown" as const } : { kind: "exact" as const, value: time },
    chartSex: "male" as const,
    location: {
      label: "上海",
      timeZoneId: "Asia/Shanghai",
      timeZoneSource: "user" as const,
      timeZoneConfirmed: true,
      coordinates: { latitude: 31.2304, longitude: 121.4737 },
    },
    trueSolarTimeMode: "compare" as const,
  };
}

describe("ziwei snapshot repository", () => {
  it("binds a purple-star snapshot to the current birth revision and reuses it", async () => {
    const directory = await createTemporaryDirectory();
    const database = initializeDatabase({ directory, migrationsFolder: join(process.cwd(), "drizzle") });
    const ids = ["profile-1", "birth-1"];
    const profiles = createProfileRepository(database.db, { createId: () => ids.shift() ?? "unexpected", now: () => "2026-08-21T21:00:00+08:00" });
    const ziwei = createZiweiSnapshotRepository(database.db, { createId: () => "ziwei-1", now: () => "2026-08-21T21:01:00+08:00" });
    const profile = profiles.create({ displayName: "紫微测试", birthInput: birthInput() });
    const first = ziwei.createOrReuse(profile);
    const reused = ziwei.createOrReuse(profile);
    expect(reused).toEqual(first);
    expect(first.payload.chart.ziwei.candidates[0]?.palaces).toHaveLength(12);
    expect(first.birthRecordId).toBe(profile.birthRecord.id);
    expect(first.payload.chart.ziwei.inputHash).toBe(profile.birthRecord.inputHash);
    expect(database.sqlite.prepare("SELECT COUNT(*) FROM chart_snapshots WHERE system = 'ziwei'").pluck().get()).toBe(1);
    database.sqlite.close();
  });

  it("stores an explicit unavailable snapshot when time is unknown", async () => {
    const directory = await createTemporaryDirectory();
    const database = initializeDatabase({ directory, migrationsFolder: join(process.cwd(), "drizzle") });
    const profiles = createProfileRepository(database.db, { createId: (() => { let i = 0; return () => `id-${++i}`; })() });
    const ziwei = createZiweiSnapshotRepository(database.db, { createId: () => "ziwei-unknown" });
    const profile = profiles.create({ displayName: "未知时间", birthInput: birthInput("unknown") });
    const snapshot = ziwei.createOrReuse(profile);
    expect(snapshot.payload.chart.ziwei.status).toBe("unavailable");
    expect(snapshot.payload.chart.ziwei.candidates).toHaveLength(0);
    database.sqlite.close();
  });

  it("rejects payload metadata tampering", async () => {
    const directory = await createTemporaryDirectory();
    const database = initializeDatabase({ directory, migrationsFolder: join(process.cwd(), "drizzle") });
    const profiles = createProfileRepository(database.db, { createId: (() => { let i = 0; return () => `id-${++i}`; })() });
    const ziwei = createZiweiSnapshotRepository(database.db, { createId: () => "ziwei-1" });
    const profile = profiles.create({ displayName: "篡改测试", birthInput: birthInput() });
    ziwei.createOrReuse(profile);
    database.sqlite.prepare("UPDATE chart_snapshots SET rule_set_version = ? WHERE id = ?").run("9.9.9", "ziwei-1");
    expect(() => ziwei.getLatest(profile)).toThrow("元数据与内容不一致");
    database.sqlite.close();
  });
});
