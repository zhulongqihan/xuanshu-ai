import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import {
  solarTermInstantsForCalendarYear,
  type SolarTermInstant,
} from "./astronomy";
import {
  supportedSolarDateSchema,
} from "./birth";
import { evidenceRefSchema, timeZoneSchema, type EvidenceRef } from "./schemas";
import { resolveHkoCalendarDate } from "./hko-calendar";
import { sexagenaryDayIndex, sexagenaryName } from "./bazi";

const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const ELEMENTS = ["wood", "fire", "earth", "metal", "water"] as const;
const JIANCHU = ["建", "除", "满", "平", "定", "执", "破", "危", "成", "收", "开", "闭"] as const;

const ALMANAC_ENGINE = {
  id: "xuanshu-almanac",
  version: "0.1.0",
  ruleSetId: "almanac-xiejibianfang-v1",
  ruleSetVersion: "1.0.0",
  sourceIds: ["hko-calendar", "gbt-33661", "meeus-aa", "xiejibianfang"],
} as const;

const termSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  utcInstant: z.string().datetime({ offset: true }),
  localDateTime: z.string().datetime({ local: true }),
  timeZoneId: timeZoneSchema,
}).strict();

const activitySchema = z.object({
  id: z.enum(["travel", "moving", "contract", "worship"]),
  label: z.string().min(1),
  status: z.literal("not_evaluated"),
  message: z.string().min(1),
}).strict();

export const almanacInputSchema = z.object({
  schemaVersion: z.literal(1),
  solarDate: supportedSolarDateSchema,
  timeZoneId: timeZoneSchema,
}).strict();

export const almanacCalculationSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.literal("complete"),
  input: almanacInputSchema,
  engine: z.object({
    id: z.literal(ALMANAC_ENGINE.id),
    version: z.literal(ALMANAC_ENGINE.version),
    ruleSetId: z.literal(ALMANAC_ENGINE.ruleSetId),
    ruleSetVersion: z.literal(ALMANAC_ENGINE.ruleSetVersion),
    sourceIds: z.array(z.string().min(1)).min(1),
  }).strict(),
  lunar: z.object({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(30),
    isLeapMonth: z.boolean(),
    monthDays: z.union([z.literal(29), z.literal(30)]),
  }).strict(),
  day: z.object({
    ganZhiIndex: z.number().int().min(0).max(59),
    name: z.string().length(2),
    stem: z.object({ name: z.string().length(1), element: z.enum(ELEMENTS) }).strict(),
    branch: z.object({ name: z.string().length(1), element: z.enum(ELEMENTS) }).strict(),
  }).strict(),
  solarTerms: z.object({
    previous: termSchema,
    next: termSchema,
    currentJie: termSchema,
    nextJie: termSchema,
  }).strict(),
  jianChu: z.object({
    name: z.enum(JIANCHU),
    monthBranch: z.string().length(1),
    dayBranch: z.string().length(1),
  }).strict(),
  clash: z.object({
    dayBranch: z.string().length(1),
    clashBranch: z.string().length(1),
  }).strict(),
  activities: z.array(activitySchema).length(4),
  evidence: z.array(evidenceRefSchema).min(1),
  ruleIds: z.array(z.string().min(1)).min(1),
}).strict();

export type AlmanacInput = z.infer<typeof almanacInputSchema>;
export type AlmanacCalculation = z.infer<typeof almanacCalculationSchema>;

const JIE_TO_MONTH_BRANCH = new Map([
  ["solar_term_xiaohan", 1],
  ["solar_term_lichun", 2],
  ["solar_term_jingzhe", 3],
  ["solar_term_qingming", 4],
  ["solar_term_lixia", 5],
  ["solar_term_mangzhong", 6],
  ["solar_term_xiaoshu", 7],
  ["solar_term_liqiu", 8],
  ["solar_term_bailu", 9],
  ["solar_term_hanlu", 10],
  ["solar_term_lidong", 11],
  ["solar_term_daxue", 0],
]);

function elementForStem(index: number) {
  return ELEMENTS[Math.floor(index / 2) % ELEMENTS.length];
}

function elementForBranch(index: number) {
  return ELEMENTS[[4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4][index % 12]];
}

function termRef(term: SolarTermInstant, timeZoneId: string) {
  return {
    id: term.id,
    name: term.name,
    utcInstant: term.instant.toString({ smallestUnit: "second" }),
    localDateTime: term.instant
      .toZonedDateTimeISO(timeZoneId)
      .toPlainDateTime()
      .toString({ smallestUnit: "second" }),
    timeZoneId,
  };
}

