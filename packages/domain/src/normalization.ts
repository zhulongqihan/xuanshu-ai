import { createHash } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import canonicalize from "canonicalize";
import {
  calendarDateSchema,
  calendarResolutionSchema,
  canonicalBirthInputSchema,
  normalizedBirthSchema,
  rawBirthInputSchema,
  timeResolutionSchema,
  type CalendarResolution,
  type CanonicalBirthInput,
  type CivilTimeCandidate,
  type NormalizationWarning,
  type NormalizedBirth,
  type RawBirthInput,
  type TimeResolution,
} from "./birth";
import { resolveHkoCalendarDate } from "./hko-calendar";
import {
  calculateBoundaryDistances,
  resolveApparentSolarTime,
  resolveSolarTermContext,
} from "./astronomy";

export const NORMALIZER_VERSION = "0.3.0";

export const NORMALIZATION_DEPENDENCIES = [
  {
    name: "@js-temporal/polyfill",
    version: "0.5.1",
    integrity:
      "sha512-hloP58zRVCRSpgDxmqCWJNlizAlUgJFqG2ypq79DCvyv9tHjRYMDOcPFjzfl/A1/YxDvRCZz8wvZvmapQnKwFQ==",
  },
  {
    name: "astronomia",
    version: "4.2.0",
    integrity:
      "sha512-mTvpBGyXB80aSsDhAAiuwza5VqAyqmj5yzhjBrFhRy17DcWDzJrb8Vdl4Sm+g276S+mY7bk/5hi6akZ5RQFeHg==",
  },
  {
    name: "canonicalize",
    version: "3.0.0",
    integrity:
      "sha512-yYLfHyDMIXRyRqsKBRLX023riFLpXY2YOfdtqKXZRZy9qsfOJ9U+4F9YZL7MEzL5+ziN2x2nlBvY/Voi3EBljA==",
  },
] as const;
export { BirthNormalizationError } from "./errors";

function normalizeSignedZero(value: number) {
  return Object.is(value, -0) ? 0 : value;
}

function canonicalTimeZoneId(timeZoneId: string) {
  return new Intl.DateTimeFormat("en", { timeZone: timeZoneId }).resolvedOptions()
    .timeZone;
}

export function canonicalizeBirthInput(input: RawBirthInput): CanonicalBirthInput {
  const raw = rawBirthInputSchema.parse(input);
  const coordinates = raw.location.coordinates
    ? {
        latitude: normalizeSignedZero(raw.location.coordinates.latitude),
        longitude: normalizeSignedZero(raw.location.coordinates.longitude),
      }
    : undefined;

  return canonicalBirthInputSchema.parse({
    ...raw,
    location: {
      ...raw.location,
      label: raw.location.label.trim().normalize("NFC"),
      timeZoneId: canonicalTimeZoneId(raw.location.timeZoneId),
      coordinates,
    },
  });
}

export function canonicalBirthJson(input: CanonicalBirthInput) {
  const canonicalInput = canonicalBirthInputSchema.parse(input);
  const serialized = canonicalize(canonicalInput);
  if (serialized === undefined) {
    throw new TypeError("出生输入无法序列化为 RFC 8785 JSON");
  }
  return serialized;
}

export function hashCanonicalBirthInput(input: CanonicalBirthInput) {
  return createHash("sha256").update(canonicalBirthJson(input), "utf8").digest("hex");
}

export function resolveCalendarDate(
  input: CanonicalBirthInput["calendarDate"],
): CalendarResolution {
  return resolveHkoCalendarDate(calendarDateSchema.parse(input));
}

function localDateTimeFor(input: CanonicalBirthInput, solarDate: string) {
  if (input.time.kind === "unknown") {
    return undefined;
  }
  return `${solarDate}T${input.time.value}:00`;
}

function civilCandidate(
  id: string,
  zonedDateTime: Temporal.ZonedDateTime,
  fold?: 0 | 1,
): CivilTimeCandidate {
  return {
    id,
    localDateTime: zonedDateTime.toPlainDateTime().toString({ smallestUnit: "second" }),
    timeZoneId: zonedDateTime.timeZoneId,
    utcOffsetSeconds: Math.trunc(zonedDateTime.offsetNanoseconds / 1_000_000_000),
    utcInstant: zonedDateTime.toInstant().toString({ smallestUnit: "second" }),
    ...(fold === undefined ? {} : { fold }),
  };
}

