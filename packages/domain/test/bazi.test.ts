import { Solar } from "lunar-typescript";
import { describe, expect, it } from "vitest";
import type { RawBirthInput } from "../src/birth";
import { calculateBazi, sexagenaryDayIndex } from "../src/bazi";
import { normalizeBirth } from "../src/normalization";

const fixedOptions = { normalizedAt: "2026-07-22T23:30:00+08:00" };

function birth(overrides: Partial<RawBirthInput> = {}): RawBirthInput {
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
    },
    trueSolarTimeMode: "civil_only",
    ...overrides,
  };
}

function chart(input: RawBirthInput, dayBoundaryPolicies?: Array<"midnight" | "zi_start">) {
  return calculateBazi(normalizeBirth(input, fixedOptions), { dayBoundaryPolicies });
}

describe("sexagenary day", () => {
  it("uses the GB/T 33661 Jia-Zi anchor and remains stable at supported boundaries", () => {
    expect(sexagenaryDayIndex("1949-10-01")).toBe(0);
    expect(sexagenaryDayIndex("2000-01-07")).toBe(0);
    expect(sexagenaryDayIndex("2024-02-10")).toBe(40);
    expect(sexagenaryDayIndex("1901-01-01")).toBe(15);
    expect(sexagenaryDayIndex("2100-12-31")).toBe(43);
  });

  it("covers more than 200 consecutive golden dates without breaking the 60-day cycle", () => {
    const anchor = Date.UTC(1949, 9, 1);
    for (let offset = -100; offset <= 100; offset += 1) {
      const date = new Date(anchor + offset * 86_400_000).toISOString().slice(0, 10);
      expect(sexagenaryDayIndex(date), date).toBe(((offset % 60) + 60) % 60);
    }
  });
});

