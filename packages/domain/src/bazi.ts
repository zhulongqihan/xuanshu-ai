import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import {
  resolveApparentSolarTime,
  solarTermInstantsForCalendarYear,
} from "./astronomy";
import {
  civilTimeCandidateSchema,
  normalizedBirthSchema,
  type NormalizedBirth,
} from "./birth";

const BAZI_ENGINE = {
  id: "xuanshu-bazi",
  version: "0.1.0",
  ruleSetId: "bazi-ziping-v1",
  ruleSetVersion: "1.0.0",
  sourceIds: [
    "gbt-33661",
    "sanming-tonghui",
    "meeus-aa",
    "iana-tzdb",
    "lunar-typescript",
  ],
} as const;

const STEMS = [
  ["甲", "wood", "yang"],
  ["乙", "wood", "yin"],
  ["丙", "fire", "yang"],
  ["丁", "fire", "yin"],
  ["戊", "earth", "yang"],
  ["己", "earth", "yin"],
  ["庚", "metal", "yang"],
  ["辛", "metal", "yin"],
  ["壬", "water", "yang"],
  ["癸", "water", "yin"],
] as const;

const BRANCHES = [
  ["子", "water", "yang"],
  ["丑", "earth", "yin"],
  ["寅", "wood", "yang"],
  ["卯", "wood", "yin"],
  ["辰", "earth", "yang"],
  ["巳", "fire", "yin"],
  ["午", "fire", "yang"],
  ["未", "earth", "yin"],
  ["申", "metal", "yang"],
  ["酉", "metal", "yin"],
  ["戌", "earth", "yang"],
  ["亥", "water", "yin"],
] as const;

const HIDDEN_STEMS: ReadonlyArray<ReadonlyArray<number>> = [
  [9],
  [5, 9, 7],
  [0, 2, 4],
  [1],
  [4, 1, 9],
  [2, 6, 4],
  [3, 5],
  [5, 3, 1],
  [6, 8, 4],
  [7],
  [4, 7, 3],
  [8, 0],
];

const HIDDEN_ROLES = ["primary", "middle", "residual"] as const;

const NAYIN = [
  "海中金", "炉中火", "大林木", "路旁土", "剑锋金", "山头火",
  "涧下水", "城头土", "白蜡金", "杨柳木", "泉中水", "屋上土",
  "霹雳火", "松柏木", "长流水", "沙中金", "山下火", "平地木",
  "壁上土", "金箔金", "覆灯火", "天河水", "大驿土", "钗钏金",
  "桑柘木", "大溪水", "沙中土", "天上火", "石榴木", "大海水",
] as const;

const GROWTH_STAGES = [
  "长生", "沐浴", "冠带", "临官", "帝旺", "衰",
  "病", "死", "墓", "绝", "胎", "养",
] as const;

const GROWTH_START_BRANCH = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3] as const;

const TEN_GODS = {
  day_master: "日主",
  peer: "比肩",
  rob_wealth: "劫财",
  eating_god: "食神",
  hurting_officer: "伤官",
  indirect_wealth: "偏财",
  direct_wealth: "正财",
  seven_killings: "七杀",
  direct_officer: "正官",
  indirect_resource: "偏印",
  direct_resource: "正印",
} as const;

const MONTH_OFFSET_BY_JIE_ID = new Map([
  ["solar_term_lichun", 0],
  ["solar_term_jingzhe", 1],
  ["solar_term_qingming", 2],
  ["solar_term_lixia", 3],
  ["solar_term_mangzhong", 4],
  ["solar_term_xiaoshu", 5],
  ["solar_term_liqiu", 6],
  ["solar_term_bailu", 7],
  ["solar_term_hanlu", 8],
  ["solar_term_lidong", 9],
  ["solar_term_daxue", 10],
  ["solar_term_xiaohan", 11],
]);

