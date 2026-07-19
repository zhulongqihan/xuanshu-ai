import { describe, expect, it } from "vitest";
import {
  claimSchema,
  liuyaoCastSchema,
} from "../src/schemas";

describe("claimSchema", () => {
  it("requires evidence for every claim", () => {
    expect(() =>
      claimSchema.parse({
        id: "claim-1",
        text: "示例判断",
        system: "bazi",
        certainty: "rule_based",
        evidence: [],
        appliesTo: "当前命盘",
      }),
    ).toThrow();
  });
});

describe("liuyaoCastSchema", () => {
  it("accepts exactly six lines ordered from bottom to top", () => {
    const cast = liuyaoCastSchema.parse({
      question: "是否适合在本周处理这件事？",
      method: "manual_lines",
      lineOrder: "bottom_to_top",
      lines: [7, 8, 9, 6, 7, 8],
      castAt: "2026-07-15T23:30:00+08:00",
      timeZone: "Asia/Shanghai",
      locationName: "上海市",
    });
    expect(cast.lines).toHaveLength(6);
  });

  it("rejects reversed or incomplete line data", () => {
    expect(() =>
      liuyaoCastSchema.parse({
        question: "测试",
        method: "manual_lines",
        lineOrder: "top_to_bottom",
        lines: [7, 8, 9, 6, 7],
        castAt: "2026-07-15T23:30:00+08:00",
        timeZone: "Asia/Shanghai",
        locationName: "上海市",
      }),
    ).toThrow();
  });
});
