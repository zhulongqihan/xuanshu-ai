import { astro } from "iztro";
import { z } from "zod";
import { normalizedBirthSchema, type NormalizedBirth } from "./birth";
import { evidenceRefSchema, type EvidenceRef } from "./schemas";

const ZIWEI_ENGINE = {
  id: "xuanshu-ziwei",
  version: "0.1.0",
  ruleSetId: "ziwei-sanhe-v1",
  ruleSetVersion: "1.0.0",
  sourceIds: ["iztro", "ziwei-quanshu"],
} as const;

const ziweiConfigSchema = z.object({
  yearDivide: z.literal("exact"),
  horoscopeDivide: z.literal("exact"),
  ageDivide: z.literal("normal"),
  dayDivide: z.literal("current"),
  algorithm: z.literal("default"),
}).strict();

const starSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  scope: z.string().min(1),
  brightness: z.string().optional(),
  mutagen: z.string().optional(),
}).strict();

const palaceSchema = z.object({
  index: z.number().int().min(0).max(11),
  name: z.string().min(1),
  heavenlyStem: z.string().min(1),
  earthlyBranch: z.string().min(1),
  isBodyPalace: z.boolean(),
  isOriginalPalace: z.boolean(),
  majorStars: z.array(starSchema),
  minorStars: z.array(starSchema),
  adjectiveStars: z.array(starSchema),
  decadal: z.object({
    range: z.tuple([z.number().int().nonnegative(), z.number().int().positive()]),
    heavenlyStem: z.string().min(1),
    earthlyBranch: z.string().min(1),
  }).strict(),
}).strict();

const candidateSchema = z.object({
  id: z.string().min(1),
  timeCandidateId: z.string().min(1),
  timeBasis: z.literal("civil"),
  timePrecision: z.enum(["exact", "approximate", "ambiguous"]),
  timeIndex: z.number().int().min(0).max(12),
  localDateTime: z.string().min(1),
  solarDate: z.string().min(1),
  lunarDate: z.string().min(1),
  chineseDate: z.string().min(1),
  earthlyBranchOfSoulPalace: z.string().min(1),
  earthlyBranchOfBodyPalace: z.string().min(1),
  soul: z.string().min(1),
  body: z.string().min(1),
  fiveElementsClass: z.string().min(1),
  palaces: z.array(palaceSchema).length(12),
  warnings: z.array(z.string().min(1)),
}).strict();

export const ziweiInputSchema = z.object({
  schemaVersion: z.literal(1),
  normalized: normalizedBirthSchema,
}).strict();

export const ziweiCalculationSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(["complete", "partial", "unavailable"]),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  engine: z.object({
    id: z.literal(ZIWEI_ENGINE.id),
    version: z.literal(ZIWEI_ENGINE.version),
    ruleSetId: z.literal(ZIWEI_ENGINE.ruleSetId),
    ruleSetVersion: z.literal(ZIWEI_ENGINE.ruleSetVersion),
    sourceIds: z.array(z.string().min(1)).min(1),
  }).strict(),
  config: ziweiConfigSchema,
  candidates: z.array(candidateSchema),
  warnings: z.array(z.string().min(1)),
  evidence: z.array(evidenceRefSchema).min(1),
  ruleIds: z.array(z.string().min(1)).min(1),
}).strict();

export type ZiweiCalculation = z.infer<typeof ziweiCalculationSchema>;

const CONFIG = {
  yearDivide: "exact" as const,
  horoscopeDivide: "exact" as const,
  ageDivide: "normal" as const,
  dayDivide: "current" as const,
  algorithm: "default" as const,
};

function timeIndex(localDateTime: string) {
  const hour = Number(localDateTime.slice(11, 13));
  if (hour === 23) return 12;
  if (hour === 0) return 0;
  return Math.floor((hour + 1) / 2);
}

function timeCandidates(normalized: NormalizedBirth) {
  const resolution = normalized.timeResolution;
  if (resolution.status === "unknown" || resolution.status === "nonexistent") return [];
  if (resolution.status === "resolved") return [{ ...resolution.candidate, kind: "resolved" as const }];
  return resolution.candidates.map((candidate) => ({ ...candidate, kind: "ambiguous" as const }));
}

function star(value: { name: string; type: string; scope: string; brightness?: string; mutagen?: string }) {
  return {
    name: value.name,
    type: value.type,
    scope: value.scope,
    ...(value.brightness ? { brightness: value.brightness } : {}),
    ...(value.mutagen ? { mutagen: value.mutagen } : {}),
  };
}

