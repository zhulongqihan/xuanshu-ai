import { bench, describe } from "vitest";
import {
  calculateAlmanac,
  calculateBazi,
  calculateLiuyao,
  calculateZiwei,
  normalizeBirth,
} from "../src";

const rawBirth = {
  schemaVersion: 1 as const,
  calendarDate: { kind: "solar" as const, date: "1990-05-18" },
  time: { kind: "exact" as const, value: "23:30" },
  chartSex: "male" as const,
  location: {
    label: "上海市",
    timeZoneId: "Asia/Shanghai",
    timeZoneSource: "user" as const,
    timeZoneConfirmed: true,
    coordinates: { latitude: 31.2304, longitude: 121.4737 },
  },
  trueSolarTimeMode: "compare" as const,
};

const normalized = normalizeBirth(rawBirth, {
  normalizedAt: "2026-08-21T12:00:00+08:00",
});

describe("deterministic engine performance", () => {
  bench("bazi", () => { void calculateBazi(normalized); });
  bench("ziwei", () => { void calculateZiwei({ schemaVersion: 1, normalized }); });
  bench("almanac", () => {
    void calculateAlmanac({
      schemaVersion: 1,
      solarDate: "1990-05-18",
      timeZoneId: "Asia/Shanghai",
    });
  });
  bench("liuyao", () => {
    void calculateLiuyao({
      schemaVersion: 1,
      cast: {
        question: "这件事接下来如何推进？",
        method: "manual_lines",
        lineOrder: "bottom_to_top",
        lines: [7, 8, 7, 9, 8, 7],
        castAt: "1990-05-18T12:00:00+08:00",
        timeZone: "Asia/Shanghai",
        locationName: "上海市",
      },
    });
  });
});
