import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { calculateLiuyao } from "@xuanshu/domain";
import { initializeDatabase } from "../src/server/db/core";
import { createLiuyaoCaseRepository } from "../src/server/liuyao/core";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function calculation() {
  return calculateLiuyao({
    schemaVersion: 1,
    cast: {
      question: "测试六爻案例",
      method: "manual_lines",
      lineOrder: "bottom_to_top",
      lines: [7, 8, 9, 6, 7, 8],
      castAt: "1990-05-18T12:00:00+08:00",
      timeZone: "Asia/Shanghai",
      locationName: "上海市",
    },
  });
}

async function createTestRepository() {
  const directory = await mkdtemp(join(tmpdir(), "xuanshu-liuyao-case-"));
  temporaryDirectories.push(directory);
  const database = initializeDatabase({
    directory,
    migrationsFolder: join(process.cwd(), "drizzle"),
  });
  const repository = createLiuyaoCaseRepository(database.db, {
    createId: () => "liuyao-case-1",
    now: () => "2026-08-21T21:30:00+08:00",
  });
  return { ...database, repository };
}

describe("liuyao case repository", () => {
  it("stores a complete calculation and returns the same auditable case", async () => {
    const { repository, sqlite } = await createTestRepository();
    const created = repository.create({ calculation: calculation() });

    expect(created).toMatchObject({
      id: "liuyao-case-1",
      question: "测试六爻案例",
      method: "manual_lines",
      cast: { lines: [7, 8, 9, 6, 7, 8] },
      calculation: { hexagram: { base: { name: "既济" } } },
    });
    expect(repository.get(created.id)).toEqual(created);
    expect(repository.list()).toEqual([created]);
    expect(
      sqlite.prepare("SELECT audit_json FROM liuyao_cases WHERE id = ?").pluck().get(created.id),
    ).toBeTypeOf("string");
    sqlite.close();
  });

  it("refuses a row whose ordinary fields diverge from the immutable audit payload", async () => {
    const { repository, sqlite } = await createTestRepository();
    const created = repository.create({ calculation: calculation() });
    sqlite
      .prepare("UPDATE liuyao_cases SET question = ? WHERE id = ?")
      .run("被篡改的问题", created.id);

    expect(() => repository.get(created.id)).toThrow("表字段与审计内容不一致");
    sqlite.close();
  });

  it("rejects legacy rows that do not have a replayable audit payload", async () => {
    const { repository, sqlite } = await createTestRepository();
    sqlite
      .prepare(
        `INSERT INTO liuyao_cases (
          id, question, method, lines_json, cast_at, time_zone, location_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "legacy-case",
        "旧案例",
        "manual_lines",
        "[7,8,7,8,7,8]",
        "2026-08-21T21:30:00+08:00",
        "Asia/Shanghai",
        "上海市",
        "2026-08-21T21:30:00+08:00",
      );

    expect(() => repository.list()).toThrow("缺少可复算审计内容");
    sqlite.close();
  });
});
