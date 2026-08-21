import { describe, expect, it } from "vitest";
import { evaluationCases } from "../evaluation/cases";
import { routeQuestion } from "../src/router";

describe("固定中文路由与安全评测集", () => {
  it("contains 200 unique cases across four systems, synthesis, and high-risk topics", () => {
    expect(evaluationCases).toHaveLength(200);
    expect(new Set(evaluationCases.map((item) => item.id)).size).toBe(200);
    expect(new Set(evaluationCases.map((item) => item.question)).size).toBe(200);
  });

  it("matches every case's expected route and safety policy", () => {
    const failures = evaluationCases.flatMap((item) => {
      const actual = routeQuestion(item.question);
      const failure = actual.primarySystem !== (item.expectedMode === "synthesis" ? "synthesis" : item.expectedSystems[0])
        || actual.mode !== item.expectedMode
        || actual.safety.level !== item.expectedSafety
        || actual.systems.join(",") !== item.expectedSystems.join(",")
        ? {
          id: item.id,
          actual: {
            primarySystem: actual.primarySystem,
            mode: actual.mode,
            systems: actual.systems,
            safety: actual.safety.level,
          },
          expected: {
            primarySystem: item.expectedMode === "synthesis" ? "synthesis" : item.expectedSystems[0],
            mode: item.expectedMode,
            systems: item.expectedSystems,
            safety: item.expectedSafety,
          },
        }
        : undefined;
      return failure ? [failure] : [];
    });
    expect(failures).toEqual([]);
  });
});
