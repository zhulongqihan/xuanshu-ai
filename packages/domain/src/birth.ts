import { z } from "zod";
import { timeZoneSchema } from "./schemas";

export const supportedSolarDateSchema = z
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
  }, "公历日期必须真实存在且位于 1901-2100");

export const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "时间必须使用 24 小时制 HH:mm");

const localDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/,
    "本地日期时间必须使用 YYYY-MM-DDTHH:mm:ss",
  )
  .refine((value) => {
    const [datePart] = value.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "本地日期时间中的公历日期必须真实存在");

const nonBlankStringSchema = z
  .string()
  .min(1)
  .max(120)
  .refine((value) => value.trim().length > 0, "文本不能只包含空白");

const canonicalStringSchema = nonBlankStringSchema.refine(
  (value) => value === value.trim() && value === value.normalize("NFC"),
  "规范文本不能包含首尾空白且必须使用 NFC",
);

export const chartSexSchema = z.enum(["male", "female"]);
export const trueSolarTimeModeSchema = z.enum(["civil_only", "compare"]);
export const timeZoneSourceSchema = z.enum(["user", "manual", "lookup"]);

export const solarCalendarDateSchema = z
  .object({
    kind: z.literal("solar"),
    date: supportedSolarDateSchema,
  })
  .strict();

export const lunarCalendarDateSchema = z
  .object({
    kind: z.literal("lunar"),
    year: z.number().int().min(1900).max(2100),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(30),
    isLeapMonth: z.boolean(),
  })
  .strict();

export const calendarDateSchema = z.discriminatedUnion("kind", [
  solarCalendarDateSchema,
  lunarCalendarDateSchema,
]);

export const exactBirthTimeSchema = z
  .object({
    kind: z.literal("exact"),
    value: localTimeSchema,
  })
  .strict();

export const approximateBirthTimeSchema = z
  .object({
    kind: z.literal("approximate"),
    value: localTimeSchema,
    beforeMinutes: z.number().int().min(0).max(720),
    afterMinutes: z.number().int().min(0).max(720),
  })
  .strict()
  .refine((value) => value.beforeMinutes + value.afterMinutes > 0, {
    message: "近似时间必须包含非零的不确定范围",
  });

export const unknownBirthTimeSchema = z
  .object({
    kind: z.literal("unknown"),
  })
  .strict();

export const birthTimeSchema = z.discriminatedUnion("kind", [
  exactBirthTimeSchema,
  approximateBirthTimeSchema,
  unknownBirthTimeSchema,
]);

export const coordinatesSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

function createBirthInputSchema(
  labelSchema: typeof nonBlankStringSchema,
  requireConfirmedTimeZone: boolean,
) {
  return z
    .object({
      schemaVersion: z.literal(1),
      calendarDate: calendarDateSchema,
      time: birthTimeSchema,
      chartSex: chartSexSchema,
      location: z
        .object({
          label: labelSchema,
          timeZoneId: timeZoneSchema,
          timeZoneSource: timeZoneSourceSchema,
          timeZoneConfirmed: z.boolean(),
          coordinates: coordinatesSchema.optional(),
        })
        .strict(),
      trueSolarTimeMode: trueSolarTimeModeSchema,
    })
    .strict()
    .superRefine((value, context) => {
      if (
        value.trueSolarTimeMode === "compare" &&
        value.location.coordinates === undefined
      ) {
        context.addIssue({
          code: "custom",
          path: ["location", "coordinates"],
          message: "比较真太阳时必须提供经纬度",
        });
      }
      if (requireConfirmedTimeZone && !value.location.timeZoneConfirmed) {
        context.addIssue({
          code: "custom",
          path: ["location", "timeZoneConfirmed"],
          message: "归一化前必须由用户确认 IANA 时区",
        });
      }
    });
}

export const rawBirthInputSchema = createBirthInputSchema(nonBlankStringSchema, false);
export const canonicalBirthInputSchema = createBirthInputSchema(canonicalStringSchema, true);

// BirthInput remains the public name for the user-supplied, unmodified payload.
export const birthInputSchema = rawBirthInputSchema;

const engineRefSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    sourceIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const calendarResolutionSchema = z
  .object({
    status: z.literal("resolved"),
    solarDate: supportedSolarDateSchema,
    lunarDate: lunarCalendarDateSchema,
    lunarMonthDays: z.union([z.literal(29), z.literal(30)]),
    engine: engineRefSchema,
  })
  .strict();

export const civilTimeCandidateSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9._:-]*$/),
    localDateTime: localDateTimeSchema,
    timeZoneId: timeZoneSchema,
    utcOffsetSeconds: z.number().int().min(-64_800).max(64_800),
    utcInstant: z.string().datetime({ offset: true }),
    fold: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .strict();