function evidence(ruleId: string, sourceId: EvidenceRef["sourceId"], locator: string) {
  return evidenceRefSchema.parse({ ruleId, sourceId, locator });
}

function dateString(normalized: NormalizedBirth) {
  const lunar = normalized.calendarResolution.lunarDate;
  return `${lunar.year}-${lunar.month}-${lunar.day}`;
}

function calculateCandidate(
  normalized: NormalizedBirth,
  candidate: ReturnType<typeof timeCandidates>[number],
) {
  const input = normalized.canonicalInput;
  const timeIndexValue = timeIndex(candidate.localDateTime);
  const gender = input.chartSex === "male" ? "男" : "女";
  const chart = astro.withOptions({
    type: "lunar",
    dateStr: dateString(normalized),
    timeIndex: timeIndexValue,
    gender,
    isLeapMonth: normalized.calendarResolution.lunarDate.isLeapMonth,
    fixLeap: true,
    language: "zh-CN",
    config: CONFIG,
  });
  const precision = input.time.kind === "approximate"
    ? "approximate" as const
    : candidate.kind === "ambiguous"
      ? "ambiguous" as const
      : "exact" as const;
  return {
    id: `ziwei-${candidate.id}`,
    timeCandidateId: candidate.id,
    timeBasis: "civil" as const,
    timePrecision: precision,
    timeIndex: timeIndexValue,
    localDateTime: candidate.localDateTime,
    solarDate: chart.solarDate,
    lunarDate: chart.lunarDate,
    chineseDate: chart.chineseDate,
    earthlyBranchOfSoulPalace: chart.earthlyBranchOfSoulPalace,
    earthlyBranchOfBodyPalace: chart.earthlyBranchOfBodyPalace,
    soul: chart.soul,
    body: chart.body,
    fiveElementsClass: chart.fiveElementsClass,
    palaces: chart.palaces.map((palace) => ({
      index: palace.index,
      name: palace.name,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      isBodyPalace: palace.isBodyPalace,
      isOriginalPalace: palace.isOriginalPalace,
      majorStars: palace.majorStars.map(star),
      minorStars: palace.minorStars.map(star),
      adjectiveStars: palace.adjectiveStars.map(star),
      decadal: {
        range: palace.decadal.range,
        heavenlyStem: palace.decadal.heavenlyStem,
        earthlyBranch: palace.decadal.earthlyBranch,
      },
    })),
    warnings: input.trueSolarTimeMode === "compare"
      ? ["紫微首版固定采用民用时间；真太阳时只在八字候选中并列，不静默替换紫微输入。"]
      : [],
  };
}

export function calculateZiwei(input: z.input<typeof ziweiInputSchema>): ZiweiCalculation {
  const normalizedInput = ziweiInputSchema.parse(input);
  const normalized = normalizedInput.normalized;
  const candidates = timeCandidates(normalized).map((candidate) => calculateCandidate(normalized, candidate));
  const warnings = candidates.length === 0
    ? ["紫微斗数首版需要可定位的出生时辰；当前记录没有生成单一紫微盘。"]
    : normalized.canonicalInput.time.kind === "approximate"
      ? ["出生时间为约略值，紫微结果仅代表中心时刻候选，不应视为完整时间范围。"]
      : [];
  const ruleIds = [
    "ziwei.calendar.lunar-resolution-v1",
    "ziwei.time-index-v1",
    "ziwei.palace-star-layout-v1",
    "ziwei.decadal-v1",
    "ziwei.config-v1",
  ];
  return ziweiCalculationSchema.parse({
    schemaVersion: 1,
    status: candidates.length === 0
      ? "unavailable"
      : candidates.some((candidate) => candidate.timePrecision !== "exact")
        ? "partial"
        : "complete",
    inputHash: normalized.inputHash,
    engine: ZIWEI_ENGINE,
    config: CONFIG,
    candidates,
    warnings,
    evidence: [
      evidence("ziwei.calendar.lunar-resolution-v1", "hko-calendar", "归一化出生记录中的 HKO 公农历解析"),
      evidence("ziwei.time-index-v1", "ziwei-quanshu", "十二时辰与早子/晚子时边界配置"),
      evidence("ziwei.palace-star-layout-v1", "iztro", "iztro 2.5.8 三合基础十二宫与星曜安置"),
      evidence("ziwei.decadal-v1", "ziwei-quanshu", "三合体系大限宫位与起运年龄结构"),
      evidence("ziwei.config-v1", "ziwei-quanshu", "立春分界、当前日界和默认安星算法配置"),
    ],
    ruleIds,
  });
}
