import { createHash } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import canonicalize from "canonicalize";
import { Lunar, LunarYear, Solar } from "lunar-typescript";
import {
  calendarDateSchema,
  calendarResolutionSchema,
  canonicalBirthInputSchema,
  rawBirthInputSchema,
  supportedSolarDateSchema,
  timeResolutionSchema,
  type CalendarResolution,
  type CanonicalBirthInput,
  type CivilTimeCandidate,
  type RawBirthInput,
  type TimeResolution,
} from "./birth";

export type BirthNormalizationErrorCode =
  | "invalid_lunar_date"
  | "unsupported_range";

export class BirthNormalizationError extends Error {
  readonly code: BirthNormalizationErrorCode;

  constructor(code: BirthNormalizationErrorCode, message: string) {
    super(message);
    this.name = "BirthNormalizationError";
    this.code = code;
  }
}

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

function lunarFields(lunar: Lunar) {
  return {
    kind: "lunar" as const,
    year: lunar.getYear(),
    month: Math.abs(lunar.getMonth()),
    day: lunar.getDay(),
    isLeapMonth: lunar.getMonth() < 0,
  };
}

function assertSupportedSolarDate(solarDate: string) {
  if (!supportedSolarDateSchema.safeParse(solarDate).success) {
    throw new BirthNormalizationError(
      "unsupported_range",
      `转换后的公历日期超出 1901-01-01 至 2100-12-31：${solarDate}`,
    );
  }
}

export function resolveCalendarDate(
  input: CanonicalBirthInput["calendarDate"],
): CalendarResolution {
  const calendarDate = calendarDateSchema.parse(input);
  let solar: Solar;
  let lunar: Lunar;

  if (calendarDate.kind === "solar") {
    const [year, month, day] = calendarDate.date.split("-").map(Number);
    solar = Solar.fromYmd(year, month, day);
    lunar = solar.getLunar();
  } else {
    const encodedMonth = calendarDate.isLeapMonth
      ? -calendarDate.month
      : calendarDate.month;
    try {
      lunar = Lunar.fromYmd(calendarDate.year, encodedMonth, calendarDate.day);
      solar = lunar.getSolar();
    } catch (error) {
      throw new BirthNormalizationError(
        "invalid_lunar_date",
        `农历日期不存在：${calendarDate.year} 年${calendarDate.isLeapMonth ? "闰" : ""}${calendarDate.month} 月 ${calendarDate.day} 日`,
      );
    }

    const roundTrip = lunarFields(solar.getLunar());
    if (
      roundTrip.year !== calendarDate.year ||
      roundTrip.month !== calendarDate.month ||
      roundTrip.day !== calendarDate.day ||
      roundTrip.isLeapMonth !== calendarDate.isLeapMonth
    ) {
      throw new BirthNormalizationError(
        "invalid_lunar_date",
        `农历日期无法稳定复算：${calendarDate.year}-${calendarDate.month}-${calendarDate.day}`,
      );
    }
  }

  const solarDate = solar.toYmd();
  assertSupportedSolarDate(solarDate);
  const resolvedLunar = lunarFields(lunar);
  const monthNumber = resolvedLunar.isLeapMonth
    ? -resolvedLunar.month
    : resolvedLunar.month;
  const lunarMonth = LunarYear.fromYear(resolvedLunar.year).getMonth(monthNumber);
  if (!lunarMonth) {
    throw new BirthNormalizationError(
      "invalid_lunar_date",
      `无法读取农历月份：${resolvedLunar.year}-${monthNumber}`,
    );
  }

  return calendarResolutionSchema.parse({
    status: "resolved",
    solarDate,
    lunarDate: resolvedLunar,
    lunarMonthDays: lunarMonth.getDayCount(),
    engine: {
      id: "lunar-typescript",
      version: "1.8.6",
      sourceIds: ["hko-calendar", "gbt-33661"],
    },
  });
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
