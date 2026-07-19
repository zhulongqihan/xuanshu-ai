import { describe, expect, it } from "vitest";
import {
  birthTimeSchema,
  canonicalBirthInputSchema,
  normalizedBirthSchema,
  rawBirthInputSchema,
  timeResolutionSchema,
} from "../src/birth";

const validRawBirth = {
  schemaVersion: 1 as const,
  calendarDate: { kind: "solar" as const, date: "1990-05-18" },
  time: { kind: "exact" as const, value: "23:30" },
  chartSex: "male" as const,
  location: {
    label: " 上海市 ",
    timeZoneId: "Asia/Shanghai",
    timeZoneSource: "user" as const,
    timeZoneConfirmed: true,
    coordinates: { latitude: 31.2304, longitude: 121.4737 },
  },
  trueSolarTimeMode: "compare" as const,
};

const canonicalBirth = {
  ...validRawBirth,
  location: { ...validRawBirth.location, label: "上海市" },
};

const provenance = {
  normalizer: { id: "xuanshu-calendar", version: "0.1.0" },
  dependencies: [
    { name: "lunar-typescript", version: "1.8.6", integrity: "sha512-test" },
  ],
  runtime: { node: "24.0.0", icu: "77.1", tzdb: "2025b" },
  sourceIds: ["hko-calendar", "iana-tzdb"],
  trace: [
    {
      step: "calendar.resolve",
      engineId: "lunar-typescript",
      engineVersion: "1.8.6",
      inputRefs: ["canonicalInput.calendarDate"],
      outputRefs: ["calendarResolution"],
      sourceIds: ["hko-calendar"],
    },
  ],
  normalizedAt: "2026-07-19T01:00:00+08:00",
};

const calendarResolution = {
  status: "resolved" as const,
  solarDate: "1990-05-18",
  lunarDate: {
    kind: "lunar" as const,
    year: 1990,
    month: 4,
    day: 24,
    isLeapMonth: false,
  },
  lunarMonthDays: 30 as const,
  engine: {
    id: "lunar-typescript",
    version: "1.8.6",
    sourceIds: ["hko-calendar"],
  },
};

describe("rawBirthInputSchema", () => {
  it("preserves the user's structured text without trimming", () => {
    expect(rawBirthInputSchema.parse(validRawBirth).location.label).toBe(" 上海市 ");
  });

  it("validates Gregorian dates only in the solar branch", () => {
    expect(() =>
      rawBirthInputSchema.parse({
        ...validRawBirth,
        calendarDate: { kind: "solar", date: "2026-02-30" },
      }),
    ).toThrow("公历日期必须真实存在");
    expect(() =>
      rawBirthInputSchema.parse({
        ...validRawBirth,
        calendarDate: { kind: "solar", date: "1900-12-31" },
      }),
    ).toThrow("公历日期必须真实存在");
  });

  it("leaves lunar month size and leap-month existence to the calendar engine", () => {
    expect(
      rawBirthInputSchema.parse({
        ...validRawBirth,
        calendarDate: {
          kind: "lunar",
          year: 2023,
          month: 2,
          day: 30,
          isLeapMonth: true,
        },
      }).calendarDate,
    ).toMatchObject({ kind: "lunar", day: 30, isLeapMonth: true });

    expect(() =>
      rawBirthInputSchema.parse({
        ...validRawBirth,
        calendarDate: { kind: "lunar", year: 2023, month: 2, day: 30 },
      }),
    ).toThrow();
  });

  it("supports exact, asymmetric approximate, and unknown birth times", () => {
    expect(
      birthTimeSchema.parse({
        kind: "approximate",
        value: "23:30",
        beforeMinutes: 15,
        afterMinutes: 45,
      }),
    ).toMatchObject({ beforeMinutes: 15, afterMinutes: 45 });
    expect(birthTimeSchema.parse({ kind: "unknown" })).toEqual({ kind: "unknown" });
    expect(() =>
      birthTimeSchema.parse({
        kind: "approximate",
        value: "23:30",
        beforeMinutes: 0,
        afterMinutes: 0,
      }),
    ).toThrow("近似时间必须包含非零的不确定范围");
  });

  it("requires coordinates when true solar time comparison is requested", () => {
    expect(() =>
      rawBirthInputSchema.parse({
        ...validRawBirth,
        location: { ...validRawBirth.location, coordinates: undefined },
      }),
    ).toThrow("比较真太阳时必须提供经纬度");
  });
});