export function resolveCivilTime(
  input: CanonicalBirthInput,
  calendar: CalendarResolution,
): TimeResolution {
  const canonicalInput = canonicalBirthInputSchema.parse(input);
  const calendarResolution = calendarResolutionSchema.parse(calendar);
  const localDateTime = localDateTimeFor(
    canonicalInput,
    calendarResolution.solarDate,
  );
  if (!localDateTime) {
    return { status: "unknown" };
  }

  const plainDateTime = Temporal.PlainDateTime.from(localDateTime);
  const timeZoneId = canonicalInput.location.timeZoneId;
  try {
    const resolved = plainDateTime.toZonedDateTime(timeZoneId, {
      disambiguation: "reject",
    });
    return timeResolutionSchema.parse({
      status: "resolved",
      candidate: civilCandidate("civil-0", resolved),
    });
  } catch {
    const earlier = plainDateTime.toZonedDateTime(timeZoneId, {
      disambiguation: "earlier",
    });
    const later = plainDateTime.toZonedDateTime(timeZoneId, {
      disambiguation: "later",
    });
    const requested = plainDateTime.toString({ smallestUnit: "second" });
    const earlierMatches =
      earlier.toPlainDateTime().toString({ smallestUnit: "second" }) === requested;
    const laterMatches =
      later.toPlainDateTime().toString({ smallestUnit: "second" }) === requested;

    if (!earlierMatches || !laterMatches) {
      return timeResolutionSchema.parse({
        status: "nonexistent",
        localDateTime: requested,
        timeZoneId,
      });
    }

    return timeResolutionSchema.parse({
      status: "ambiguous",
      candidates: [
        civilCandidate("civil-earlier", earlier, 0),
        civilCandidate("civil-later", later, 1),
      ],
    });
  }
}

function warning(
  code: string,
  severity: NormalizationWarning["severity"],
  message: string,
  affectedCandidateIds: string[] = [],
  fieldPaths: string[] = [],
): NormalizationWarning {
  return { code, severity, message, affectedCandidateIds, fieldPaths };
}

function buildWarnings(
  input: CanonicalBirthInput,
  timeResolution: TimeResolution,
  boundaryDistances: NormalizedBirth["boundaryDistances"],
  apparentSolarTime: NormalizedBirth["apparentSolarTime"],
) {
  const warnings: NormalizationWarning[] = [];
  if (input.time.kind === "unknown") {
    warnings.push(
      warning(
        "birth_time_unknown",
        "warning",
        "出生时间未知，不能生成唯一时刻或时柱。",
        [],
        ["canonicalInput.time"],
      ),
    );
  } else if (input.time.kind === "approximate") {
    warnings.push(
      warning(
        "birth_time_approximate",
        "warning",
        `出生时间范围为中心时刻前 ${input.time.beforeMinutes} 分钟、后 ${input.time.afterMinutes} 分钟。`,
        [],
        ["canonicalInput.time"],
      ),
    );
  }

  if (timeResolution.status === "nonexistent") {
    warnings.push(
      warning(
        "civil_time_nonexistent",
        "error",
        "该民用时间位于夏令时跳变缺口，必须修正输入后再计算。",
        [],
        ["canonicalInput.time", "canonicalInput.location.timeZoneId"],
      ),
    );
  } else if (timeResolution.status === "ambiguous") {
    warnings.push(
      warning(
        "civil_time_ambiguous",
        "warning",
        "该民用时间在夏令时回拨时出现两次，已保留两个 UTC 候选。",
        timeResolution.candidates.map((candidate) => candidate.id),
        ["canonicalInput.time", "canonicalInput.location.timeZoneId"],
      ),
    );
  }

  const nearby = boundaryDistances.filter(
    (distance) => Math.abs(distance.signedSeconds) <= 300,
  );
  if (nearby.length > 0) {
    warnings.push(
      warning(
        "near_time_boundary",
        "warning",
        "候选时刻距节气、换日或时辰边界不超过五分钟。",
        [...new Set(nearby.map((distance) => distance.candidateId))],
        ["boundaryDistances"],
      ),
    );
  }

  if (input.time.kind === "approximate") {
    const { beforeMinutes, afterMinutes } = input.time;
    const crossesBoundary = boundaryDistances.filter(
      (distance) =>
        distance.signedSeconds <= beforeMinutes * 60 &&
        distance.signedSeconds >= -afterMinutes * 60,
    );
    if (crossesBoundary.length > 0) {
      warnings.push(
        warning(
          "uncertainty_crosses_boundary",
          "warning",
          "出生时间的不确定范围跨越至少一个节气、换日或时辰边界。",
          [...new Set(crossesBoundary.map((distance) => distance.candidateId))],
          ["canonicalInput.time", "boundaryDistances"],
        ),
      );
    }
  }

  if (apparentSolarTime.status === "resolved" && timeResolution.status !== "nonexistent") {
    const civilById = new Map(
      (timeResolution.status === "resolved"
        ? [timeResolution.candidate]
        : timeResolution.status === "ambiguous"
          ? timeResolution.candidates
          : []
      ).map((candidate) => [candidate.id, candidate.localDateTime]),
    );
    const shifted = apparentSolarTime.candidates.filter(
      (candidate) =>
        civilById.get(candidate.candidateId)?.slice(0, 10) !==
        candidate.apparentLocalDateTime.slice(0, 10),
    );
    if (shifted.length > 0) {
      warnings.push(
        warning(
          "apparent_solar_date_shift",
          "warning",
          "真太阳时与民用时间落在不同公历日期，后续命盘必须并列比较。",
          shifted.map((candidate) => candidate.candidateId),
          ["apparentSolarTime"],
        ),
      );
    }
  }

  return warnings;
}

