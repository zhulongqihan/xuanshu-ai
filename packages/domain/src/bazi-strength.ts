import { z } from "zod";
import { baziCalculationSchema, type BaziCalculation, type BaziCandidate } from "./bazi";

const ELEMENTS = ["wood", "fire", "earth", "metal", "water"] as const;
const elementSchema = z.enum(ELEMENTS);
const polaritySchema = z.enum(["yang", "yin"]);

const STRENGTH_ENGINE = {
  id: "xuanshu-bazi-strength",
  version: "0.1.0",
  ruleSetId: "bazi-strength-v1",
  ruleSetVersion: "1.0.0",
  sourceIds: ["ditiansui", "ziping-zhenquan", "sanming-tonghui"],
} as const;

const relationSchema = z.enum(["same", "resource", "drain", "wealth", "officer"]);
const supportLevelSchema = z.enum(["supportive", "balanced", "less_supported"]);

const elementDistributionSchema = z.object({
  element: elementSchema,
  visibleStemCount: z.number().int().nonnegative(),
  hiddenStemCount: z.number().int().nonnegative(),
  weightedScore: z.number().nonnegative(),
}).strict();

const strengthCandidateSchema = z.object({
  baziCandidateId: z.string().min(1),
  status: z.enum(["complete", "partial"]),
  dayMaster: z.object({
    name: z.string().length(1),
    element: elementSchema,
    polarity: polaritySchema,
  }).strict(),
  monthContext: z.object({
    branchName: z.string().length(1),
    element: elementSchema,
    relationToDayMaster: relationSchema,
  }).strict(),
  supportElements: z.object({
    sameElement: elementSchema,
    resourceElement: elementSchema,
  }).strict(),
  distribution: z.array(elementDistributionSchema).length(ELEMENTS.length),
  root: z.object({
    isRooted: z.boolean(),
    branchNames: z.array(z.string().length(1)),
  }).strict(),
  support: z.object({
    supportScore: z.number().nonnegative(),
    otherScore: z.number().nonnegative(),
    supportRatio: z.number().min(0).max(1),
    level: supportLevelSchema,
  }).strict(),
  warnings: z.array(z.object({
    code: z.string().regex(/^[a-z][a-z0-9_]*$/),
    message: z.string().min(1),
  }).strict()),
}).strict();

export const baziStrengthCalculationSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(["complete", "partial", "unavailable"]),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  engine: z.object({
    id: z.literal(STRENGTH_ENGINE.id),
    version: z.literal(STRENGTH_ENGINE.version),
    ruleSetId: z.literal(STRENGTH_ENGINE.ruleSetId),
    ruleSetVersion: z.literal(STRENGTH_ENGINE.ruleSetVersion),
    sourceIds: z.array(z.string().min(1)).min(1),
  }).strict(),
  candidates: z.array(strengthCandidateSchema),
  warnings: z.array(z.object({
    code: z.string().regex(/^[a-z][a-z0-9_]*$/),
    message: z.string().min(1),
    baziCandidateIds: z.array(z.string().min(1)),
  }).strict()),
  ruleIds: z.array(z.string().min(1)).min(1),
}).strict();

export type BaziStrengthCalculation = z.infer<typeof baziStrengthCalculationSchema>;

const WEIGHT_BY_HIDDEN_ROLE = {
  primary: 0.7,
  middle: 0.4,
  residual: 0.2,
} as const;

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function resourceElement(element: BaziCandidate["pillars"]["day"]["stem"]["element"]) {
  return ELEMENTS[modulo(ELEMENTS.indexOf(element) - 1, ELEMENTS.length)];
}

function relationToDayMaster(
  monthElement: BaziCandidate["pillars"]["month"]["branch"]["element"],
  dayMasterElement: BaziCandidate["pillars"]["day"]["stem"]["element"],
) {
  const monthIndex = ELEMENTS.indexOf(monthElement);
  const dayIndex = ELEMENTS.indexOf(dayMasterElement);
  if (monthIndex === dayIndex) return "same" as const;
  if (monthIndex === modulo(dayIndex - 1, ELEMENTS.length)) return "resource" as const;
  if (monthIndex === modulo(dayIndex + 1, ELEMENTS.length)) return "drain" as const;
  if (monthIndex === modulo(dayIndex + 2, ELEMENTS.length)) return "wealth" as const;
  return "officer" as const;
}

