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

const TRANSIT_SCHEMA = z.object({
  localDateTime: z.string().datetime({ local: true }),
  utcInstant: z.string().datetime({ offset: true }),
}).strict();

const START_AGE_RANGE_SCHEMA = z.object({
  min: START_AGE_SCHEMA,
  max: START_AGE_SCHEMA,
}).strict().superRefine((value, context) => {
  if (value.min.distanceSeconds > value.max.distanceSeconds) {
    context.addIssue({
      code: "custom",
      path: ["min"],
      message: "起运年龄范围的最小值不能大于最大值",
    });
  }
});

const TRANSIT_RANGE_SCHEMA = z.object({
  min: TRANSIT_SCHEMA,
  max: TRANSIT_SCHEMA,
}).strict().superRefine((value, context) => {
  if (
    Temporal.Instant.compare(
      Temporal.Instant.from(value.min.utcInstant),
      Temporal.Instant.from(value.max.utcInstant),
    ) > 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["min"],
      message: "交运时间范围的最小值不能晚于最大值",
    });
  }
});

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
  startAge: START_AGE_SCHEMA.optional(),
  startAgeRange: START_AGE_RANGE_SCHEMA.optional(),
  transit: TRANSIT_SCHEMA.optional(),
  transitRange: TRANSIT_RANGE_SCHEMA.optional(),
  cycles: z.array(LUCK_CYCLE_SCHEMA).min(1),
}).strict().superRefine((value, context) => {
  const hasPoint = value.startAge !== undefined && value.transit !== undefined;
  const hasRange = value.startAgeRange !== undefined && value.transitRange !== undefined;
  if (hasPoint === hasRange) {
    context.addIssue({
      code: "custom",
      path: ["startAge"],
      message: "大运候选必须提供单一起运点或范围起运点（二选一）",
    });
  }
});

