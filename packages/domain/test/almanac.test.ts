import { describe, expect, it } from "vitest";
import { calculateAlmanac } from "../src/almanac";

function almanac(solarDate = "1990-05-18", timeZoneId = "Asia/Shanghai") {
  return calculateAlmanac({ schemaVersion: 1, solarDate, timeZoneId });
}

describe("almanac facts", () => {
  it("calculates offline lunar, day, solar-term, jianchu, and clash facts", () => {
    const result = almanac();

    expect(result).toMatchObject({
      status: "complete",
      input: { solarDate: "1990-05-18", timeZoneId: "Asia/Shanghai" },
      engine: {
        id: "xuanshu-almanac",
        ruleSetId: "almanac-xiejibianfang-v1",
      },
      lunar: { year: 1990, month: 4, day: 24, isLeapMonth: false },
      day: {
        ganZhiIndex: 19,
        name: "癸未",
        stem: { name: "癸", element: "water" },
        branch: { name: "未", element: "earth" },
      },
      solarTerms: {
        currentJie: { name: "立夏" },
        nextJie: { name: "芒种" },
      },
      jianChu: { name: "满", monthBranch: "巳", dayBranch: "未" },
      clash: { dayBranch: "未", clashBranch: "丑" },
    });
    expect(result.activities).toHaveLength(4);
    expect(result.activities.every((item) => ["favorable", "caution", "conflict", "insufficient"].includes(item.status))).toBe(true);
    expect(result.activities.map((item) => item.status)).toEqual(["caution", "favorable", "caution", "caution"]);
    expect(result.activities.every((item) => item.factors.length > 0)).toBe(true);
    expect(result.evidence.map((item) => item.ruleId)).toEqual(result.ruleIds);
  });

  it("keeps timezone-specific solar-term display deterministic", () => {
    const result = almanac("2025-11-02", "America/New_York");

    expect(result.solarTerms.currentJie.timeZoneId).toBe("America/New_York");
    expect(result.solarTerms.currentJie.localDateTime).toContain("T");
    expect(result.solarTerms.nextJie.utcInstant).toMatch(/Z|[+-]\d{2}:\d{2}$/);
    expect(result.engine.sourceIds).toContain("meeus-aa");
  });

  it("exposes an explicit conflict signal for a broken-day activity rule", () => {
    const result = almanac("1990-05-22");

    expect(result.jianChu.name).toBe("破");
    expect(result.activities.map((item) => item.status)).toEqual([
      "conflict",
      "conflict",
      "conflict",
      "conflict",
    ]);
    expect(result.activities.every((item) => item.factors[0]?.signal === "conflict")).toBe(true);
  });

  it("rejects dates outside the formal HKO range", () => {
    expect(() => almanac("2101-01-01")).toThrow("公历日期必须真实存在且位于 1901-2100");
  });
});
