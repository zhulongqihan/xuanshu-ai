import { describe, expect, it } from "vitest";
import { calculateBazi } from "../src/bazi";
import { calculateBaziStrength } from "../src/bazi-strength";
import type { RawBirthInput } from "../src/birth";
import { normalizeBirth } from "../src/normalization";

const fixedOptions = { normalizedAt: "2026-08-21T20:00:00+08:00" };

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

function strength(input: RawBirthInput) {
  const normalized = normalizeBirth(input, fixedOptions);
  return calculateBaziStrength(calculateBazi(normalized));
}

describe("bazi strength base facts", () => {
  it("returns transparent season, root, distribution, and support facts", () => {
    const result = strength(birth());
    const candidate = result.candidates[0];

    expect(result.status).toBe("complete");
    expect(candidate).toMatchObject({
      status: "complete",
      dayMaster: { name: "癸", element: "water", polarity: "yin" },
      monthContext: { branchName: "巳", element: "fire", relationToDayMaster: "wealth" },
      supportElements: { sameElement: "water", resourceElement: "metal" },
    });
    expect(candidate.distribution.map((item) => item.element)).toEqual([
      "wood", "fire", "earth", "metal", "water",
    ]);
    expect(candidate.distribution.reduce((sum, item) => sum + item.weightedScore, 0))
      .toBeCloseTo(candidate.support.supportScore + candidate.support.otherScore, 6);
    expect(candidate.support.supportRatio).toBeCloseTo(
      candidate.support.supportScore /
        (candidate.support.supportScore + candidate.support.otherScore),
      6,
    );
    expect(candidate.support.level).toMatch(/^(supportive|balanced|less_supported)$/);
    expect(result.ruleIds).toEqual([
      "bazi.strength.month-order-v1",
      "bazi.strength.visible-hidden-count-v1",
      "bazi.strength.root-v1",
      "bazi.strength.support-ratio-v1",
    ]);
  });

  it("keeps unknown-time strength partial instead of inventing an hour pillar", () => {
    const result = strength(birth({ time: { kind: "unknown" } }));

    expect(result.status).toBe("partial");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.every((candidate) => candidate.status === "partial")).toBe(true);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: "hour_pillar_unavailable",
    }));
    expect(result.candidates.every((candidate) =>
      candidate.warnings.some((warning) => warning.code === "hour_pillar_unavailable"),
    )).toBe(true);
  });

  it("reports unavailable when the source chart has no candidates", () => {
    const normalized = normalizeBirth(birth(), fixedOptions);
    const chart = calculateBazi(normalized);
    const result = calculateBaziStrength({
      ...chart,
      status: "unavailable",
      candidates: [],
    });

    expect(result).toMatchObject({
      status: "unavailable",
      candidates: [],
      warnings: [{ code: "bazi_candidates_unavailable", baziCandidateIds: [] }],
    });
  });
});
