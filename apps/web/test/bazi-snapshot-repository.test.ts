import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../src/server/db/core";
import { createBaziSnapshotRepository } from "../src/server/charts/core";
import { createProfileRepository } from "../src/server/profiles/core";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "xuanshu-bazi-snapshot-"));
  temporaryDirectories.push(directory);
  return directory;
}

function birthInput(time = "23:30") {
  return {
    schemaVersion: 1,
    calendarDate: { kind: "solar", date: "1990-05-18" },
    time: { kind: "exact", value: time },
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

describe("bazi snapshot repository", () => {
  it("binds snapshots to the exact birth revision and reuses the same calculation", async () => {
    const directory = await createTemporaryDirectory();
    const database = initializeDatabase({
      directory,
      migrationsFolder: join(process.cwd(), "drizzle"),
    });
    const ids = ["profile-1", "birth-record-1", "birth-record-2"];
    const profiles = createProfileRepository(database.db, {
      createId: () => ids.shift() ?? "unexpected-id",
      now: () => "2026-08-21T20:00:00+08:00",
    });
    const snapshots = createBaziSnapshotRepository(database.db, {
      createId: (() => {
        let index = 0;
        return () => `chart-${++index}`;
      })(),
      now: () => "2026-08-21T20:01:00+08:00",
    });

    const firstProfile = profiles.create({
      displayName: "测试档案",
      birthInput: birthInput(),
    });
    const first = snapshots.createOrReuse(firstProfile);
    const reused = snapshots.createOrReuse(firstProfile);

    expect(reused).toEqual(first);
    expect(first.birthRecordId).toBe(firstProfile.birthRecord.id);
    expect(first.payload.chart.bazi.inputHash).toBe(firstProfile.birthRecord.inputHash);
    expect(first.payload.chart.luck.inputHash).toBe(firstProfile.birthRecord.inputHash);
    expect(first.payload.chart.evidence.map((item) => item.ruleId)).toEqual(
      expect.arrayContaining(first.payload.chart.bazi.ruleIds.concat(first.payload.chart.luck.ruleIds)),
    );
    expect(first.payload.calculationTrace).toEqual(
      expect.arrayContaining([
        `birth-record:${firstProfile.birthRecord.id}@${firstProfile.birthRecord.inputHash}`,
      ]),
    );

    const secondProfile = profiles.update("profile-1", {
      displayName: "测试档案（修订）",
      birthInput: birthInput("12:00"),
    });
    expect(secondProfile).toBeDefined();
    if (!secondProfile) throw new Error("修订档案创建失败");
    const second = snapshots.createOrReuse(secondProfile);

    expect(second.id).not.toBe(first.id);
    expect(second.birthRecordId).toBe(secondProfile.birthRecord.id);
    expect(second.inputHash).not.toBe(first.inputHash);
    expect(
      database.sqlite.prepare("SELECT COUNT(*) FROM chart_snapshots").pluck().get(),
    ).toBe(2);
    expect(
      database.sqlite
        .prepare("SELECT COUNT(*) FROM chart_snapshots WHERE birth_record_id = ?")
        .pluck()
        .get(first.birthRecordId),
    ).toBe(1);
    database.sqlite.close();
  });

  it("rejects a snapshot whose stored metadata diverges from its payload", async () => {
    const directory = await createTemporaryDirectory();
    const database = initializeDatabase({
      directory,
      migrationsFolder: join(process.cwd(), "drizzle"),
    });
    const profiles = createProfileRepository(database.db, {
      createId: (() => {
        let index = 0;
        return () => `id-${++index}`;
      })(),
      now: () => "2026-08-21T20:00:00+08:00",
    });
    const snapshots = createBaziSnapshotRepository(database.db, {
      createId: () => "chart-1",
      now: () => "2026-08-21T20:01:00+08:00",
    });
    const profile = profiles.create({ displayName: "篡改测试", birthInput: birthInput() });
    const snapshot = snapshots.createOrReuse(profile);
    database.sqlite
      .prepare("UPDATE chart_snapshots SET input_hash = ? WHERE id = ?")
      .run("f".repeat(64), snapshot.id);

    expect(() => snapshots.getLatest(profile)).toThrow("元数据与内容不一致");
    database.sqlite.close();
  });
});
