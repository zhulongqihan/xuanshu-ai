import { describe, expect, it } from "vitest";
import {
  countReviewedReferenceCases,
  liuyaoReferenceCaseSchema,
  validateReferenceCaseSet,
} from "../src";

const candidate = {
  schemaVersion: 1 as const,
  id: "liuyao.s3.example-01",
  system: "liuyao" as const,
  status: "candidate" as const,
  ruleSetId: "liuyao-wenwanggua-v1",
  ruleSetVersion: "1.0.0",
  privacy: { containsPersonalData: false as const },
  provenance: {
    sourceId: "chinese-fortune-liuyao",
    sourceTier: "S3" as const,
    locator: "references/04-liuyao.md#案例一",
    inputDerivation: "transcribed" as const,
    notes: "来源正文卦名与逐爻表存在差异，暂不计入黄金集。",
  },
  input: {
    question: "评测用六爻案例",
    method: "manual_lines" as const,
    lineOrder: "bottom_to_top" as const,
    lines: [8, 8, 6, 7, 7, 7] as const,
    castAt: "1903-09-04T12:00:00+08:00",
    timeZone: "Asia/Shanghai",
    locationName: "脱敏地点",
  },
  assertions: [{
    path: "hexagram.base.name",
    expected: "否",
    comparison: "cross-implementation" as const,
    notes: "按来源逐爻表复算；来源正文写作晋。",
  }],
};

describe("reference case contract", () => {
  it("accepts a privacy-safe candidate and reports reviewed counts", () => {
    const cases = validateReferenceCaseSet([candidate]);
    expect(cases).toHaveLength(1);
    expect(countReviewedReferenceCases(cases)).toEqual({ ziwei: 0, liuyao: 0 });
  });

  it("requires a review record before a case can be marked reviewed", () => {
    expect(() => liuyaoReferenceCaseSchema.parse({ ...candidate, status: "reviewed" })).toThrow("reviewed");
  });

  it("rejects duplicate IDs and personal data fixtures", () => {
    expect(() => validateReferenceCaseSet([candidate, candidate])).toThrow("ID 重复");
    expect(() => liuyaoReferenceCaseSchema.parse({
      ...candidate,
      privacy: { containsPersonalData: true },
    })).toThrow();
  });
});
