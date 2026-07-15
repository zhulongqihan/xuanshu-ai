import { describe, expect, it } from "vitest";
import {
  birthInputSchema,
  claimSchema,
  liuyaoCastSchema,
} from "../src/schemas";

const validBirth = {
  calendar: "solar" as const,
  date: "1990-05-18",
  time: "23:30",
  chartSex: "male" as const,
  locationName: "上海市",
  latitude: 31.2304,
  longitude: 121.4737,
  timeZone: "Asia/Shanghai",
};

describe("birthInputSchema", () => {
  it("accepts a complete supported birth input", () => {
    expect(birthInputSchema.parse(validBirth)).toMatchObject({
      isLeapMonth: false,
      uncertaintyMinutes: 0,
    });
  });

  it("rejects impossible and out-of-range dates", () => {
    expect(() => birthInputSchema.parse({ ...validBirth, date: "1900-12-31" })).toThrow();
    expect(() => birthInputSchema.parse({ ...validBirth, date: "2026-02-30" })).toThrow();
  });

  it("requires coordinates to be supplied together", () => {
    const { longitude: _longitude, ...missingLongitude } = validBirth;
    expect(() => birthInputSchema.parse(missingLongitude)).toThrow(
      "经纬度必须同时提供或同时省略",
    );
  });

  it("rejects leap-month flags on solar dates", () => {
    expect(() =>
      birthInputSchema.parse({ ...validBirth, isLeapMonth: true }),
    ).toThrow("公历日期不能标记为闰月");
  });
});

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