describe("bazi fact calculation", () => {
  it("keeps midnight and Zi-start day-boundary charts explicit", () => {
    const result = chart(birth(), ["midnight", "zi_start"]);

    expect(result.status).toBe("complete");
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((candidate) => ({
      boundary: candidate.dayBoundary,
      pillars: Object.values(candidate.pillars).map((pillar) => pillar?.name),
    }))).toEqual([
      {
        boundary: "midnight",
        pillars: ["庚午", "辛巳", "癸未", "壬子"],
      },
      {
        boundary: "zi_start",
        pillars: ["庚午", "辛巳", "甲申", "甲子"],
      },
    ]);
    expect(result.candidates[0].pillars.year.stemTenGod.name).toBe("正印");
    expect(result.candidates[0].pillars.month.stemTenGod.name).toBe("偏印");
    expect(result.candidates[0].pillars.day.stemTenGod.name).toBe("日主");
    expect(result.candidates[0].pillars.hour?.stemTenGod.name).toBe("劫财");
    expect(result.candidates[0].pillars.hour?.hiddenStems[0].tenGod.name).toBe("比肩");
    expect(result.candidates[0].pillars.month.hiddenStems.map((item) => item.stem.name))
      .toEqual(["丙", "庚", "戊"]);
  });

  it("changes year and month at the exact Li-Chun instant instead of at midnight", () => {
    const before = chart(birth({
      calendarDate: { kind: "solar", date: "2024-02-04" },
      time: { kind: "exact", value: "16:26" },
      chartSex: "female",
    }));
    const after = chart(birth({
      calendarDate: { kind: "solar", date: "2024-02-04" },
      time: { kind: "exact", value: "16:28" },
      chartSex: "female",
    }));

    expect(before.candidates[0].currentJie.name).toBe("小寒");
    expect(before.candidates[0].pillars.year.name).toBe("癸卯");
    expect(before.candidates[0].pillars.month.name).toBe("乙丑");
    expect(after.candidates[0].currentJie.name).toBe("立春");
    expect(after.candidates[0].pillars.year.name).toBe("甲辰");
    expect(after.candidates[0].pillars.month.name).toBe("丙寅");
  });

  it("preserves a visible apparent-solar candidate when it crosses midnight", () => {
    const result = chart(birth({
      calendarDate: { kind: "solar", date: "1992-05-18" },
      time: { kind: "exact", value: "23:55" },
      location: {
        ...birth().location,
        coordinates: { latitude: 31.2304, longitude: 121.4737 },
      },
      trueSolarTimeMode: "compare",
    }));

    expect(result.candidates.map((candidate) => candidate.timeBasis)).toEqual([
      "civil",
      "apparent_solar",
    ]);
    expect(result.candidates[0].pillars.day.name).toBe("甲午");
    expect(result.candidates[1].localDateTime).toMatch(/^1992-05-19T00:/);
    expect(result.candidates[1].pillars.day.name).toBe("乙未");
  });

  it("returns partial three-pillar candidates instead of inventing an unknown hour", () => {
    const ordinary = chart(birth({
      calendarDate: { kind: "solar", date: "2024-02-10" },
      time: { kind: "unknown" },
    }));
    const boundaryDate = chart(birth({
      calendarDate: { kind: "solar", date: "2024-02-04" },
      time: { kind: "unknown" },
    }));

    expect(ordinary.status).toBe("partial");
    expect(ordinary.candidates).toHaveLength(1);
    expect(ordinary.candidates[0].pillars.hour).toBeNull();
    expect(boundaryDate.candidates).toHaveLength(2);
    expect(boundaryDate.candidates.map((candidate) => candidate.pillars.month.name))
      .toEqual(["乙丑", "丙寅"]);
  });

  it("expands an approximate interval into each distinct hour and day-boundary chart", () => {
    const result = chart(birth({
      calendarDate: { kind: "solar", date: "2024-02-10" },
      time: {
        kind: "approximate",
        value: "22:55",
        beforeMinutes: 0,
        afterMinutes: 10,
      },
    }), ["midnight", "zi_start"]);

    expect(result.status).toBe("complete");
    expect(result.candidates.map((candidate) => ({
      boundary: candidate.dayBoundary,
      day: candidate.pillars.day.name,
      hour: candidate.pillars.hour?.name,
      sampleCount: candidate.sourceTimeWindows?.reduce(
        (total, window) => total + window.sampleCount,
        0,
      ),
    }))).toEqual([
      { boundary: "midnight", day: "甲辰", hour: "乙亥", sampleCount: 5 },
      { boundary: "midnight", day: "甲辰", hour: "甲子", sampleCount: 6 },
      { boundary: "zi_start", day: "乙巳", hour: "丙子", sampleCount: 6 },
    ]);
    expect(result.candidates[0].sourceTimeWindows).toEqual([{
      startCivilLocalDateTime: "2024-02-10T22:55:00",
      endCivilLocalDateTime: "2024-02-10T22:59:00",
      startUtcInstant: "2024-02-10T14:55:00Z",
      endUtcInstant: "2024-02-10T14:59:00Z",
      sampleCount: 5,
    }]);
    expect(result.warnings[0]).toMatchObject({ code: "birth_time_approximate" });
  });

  it("retains both DST folds while expanding an approximate interval", () => {
    const result = chart(birth({
      calendarDate: { kind: "solar", date: "2025-11-02" },
      time: {
        kind: "approximate",
        value: "01:30",
        beforeMinutes: 0,
        afterMinutes: 1,
      },
      location: {
        label: "New York",
        timeZoneId: "America/New_York",
        timeZoneSource: "user",
        timeZoneConfirmed: true,
      },
    }));

    expect(result.candidates).toHaveLength(2);
    expect(new Set(result.candidates.map((candidate) => candidate.utcInstant)).size).toBe(2);
    expect(result.candidates[0].pillars).toEqual(result.candidates[1].pillars);
    expect(result.candidates.map((candidate) => candidate.sourceTimeWindows)).toEqual([
      [{
        startCivilLocalDateTime: "2025-11-02T01:30:00",
        endCivilLocalDateTime: "2025-11-02T01:31:00",
        startUtcInstant: "2025-11-02T05:30:00Z",
        endUtcInstant: "2025-11-02T05:31:00Z",
        sampleCount: 2,
        fold: 0,
      }],
      [{
        startCivilLocalDateTime: "2025-11-02T01:30:00",
        endCivilLocalDateTime: "2025-11-02T01:31:00",
        startUtcInstant: "2025-11-02T06:30:00Z",
        endUtcInstant: "2025-11-02T06:31:00Z",
        sampleCount: 2,
        fold: 1,
      }],
    ]);
  });

  it("returns unavailable when an approximate interval is entirely inside a DST gap", () => {
    const result = chart(birth({
      calendarDate: { kind: "solar", date: "2025-03-09" },
      time: {
        kind: "approximate",
        value: "02:15",
        beforeMinutes: 10,
        afterMinutes: 10,
      },
      location: {
        label: "New York",
        timeZoneId: "America/New_York",
        timeZoneSource: "user",
        timeZoneConfirmed: true,
      },
    }));

    expect(result.status).toBe("unavailable");
    expect(result.candidates).toEqual([]);
    expect(result.warnings[0].code).toBe("approximate_interval_nonexistent");
  });

  it("keeps valid interval portions when the approximate center is in a DST gap", () => {
    const result = chart(birth({
      calendarDate: { kind: "solar", date: "2025-03-09" },
      time: {
        kind: "approximate",
        value: "02:30",
        beforeMinutes: 45,
        afterMinutes: 45,
      },
      location: {
        label: "New York",
        timeZoneId: "America/New_York",
        timeZoneSource: "user",
        timeZoneConfirmed: true,
      },
    }));

    expect(result.status).toBe("complete");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.warnings[0].code).toBe("birth_time_approximate");
  });

  it("refuses to create a chart for a nonexistent DST civil time", () => {
    const result = chart(birth({
      calendarDate: { kind: "solar", date: "2025-03-09" },
      time: { kind: "exact", value: "02:30" },
      location: {
        label: "New York",
        timeZoneId: "America/New_York",
        timeZoneSource: "user",
        timeZoneConfirmed: true,
      },
    }));

    expect(result.status).toBe("unavailable");
    expect(result.candidates).toEqual([]);
    expect(result.warnings[0].code).toBe("civil_time_nonexistent");
  });
});

describe("lunar-typescript cross-validation", () => {
  it("matches 200 non-boundary four-pillar samples across 1901-2100", () => {
    for (let year = 1901; year <= 2100; year += 1) {
      const month = ((year - 1901) % 12) + 1;
      const date = `${year}-${String(month).padStart(2, "0")}-15`;
      const result = chart(birth({
        calendarDate: { kind: "solar", date },
        time: { kind: "exact", value: "12:00" },
      }));
      const expected = Solar.fromYmdHms(year, month, 15, 12, 0, 0)
        .getLunar()
        .getEightChar();
      expected.setSect(2);

      expect(
        Object.values(result.candidates[0].pillars).map((pillar) => pillar?.name),
        date,
      ).toEqual([
        expected.getYear(),
        expected.getMonth(),
        expected.getDay(),
        expected.getTime(),
      ]);
    }
  }, 120_000);
});
