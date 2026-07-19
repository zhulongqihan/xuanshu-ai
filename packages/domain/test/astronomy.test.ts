import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RawBirthInput } from "../src/birth";
import {
  NORMALIZATION_DEPENDENCIES,
  normalizeBirth,
} from "../src/normalization";

function birth(overrides: Partial<RawBirthInput> = {}): RawBirthInput {
  return {
    schemaVersion: 1,
    calendarDate: { kind: "solar", date: "2024-02-04" },
    time: { kind: "exact", value: "16:27" },
    chartSex: "female",
    location: {
      label: "上海市",
      timeZoneId: "Asia/Shanghai",
      timeZoneSource: "user",
      timeZoneConfirmed: true,
      coordinates: { latitude: 31.2304, longitude: 120 },
    },
    trueSolarTimeMode: "compare",
    ...overrides,
  };
}

const fixedOptions = { normalizedAt: "2026-07-19T21:40:00+08:00" };

describe("astronomical birth normalization", () => {
  it("locates the 2024 Li Chun boundary with high-precision VSOP87", () => {
    const normalized = normalizeBirth(birth(), fixedOptions);

    expect(normalized.timeResolution.status).toBe("resolved");
    expect(normalized.solarTermContext.status).toBe("resolved");
    if (normalized.solarTermContext.status === "resolved") {
      expect(normalized.solarTermContext.candidates[0].next.name).toBe("立春");
      expect(normalized.solarTermContext.candidates[0].secondsUntilNext).toBeLessThan(10);
    }
    expect(
      normalized.boundaryDistances.find((distance) => distance.kind === "solar_term")
        ?.signedSeconds,
    ).toBeLessThan(0);
    expect(normalized.warnings.map((item) => item.code)).toContain(
      "near_time_boundary",
    );
  });

  it("separates longitude correction from equation of time", () => {
    const normalized = normalizeBirth(
      birth({
        calendarDate: { kind: "solar", date: "2024-02-11" },
        time: { kind: "exact", value: "12:00" },
      }),
      fixedOptions,
    );

    expect(normalized.apparentSolarTime.status).toBe("resolved");
    if (normalized.apparentSolarTime.status === "resolved") {
      const candidate = normalized.apparentSolarTime.candidates[0];
      expect(candidate.longitudeCorrectionSeconds).toBe(0);
      expect(candidate.equationOfTimeSeconds).toBeGreaterThan(-860);
      expect(candidate.equationOfTimeSeconds).toBeLessThan(-840);
      expect(candidate.totalCorrectionSeconds).toBe(
        candidate.equationOfTimeSeconds,
      );
    }
  });

  it("keeps unknown time unresolved without astronomical fabrication", () => {
    const normalized = normalizeBirth(
      birth({
        time: { kind: "unknown" },
        trueSolarTimeMode: "civil_only",
      }),
      fixedOptions,
    );

    expect(normalized.timeResolution).toEqual({ status: "unknown" });
    expect(normalized.apparentSolarTime).toEqual({ status: "not_requested" });
    expect(normalized.solarTermContext).toEqual({
      status: "unavailable",
      reason: "time_unknown",
    });
    expect(normalized.boundaryDistances).toEqual([]);
    expect(normalized.warnings.map((item) => item.code)).toContain(
      "birth_time_unknown",
    );
  });

  it("marks an approximate interval that crosses the 23:00 boundary", () => {
    const normalized = normalizeBirth(
      birth({
        calendarDate: { kind: "solar", date: "2024-02-10" },
        time: {
          kind: "approximate",
          value: "22:55",
          beforeMinutes: 0,
          afterMinutes: 10,
        },
        trueSolarTimeMode: "civil_only",
      }),
      fixedOptions,
    );

    expect(normalized.warnings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "birth_time_approximate",
        "near_time_boundary",
        "uncertainty_crosses_boundary",
      ]),
    );
  });

  it("assembles both DST folds with matching term contexts", () => {
    const normalized = normalizeBirth(
      birth({
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
      fixedOptions,
    );

    expect(normalized.timeResolution.status).toBe("ambiguous");
    expect(normalized.solarTermContext.status).toBe("resolved");
    if (
      normalized.timeResolution.status === "ambiguous" &&
      normalized.solarTermContext.status === "resolved"
    ) {
      expect(normalized.solarTermContext.candidates.map((item) => item.candidateId)).toEqual(
        normalized.timeResolution.candidates.map((item) => item.id),
      );
    }
    expect(normalized.warnings.map((item) => item.code)).toContain(
      "civil_time_ambiguous",
    );
  });

  it("returns a structured error state for nonexistent civil time", () => {
    const normalized = normalizeBirth(
      birth({
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
      fixedOptions,
    );

    expect(normalized.timeResolution.status).toBe("nonexistent");
    expect(normalized.boundaryDistances).toEqual([]);
    expect(normalized.warnings).toContainEqual(
      expect.objectContaining({ code: "civil_time_nonexistent", severity: "error" }),
    );
  });

  it("is byte-stable when normalizedAt and semantic input are fixed", () => {
    const first = normalizeBirth(birth(), fixedOptions);
    const second = normalizeBirth(birth(), fixedOptions);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("keeps hard-coded provenance integrity aligned with the lockfile", () => {
    const lockfile = readFileSync(join(process.cwd(), "..", "..", "pnpm-lock.yaml"),
      "utf8");
    for (const dependency of NORMALIZATION_DEPENDENCIES) {
      expect(lockfile).toContain(`${dependency.name}@${dependency.version}`);
      expect(lockfile).toContain(dependency.integrity);
    }
  });
});