export const timeResolutionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unknown") }).strict(),
  z
    .object({
      status: z.literal("nonexistent"),
      localDateTime: localDateTimeSchema,
      timeZoneId: timeZoneSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("resolved"),
      candidate: civilTimeCandidateSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("ambiguous"),
      candidates: z.tuple([civilTimeCandidateSchema, civilTimeCandidateSchema]),
    })
    .strict()
    .refine(
      (value) =>
        value.candidates[0].utcInstant !== value.candidates[1].utcInstant &&
        value.candidates[0].id !== value.candidates[1].id,
      "歧义时间必须包含两个不同候选",
    ),
]);

const apparentSolarCandidateSchema = z
  .object({
    candidateId: z.string().min(1),
    apparentLocalDateTime: localDateTimeSchema,
    longitudeCorrectionSeconds: z.number(),
    equationOfTimeSeconds: z.number(),
    totalCorrectionSeconds: z.number(),
  })
  .strict();

export const apparentSolarTimeSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not_requested") }).strict(),
  z
    .object({
      status: z.literal("unavailable"),
      reason: z.enum(["missing_coordinates", "time_unknown", "time_nonexistent"]),
    })
    .strict(),
  z
    .object({
      status: z.literal("resolved"),
      candidates: z.array(apparentSolarCandidateSchema).min(1),
      engine: engineRefSchema,
    })
    .strict(),
]);

const solarTermSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    utcInstant: z.string().datetime({ offset: true }),
    localDateTime: localDateTimeSchema,
    timeZoneId: timeZoneSchema,
  })
  .strict();

export const solarTermContextSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("unavailable"),
      reason: z.enum(["time_unknown", "time_nonexistent"]),
    })
    .strict(),
  z
    .object({
      status: z.literal("resolved"),
      candidates: z
        .array(
          z
            .object({
              candidateId: z.string().min(1),
              previous: solarTermSchema,
              next: solarTermSchema,
              secondsSincePrevious: z.number().nonnegative(),
              secondsUntilNext: z.number().nonnegative(),
            })
            .strict(),
        )
        .min(1),
      engine: engineRefSchema,
    })
    .strict(),
]);

export const boundaryDistanceSchema = z
  .object({
    kind: z.enum([
      "solar_term",
      "civil_23",
      "civil_midnight",
      "shichen",
      "apparent_23",
      "apparent_midnight",
    ]),
    candidateId: z.string().min(1),
    signedSeconds: z.number(),
  })
  .strict();

export const normalizationWarningSchema = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9_]*$/),
    severity: z.enum(["info", "warning", "error"]),
    message: z.string().min(1).max(500),
    affectedCandidateIds: z.array(z.string().min(1)),
    fieldPaths: z.array(z.string().min(1)),
  })
  .strict();

const calculationTraceStepSchema = z
  .object({
    step: z.string().min(1),
    engineId: z.string().min(1),
    engineVersion: z.string().min(1),
    inputRefs: z.array(z.string().min(1)),
    outputRefs: z.array(z.string().min(1)),
    sourceIds: z.array(z.string().min(1)),
  })
  .strict();