const elementSchema = z.enum(["wood", "fire", "earth", "metal", "water"]);
const polaritySchema = z.enum(["yang", "yin"]);
const stemSchema = z.object({
  index: z.number().int().min(0).max(9),
  name: z.string().length(1),
  element: elementSchema,
  polarity: polaritySchema,
}).strict();
const branchSchema = z.object({
  index: z.number().int().min(0).max(11),
  name: z.string().length(1),
  element: elementSchema,
  polarity: polaritySchema,
}).strict();
const tenGodSchema = z.object({
  id: z.enum(Object.keys(TEN_GODS) as [keyof typeof TEN_GODS, ...(keyof typeof TEN_GODS)[]]),
  name: z.string().min(1),
}).strict();
const hiddenStemSchema = z.object({
  role: z.enum(HIDDEN_ROLES),
  stem: stemSchema,
  tenGod: tenGodSchema,
}).strict();
const pillarSchema = z.object({
  ganZhiIndex: z.number().int().min(0).max(59),
  name: z.string().length(2),
  stem: stemSchema,
  branch: branchSchema,
  stemTenGod: tenGodSchema,
  hiddenStems: z.array(hiddenStemSchema).min(1).max(3),
  naYin: z.string().min(1),
  growthStage: z.enum(GROWTH_STAGES),
}).strict();
const termRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  utcInstant: z.string().datetime({ offset: true }),
}).strict();
const baziCandidateSchema = z.object({
  id: z.string().min(1),
  sourceCandidateId: z.string().min(1),
  timeBasis: z.enum(["civil", "apparent_solar"]),
  timePrecision: z.enum(["exact", "approximate", "unknown"]),
  dayBoundary: z.enum(["midnight", "zi_start"]),
  localDateTime: z.string().optional(),
  utcInstant: z.string().datetime({ offset: true }).optional(),
  currentJie: termRefSchema,
  nextJie: termRefSchema,
  pillars: z.object({
    year: pillarSchema,
    month: pillarSchema,
    day: pillarSchema,
    hour: pillarSchema.nullable(),
  }).strict(),
}).strict();

export const baziCalculationSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(["complete", "partial", "unavailable"]),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  engine: z.object({
    id: z.literal(BAZI_ENGINE.id),
    version: z.literal(BAZI_ENGINE.version),
    ruleSetId: z.literal(BAZI_ENGINE.ruleSetId),
    ruleSetVersion: z.literal(BAZI_ENGINE.ruleSetVersion),
    sourceIds: z.array(z.string().min(1)).min(1),
  }).strict(),
  candidates: z.array(baziCandidateSchema),
  warnings: z.array(z.object({
    code: z.string().regex(/^[a-z][a-z0-9_]*$/),
    message: z.string().min(1),
    candidateIds: z.array(z.string().min(1)),
  }).strict()),
  ruleIds: z.array(z.string().min(1)).min(1),
}).strict();

export type BaziCalculation = z.infer<typeof baziCalculationSchema>;
export type BaziCandidate = z.infer<typeof baziCandidateSchema>;
export type BaziDayBoundary = BaziCandidate["dayBoundary"];

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function stem(index: number) {
  const normalized = modulo(index, 10);
  const [name, element, polarity] = STEMS[normalized];
  return { index: normalized, name, element, polarity };
}

function branch(index: number) {
  const normalized = modulo(index, 12);
  const [name, element, polarity] = BRANCHES[normalized];
  return { index: normalized, name, element, polarity };
}

function ganZhiIndex(stemIndex: number, branchIndex: number) {
  const index = Array.from({ length: 60 }, (_, value) => value).find(
    (value) => value % 10 === modulo(stemIndex, 10) && value % 12 === modulo(branchIndex, 12),
  );
  if (index === undefined) {
    throw new RangeError(`无效干支组合：${stemIndex}/${branchIndex}`);
  }
  return index;
}

export function sexagenaryName(index: number) {
  if (!Number.isInteger(index)) {
    throw new TypeError(`干支索引必须是整数：${index}`);
  }
  const normalized = modulo(index, 60);
  return `${STEMS[normalized % 10][0]}${BRANCHES[normalized % 12][0]}`;
}