function termsAround(date: string, timeZoneId: string) {
  const year = Number(date.slice(0, 4));
  const noon = Temporal.PlainDateTime.from(`${date}T12:00:00`)
    .toZonedDateTime(timeZoneId)
    .toInstant();
  const terms = [year - 1, year, year + 1]
    .flatMap((termYear) => solarTermInstantsForCalendarYear(termYear))
    .sort((left, right) => Temporal.Instant.compare(left.instant, right.instant));
  const nextIndex = terms.findIndex((term) => Temporal.Instant.compare(term.instant, noon) > 0);
  const previous = terms[nextIndex - 1];
  const next = terms[nextIndex];
  const jieTerms = terms.filter((term) => term.kind === "jie");
  const nextJieIndex = jieTerms.findIndex((term) => Temporal.Instant.compare(term.instant, noon) > 0);
  const currentJie = jieTerms[nextJieIndex - 1];
  const nextJie = jieTerms[nextJieIndex];
  if (!previous || !next || !currentJie || !nextJie) {
    throw new RangeError(`无法定位黄历节气上下文：${date}`);
  }
  return { previous, next, currentJie, nextJie };
}

function evidence(ruleId: string, sourceId: EvidenceRef["sourceId"], locator: string) {
  return evidenceRefSchema.parse({ ruleId, sourceId, locator });
}

export function calculateAlmanac(input: AlmanacInput): AlmanacCalculation {
  const normalized = almanacInputSchema.parse(input);
  const calendar = resolveHkoCalendarDate({ kind: "solar", date: normalized.solarDate });
  const dayIndex = sexagenaryDayIndex(normalized.solarDate);
  const dayStemIndex = dayIndex % 10;
  const dayBranchIndex = dayIndex % 12;
  const terms = termsAround(normalized.solarDate, normalized.timeZoneId);
  const monthBranchIndex = JIE_TO_MONTH_BRANCH.get(terms.currentJie.id);
  if (monthBranchIndex === undefined) {
    throw new RangeError(`未登记的黄历月令节气：${terms.currentJie.id}`);
  }
  const jianChuIndex = (dayBranchIndex - monthBranchIndex + 12) % 12;
  const activities = [
    ["travel", "出行"],
    ["moving", "搬迁"],
    ["contract", "签约"],
    ["worship", "祭祀"],
  ] as const;
  const result = {
    schemaVersion: 1 as const,
    status: "complete" as const,
    input: normalized,
    engine: ALMANAC_ENGINE,
    lunar: {
      year: calendar.lunarDate.year,
      month: calendar.lunarDate.month,
      day: calendar.lunarDate.day,
      isLeapMonth: calendar.lunarDate.isLeapMonth,
      monthDays: calendar.lunarMonthDays,
    },
    day: {
      ganZhiIndex: dayIndex,
      name: sexagenaryName(dayIndex),
      stem: { name: STEMS[dayStemIndex], element: elementForStem(dayStemIndex) },
      branch: { name: BRANCHES[dayBranchIndex], element: elementForBranch(dayBranchIndex) },
    },
    solarTerms: {
      previous: termRef(terms.previous, normalized.timeZoneId),
      next: termRef(terms.next, normalized.timeZoneId),
      currentJie: termRef(terms.currentJie, normalized.timeZoneId),
      nextJie: termRef(terms.nextJie, normalized.timeZoneId),
    },
    jianChu: {
      name: JIANCHU[jianChuIndex],
      monthBranch: BRANCHES[monthBranchIndex],
      dayBranch: BRANCHES[dayBranchIndex],
    },
    clash: {
      dayBranch: BRANCHES[dayBranchIndex],
      clashBranch: BRANCHES[(dayBranchIndex + 6) % 12],
    },
    activities: activities.map(([id, label]) => ({
      id,
      label,
      status: "not_evaluated" as const,
      message: "首版只提供日期事实；未完成该事项的逐条宜忌校验，不输出单一吉凶结论。",
    })),
    evidence: [
      evidence("almanac.lunar-date-hko-v1", "hko-calendar", "1901-2100 公农历逐日离线表"),
      evidence("almanac.sexagenary-day-v1", "gbt-33661", "第 6.3.2 条；1949-10-01=甲子日锚点"),
      evidence("almanac.solar-term-context-v1", "meeus-aa", "太阳视黄经节气时刻；本地时区展示"),
      evidence("almanac.jianchu-v1", "xiejibianfang", "建除十二神：月令地支与日支顺序"),
      evidence("almanac.clash-v1", "xiejibianfang", "日支相冲：相隔六位地支"),
      evidence("almanac.activity-scope-v1", "xiejibianfang", "事项宜忌必须绑定具体事项并逐条校验"),
    ],
    ruleIds: [
      "almanac.lunar-date-hko-v1",
      "almanac.sexagenary-day-v1",
      "almanac.solar-term-context-v1",
      "almanac.jianchu-v1",
      "almanac.clash-v1",
      "almanac.activity-scope-v1",
    ],
  };
  return almanacCalculationSchema.parse(result);
}