export type NormalizeBirthOptions = {
  normalizedAt?: string;
};

export function normalizeBirth(
  input: RawBirthInput,
  { normalizedAt = new Date().toISOString() }: NormalizeBirthOptions = {},
): NormalizedBirth {
  const canonicalInput = canonicalizeBirthInput(input);
  const inputHash = hashCanonicalBirthInput(canonicalInput);
  const calendarResolution = resolveCalendarDate(canonicalInput.calendarDate);
  const timeResolution = resolveCivilTime(canonicalInput, calendarResolution);
  const apparentSolarTime = resolveApparentSolarTime(canonicalInput, timeResolution);
  const solarTermContext = resolveSolarTermContext(timeResolution);
  const boundaryDistances = calculateBoundaryDistances(
    timeResolution,
    solarTermContext,
    apparentSolarTime,
  );
  const warnings = buildWarnings(
    canonicalInput,
    timeResolution,
    boundaryDistances,
    apparentSolarTime,
  );
  const trace = [
    {
      step: "input.canonicalize",
      engineId: "canonicalize",
      engineVersion: "3.0.0",
      inputRefs: ["rawInput"],
      outputRefs: ["canonicalInput", "inputHash"],
      sourceIds: ["rfc-8785"],
    },
    {
      step: "calendar.resolve",
      engineId: "hko-calendar-table",
      engineVersion: "1.0.0",
      inputRefs: ["canonicalInput.calendarDate"],
      outputRefs: ["calendarResolution"],
      sourceIds: ["hko-calendar", "gbt-33661"],
    },
    {
      step: "civil_time.resolve",
      engineId: "@js-temporal/polyfill",
      engineVersion: "0.5.1",
      inputRefs: ["calendarResolution.solarDate", "canonicalInput.time"],
      outputRefs: ["timeResolution"],
      sourceIds: ["iana-tzdb"],
    },
    {
      step: "solar_terms.resolve",
      engineId: "astronomia-vsop87",
      engineVersion: "4.2.0",
      inputRefs: ["timeResolution"],
      outputRefs: ["solarTermContext", "boundaryDistances"],
      sourceIds: ["meeus-aa"],
    },
    {
      step: "apparent_solar_time.resolve",
      engineId: "astronomia-vsop87",
      engineVersion: "4.2.0",
      inputRefs: ["timeResolution", "canonicalInput.location.coordinates"],
      outputRefs: ["apparentSolarTime"],
      sourceIds: ["meeus-aa"],
    },
  ];

  return normalizedBirthSchema.parse({
    schemaVersion: 1,
    inputHash,
    canonicalInput,
    calendarResolution,
    timeResolution,
    apparentSolarTime,
    solarTermContext,
    boundaryDistances,
    warnings,
    provenance: {
      normalizer: { id: "xuanshu-birth-normalizer", version: NORMALIZER_VERSION },
      dependencies: NORMALIZATION_DEPENDENCIES,
      runtime: {
        node: process.versions.node,
        icu: process.versions.icu,
        ...(process.versions.tz ? { tzdb: process.versions.tz } : {}),
      },
      sourceIds: [
        "hko-calendar",
        "hko-calendar-api",
        "gbt-33661",
        "iana-tzdb",
        "meeus-aa",
      ],
      trace,
      normalizedAt,
    },
  });
}
