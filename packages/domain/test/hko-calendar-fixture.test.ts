import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCalendarDate } from "../src/normalization";

const FIXTURE_DIRECTORY = join(process.cwd(), "test", "fixtures");
const FIXTURE_FILENAME = "hko-calendar-1901-2100.csv";
const MANIFEST_FILENAME = "hko-calendar-1901-2100.manifest.json";

type FixtureRow = {
  solarDate: string;
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
};

function readFixture() {
  const content = readFileSync(join(FIXTURE_DIRECTORY, FIXTURE_FILENAME), "utf8");
  const rows: FixtureRow[] = [];
  for (const line of content.split("\n")) {
    if (!line || line.startsWith("#") || line.startsWith("solar_date,")) continue;
    const [solarDate, lunarYear, lunarMonth, lunarDay, isLeapMonth] = line.split(",");
    rows.push({
      solarDate,
      lunarYear: Number(lunarYear),
      lunarMonth: Number(lunarMonth),
      lunarDay: Number(lunarDay),
      isLeapMonth: isLeapMonth === "1",
    });
  }
  return { content, rows };
}

describe("HKO 1901-2100 Gregorian-lunar fixture", () => {
  const fixture = readFixture();

  it("pins every official annual source and the derived fixture hash", () => {
    const manifest = JSON.parse(
      readFileSync(join(FIXTURE_DIRECTORY, MANIFEST_FILENAME), "utf8"),
    ) as {
      rowCount: number;
      fixture: { filename: string; bytes: number; sha256: string };
      sources: Array<{ year: number; rows: number; sha256: string }>;
      sourcePatches: Array<{
        solarDate: string;
        insertedLunarDay: number;
        evidence: { filename: string; page: number; sha256: string };
      }>;
    };

    expect(manifest.rowCount).toBe(73_049);
    expect(fixture.content).not.toContain("\r");
    expect(manifest.fixture).toEqual({
      filename: FIXTURE_FILENAME,
      bytes: Buffer.byteLength(fixture.content),
      sha256: createHash("sha256").update(fixture.content).digest("hex"),
    });
    expect(manifest.sources).toHaveLength(200);
    expect(manifest.sources.map((source) => source.year)).toEqual(
      Array.from({ length: 200 }, (_, index) => 1901 + index),
    );
    expect(manifest.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256))).toBe(
      true,
    );
    expect(manifest.sources.find((source) => source.year === 2069)?.rows).toBe(364);
    expect(manifest.sourcePatches).toEqual([
      expect.objectContaining({
        solarDate: "2069-12-30",
        insertedLunarDay: 17,
        evidence: expect.objectContaining({
          filename: "2069e.pdf",
          page: 1,
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    ]);
  });

  it(
    "matches all 73,049 days in both conversion directions",
    { timeout: 120_000 },
    () => {
      const mismatches: string[] = [];
      for (const expected of fixture.rows) {
        const fromSolar = resolveCalendarDate({
          kind: "solar",
          date: expected.solarDate,
        });
        const expectedLunar = {
          kind: "lunar" as const,
          year: expected.lunarYear,
          month: expected.lunarMonth,
          day: expected.lunarDay,
          isLeapMonth: expected.isLeapMonth,
        };
        if (JSON.stringify(fromSolar.lunarDate) !== JSON.stringify(expectedLunar)) {
          mismatches.push(
            `${expected.solarDate}: HKO=${JSON.stringify(expectedLunar)} actual=${JSON.stringify(fromSolar.lunarDate)}`,
          );
        }

        const fromLunar = resolveCalendarDate(expectedLunar);
        if (fromLunar.solarDate !== expected.solarDate) {
          mismatches.push(
            `${JSON.stringify(expectedLunar)}: HKO=${expected.solarDate} actual=${fromLunar.solarDate}`,
          );
        }
        if (mismatches.length >= 20) break;
      }

      expect(mismatches).toEqual([]);
      expect(fixture.rows).toHaveLength(73_049);
      expect(fixture.rows[0]).toMatchObject({ solarDate: "1901-01-01" });
      expect(fixture.rows.at(-1)).toMatchObject({ solarDate: "2100-12-31" });
    },
  );
});