function tenGod(dayStemIndex: number, targetStemIndex: number) {
  const day = stem(dayStemIndex);
  const target = stem(targetStemIndex);
  const elementIndex = { wood: 0, fire: 1, earth: 2, metal: 3, water: 4 } as const;
  const dayElement = elementIndex[day.element];
  const targetElement = elementIndex[target.element];
  const samePolarity = day.polarity === target.polarity;
  let id: Exclude<keyof typeof TEN_GODS, "day_master">;
  if (dayElement === targetElement) {
    id = samePolarity ? "peer" : "rob_wealth";
  } else if ((dayElement + 1) % 5 === targetElement) {
    id = samePolarity ? "eating_god" : "hurting_officer";
  } else if ((dayElement + 2) % 5 === targetElement) {
    id = samePolarity ? "indirect_wealth" : "direct_wealth";
  } else if ((targetElement + 2) % 5 === dayElement) {
    id = samePolarity ? "seven_killings" : "direct_officer";
  } else {
    id = samePolarity ? "indirect_resource" : "direct_resource";
  }
  return { id, name: TEN_GODS[id] };
}

function growthStage(dayStemIndex: number, branchIndex: number) {
  const forward = dayStemIndex % 2 === 0;
  const offset = forward
    ? modulo(branchIndex - GROWTH_START_BRANCH[dayStemIndex], 12)
    : modulo(GROWTH_START_BRANCH[dayStemIndex] - branchIndex, 12);
  return GROWTH_STAGES[offset];
}

function pillar(
  stemIndex: number,
  branchIndex: number,
  dayStemIndex: number,
  isDayMaster = false,
) {
  const index = ganZhiIndex(stemIndex, branchIndex);
  const stemValue = stem(stemIndex);
  const branchValue = branch(branchIndex);
  return pillarSchema.parse({
    ganZhiIndex: index,
    name: `${stemValue.name}${branchValue.name}`,
    stem: stemValue,
    branch: branchValue,
    stemTenGod: isDayMaster
      ? { id: "day_master", name: TEN_GODS.day_master }
      : tenGod(dayStemIndex, stemValue.index),
    hiddenStems: HIDDEN_STEMS[branchValue.index].map((hiddenStem, hiddenIndex) => ({
      role: HIDDEN_ROLES[hiddenIndex],
      stem: stem(hiddenStem),
      tenGod: tenGod(dayStemIndex, hiddenStem),
    })),
    naYin: NAYIN[Math.floor(index / 2)],
    growthStage: growthStage(dayStemIndex, branchValue.index),
  });
}

const ANCHOR_EPOCH_DAY = Math.trunc(Date.UTC(1949, 9, 1) / 86_400_000);

export function sexagenaryDayIndex(solarDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(solarDate)) {
    throw new TypeError(`日柱日期格式无效：${solarDate}`);
  }
  const [year, month, day] = solarDate.split("-").map(Number);
  const epochDay = Math.trunc(Date.UTC(year, month - 1, day) / 86_400_000);
  const roundTrip = new Date(epochDay * 86_400_000).toISOString().slice(0, 10);
  if (roundTrip !== solarDate) {
    throw new TypeError(`日柱日期不存在：${solarDate}`);
  }
  return modulo(epochDay - ANCHOR_EPOCH_DAY, 60);
}

function termRef(term: ReturnType<typeof solarTermInstantsForCalendarYear>[number]) {
  return {
    id: term.id,
    name: term.name,
    utcInstant: term.instant.toString({ smallestUnit: "second" }),
  };
}

function jieContext(instant: Temporal.Instant) {
  const utcYear = instant.toZonedDateTimeISO("UTC").year;
  const terms = [utcYear - 1, utcYear, utcYear + 1]
    .flatMap((year) => solarTermInstantsForCalendarYear(year))
    .filter((term) => term.kind === "jie")
    .sort((left, right) => Temporal.Instant.compare(left.instant, right.instant));
  const nextIndex = terms.findIndex((term) => Temporal.Instant.compare(term.instant, instant) > 0);
  const current = terms[nextIndex - 1];
  const next = terms[nextIndex];
  const liChun = terms
    .slice(0, nextIndex)
    .reverse()
    .find((term) => term.id === "solar_term_lichun");
  if (!current || !next || !liChun) {
    throw new RangeError(`无法定位八字节气上下文：${instant.toString()}`);
  }
  const monthOffset = MONTH_OFFSET_BY_JIE_ID.get(current.id);
  if (monthOffset === undefined) {
    throw new RangeError(`未登记的月柱节气：${current.id}`);
  }
  return { current, next, liChun, monthOffset };
}

