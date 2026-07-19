import { z } from "zod";

export const timeZoneSchema = z.string().min(1).refine((value) => {
  try {
    new Intl.DateTimeFormat("zh-CN", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, "必须使用有效的 IANA 时区");

export const certaintyLevelSchema = z.enum([
  "deterministic",
  "rule_based",
  "interpretive",
  "ambiguous",
]);

export const ruleSetRefSchema = z
  .object({
    system: z.enum(["calendar", "bazi", "ziwei", "almanac", "liuyao"]),
    id: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    status: z.enum(["draft", "active", "deprecated"]),
    sourceIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const evidenceRefSchema = z
  .object({
    sourceId: z.string().min(1),
    edition: z.string().max(120).optional(),
    locator: z.string().min(1).max(200),
    ruleId: z.string().min(1),
    excerpt: z.string().max(500).optional(),
  })
  .strict();

export const claimSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().trim().min(1).max(2000),
    system: z.enum(["bazi", "ziwei", "almanac", "liuyao", "synthesis"]),
    certainty: certaintyLevelSchema,
    evidence: z.array(evidenceRefSchema).min(1),
    appliesTo: z.string().trim().min(1).max(300),
    uncertainty: z.array(z.string().trim().min(1).max(500)).default([]),
  })
  .strict();

export const chartSnapshotSchema = z
  .object({
    id: z.string().min(1),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    engineVersion: z.string().min(1),
    ruleSet: ruleSetRefSchema,
    chart: z.unknown(),
    calculationTrace: z.array(z.string().min(1)),
    warnings: z.array(z.string().min(1)),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const liuyaoLineSchema = z.union([
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
]);

export const liuyaoCastSchema = z
  .object({
    question: z.string().trim().min(1).max(1000),
    method: z.enum(["coins", "manual_lines", "existing_hexagram"]),
    lineOrder: z.literal("bottom_to_top"),
    lines: z.tuple([
      liuyaoLineSchema,
      liuyaoLineSchema,
      liuyaoLineSchema,
      liuyaoLineSchema,
      liuyaoLineSchema,
      liuyaoLineSchema,
    ]),
    castAt: z.string().datetime({ offset: true }),
    timeZone: timeZoneSchema,
    locationName: z.string().trim().min(1).max(120),
    randomAudit: z
      .object({
        algorithm: z.string().min(1),
        nonce: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();

export type CertaintyLevel = z.infer<typeof certaintyLevelSchema>;
export type RuleSetRef = z.infer<typeof ruleSetRefSchema>;
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type ChartSnapshot = z.infer<typeof chartSnapshotSchema>;
export type LiuyaoCast = z.infer<typeof liuyaoCastSchema>;
