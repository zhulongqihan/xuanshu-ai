import { Solar } from "lunar-typescript";
import { describe, expect, it } from "vitest";
import { calculateBaziLuck } from "../src/bazi-luck";
import { calculateBazi } from "../src/bazi";
import type { RawBirthInput } from "../src/birth";
import { normalizeBirth } from "../src/normalization";

const fixedOptions = { normalizedAt: "2026-07-22T23:30:00+08:00" };

function birth(overrides: Partial<RawBirthInput> = {}): RawBirthInput {
  return {
    schemaVersion: 1,
    calendarDate: { kind: "solar", date: "1990-05-18" },
    time: { kind: "exact", value: "12:00" },
    chartSex: "male",
    location: {
      label: "上海市",
      timeZoneId: "Asia/Shanghai",
      timeZoneSource: "user",
      timeZoneConfirmed: true,
    },
    trueSolarTimeMode: "civil_only",
    ...overrides,
  };
}

function luck(input: RawBirthInput, cycleCount?: number) {
  const normalized = normalizeBirth(input, fixedOptions);
  return calculateBaziLuck(
    normalized,
    calculateBazi(normalized),
    cycleCount === undefined ? {} : { cycleCount },
  );
}

function symbolicAgeSeconds(age: {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes?: number;
}) {
  return age.years * 259_200 +
    age.months * 21_600 +
    age.days * 720 +
    age.hours * 30 +
    (age.minutes ?? 0) / 2;
}

describe("bazi luck direction and cycles", () => {
  it.each([
    {
      label: "阳年男顺行",
      year: 1992,
      chartSex: "male" as const,
      direction: "forward",
      cycles: ["丙午", "丁未", "戊申", "己酉"],
    },
    {
      label: "阳年女逆行",
      year: 1992,
      chartSex: "female" as const,
      direction: "backward",
      cycles: ["甲辰", "癸卯", "壬寅", "辛丑"],
    },
    {
      label: "阴年女顺行",
      year: 1993,
      chartSex: "female" as const,
      direction: "forward",
      cycles: ["戊午", "己未", "庚申", "辛酉"],
    },
    {
      label: "阴年男逆行",
      year: 1993,
      chartSex: "male" as const,
      direction: "backward",
      cycles: ["丙辰", "乙卯", "甲寅", "癸丑"],
    },
  ])("keeps $label deterministic", ({ year, chartSex, direction, cycles }) => {
    const result = luck(birth({
      calendarDate: { kind: "solar", date: `${year}-05-18` },
      chartSex,
    }), 4);

    expect(result.status).toBe("complete");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ direction });
    expect(result.candidates[0].cycles.map((cycle) => cycle.name)).toEqual(cycles);
    expect(result.candidates[0].cycles.map((cycle) => [
      cycle.startOffsetYears,
      cycle.endOffsetYears,
    ])).toEqual([[0, 10], [10, 20], [20, 30], [30, 40]]);
  });

  it.each([
    { year: 1992, chartSex: "male" as const, gender: 1 },
    { year: 1992, chartSex: "female" as const, gender: 0 },
    { year: 1993, chartSex: "female" as const, gender: 0 },
    { year: 1993, chartSex: "male" as const, gender: 1 },
  ])("cross-checks $year/$chartSex with lunar-typescript sect 2", ({
    year,
    chartSex,
    gender,
  }) => {
    const result = luck(birth({
      calendarDate: { kind: "solar", date: `${year}-05-18` },
      chartSex,
    }), 4);
    const expectedChart = Solar.fromYmdHms(year, 5, 18, 12, 0, 0)
      .getLunar()
      .getEightChar();
    expectedChart.setSect(2);
    const expected = expectedChart.getYun(gender, 2);

    expect(result.candidates[0].direction === "forward").toBe(expected.isForward());
    const referenceAge = {
      years: expected.getStartYear(),
      months: expected.getStartMonth(),
      days: expected.getStartDay(),
      hours: expected.getStartHour(),
    };
    const actualAge = result.candidates[0].startAge;
    expect(Math.abs(symbolicAgeSeconds(actualAge) - symbolicAgeSeconds(referenceAge)))
      .toBeLessThanOrEqual(60);
    expect(symbolicAgeSeconds(actualAge)).toBe(actualAge.distanceSeconds);
    expect(result.candidates[0].cycles.map((cycle) => cycle.name)).toEqual(
      expected.getDaYun(5).slice(1).map((cycle) => cycle.getGanZhi()),
    );
  });
});

