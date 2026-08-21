import { describe, expect, it } from "vitest";
import { routeQuestion } from "@xuanshu/agent";
import { calculateAlmanac } from "@xuanshu/domain";
import {
  buildAlmanacConsultationSystem,
  buildConsultationFacts,
} from "../src/server/consult/facts";

describe("consultation facts boundary", () => {
  it("keeps an almanac-only question free of unrelated bazi facts", () => {
    const route = routeQuestion("明天适合签约吗？");
    const almanac = calculateAlmanac({
      schemaVersion: 1,
      solarDate: "2026-08-22",
      timeZoneId: "Asia/Shanghai",
    });
    const facts = buildConsultationFacts(route, [buildAlmanacConsultationSystem(almanac)]);

    expect(route.systems).toEqual(["almanac"]);
    expect(facts.systems.map((item) => item.system)).toEqual(["almanac"]);
    expect(facts.systems.some((item) => item.system === "bazi")).toBe(false);
  });
});