describe("canonicalBirthInputSchema", () => {
  it("requires trimmed NFC text while raw input retains the original", () => {
    expect(canonicalBirthInputSchema.parse(canonicalBirth).location.label).toBe("上海市");
    expect(() => canonicalBirthInputSchema.parse(validRawBirth)).toThrow("规范文本");
    expect(() =>
      canonicalBirthInputSchema.parse({
        ...canonicalBirth,
        location: { ...canonicalBirth.location, label: "A\u030A" },
      }),
    ).toThrow("规范文本");
  });

  it("requires explicit user confirmation of the IANA time zone", () => {
    expect(
      rawBirthInputSchema.parse({
        ...validRawBirth,
        location: { ...validRawBirth.location, timeZoneConfirmed: false },
      }).location.timeZoneConfirmed,
    ).toBe(false);
    expect(() =>
      canonicalBirthInputSchema.parse({
        ...canonicalBirth,
        location: { ...canonicalBirth.location, timeZoneConfirmed: false },
      }),
    ).toThrow("归一化前必须由用户确认 IANA 时区");
  });
});

describe("normalizedBirthSchema", () => {
  it("represents unknown birth time without inventing an instant", () => {
    const normalized = normalizedBirthSchema.parse({
      schemaVersion: 1,
      inputHash: "a".repeat(64),
      canonicalInput: {
        ...canonicalBirth,
        time: { kind: "unknown" },
      },
      calendarResolution,
      timeResolution: { status: "unknown" },
      apparentSolarTime: { status: "unavailable", reason: "time_unknown" },
      solarTermContext: { status: "unavailable", reason: "time_unknown" },
      boundaryDistances: [],
      warnings: [
        {
          code: "birth_time_unknown",
          severity: "warning",
          message: "出生时间未知，不能生成唯一时柱。",
          affectedCandidateIds: [],
          fieldPaths: ["canonicalInput.time"],
        },
      ],
      provenance,
    });

    expect(normalized.timeResolution).toEqual({ status: "unknown" });
    expect(JSON.stringify(normalized)).not.toContain("utcInstant");
  });

  it("requires two distinct candidates for a DST overlap", () => {
    const candidate = {
      id: "dst-earlier",
      localDateTime: "2025-11-02T01:30:00",
      timeZoneId: "America/New_York",
      utcOffsetSeconds: -14_400,
      utcInstant: "2025-11-02T05:30:00Z",
      fold: 0 as const,
    };
    expect(
      timeResolutionSchema.parse({
        status: "ambiguous",
        candidates: [
          candidate,
          {
            ...candidate,
            id: "dst-later",
            utcOffsetSeconds: -18_000,
            utcInstant: "2025-11-02T06:30:00Z",
            fold: 1,
          },
        ],
      }).status,
    ).toBe("ambiguous");
    expect(() =>
      timeResolutionSchema.parse({
        status: "ambiguous",
        candidates: [candidate, candidate],
      }),
    ).toThrow("歧义时间必须包含两个不同候选");
  });

  it("rejects trace data that references a nonexistent time candidate", () => {
    expect(() =>
      normalizedBirthSchema.parse({
        schemaVersion: 1,
        inputHash: "b".repeat(64),
        canonicalInput: {
          ...canonicalBirth,
          trueSolarTimeMode: "civil_only",
        },
        calendarResolution,
        timeResolution: {
          status: "resolved",
          candidate: {
            id: "civil-1",
            localDateTime: "1990-05-18T23:30:00",
            timeZoneId: "Asia/Shanghai",
            utcOffsetSeconds: 28_800,
            utcInstant: "1990-05-18T15:30:00Z",
          },
        },
        apparentSolarTime: { status: "not_requested" },
        solarTermContext: {
          status: "resolved",
          candidates: [
            {
              candidateId: "civil-1",
              previous: {
                id: "solar-term-li-xia",
                name: "立夏",
                utcInstant: "1990-05-06T01:35:00Z",
                localDateTime: "1990-05-06T09:35:00",
                timeZoneId: "Asia/Shanghai",
              },
              next: {
                id: "solar-term-xiao-man",
                name: "小满",
                utcInstant: "1990-05-21T14:37:00Z",
                localDateTime: "1990-05-21T22:37:00",
                timeZoneId: "Asia/Shanghai",
              },
              secondsSincePrevious: 1_097_700,
              secondsUntilNext: 259_620,
            },
          ],
          engine: {
            id: "lunar-typescript",
            version: "1.8.6",
            sourceIds: ["hko-calendar"],
          },
        },
        boundaryDistances: [
          { kind: "civil_midnight", candidateId: "missing", signedSeconds: -1_800 },
        ],
        warnings: [],
        provenance,
      }),
    ).toThrow("候选引用不存在：missing");
  });

  it("rejects true-solar output in civil-only mode", () => {
    expect(() =>
      normalizedBirthSchema.parse({
        schemaVersion: 1,
        inputHash: "c".repeat(64),
        canonicalInput: {
          ...canonicalBirth,
          time: { kind: "unknown" },
          trueSolarTimeMode: "civil_only",
        },
        calendarResolution,
        timeResolution: { status: "unknown" },
        apparentSolarTime: { status: "unavailable", reason: "time_unknown" },
        solarTermContext: { status: "unavailable", reason: "time_unknown" },
        boundaryDistances: [],
        warnings: [],
        provenance,
      }),
    ).toThrow("civil_only 模式不得生成真太阳时结果");
  });
});
