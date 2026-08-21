import { describe, expect, it } from "vitest";
import { routeQuestion } from "../src/router";

describe("consultation router", () => {
  it("routes a bazi question to one deterministic system", () => {
    expect(routeQuestion("请解释这份八字的大运和旺衰。"))
      .toMatchObject({ primarySystem: "bazi", systems: ["bazi"], mode: "single", safety: { level: "normal" } });
  });

  it("routes ziwei, almanac, and liuyao vocabulary independently", () => {
    expect(routeQuestion("紫微斗数的命宫和夫妻宫怎么读？").primarySystem).toBe("ziwei");
    expect(routeQuestion("明天适合搬家吗？").primarySystem).toBe("almanac");
    expect(routeQuestion("这个六爻的世应和变卦是什么？").primarySystem).toBe("liuyao");
  });

  it("uses synthesis mode when the question names multiple systems", () => {
    const result = routeQuestion("请结合八字和紫微看看这次工作选择。");
    expect(result).toMatchObject({ primarySystem: "synthesis", mode: "synthesis" });
    expect(result.systems).toEqual(["bazi", "ziwei"]);
  });

  it("marks medical, legal, and financial topics as high risk", () => {
    const result = routeQuestion("请根据八字判断我的投资和健康会不会出问题？");
    expect(result.safety.level).toBe("high_risk");
    expect(result.safety.cautions[0]).toContain("投资");
  });

  it("keeps ambiguous questions in a safe synthesis entry", () => {
    const result = routeQuestion("请帮我解释一下。");
    expect(result).toMatchObject({ primarySystem: "synthesis", mode: "single", systems: ["bazi"] });
    expect(() => routeQuestion("x")).toThrow("问题长度");
  });
});
