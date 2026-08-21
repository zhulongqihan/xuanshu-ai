import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../src/server/db/core";
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
  const directory = await mkdtemp(join(tmpdir(), "xuanshu-profile-"));
  temporaryDirectories.push(directory);
  return directory;
}

function birthInput() {
  return {
    schemaVersion: 1,
    calendarDate: { kind: "solar", date: "1990-05-18" },
    time: { kind: "exact", value: "23:30" },
    chartSex: "male",
    location: {
      label: " 上海市 ",
      timeZoneId: "Asia/Chungking",
      timeZoneSource: "user",
      timeZoneConfirmed: true,
      coordinates: { latitude: 31.2304, longitude: 121.4737 },
    },
    trueSolarTimeMode: "compare",
  };
}

async function createTestRepository() {
  const directory = await createTemporaryDirectory();
  const database = initializeDatabase({
    directory,
    migrationsFolder: join(process.cwd(), "drizzle"),
  });
  const ids = ["profile-1", "birth-record-1", "birth-record-2"];
  const repository = createProfileRepository(database.db, {
    createId: () => ids.shift() ?? "unexpected-id",
    now: () => "2026-07-19T22:00:00+08:00",
  });
  return { ...database, repository };
}

describe("profile repository", () => {
  it("writes raw, canonical, and normalized birth data in one transaction", async () => {
    const { repository, sqlite } = await createTestRepository();
    const created = repository.create({
      displayName: " 测试档案 ",
      birthInput: birthInput(),
    });

    expect(created).toMatchObject({
      id: "profile-1",
      displayName: "测试档案",
      birthRecord: {
        id: "birth-record-1",
        revision: 1,
        rawInput: { location: { label: " 上海市 " } },
        canonicalInput: {
          location: { label: "上海市", timeZoneId: "Asia/Shanghai" },
        },
        normalized: {
          schemaVersion: 1,
          provenance: { normalizer: { id: "xuanshu-birth-normalizer" } },
        },
      },
    });
    expect(created.birthRecord.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.list()).toEqual([created]);
    expect(repository.get("profile-1")).toEqual(created);
    expect(repository.get("missing")).toBeUndefined();
    expect(
      sqlite.prepare("SELECT COUNT(*) FROM profiles").pluck().get(),
    ).toBe(1);
    expect(
      sqlite.prepare("SELECT COUNT(*) FROM profile_birth_records").pluck().get(),
    ).toBe(1);
    sqlite.close();
  });

  it("creates an immutable birth revision when the birth input changes", async () => {
    const { repository, sqlite } = await createTestRepository();
    const created = repository.create({
      displayName: "修订前",
      birthInput: birthInput(),
    });

    const updated = repository.update("profile-1", {
      displayName: "修订后",
      birthInput: {
        ...birthInput(),
        time: { kind: "exact", value: "12:00" },
      },
    });

    expect(updated).toMatchObject({
      id: "profile-1",
      displayName: "修订后",
      birthRecord: {
        id: "birth-record-2",
        revision: 2,
      },
    });
    expect(updated?.birthRecord.inputHash).not.toBe(created.birthRecord.inputHash);
    expect(
      sqlite.prepare(
        "SELECT revision, is_current FROM profile_birth_records ORDER BY revision",
      ).all(),
    ).toEqual([
      { revision: 1, is_current: 0 },
      { revision: 2, is_current: 1 },
    ]);
    expect(repository.get("profile-1")).toEqual(updated);
    sqlite.close();
  });

  it("does not leave a half profile when normalization fails", async () => {
    const { repository, sqlite } = await createTestRepository();
    const invalid = birthInput();
    invalid.location.timeZoneConfirmed = false;

    expect(() =>
      repository.create({ displayName: "失败档案", birthInput: invalid }),
    ).toThrow("归一化前必须由用户确认 IANA 时区");
    expect(
      sqlite.prepare("SELECT COUNT(*) FROM profiles").pluck().get(),
    ).toBe(0);
    expect(
      sqlite.prepare("SELECT COUNT(*) FROM profile_birth_records").pluck().get(),
    ).toBe(0);
    sqlite.close();
  });

  it("deletes all profile-linked sensitive records", async () => {
    const { repository, sqlite } = await createTestRepository();
    const created = repository.create({
      displayName: "删除测试",
      birthInput: birthInput(),
    });
    const now = "2026-07-19T22:00:00+08:00";
    sqlite
      .prepare(
        `INSERT INTO chart_snapshots (
          id, profile_id, birth_record_id, system, input_hash, engine_version,
          rule_set_id, rule_set_version, payload_json, warnings_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "chart-1",
        created.id,
        created.birthRecord.id,
        "bazi",
        created.birthRecord.inputHash,
        "0.1.0",
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
      .run("consult-1", created.id, "测试", now, now);
    sqlite
      .prepare(
        "INSERT INTO messages (id, consultation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run("message-1", "consult-1", "user", "敏感咨询", now);
    sqlite
      .prepare(
        `INSERT INTO liuyao_cases (
          id, profile_id, question, method, lines_json, cast_at, time_zone,
          location_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "liuyao-1",
        created.id,
        "敏感问题",
        "manual_lines",
        "[7,8,7,8,7,8]",
        now,
        "Asia/Shanghai",
        "上海市",
        now,
      );

    expect(repository.delete(created.id)).toBe(true);
    for (const table of [
      "profiles",
      "profile_birth_records",
      "chart_snapshots",
      "consultations",
      "messages",
      "liuyao_cases",
    ]) {
      expect(sqlite.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get()).toBe(0);
    }
    expect(repository.delete(created.id)).toBe(false);
    sqlite.close();
  });

  it("enforces JSON and one-current-record constraints in SQLite", async () => {
    const { repository, sqlite } = await createTestRepository();
    const created = repository.create({
      displayName: "约束测试",
      birthInput: birthInput(),
    });

    expect(() =>
      sqlite
        .prepare(
          "UPDATE profile_birth_records SET warnings_json = ? WHERE id = ?",
        )
        .run("not-json", created.birthRecord.id),
    ).toThrow();
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO profile_birth_records (
            id, profile_id, revision, is_current, raw_input_json,
            canonical_input_json, input_hash, input_schema_version,
            normalized_json, normalized_schema_version, normalizer_version,
            dependencies_json, source_refs_json, warnings_json, created_at
          ) SELECT ?, profile_id, 2, 1, raw_input_json, canonical_input_json, ?,
            input_schema_version, normalized_json, normalized_schema_version,
            normalizer_version, dependencies_json, source_refs_json, warnings_json,
            created_at FROM profile_birth_records WHERE id = ?`,
        )
        .run("birth-record-2", "b".repeat(64), created.birthRecord.id),
    ).toThrow();
    sqlite.close();
  });

  it("refuses a valid-looking row whose input hash no longer matches", async () => {
    const { repository, sqlite } = await createTestRepository();
    const created = repository.create({
      displayName: "篡改测试",
      birthInput: birthInput(),
    });
    sqlite
      .prepare("UPDATE profile_birth_records SET input_hash = ? WHERE id = ?")
      .run("c".repeat(64), created.birthRecord.id);

    expect(() => repository.get(created.id)).toThrow("无法通过复算校验");
    sqlite.close();
  });

  it("refuses raw input that no longer canonicalizes to the stored input", async () => {
    const { repository, sqlite } = await createTestRepository();
    const created = repository.create({
      displayName: "原始输入篡改测试",
      birthInput: birthInput(),
    });
    const changedRawInput = birthInput();
    changedRawInput.calendarDate.date = "1991-05-18";
    sqlite
      .prepare("UPDATE profile_birth_records SET raw_input_json = ? WHERE id = ?")
      .run(JSON.stringify(changedRawInput), created.birthRecord.id);

    expect(() => repository.get(created.id)).toThrow("无法通过复算校验");
    sqlite.close();
  });

  it("refuses provenance columns that diverge from the normalized record", async () => {
    const { repository, sqlite } = await createTestRepository();
    const created = repository.create({
      displayName: "溯源篡改测试",
      birthInput: birthInput(),
    });
    sqlite
      .prepare("UPDATE profile_birth_records SET source_refs_json = ? WHERE id = ?")
      .run('["unknown-source"]', created.birthRecord.id);

    expect(() => repository.get(created.id)).toThrow("无法通过复算校验");
    sqlite.close();
  });
});