function dateAndTime(localDateTime: string, dayBoundary: BaziDayBoundary) {
  const plain = Temporal.PlainDateTime.from(localDateTime);
  const dayDate =
    dayBoundary === "zi_start" && plain.hour === 23
      ? plain.toPlainDate().add({ days: 1 }).toString()
      : plain.toPlainDate().toString();
  return { plain, dayDate };
}

function chartCandidate(args: {
  id: string;
  sourceCandidateId: string;
  timeBasis: BaziCandidate["timeBasis"];
  timePrecision: BaziCandidate["timePrecision"];
  dayBoundary: BaziDayBoundary;
  localDateTime?: string;
  utcInstant: string;
  solarDateForUnknown?: string;
}) {
  const instant = Temporal.Instant.from(args.utcInstant);
  const terms = jieContext(instant);
  const yearIndex = modulo(terms.liChun.calendarYear - 4, 60);
  const yearStemIndex = yearIndex % 10;
  const monthBranchIndex = modulo(2 + terms.monthOffset, 12);
  const monthStemIndex = modulo(yearStemIndex * 2 + 2 + terms.monthOffset, 10);
  const dateTime = args.localDateTime
    ? dateAndTime(args.localDateTime, args.dayBoundary)
    : undefined;
  const dayDate = dateTime?.dayDate ?? args.solarDateForUnknown;
  if (!dayDate) {
    throw new TypeError("八字候选缺少日柱日期");
  }
  const dayIndex = sexagenaryDayIndex(dayDate);
  const dayStemIndex = dayIndex % 10;
  const hourBranchIndex = dateTime
    ? Math.floor(((dateTime.plain.hour + 1) % 24) / 2)
    : undefined;
  const hourStemIndex = hourBranchIndex === undefined
    ? undefined
    : modulo((dayStemIndex % 5) * 2 + hourBranchIndex, 10);

  return baziCandidateSchema.parse({
    id: args.id,
    sourceCandidateId: args.sourceCandidateId,
    timeBasis: args.timeBasis,
    timePrecision: args.timePrecision,
    dayBoundary: args.dayBoundary,
    ...(args.localDateTime ? { localDateTime: args.localDateTime } : {}),
    utcInstant: args.utcInstant,
    currentJie: termRef(terms.current),
    nextJie: termRef(terms.next),
    pillars: {
      year: pillar(yearIndex % 10, yearIndex % 12, dayStemIndex),
      month: pillar(monthStemIndex, monthBranchIndex, dayStemIndex),
      day: pillar(dayIndex % 10, dayIndex % 12, dayStemIndex, true),
      hour: hourBranchIndex === undefined || hourStemIndex === undefined
        ? null
        : pillar(hourStemIndex, hourBranchIndex, dayStemIndex),
    },
  });
}

function exactCandidates(
  normalized: NormalizedBirth,
  dayBoundaryPolicies: BaziDayBoundary[],
) {
  const civilCandidates = normalized.timeResolution.status === "resolved"
    ? [normalized.timeResolution.candidate]
    : normalized.timeResolution.status === "ambiguous"
      ? [...normalized.timeResolution.candidates]
      : [];
  const apparentByCandidate = new Map(
    normalized.apparentSolarTime.status === "resolved"
      ? normalized.apparentSolarTime.candidates.map((candidate) => [candidate.candidateId, candidate])
      : [],
  );
  const timePrecision = normalized.canonicalInput.time.kind;
  const candidates: BaziCandidate[] = [];

  for (const civil of civilCandidates) {
    const bases = [
      { basis: "civil" as const, localDateTime: civil.localDateTime },
      ...(apparentByCandidate.has(civil.id)
        ? [{
            basis: "apparent_solar" as const,
            localDateTime: apparentByCandidate.get(civil.id)!.apparentLocalDateTime,
          }]
        : []),
    ];
    for (const basis of bases) {
      const hour = Temporal.PlainDateTime.from(basis.localDateTime).hour;
      const policies = hour === 23 ? dayBoundaryPolicies : ["midnight" as const];
      for (const dayBoundary of policies) {
        candidates.push(chartCandidate({
          id: `${civil.id}:${basis.basis}:${dayBoundary}`,
          sourceCandidateId: civil.id,
          timeBasis: basis.basis,
          timePrecision: timePrecision === "unknown" ? "unknown" : timePrecision,
          dayBoundary,
          localDateTime: basis.localDateTime,
          utcInstant: civil.utcInstant,
        }));
      }
    }
  }
  return candidates;
}

