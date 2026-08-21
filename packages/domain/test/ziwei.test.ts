import { describe, expect, it } from "vitest";
import { calculateZiwei, normalizeBirth } from "../src";

function birthInput(time: { kind: "exact" | "approximate" | "unknown"; value?: string; beforeMinutes?: number; afterMinutes?: number } = { kind: "exact", value: "12:00" }) {
  return {
    schemaVersion: 1 as const,
    calendarDate: { kind: "solar" as const, date: "1990-05-18" },
    time: time.kind === "unknown"
      ? { kind: "unknown" as const }
      : time.kind === "approximate"
        ? { kind: "approximate" as const, value: time.value ?? "12:00", beforeMinutes: time.beforeMinutes ?? 30, afterMinutes: time.afterMinutes ?? 30 }
        : { kind: "exact" as const, value: time.value ?? "12:00" },
    chartSex: "male" as const,
    location: {
      label: "上海",
      timeZoneId: "Asia/Shanghai",
      timeZoneSource: "user" as const,
      timeZoneConfirmed: true,
      coordinates: { latitude: 31.2304, longitude: 121.4737 },
    },
    trueSolarTimeMode: "compare" as const,
  };
}

function engineeringBirth(index: number) {
  const date = new Date(Date.UTC(1988, 0, 1 + index)).toISOString().slice(0, 10);
  const hour = String((index % 12) * 2).padStart(2, "0");
  return {
    ...birthInput({ kind: "exact", value: `${hour}:00` }),
    calendarDate: { kind: "solar" as const, date },
    chartSex: index % 2 === 0 ? "male" as const : "female" as const,
  };
}

describe("ziwei calculation", () => {
  it("generates a versioned twelve-palace chart from the normalized birth record", () => {
    const normalized = normalizeBirth(birthInput());
    const result = calculateZiwei({ schemaVersion: 1, normalized });
    expect(result.status).toBe("complete");
    expect(result.inputHash).toBe(normalized.inputHash);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.palaces).toHaveLength(12);
    expect(result.candidates[0]?.palaces.some((palace) =>
      palace.majorStars.some((star) => star.name === "紫微"),
    )).toBe(true);
    expect(result.candidates[0]?.warnings).toContain(
      "紫微首版固定采用民用时间；真太阳时只在八字候选中并列，不静默替换紫微输入。",
    );
    expect(result.evidence.map((item) => item.ruleId)).toEqual(expect.arrayContaining(result.ruleIds));
  });

  it("keeps approximate time as an explicit partial result", () => {
    const normalized = normalizeBirth(birthInput({ kind: "approximate", value: "23:30" }));
    const result = calculateZiwei({ schemaVersion: 1, normalized });
    expect(result.status).toBe("partial");
    expect(result.candidates[0]?.timePrecision).toBe("approximate");
    expect(result.warnings[0]).toContain("约略值");
  });

  it("does not fabricate a chart when the birth time is unknown", () => {
    const normalized = normalizeBirth(birthInput({ kind: "unknown" }));
    const result = calculateZiwei({ schemaVersion: 1, normalized });
    expect(result.status).toBe("unavailable");
    expect(result.candidates).toHaveLength(0);
    expect(result.warnings[0]).toContain("需要可定位的出生时辰");
  });

  it("keeps 100 engineering regression charts structurally stable", () => {
    for (let index = 0; index < 100; index += 1) {
      const normalized = normalizeBirth(engineeringBirth(index));
      const result = calculateZiwei({ schemaVersion: 1, normalized });
      expect(result.status, `case-${index}`).toBe("complete");
      expect(result.candidates, `case-${index}`).toHaveLength(1);
      expect(result.candidates[0]?.palaces, `case-${index}`).toHaveLength(12);
      expect(result.candidates[0]?.palaces.every((palace) => palace.name.length > 0), `case-${index}`).toBe(true);
      expect(result.candidates[0]?.palaces.some((palace) => palace.majorStars.length > 0), `case-${index}`).toBe(true);
    }
  });
});