describe("bazi luck boundaries and validation", () => {
  it("uses Li-Chun as the adjacent Jie on both sides of the exact boundary", () => {
    const before = luck(birth({
      calendarDate: { kind: "solar", date: "2024-02-04" },
      time: { kind: "exact", value: "16:26" },
      chartSex: "female",
    }));
    const after = luck(birth({
      calendarDate: { kind: "solar", date: "2024-02-04" },
      time: { kind: "exact", value: "16:28" },
      chartSex: "female",
    }));

    expect(before.candidates[0]).toMatchObject({
      direction: "forward",
      referenceJie: { id: "solar_term_lichun", name: "立春" },
    });
    expect(after.candidates[0]).toMatchObject({
      direction: "backward",
      referenceJie: { id: "solar_term_lichun", name: "立春" },
    });
    expect(before.candidates[0].startAge.distanceSeconds).toBeGreaterThan(0);
    expect(after.candidates[0].startAge.distanceSeconds).toBeGreaterThan(0);
    expect(before.candidates[0].startAge.distanceSeconds).toBeLessThan(120);
    expect(after.candidates[0].startAge.distanceSeconds).toBeLessThan(120);
  });

  it("preserves both DST folds and their distinct physical distances", () => {
    const result = luck(birth({
      calendarDate: { kind: "solar", date: "2025-11-02" },
      time: { kind: "exact", value: "01:30" },
      location: {
        label: "New York",
        timeZoneId: "America/New_York",
        timeZoneSource: "user",
        timeZoneConfirmed: true,
      },
    }));

    expect(result.status).toBe("complete");
    expect(result.candidates).toHaveLength(2);
    const distances = result.candidates
      .map((candidate) => candidate.startAge.distanceSeconds)
      .sort((left, right) => left - right);
    expect(distances[1] - distances[0]).toBe(3_600);
  });

  it("does not invent a single start point for approximate or unknown time", () => {
    const approximate = luck(birth({
      time: {
        kind: "approximate",
        value: "12:00",
        beforeMinutes: 30,
        afterMinutes: 30,
      },
    }));
    const unknown = luck(birth({ time: { kind: "unknown" } }));

    for (const result of [approximate, unknown]) {
      expect(result.status).toBe("unavailable");
      expect(result.candidates).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe("exact_birth_time_required");
      expect(result.warnings[0].baziCandidateIds.length).toBeGreaterThan(0);
    }
  });

  it("explains an unavailable source chart", () => {
    const result = luck(birth({
      calendarDate: { kind: "solar", date: "2025-03-09" },
      time: { kind: "exact", value: "02:30" },
      location: {
        label: "New York",
        timeZoneId: "America/New_York",
        timeZoneSource: "user",
        timeZoneConfirmed: true,
      },
    }));

    expect(result).toMatchObject({
      status: "unavailable",
      candidates: [],
      warnings: [{ code: "bazi_candidates_unavailable", baziCandidateIds: [] }],
    });
  });

  it("rejects mismatched input hashes and invalid cycle counts", () => {
    const normalized = normalizeBirth(birth(), fixedOptions);
    const otherNormalized = normalizeBirth(birth({
      calendarDate: { kind: "solar", date: "1990-05-19" },
    }), fixedOptions);
    const chart = calculateBazi(otherNormalized);

    expect(() => calculateBaziLuck(normalized, chart)).toThrow(
      "大运输入与八字盘的出生输入哈希不一致",
    );
    for (const cycleCount of [0, 13, 1.5]) {
      expect(() => calculateBaziLuck(
        normalized,
        calculateBazi(normalized),
        { cycleCount },
      )).toThrow("大运柱数量必须是 1 至 12 的整数");
    }
    expect(luck(birth(), 1).candidates[0].cycles).toHaveLength(1);
    expect(luck(birth(), 12).candidates[0].cycles).toHaveLength(12);
  });
});