function civilCandidatesForPlainDateTime(
  plain: Temporal.PlainDateTime,
  timeZoneId: string,
  sourceId: string,
) {
  const requested = plain.toString({ smallestUnit: "second" });
  const candidate = (
    id: string,
    zonedDateTime: Temporal.ZonedDateTime,
    fold?: 0 | 1,
  ) => civilTimeCandidateSchema.parse({
    id,
    localDateTime: requested,
    timeZoneId,
    utcOffsetSeconds: Math.trunc(zonedDateTime.offsetNanoseconds / 1_000_000_000),
    utcInstant: zonedDateTime.toInstant().toString({ smallestUnit: "second" }),
    ...(fold === undefined ? {} : { fold }),
  });

  try {
    return [candidate(sourceId, plain.toZonedDateTime(timeZoneId, {
      disambiguation: "reject",
    }))];
  } catch {
    const earlier = plain.toZonedDateTime(timeZoneId, { disambiguation: "earlier" });
    const later = plain.toZonedDateTime(timeZoneId, { disambiguation: "later" });
    const matches = (value: Temporal.ZonedDateTime) =>
      value.toPlainDateTime().toString({ smallestUnit: "second" }) === requested;
    if (!matches(earlier) || !matches(later)) {
      return [];
    }
    return [
      candidate(`${sourceId}:fold-0`, earlier, 0),
      candidate(`${sourceId}:fold-1`, later, 1),
    ];
  }
}

function candidateSignature(candidate: BaziCandidate, fold?: 0 | 1) {
  return [
    candidate.timeBasis,
    candidate.dayBoundary,
    fold ?? "single",
    candidate.pillars.year.name,
    candidate.pillars.month.name,
    candidate.pillars.day.name,
    candidate.pillars.hour?.name ?? "unknown",
  ].join(":");
}

function approximateCandidates(
  normalized: NormalizedBirth,
  dayBoundaryPolicies: BaziDayBoundary[],
) {
  if (normalized.canonicalInput.time.kind !== "approximate") {
    return [];
  }
  const inputTime = normalized.canonicalInput.time;
  const center = Temporal.PlainDateTime.from(
    `${normalized.calendarResolution.solarDate}T${inputTime.value}:00`,
  );
  const start = center.subtract({ minutes: inputTime.beforeMinutes });
  const end = center.add({ minutes: inputTime.afterMinutes });
  const timeZoneId = normalized.canonicalInput.location.timeZoneId;
  const unique = new Map<string, BaziCandidate>();
  let sequence = 0;

  for (
    let plain = start;
    Temporal.PlainDateTime.compare(plain, end) <= 0;
    plain = plain.add({ minutes: 1 })
  ) {
    const civilCandidates = civilCandidatesForPlainDateTime(
      plain,
      timeZoneId,
      `approx-${sequence}`,
    );
    sequence += 1;
    for (const civil of civilCandidates) {
      const apparent = resolveApparentSolarTime(normalized.canonicalInput, {
        status: "resolved",
        candidate: civil,
      });
      const bases = [
        { basis: "civil" as const, localDateTime: civil.localDateTime },
        ...(apparent.status === "resolved"
          ? [{
              basis: "apparent_solar" as const,
              localDateTime: apparent.candidates[0].apparentLocalDateTime,
            }]
          : []),
      ];
      for (const basis of bases) {
        const hour = Temporal.PlainDateTime.from(basis.localDateTime).hour;
        const policies = hour === 23 ? dayBoundaryPolicies : ["midnight" as const];
        for (const dayBoundary of policies) {
          const calculated = chartCandidate({
            id: `${civil.id}:${basis.basis}:${dayBoundary}`,
            sourceCandidateId: civil.id,
            timeBasis: basis.basis,
            timePrecision: "approximate",
            dayBoundary,
            localDateTime: basis.localDateTime,
            utcInstant: civil.utcInstant,
          });
          const signature = candidateSignature(calculated, civil.fold);
          if (!unique.has(signature)) {
            unique.set(signature, calculated);
          }
        }
      }
    }
  }
  return [...unique.values()];
}

