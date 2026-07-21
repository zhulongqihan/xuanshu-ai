import { z } from "zod";
import {
  calendarDateSchema,
  calendarResolutionSchema,
  supportedSolarDateSchema,
  type CalendarResolution,
  type CanonicalBirthInput,
} from "./birth";
import calendarDataJson from "./data/hko-calendar-months.json";
import { BirthNormalizationError } from "./errors";

const DAY_MILLISECONDS = 86_400_000;
const CALENDAR_ENGINE_VERSION = "1.0.0";

const monthTupleSchema = z.tuple([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.number().int().min(1900).max(2100),
  z.number().int().min(1).max(12),
  z.union([z.literal(0), z.literal(1)]),
  z.union([z.literal(29), z.literal(30)]),
]);

const calendarDataSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceId: z.literal("hko-calendar"),
    solarRange: z
      .object({
        start: z.literal("1901-01-01"),
        end: z.literal("2100-12-31"),
      })
      .strict(),
    terminalMonthDays: z.union([z.literal(29), z.literal(30)]),
    months: z.array(monthTupleSchema).min(2_400),
  })
  .strict();

function epochDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Math.trunc(Date.UTC(year, month - 1, day) / DAY_MILLISECONDS);
}

function dateFromEpochDay(value: number) {
  return new Date(value * DAY_MILLISECONDS).toISOString().slice(0, 10);
}

const calendarData = calendarDataSchema.parse(calendarDataJson);
const months = calendarData.months.map(
  ([solarStart, lunarYear, lunarMonth, isLeapMonth, days]) => ({
    solarStart,
    startDay: epochDay(solarStart),
    lunarYear,
    lunarMonth,
    isLeapMonth: isLeapMonth === 1,
    days,
  }),
);

const monthByLunarKey = new Map<string, (typeof months)[number]>();
if (months.at(-1)?.days !== calendarData.terminalMonthDays) {
  throw new Error("HKO 终端月长度与数据清单不一致");
}
for (const [index, month] of months.entries()) {
  const next = months[index + 1];
  if (next && next.startDay !== month.startDay + month.days) {
    throw new Error(
      `HKO 月界数据不连续：${month.solarStart} 后为 ${next.solarStart}`,
    );
  }
  const key = `${month.lunarYear}:${month.lunarMonth}:${month.isLeapMonth ? 1 : 0}`;
  if (monthByLunarKey.has(key)) {
    throw new Error(`HKO 月界数据存在重复农历月：${key}`);
  }
  monthByLunarKey.set(key, month);
}

function result(
  solarDate: string,
  month: (typeof months)[number],
  lunarDay: number,
): CalendarResolution {
  return calendarResolutionSchema.parse({
    status: "resolved",
    solarDate,
    lunarDate: {
      kind: "lunar",
      year: month.lunarYear,
      month: month.lunarMonth,
      day: lunarDay,
      isLeapMonth: month.isLeapMonth,
    },
    lunarMonthDays: month.days,
    engine: {
      id: "hko-calendar-table",
      version: CALENDAR_ENGINE_VERSION,
      sourceIds: ["hko-calendar", "gbt-33661"],
    },
  });
}

function monthForSolarDay(targetDay: number) {
  let low = 0;
  let high = months.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (months[middle].startDay <= targetDay) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return months[high];
}

function assertSupportedSolarDate(solarDate: string) {
  if (!supportedSolarDateSchema.safeParse(solarDate).success) {
    throw new BirthNormalizationError(
      "unsupported_range",
      `转换后的公历日期超出 1901-01-01 至 2100-12-31：${solarDate}`,
    );
  }
}

export function resolveHkoCalendarDate(
  input: CanonicalBirthInput["calendarDate"],
): CalendarResolution {
  const calendarDate = calendarDateSchema.parse(input);
  if (calendarDate.kind === "solar") {
    const targetDay = epochDay(calendarDate.date);
    const month = monthForSolarDay(targetDay);
    if (!month) {
      throw new BirthNormalizationError(
        "unsupported_range",
        `公历日期超出 HKO 月界范围：${calendarDate.date}`,
      );
    }
    const lunarDay = targetDay - month.startDay + 1;
    if (lunarDay < 1 || lunarDay > month.days) {
      throw new BirthNormalizationError(
        "invalid_lunar_date",
        `HKO 月界无法解析公历日期：${calendarDate.date}`,
      );
    }
    return result(calendarDate.date, month, lunarDay);
  }

  const key = `${calendarDate.year}:${calendarDate.month}:${calendarDate.isLeapMonth ? 1 : 0}`;
  const month = monthByLunarKey.get(key);
  if (!month) {
    if (calendarDate.year === 1900) {
      throw new BirthNormalizationError(
        "unsupported_range",
        `农历日期转换结果早于正式范围：${calendarDate.year}-${calendarDate.month}-${calendarDate.day}`,
      );
    }
    throw new BirthNormalizationError(
      "invalid_lunar_date",
      `农历月份不存在：${calendarDate.year} 年${calendarDate.isLeapMonth ? "闰" : ""}${calendarDate.month} 月`,
    );
  }
  if (calendarDate.day > month.days) {
    throw new BirthNormalizationError(
      "invalid_lunar_date",
      `农历日期不存在：${calendarDate.year} 年${calendarDate.isLeapMonth ? "闰" : ""}${calendarDate.month} 月 ${calendarDate.day} 日`,
    );
  }
  const solarDate = dateFromEpochDay(month.startDay + calendarDate.day - 1);
  assertSupportedSolarDate(solarDate);
  return result(solarDate, month, calendarDate.day);
}