function roundScore(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function supportLevel(supportRatio: number) {
  if (supportRatio >= 0.6) return "supportive" as const;
  if (supportRatio <= 0.4) return "less_supported" as const;
  return "balanced" as const;
}

function calculateCandidate(candidate: BaziCandidate) {
  const dayMaster = candidate.pillars.day.stem;
  const sameElement = dayMaster.element;
  const resource = resourceElement(dayMaster.element);
  const distribution = new Map(
    ELEMENTS.map((element) => [element, {
      element,
      visibleStemCount: 0,
      hiddenStemCount: 0,
      weightedScore: 0,
    }]),
  );
  const rootedBranches: string[] = [];
  const pillars = [
    candidate.pillars.year,
    candidate.pillars.month,
    candidate.pillars.day,
    candidate.pillars.hour,
  ].filter((pillar): pillar is NonNullable<typeof pillar> => pillar !== null);

  for (const pillar of pillars) {
    const visible = distribution.get(pillar.stem.element)!;
    visible.visibleStemCount += 1;
    visible.weightedScore += 1;
    let branchIsRooted = false;
    for (const hidden of pillar.hiddenStems) {
      const value = distribution.get(hidden.stem.element)!;
      value.hiddenStemCount += 1;
      value.weightedScore += WEIGHT_BY_HIDDEN_ROLE[hidden.role];
      if (hidden.stem.element === sameElement) branchIsRooted = true;
    }
    if (branchIsRooted) rootedBranches.push(pillar.branch.name);
  }

  const distributionList = ELEMENTS.map((element) => {
    const value = distribution.get(element)!;
    return {
      ...value,
      weightedScore: roundScore(value.weightedScore),
    };
  });
  const supportScore = distributionList
    .filter((value) => value.element === sameElement || value.element === resource)
    .reduce((total, value) => total + value.weightedScore, 0);
  const totalScore = distributionList.reduce((total, value) => total + value.weightedScore, 0);
  const otherScore = totalScore - supportScore;
  const supportRatio = totalScore === 0 ? 0 : roundScore(supportScore / totalScore);
  const warnings: BaziStrengthCalculation["candidates"][number]["warnings"] = [];
  if (!candidate.pillars.hour) {
    warnings.push({
      code: "hour_pillar_unavailable",
      message: "时柱不可用，旺衰基础量仅根据现有三柱计算。",
    });
  }

  return {
    baziCandidateId: candidate.id,
    status: candidate.pillars.hour ? "complete" as const : "partial" as const,
    dayMaster: {
      name: dayMaster.name,
      element: dayMaster.element,
      polarity: dayMaster.polarity,
    },
    monthContext: {
      branchName: candidate.pillars.month.branch.name,
      element: candidate.pillars.month.branch.element,
      relationToDayMaster: relationToDayMaster(
        candidate.pillars.month.branch.element,
        dayMaster.element,
      ),
    },
    supportElements: {
      sameElement,
      resourceElement: resource,
    },
    distribution: distributionList,
    root: {
      isRooted: rootedBranches.length > 0,
      branchNames: [...new Set(rootedBranches)],
    },
    support: {
      supportScore: roundScore(supportScore),
      otherScore: roundScore(otherScore),
      supportRatio,
      level: supportLevel(supportRatio),
    },
    warnings,
  };
}

export function calculateBaziStrength(input: BaziCalculation): BaziStrengthCalculation {
  const bazi = baziCalculationSchema.parse(input);
  const candidates = bazi.candidates.map(calculateCandidate);
  const warnings: BaziStrengthCalculation["warnings"] = [];
  if (candidates.length === 0) {
    warnings.push({
      code: "bazi_candidates_unavailable",
      message: "八字盘没有可用候选，无法计算旺衰基础量。",
      baziCandidateIds: [],
    });
  }
  const partialIds = candidates
    .filter((candidate) => candidate.status === "partial")
    .map((candidate) => candidate.baziCandidateId);
  if (partialIds.length > 0) {
    warnings.push({
      code: "hour_pillar_unavailable",
      message: "至少一个候选缺少时柱，相关旺衰量应视为部分结果。",
      baziCandidateIds: partialIds,
    });
  }

  return baziStrengthCalculationSchema.parse({
    schemaVersion: 1,
    status: candidates.length === 0 ? "unavailable" : partialIds.length > 0 ? "partial" : "complete",
    inputHash: bazi.inputHash,
    engine: STRENGTH_ENGINE,
    candidates,
    warnings,
    ruleIds: [
      "bazi.strength.month-order-v1",
      "bazi.strength.visible-hidden-count-v1",
      "bazi.strength.root-v1",
      "bazi.strength.support-ratio-v1",
    ],
  });
}