function unknownTimeCandidates(normalized: NormalizedBirth) {
  const solarDate = normalized.calendarResolution.solarDate;
  const timeZoneId = normalized.canonicalInput.location.timeZoneId;
  const start = Temporal.PlainDateTime.from(`${solarDate}T00:00:00`)
    .toZonedDateTime(timeZoneId, { disambiguation: "earlier" })
    .toInstant();
  const end = Temporal.PlainDate.from(solarDate)
    .add({ days: 1 })
    .toPlainDateTime("00:00:00")
    .toZonedDateTime(timeZoneId, { disambiguation: "later" })
    .toInstant();
  const samples = [start.add({ seconds: 1 }), end.subtract({ seconds: 1 })];
  const candidates = samples.map((instant, index) => chartCandidate({
    id: `unknown-time-${index}`,
    sourceCandidateId: "time-unknown",
    timeBasis: "civil",
    timePrecision: "unknown",
    dayBoundary: "midnight",
    utcInstant: instant.toString({ smallestUnit: "second" }),
    solarDateForUnknown: solarDate,
  }));
  const signature = (candidate: BaziCandidate) =>
    `${candidate.pillars.year.name}/${candidate.pillars.month.name}/${candidate.pillars.day.name}`;
  return signature(candidates[0]) === signature(candidates[1])
    ? [candidates[0]]
    : candidates;
}

export function calculateBazi(
  input: NormalizedBirth,
  options: { dayBoundaryPolicies?: BaziDayBoundary[] } = {},
): BaziCalculation {
  const normalized = normalizedBirthSchema.parse(input);
  const policies = options.dayBoundaryPolicies ?? ["midnight"];
  if (policies.length === 0 || policies.some((item) => item !== "midnight" && item !== "zi_start")) {
    throw new TypeError("日界政策必须至少包含 midnight 或 zi_start");
  }
  const dayBoundaryPolicies = [...new Set(policies)];
  const warnings: BaziCalculation["warnings"] = [];
  let candidates: BaziCandidate[] = [];
  let status: BaziCalculation["status"] = "complete";

  if (normalized.canonicalInput.time.kind === "approximate") {
    candidates = approximateCandidates(normalized, dayBoundaryPolicies);
    if (candidates.length === 0) {
      status = "unavailable";
      warnings.push({
        code: "approximate_interval_nonexistent",
        message: "约略时间区间内没有有效民用时刻，未生成八字候选。",
        candidateIds: [],
      });
    } else {
      warnings.push({
        code: "birth_time_approximate",
        message: `约略时间区间展开为 ${candidates.length} 个不同四柱候选。`,
        candidateIds: candidates.map((candidate) => candidate.id),
      });
    }
  } else if (normalized.timeResolution.status === "nonexistent") {
    status = "unavailable";
    warnings.push({
      code: "civil_time_nonexistent",
      message: "出生民用时间不存在，未生成八字候选。",
      candidateIds: [],
    });
  } else if (normalized.timeResolution.status === "unknown") {
    status = "partial";
    candidates = unknownTimeCandidates(normalized);
    warnings.push({
      code: "birth_time_unknown",
      message: candidates.length > 1
        ? "出生日期跨越八字节气，保留两个无时柱候选。"
        : "出生时间未知，仅生成不含时柱的三柱结果。",
      candidateIds: candidates.map((candidate) => candidate.id),
    });
  } else {
    candidates = exactCandidates(normalized, dayBoundaryPolicies);
  }

  return baziCalculationSchema.parse({
    schemaVersion: 1,
    status,
    inputHash: normalized.inputHash,
    engine: BAZI_ENGINE,
    candidates,
    warnings,
    ruleIds: [
      "bazi.year.lichun-v1",
      "bazi.month.jie-v1",
      "bazi.day.gbt-anchor-v1",
      "bazi.hour.five-rats-v1",
      "bazi.hidden-stems.common-v1",
      "bazi.ten-gods.element-polarity-v1",
      "bazi.nayin.sixty-cycle-v1",
      "bazi.growth-stage.v1",
    ],
  });
}
