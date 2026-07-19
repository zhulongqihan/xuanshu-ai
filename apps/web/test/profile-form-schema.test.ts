import { describe, expect, it } from "vitest";
import { parseProfileFormData } from "../src/app/profiles/form-schema";

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) {
    data.set(name, value);
  }
  return data;
}

describe("profile form schema", () => {
  it("builds a confirmed solar birth input", () => {
    const result = parseProfileFormData(
      formData({
        displayName: " 本人 ",
        calendarKind: "solar",
        solarDate: "1990-05-18",
        timeKind: "exact",
        birthTime: "23:30",
        chartSex: "male",
        locationLabel: "上海市",
        timeZoneId: "Asia/Shanghai",
        timeZoneConfirmed: "on",
      }),
    );

    expect(result).toEqual({
      success: true,
      data: {
        displayName: "本人",
        birthInput: {
          schemaVersion: 1,
          calendarDate: { kind: "solar", date: "1990-05-18" },
          time: { kind: "exact", value: "23:30" },
          chartSex: "male",
          location: {
            label: "上海市",
            timeZoneId: "Asia/Shanghai",
            timeZoneSource: "manual",
            timeZoneConfirmed: true,
          },
          trueSolarTimeMode: "civil_only",
        },
      },
    });
  });

  it("builds a lunar approximate input with true solar time coordinates", () => {
    const result = parseProfileFormData(
      formData({
        displayName: "家人",
        calendarKind: "lunar",
        lunarYear: "1990",
        lunarMonth: "4",
        lunarDay: "24",
        isLeapMonth: "on",
        timeKind: "approximate",
        birthTime: "08:15",
        beforeMinutes: "30",
        afterMinutes: "45",
        chartSex: "female",
        locationLabel: "成都市",
        timeZoneId: "Asia/Chongqing",
        timeZoneConfirmed: "on",
        trueSolarTime: "compare",
        latitude: "30.5728",
        longitude: "104.0668",
      }),
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        birthInput: {
          calendarDate: {
            kind: "lunar",
            year: 1990,
            month: 4,
            day: 24,
            isLeapMonth: true,
          },
          time: {
            kind: "approximate",
            value: "08:15",
            beforeMinutes: 30,
            afterMinutes: 45,
          },
          location: {
            coordinates: { latitude: 30.5728, longitude: 104.0668 },
          },
          trueSolarTimeMode: "compare",
        },
      },
    });
  });

  it("returns field errors for unconfirmed time zone and missing coordinates", () => {
    const result = parseProfileFormData(
      formData({
        displayName: "测试",
        calendarKind: "solar",
        solarDate: "2026-02-30",
        timeKind: "unknown",
        chartSex: "male",
        locationLabel: "北京市",
        timeZoneId: "Asia/Shanghai",
        trueSolarTime: "compare",
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.solarDate).toBeDefined();
      expect(result.errors.timeZoneConfirmed).toContain("保存前必须确认出生地时区");
      expect(result.errors.latitude).toBeDefined();
      expect(result.errors.longitude).toBeDefined();
    }
  });
  it("rejects selector values that did not come from the form", () => {
    const result = parseProfileFormData(
      formData({
        displayName: "测试",
        calendarKind: "sidereal",
        solarDate: "1990-05-18",
        timeKind: "estimated",
        birthTime: "08:00",
        chartSex: "male",
        locationLabel: "北京市",
        timeZoneId: "Asia/Shanghai",
        timeZoneConfirmed: "on",
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.calendarKind).toContain("请选择公历或农历");
      expect(result.errors.birthTime).toContain("请选择出生时间精度");
    }
  });

});
