import { describe, expect, it } from "vitest";
import type { RawBirthInput } from "../src/birth";
import {
  BirthNormalizationError,
  canonicalBirthJson,
  canonicalizeBirthInput,
  hashCanonicalBirthInput,
  resolveCalendarDate,
  resolveCivilTime,
} from "../src/normalization";

function rawBirth(overrides: Partial<RawBirthInput> = {}): RawBirthInput {
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
    ...overrides,
  };
}

describe("birth input canonicalization", () => {
  it("normalizes display text, signed zero, and IANA aliases", () => {
    const canonical = canonicalizeBirthInput(
      rawBirth({
        location: {
          label: " A\u030A ",
          timeZoneId: "Asia/Chungking",
          timeZoneSource: "user",
          timeZoneConfirmed: true,
          coordinates: { latitude: -0, longitude: 0 },
        },
      }),
    );

    expect(canonical.location).toMatchObject({
      label: "Å",
      timeZoneId: "Asia/Shanghai",
      coordinates: { latitude: 0, longitude: 0 },
    });
    expect(Object.is(canonical.location.coordinates?.latitude, -0)).toBe(false);
  });

  it("uses RFC 8785 JSON and a stable SHA-256 over semantic input", () => {
    const first = canonicalizeBirthInput(rawBirth());
    const equivalent = canonicalizeBirthInput(
      rawBirth({
        location: {
          ...rawBirth().location,
          label: "上海市",
          timeZoneId: "Asia/Shanghai",
        },
      }),
    );
    const changed = canonicalizeBirthInput(rawBirth({ chartSex: "female" }));

    expect(canonicalBirthJson(first)).toBe(canonicalBirthJson(equivalent));
    expect(hashCanonicalBirthInput(first)).toBe(
      "5d914b2501adeb22a5b7a875ffc02627f1cdd9be14716bcf00b18744d9636bb4",
    );
    expect(hashCanonicalBirthInput(first)).toBe(hashCanonicalBirthInput(equivalent));
    expect(hashCanonicalBirthInput(first)).not.toBe(hashCanonicalBirthInput(changed));
  });

  it("refuses to canonicalize an unconfirmed time zone", () => {
    expect(() =>
      canonicalizeBirthInput(
        rawBirth({
          location: { ...rawBirth().location, timeZoneConfirmed: false },
        }),
      ),
    ).toThrow("归一化前必须由用户确认 IANA 时区");
  });
});

describe("calendar resolution", () => {
  it("matches HKO Chinese New Year fixture in both directions", () => {
    const fromSolar = resolveCalendarDate({ kind: "solar", date: "2024-02-10" });
    const fromLunar = resolveCalendarDate({
      kind: "lunar",
      year: 2024,
      month: 1,
      day: 1,
      isLeapMonth: false,
    });

    expect(fromSolar.lunarDate).toEqual({
      kind: "lunar",
      year: 2024,
      month: 1,
      day: 1,
      isLeapMonth: false,
    });
    expect(fromLunar.solarDate).toBe("2024-02-10");
  });

  it("matches the HKO 2023 leap-second-month fixture", () => {
    const result = resolveCalendarDate({
      kind: "lunar",
      year: 2023,
      month: 2,
      day: 1,
      isLeapMonth: true,
    });

    expect(result.solarDate).toBe("2023-03-22");
    expect(result.lunarDate.isLeapMonth).toBe(true);
  });

  it("rejects nonexistent leap months and converted dates outside support", () => {
    expect(() =>
      resolveCalendarDate({
        kind: "lunar",
        year: 2024,
        month: 2,
        day: 1,
        isLeapMonth: true,
      }),
    ).toThrow(BirthNormalizationError);
    expect(() =>
      resolveCalendarDate({
        kind: "lunar",
        year: 2024,
        month: 1,
        day: 30,
        isLeapMonth: false,
      }),
    ).toThrow(BirthNormalizationError);
    try {
      resolveCalendarDate({
        kind: "lunar",
        year: 1900,
        month: 1,
        day: 1,
        isLeapMonth: false,
      });
      throw new Error("应拒绝支持范围外日期");
    } catch (error) {
      expect(error).toMatchObject({ code: "unsupported_range" });
    }
  });
});

describe("civil time resolution", () => {
  it("returns nonexistent instead of silently shifting a DST gap", () => {
    const canonical = canonicalizeBirthInput(
      rawBirth({
        calendarDate: { kind: "solar", date: "2025-03-09" },
        time: { kind: "exact", value: "02:30" },
        location: {
          label: "New York",
          timeZoneId: "America/New_York",
          timeZoneSource: "user",
          timeZoneConfirmed: true,
        },
        trueSolarTimeMode: "civil_only",
      }),
    );

    expect(resolveCivilTime(canonical, resolveCalendarDate(canonical.calendarDate))).toEqual({
      status: "nonexistent",
      localDateTime: "2025-03-09T02:30:00",
      timeZoneId: "America/New_York",
    });
  });

  it("returns both folds for a DST overlap", () => {
    const canonical = canonicalizeBirthInput(
      rawBirth({
        calendarDate: { kind: "solar", date: "2025-11-02" },
        time: { kind: "exact", value: "01:30" },
        location: {
          label: "New York",
          timeZoneId: "America/New_York",
          timeZoneSource: "user",
          timeZoneConfirmed: true,
        },
        trueSolarTimeMode: "civil_only",
      }),
    );
    const result = resolveCivilTime(
      canonical,
      resolveCalendarDate(canonical.calendarDate),
    );

    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.map((candidate) => candidate.utcInstant)).toEqual([
        "2025-11-02T05:30:00Z",
        "2025-11-02T06:30:00Z",
      ]);
      expect(result.candidates.map((candidate) => candidate.fold)).toEqual([0, 1]);
    }
  });

  it("uses historical IANA daylight-saving offsets", () => {
    const canonical = canonicalizeBirthInput(
      rawBirth({
        calendarDate: { kind: "solar", date: "1990-07-01" },
        time: { kind: "exact", value: "12:00" },
      }),
    );
    const result = resolveCivilTime(
      canonical,
      resolveCalendarDate(canonical.calendarDate),
    );

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.candidate.utcOffsetSeconds).toBe(32_400);
      expect(result.candidate.utcInstant).toBe("1990-07-01T03:00:00Z");
    }
  });

  it("does not create an instant for unknown birth time", () => {
    const canonical = canonicalizeBirthInput(
      rawBirth({ time: { kind: "unknown" } }),
    );

    expect(resolveCivilTime(canonical, resolveCalendarDate(canonical.calendarDate))).toEqual({
      status: "unknown",
    });
  });
});
