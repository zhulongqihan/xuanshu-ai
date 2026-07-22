import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import { solarTermInstantsForCalendarYear } from "./astronomy";
import {
  baziCalculationSchema,
  sexagenaryName,
  type BaziCalculation,
} from "./bazi";
import { normalizedBirthSchema, type NormalizedBirth } from "./birth";

const TERM_REF_SCHEMA = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  utcInstant: z.string().datetime({ offset: true }),
}).strict();

const START_AGE_SCHEMA = z.object({
  distanceSeconds: z.number().int().nonnegative(),
  symbolicYears: z.number().nonnegative(),
  years: z.number().int().nonnegative(),
  months: z.number().int().min(0).max(11),
  days: z.number().int().min(0).max(29),
  hours: z.number().int().min(0).max(23),
  minutes: z.number().int().min(0).max(59),
}).strict();

const LUCK_CYCLE_SCHEMA = z.object({
  index: z.number().int().positive(),
  ganZhiIndex: z.number().int().min(0).max(59),
  name: z.string().length(2),
  startOffsetYears: z.number().int().nonnegative(),
  endOffsetYears: z.number().int().positive(),
}).strict();

const LUCK_CANDIDATE_SCHEMA = z.object({
  baziCandidateId: z.string().min(1),
  direction: z.enum(["forward", "backward"]),
  yearStemPolarity: z.enum(["yang", "yin"]),
  referenceJie: TERM_REF_SCHEMA,
  startAge: START_AGE_SCHEMA,
  cycles: z.array(LUCK_CYCLE_SCHEMA).min(1),
}).strict();

export const baziLuckCalculationSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(["complete", "partial", "unavailable"]),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  engine: z.object({
    id: z.literal("xuanshu-bazi-luck"),
    version: z.literal("0.1.0"),
    ruleSetId: z.literal("bazi-ziping-v1"),
    ruleSetVersion: z.literal("1.0.0"),
    sourceIds: z.array(z.string().min(1)).min(1),
  }).strict(),
  candidates: z.array(LUCK_CANDIDATE_SCHEMA),
  warnings: z.array(z.object({
    code: z.string().regex(/^[a-z][a-z0-9_]*$/),
    message: z.string().min(1),
    baziCandidateIds: z.array(z.string().min(1)),
  }).strict()),
  ruleIds: z.array(z.string().min(1)).min(1),
}).strict();

export type BaziLuckCalculation = z.infer<typeof baziLuckCalculationSchema>;

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function termRef(term: ReturnType<typeof solarTermInstantsForCalendarYear>[number]) {
  return {
    id: term.id,
    name: term.name,
    utcInstant: term.instant.toString({ smallestUnit: "second" }),
  };
}

function adjacentJie(instant: Temporal.Instant) {
  const utcYear = instant.toZonedDateTimeISO("UTC").year;
  const terms = [utcYear - 1, utcYear, utcYear + 1]
    .flatMap((year) => solarTermInstantsForCalendarYear(year))
    .filter((term) => term.kind === "jie")
    .sort((left, right) => Temporal.Instant.compare(left.instant, right.instant));
  const nextIndex = terms.findIndex((term) => Temporal.Instant.compare(term.instant, instant) > 0);
  const previous = terms[nextIndex - 1];
  const next = terms[nextIndex];
  if (!previous || !next) {
    throw new RangeError(`无法定位起运节气：${instant.toString()}`);
  }
  return { previous, next };
}

function decomposeStartAge(distanceSeconds: number) {
  let remaining = Math.round(distanceSeconds);
  const years = Math.floor(remaining / 259_200);
  remaining -= years * 259_200;
  const months = Math.floor(remaining / 21_600);
  remaining -= months * 21_600;
  const days = Math.floor(remaining / 720);
  remaining -= days * 720;
  const hours = Math.floor(remaining / 30);
  remaining -= hours * 30;
  const minutes = remaining * 2;
  return START_AGE_SCHEMA.parse({
    distanceSeconds: Math.round(distanceSeconds),
    symbolicYears: Math.round((distanceSeconds / 259_200) * 1_000_000) / 1_000_000,
    years,
    months,
    days,
    hours,
    minutes,
  });
}

