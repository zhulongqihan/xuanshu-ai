import { z } from "zod";

const supportedDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期必须使用 YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    if (year < 1901 || year > 2100) {
      return false;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "日期必须真实存在且位于 1901-2100");

const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "时间必须使用 24 小时制 HH:mm");

const timeZoneSchema = z.string().min(1).refine((value) => {
  try {
    new Intl.DateTimeFormat("zh-CN", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, "必须使用有效的 IANA 时区");

export const calendarTypeSchema = z.enum(["solar", "lunar"]);
export const chartSexSchema = z.enum(["male", "female"]);

export const birthInputSchema = z
  .object({
    calendar: calendarTypeSchema,
    date: supportedDateSchema,
    time: localTimeSchema,
    isLeapMonth: z.boolean().default(false),
    chartSex: chartSexSchema,
    locationName: z.string().trim().min(1).max(120),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    timeZone: timeZoneSchema,
    uncertaintyMinutes: z.number().int().min(0).max(720).default(0),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.calendar === "solar" && value.isLeapMonth) {
      context.addIssue({
        code: "custom",
        path: ["isLeapMonth"],
        message: "公历日期不能标记为闰月",
      });
    }
    if ((value.latitude === undefined) !== (value.longitude === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "经纬度必须同时提供或同时省略",
      });
    }
  });

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

export type BirthInput = z.infer<typeof birthInputSchema>;
export type CertaintyLevel = z.infer<typeof certaintyLevelSchema>;
export type RuleSetRef = z.infer<typeof ruleSetRefSchema>;
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type ChartSnapshot = z.infer<typeof chartSnapshotSchema>;
export type LiuyaoCast = z.infer<typeof liuyaoCastSchema>;
