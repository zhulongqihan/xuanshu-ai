import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../src/server/db/core";
import { createConsultationRepository } from "../src/server/consult/core";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function databaseFixture() {
  const directory = await mkdtemp(join(tmpdir(), "xuanshu-consult-"));
  temporaryDirectories.push(directory);
  const database = initializeDatabase({ directory, migrationsFolder: join(process.cwd(), "drizzle") });
  database.sqlite.prepare(
    `INSERT INTO profiles (
      id, display_name, calendar_type, birth_date, birth_time, chart_sex,
      location_name, time_zone, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("profile-1", "测试档案", "solar", "1990-05-18", "12:00", "male", "上海", "Asia/Shanghai", "2026-08-21T00:00:00Z", "2026-08-21T00:00:00Z");
  return database;
}

describe("consultation repository", () => {
  it("stores a local thread and validates evidence claims on read", async () => {
    const database = await databaseFixture();
    const repository = createConsultationRepository(database.db, {
      createId: (() => {
        let index = 0;
        return () => `id-${++index}`;
      })(),
      now: (() => {
        let index = 0;
        return () => `2026-08-21T00:0${++index}:00Z`;
      })(),
    });
    const consultation = repository.create("profile-1", "日主问题");
    repository.appendMessage(consultation.id, { role: "user", content: "请解释日主。" });
    repository.appendMessage(consultation.id, {
      role: "assistant",
      content: "日主是事实层字段。",
      claims: [{
        id: "claim-1",
        text: "日主为癸水。",
        system: "bazi",
        certainty: "deterministic",
        evidence: [{ sourceId: "gbt-33661", locator: "第 6.3.2 条", ruleId: "bazi.day.gbt-anchor-v1" }],
        appliesTo: "当前候选",
        uncertainty: [],
      }],
    });
    expect(repository.list("profile-1")).toEqual([expect.objectContaining({ id: consultation.id, messageCount: 2 })]);
    expect(repository.get(consultation.id)?.messages).toHaveLength(2);
    database.sqlite.close();
  });

  it("deletes a thread without affecting the profile", async () => {
    const database = await databaseFixture();
    const repository = createConsultationRepository(database.db);
    const consultation = repository.create("profile-1", "待删除");
    expect(repository.delete(consultation.id)).toBe(true);
    expect(repository.get(consultation.id)).toBeUndefined();
    expect(database.sqlite.prepare("SELECT COUNT(*) FROM profiles").pluck().get()).toBe(1);
    database.sqlite.close();
  });
});