function isForward(
  polarity: "yang" | "yin",
  chartSex: NormalizedBirth["canonicalInput"]["chartSex"],
) {
  return (polarity === "yang" && chartSex === "male") ||
    (polarity === "yin" && chartSex === "female");
}

export function calculateBaziLuck(
  normalizedInput: NormalizedBirth,
  baziInput: BaziCalculation,
  options: { cycleCount?: number } = {},
): BaziLuckCalculation {
  const normalized = normalizedBirthSchema.parse(normalizedInput);
  const bazi = baziCalculationSchema.parse(baziInput);
  if (normalized.inputHash !== bazi.inputHash) {
    throw new TypeError("大运输入与八字盘的出生输入哈希不一致");
  }
  const cycleCount = options.cycleCount ?? 8;
  if (!Number.isInteger(cycleCount) || cycleCount < 1 || cycleCount > 12) {
    throw new RangeError("大运柱数量必须是 1 至 12 的整数");
  }

  const candidates: BaziLuckCalculation["candidates"] = [];
  const unsupportedIds: string[] = [];
  for (const candidate of bazi.candidates) {
    if (candidate.timePrecision !== "exact" || !candidate.utcInstant) {
      unsupportedIds.push(candidate.id);
      continue;
    }
    const instant = Temporal.Instant.from(candidate.utcInstant);
    const jie = adjacentJie(instant);
    const forward = isForward(
      candidate.pillars.year.stem.polarity,
      normalized.canonicalInput.chartSex,
    );
    const reference = forward ? jie.next : jie.previous;
    const distanceSeconds = Math.abs(
      Number(reference.instant.epochMilliseconds - instant.epochMilliseconds) / 1_000,
    );
    const step = forward ? 1 : -1;
    const monthIndex = candidate.pillars.month.ganZhiIndex;
    candidates.push(LUCK_CANDIDATE_SCHEMA.parse({
      baziCandidateId: candidate.id,
      direction: forward ? "forward" : "backward",
      yearStemPolarity: candidate.pillars.year.stem.polarity,
      referenceJie: termRef(reference),
      startAge: decomposeStartAge(distanceSeconds),
      cycles: Array.from({ length: cycleCount }, (_, index) => {
        const ganZhiIndex = modulo(monthIndex + step * (index + 1), 60);
        return {
          index: index + 1,
          ganZhiIndex,
          name: sexagenaryName(ganZhiIndex),
          startOffsetYears: index * 10,
          endOffsetYears: (index + 1) * 10,
        };
      }),
    }));
  }

  const warnings: BaziLuckCalculation["warnings"] = [];
  if (bazi.candidates.length === 0) {
    warnings.push({
      code: "bazi_candidates_unavailable",
      message: "八字盘没有可用候选，不能计算大运。",
      baziCandidateIds: [],
    });
  }
  if (unsupportedIds.length > 0) {
    warnings.push({
      code: "exact_birth_time_required",
      message: "约略或未知出生时间不能生成单一起运点。",
      baziCandidateIds: unsupportedIds,
    });
  }
  const status = candidates.length === 0
    ? "unavailable"
    : unsupportedIds.length > 0
      ? "partial"
      : "complete";

  return baziLuckCalculationSchema.parse({
    schemaVersion: 1,
    status,
    inputHash: normalized.inputHash,
    engine: {
      id: "xuanshu-bazi-luck",
      version: "0.1.0",
      ruleSetId: "bazi-ziping-v1",
      ruleSetVersion: "1.0.0",
      sourceIds: ["sanming-tonghui", "meeus-aa", "iana-tzdb"],
    },
    candidates,
    warnings,
    ruleIds: [
      "bazi.luck.direction-year-polarity-v1",
      "bazi.luck.jie-distance-v1",
      "bazi.luck.three-days-one-year-v1",
      "bazi.luck.month-pillar-sequence-v1",
    ],
  });
}