export const baziLuckCalculationSchema = z.object({
  schemaVersion: z.literal(2),
  status: z.enum(["complete", "partial", "unavailable"]),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  engine: z.object({
    id: z.literal("xuanshu-bazi-luck"),
    version: z.literal("0.2.0"),
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

function startAgeSeconds(age: z.infer<typeof START_AGE_SCHEMA>) {
  return age.distanceSeconds;
}

function transitPoint(
  birthLocalDateTime: string,
  startAge: z.infer<typeof START_AGE_SCHEMA>,
  timeZoneId: string,
) {
  const local = Temporal.PlainDateTime.from(birthLocalDateTime).add({
    years: startAge.years,
    months: startAge.months,
    days: startAge.days,
    hours: startAge.hours,
    minutes: startAge.minutes,
  });
  const zoned = local.toZonedDateTime(timeZoneId, { disambiguation: "compatible" });
  return TRANSIT_SCHEMA.parse({
    localDateTime: zoned.toPlainDateTime().toString({ smallestUnit: "second" }),
    utcInstant: zoned.toInstant().toString({ smallestUnit: "second" }),
  });
}

function isForward(
  polarity: "yang" | "yin",
  chartSex: NormalizedBirth["canonicalInput"]["chartSex"],
) {
  return (polarity === "yang" && chartSex === "male") ||
    (polarity === "yin" && chartSex === "female");
}

function sourceCivilCandidate(normalized: NormalizedBirth, sourceCandidateId: string) {
  const candidates = normalized.timeResolution.status === "resolved"
    ? [normalized.timeResolution.candidate]
    : normalized.timeResolution.status === "ambiguous"
      ? [...normalized.timeResolution.candidates]
      : [];
  const candidate = candidates.find((item) => item.id === sourceCandidateId);
  if (!candidate) {
    throw new TypeError(`找不到八字候选的民用时间来源：${sourceCandidateId}`);
  }
  return candidate;
}

type LuckMetric = {
  reference: ReturnType<typeof adjacentJie>["previous"];
  startAge: z.infer<typeof START_AGE_SCHEMA>;
  transit: z.infer<typeof TRANSIT_SCHEMA>;
};

function metricForSource(
  instant: Temporal.Instant,
  birthLocalDateTime: string,
  forward: boolean,
  timeZoneId: string,
): LuckMetric {
  const jie = adjacentJie(instant);
  const reference = forward ? jie.next : jie.previous;
  const distanceSeconds = Math.abs(
    Number(reference.instant.epochMilliseconds - instant.epochMilliseconds) / 1_000,
  );
  const startAge = decomposeStartAge(distanceSeconds);
  return {
    reference,
    startAge,
    transit: transitPoint(birthLocalDateTime, startAge, timeZoneId),
  };
}

function sourceSamples(
  candidate: BaziCalculation["candidates"][number],
) {
  const windows = candidate.sourceTimeWindows ?? [];
  return windows.flatMap((window) => Array.from({ length: window.sampleCount }, (_, index) => ({
    localDateTime: Temporal.PlainDateTime.from(window.startCivilLocalDateTime)
      .add({ minutes: index })
      .toString({ smallestUnit: "second" }),
    instant: Temporal.Instant.from(window.startUtcInstant).add({ seconds: index * 60 }),
  })));
}

function rangeForMetrics(metrics: LuckMetric[]) {
  if (metrics.length === 0) {
    throw new RangeError("约略时间候选没有可用于计算大运的来源样本");
  }
  const ageMin = metrics.reduce((left, right) =>
    startAgeSeconds(left.startAge) <= startAgeSeconds(right.startAge) ? left : right,
  );
  const ageMax = metrics.reduce((left, right) =>
    startAgeSeconds(left.startAge) >= startAgeSeconds(right.startAge) ? left : right,
  );
  const transitMin = metrics.reduce((left, right) =>
    Temporal.Instant.compare(
      Temporal.Instant.from(left.transit.utcInstant),
      Temporal.Instant.from(right.transit.utcInstant),
    ) <= 0 ? left : right,
  );
  const transitMax = metrics.reduce((left, right) =>
    Temporal.Instant.compare(
      Temporal.Instant.from(left.transit.utcInstant),
      Temporal.Instant.from(right.transit.utcInstant),
    ) >= 0 ? left : right,
  );
  const referenceIds = new Set(metrics.map((metric) => metric.reference.id));
  if (referenceIds.size !== 1) {
    throw new RangeError("同一八字候选的约略时间范围跨越了多个起运节气，无法合并为单一范围");
  }
  return {
    reference: metrics[0].reference,
    startAgeRange: { min: ageMin.startAge, max: ageMax.startAge },
    transitRange: { min: transitMin.transit, max: transitMax.transit },
  };
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
  const approximateIds: string[] = [];
  for (const candidate of bazi.candidates) {
    const forward = isForward(
      candidate.pillars.year.stem.polarity,
      normalized.canonicalInput.chartSex,
    );
    const cycles = Array.from({ length: cycleCount }, (_, index) => {
      const step = forward ? 1 : -1;
      const ganZhiIndex = modulo(
        candidate.pillars.month.ganZhiIndex + step * (index + 1),
        60,
      );
      return {
        index: index + 1,
        ganZhiIndex,
        name: sexagenaryName(ganZhiIndex),
        startOffsetYears: index * 10,
        endOffsetYears: (index + 1) * 10,
      };
    });

    if (candidate.timePrecision === "unknown" || !candidate.utcInstant) {
      unsupportedIds.push(candidate.id);
      continue;
    }

    if (candidate.timePrecision === "approximate") {
      const samples = sourceSamples(candidate);
      const metrics = samples.map((sample) => metricForSource(
        sample.instant,
        sample.localDateTime,
        forward,
        normalized.canonicalInput.location.timeZoneId,
      ));
      const range = rangeForMetrics(metrics);
      approximateIds.push(candidate.id);
      candidates.push(LUCK_CANDIDATE_SCHEMA.parse({
        baziCandidateId: candidate.id,
        direction: forward ? "forward" : "backward",
        yearStemPolarity: candidate.pillars.year.stem.polarity,
        referenceJie: termRef(range.reference),
        startAgeRange: range.startAgeRange,
        transitRange: range.transitRange,
        cycles,
      }));
      continue;
    }

    const source = sourceCivilCandidate(normalized, candidate.sourceCandidateId);
    const metric = metricForSource(
      Temporal.Instant.from(candidate.utcInstant),
      source.localDateTime,
      forward,
      normalized.canonicalInput.location.timeZoneId,
    );
    candidates.push(LUCK_CANDIDATE_SCHEMA.parse({
      baziCandidateId: candidate.id,
      direction: forward ? "forward" : "backward",
      yearStemPolarity: candidate.pillars.year.stem.polarity,
      referenceJie: termRef(metric.reference),
      startAge: metric.startAge,
      transit: metric.transit,
      cycles,
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
  if (approximateIds.length > 0) {
    warnings.push({
      code: "approximate_start_age_range",
      message: "约略出生时间保留起运年龄与交运公历时间范围，没有强行选择单一点。",
      baziCandidateIds: approximateIds,
    });
  }
  if (unsupportedIds.length > 0) {
    warnings.push({
      code: "unknown_birth_time_no_start_point",
      message: "出生时间未知，无法生成起运年龄或交运公历点。",
      baziCandidateIds: unsupportedIds,
    });
  }
  const status = candidates.length === 0
    ? "unavailable"
    : unsupportedIds.length > 0
      ? "partial"
      : "complete";

  return baziLuckCalculationSchema.parse({
    schemaVersion: 2,
    status,
    inputHash: normalized.inputHash,
    engine: {
      id: "xuanshu-bazi-luck",
      version: "0.2.0",
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
      "bazi.luck.approximate-range-v1",
      "bazi.luck.transit-point-v1",
    ],
  });
}