export const normalizationProvenanceSchema = z
  .object({
    normalizer: z.object({ id: z.string().min(1), version: z.string().min(1) }).strict(),
    dependencies: z.array(
      z
        .object({
          name: z.string().min(1),
          version: z.string().min(1),
          integrity: z.string().min(1).optional(),
        })
        .strict(),
    ),
    runtime: z
      .object({
        node: z.string().min(1),
        icu: z.string().min(1),
        tzdb: z.string().min(1).optional(),
      })
      .strict(),
    sourceIds: z.array(z.string().min(1)).min(1),
    trace: z.array(calculationTraceStepSchema).min(1),
    normalizedAt: z.string().datetime({ offset: true }),
  })
  .strict();

function timeCandidateIds(value: z.infer<typeof timeResolutionSchema>) {
  if (value.status === "resolved") {
    return [value.candidate.id];
  }
  if (value.status === "ambiguous") {
    return value.candidates.map((candidate) => candidate.id);
  }
  return [];
}

export const normalizedBirthSchema = z
  .object({
    schemaVersion: z.literal(1),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    canonicalInput: canonicalBirthInputSchema,
    calendarResolution: calendarResolutionSchema,
    timeResolution: timeResolutionSchema,
    apparentSolarTime: apparentSolarTimeSchema,
    solarTermContext: solarTermContextSchema,
    boundaryDistances: z.array(boundaryDistanceSchema),
    warnings: z.array(normalizationWarningSchema),
    provenance: normalizationProvenanceSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const candidateIdList = timeCandidateIds(value.timeResolution);
    const candidateIds = new Set(candidateIdList);
    const references: Array<{ id: string; path: Array<string | number> }> = [];
    const addIssue = (path: Array<string | number>, message: string) => {
      context.addIssue({ code: "custom", path, message });
    };

    const inputCalendar = value.canonicalInput.calendarDate;
    if (
      inputCalendar.kind === "solar" &&
      inputCalendar.date !== value.calendarResolution.solarDate
    ) {
      addIssue(
        ["calendarResolution", "solarDate"],
        "公历归一化结果必须与公历原始输入一致",
      );
    }
    if (inputCalendar.kind === "lunar") {
      const resolvedLunar = value.calendarResolution.lunarDate;
      if (
        inputCalendar.year !== resolvedLunar.year ||
        inputCalendar.month !== resolvedLunar.month ||
        inputCalendar.day !== resolvedLunar.day ||
        inputCalendar.isLeapMonth !== resolvedLunar.isLeapMonth
      ) {
        addIssue(
          ["calendarResolution", "lunarDate"],
          "农历归一化结果必须与农历原始输入一致",
        );
      }
    }

    const expectedLocalPrefix =
      value.canonicalInput.time.kind === "unknown"
        ? undefined
        : `${value.calendarResolution.solarDate}T${value.canonicalInput.time.value}:`;
    const timeCandidates =
      value.timeResolution.status === "resolved"
        ? [value.timeResolution.candidate]
        : value.timeResolution.status === "ambiguous"
          ? value.timeResolution.candidates
          : [];
    for (const [index, candidate] of timeCandidates.entries()) {
      if (candidate.timeZoneId !== value.canonicalInput.location.timeZoneId) {
        addIssue(
          ["timeResolution", "candidates", index, "timeZoneId"],
          "时间候选必须使用输入中确认的 IANA 时区",
        );
      }
      if (expectedLocalPrefix && !candidate.localDateTime.startsWith(expectedLocalPrefix)) {
        addIssue(
          ["timeResolution", "candidates", index, "localDateTime"],
          "时间候选必须使用转换后的公历日期和输入时间",
        );
      }
    }

    const timeStatus = value.timeResolution.status;
    if (timeStatus === "unknown" || timeStatus === "nonexistent") {
      const expectedReason = timeStatus === "unknown" ? "time_unknown" : "time_nonexistent";
      if (
        value.solarTermContext.status !== "unavailable" ||
        value.solarTermContext.reason !== expectedReason
      ) {
        addIssue(
          ["solarTermContext"],
          `时间状态为 ${timeStatus} 时节气上下文必须标记 ${expectedReason}`,
        );
      }
    } else if (value.solarTermContext.status !== "resolved") {
      addIssue(["solarTermContext"], "已解析的时间必须包含逐候选节气上下文");
    }

    if (value.canonicalInput.trueSolarTimeMode === "civil_only") {
      if (value.apparentSolarTime.status !== "not_requested") {
        addIssue(
          ["apparentSolarTime"],
          "civil_only 模式不得生成真太阳时结果",
        );
      }
    } else if (timeStatus === "unknown" || timeStatus === "nonexistent") {
      const expectedReason = timeStatus === "unknown" ? "time_unknown" : "time_nonexistent";
      if (
        value.apparentSolarTime.status !== "unavailable" ||
        value.apparentSolarTime.reason !== expectedReason
      ) {
        addIssue(
          ["apparentSolarTime"],
          `时间状态为 ${timeStatus} 时真太阳时必须标记 ${expectedReason}`,
        );
      }
    } else if (value.apparentSolarTime.status !== "resolved") {
      addIssue(["apparentSolarTime"], "compare 模式必须包含逐候选真太阳时结果");
    }

    const requireCompleteCandidateCoverage = (
      ids: string[],
      path: Array<string | number>,
      label: string,
    ) => {
      const outputIds = new Set(ids);
      if (
        outputIds.size !== candidateIds.size ||
        candidateIdList.some((id) => !outputIds.has(id))
      ) {
        addIssue(path, `${label}必须覆盖全部且仅覆盖有效时间候选`);
      }
    };

    if (value.apparentSolarTime.status === "resolved") {
      requireCompleteCandidateCoverage(
        value.apparentSolarTime.candidates.map((candidate) => candidate.candidateId),
        ["apparentSolarTime", "candidates"],
        "真太阳时结果",
      );
      value.apparentSolarTime.candidates.forEach((candidate, index) => {
        references.push({
          id: candidate.candidateId,
          path: ["apparentSolarTime", "candidates", index, "candidateId"],
        });
      });
    }
    if (value.solarTermContext.status === "resolved") {
      requireCompleteCandidateCoverage(
        value.solarTermContext.candidates.map((candidate) => candidate.candidateId),
        ["solarTermContext", "candidates"],
        "节气上下文",
      );
      value.solarTermContext.candidates.forEach((candidate, index) => {
        references.push({
          id: candidate.candidateId,
          path: ["solarTermContext", "candidates", index, "candidateId"],
        });
      });
    }
    value.boundaryDistances.forEach((boundary, index) => {
      references.push({
        id: boundary.candidateId,
        path: ["boundaryDistances", index, "candidateId"],
      });
    });
    value.warnings.forEach((warning, warningIndex) => {
      warning.affectedCandidateIds.forEach((id, idIndex) => {
        references.push({
          id,
          path: ["warnings", warningIndex, "affectedCandidateIds", idIndex],
        });
      });
    });

    for (const reference of references) {
      if (!candidateIds.has(reference.id)) {
        context.addIssue({
          code: "custom",
          path: reference.path,
          message: `候选引用不存在：${reference.id}`,
        });
      }
    }
  });

export type RawBirthInput = z.infer<typeof rawBirthInputSchema>;
export type CanonicalBirthInput = z.infer<typeof canonicalBirthInputSchema>;
export type BirthInput = RawBirthInput;
export type NormalizedBirth = z.infer<typeof normalizedBirthSchema>;
export type CivilTimeCandidate = z.infer<typeof civilTimeCandidateSchema>;
export type NormalizationWarning = z.infer<typeof normalizationWarningSchema>;
