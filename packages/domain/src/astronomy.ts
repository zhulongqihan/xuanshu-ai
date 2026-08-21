/// <reference path="./astronomia.d.ts" />

import { Temporal } from "@js-temporal/polyfill";
import earthData from "astronomia/data/vsop87Bearth";
import { e as equationOfTime } from "astronomia/eqtime";
import { CalendarGregorian } from "astronomia/julian";
import { Planet } from "astronomia/planetposition";
import { longitude as solarLongitude } from "astronomia/solstice";
import {
  apparentSolarTimeSchema,
  boundaryDistanceSchema,
  solarTermContextSchema,
  type ApparentSolarTime,
  type BoundaryDistance,
  type CanonicalBirthInput,
  type CivilTimeCandidate,
  type SolarTermContext,
  type TimeResolution,
} from "./birth";

const ASTRONOMIA_ENGINE = {
  id: "astronomia-vsop87",
  version: "4.2.0",
  sourceIds: ["meeus-aa"],
} as const;

const earth = new Planet(earthData);
const RADIAN_TO_TIME_SECONDS = 43_200 / Math.PI;
const LONGITUDE_DEGREE_TO_SECONDS = 240;
const DAY_SECONDS = 86_400;

const SOLAR_TERMS = [
  ["xiaohan", "小寒", 285, -1],
  ["dahan", "大寒", 300, -1],
  ["lichun", "立春", 315, -1],
  ["yushui", "雨水", 330, -1],
  ["jingzhe", "惊蛰", 345, -1],
  ["chunfen", "春分", 0, 0],
  ["qingming", "清明", 15, 0],
  ["guyu", "谷雨", 30, 0],
  ["lixia", "立夏", 45, 0],
  ["xiaoman", "小满", 60, 0],
  ["mangzhong", "芒种", 75, 0],
  ["xiazhi", "夏至", 90, 0],
  ["xiaoshu", "小暑", 105, 0],
  ["dashu", "大暑", 120, 0],
  ["liqiu", "立秋", 135, 0],
  ["chushu", "处暑", 150, 0],
  ["bailu", "白露", 165, 0],
  ["qiufen", "秋分", 180, 0],
  ["hanlu", "寒露", 195, 0],
  ["shuangjiang", "霜降", 210, 0],
  ["lidong", "立冬", 225, 0],
  ["xiaoxue", "小雪", 240, 0],
  ["daxue", "大雪", 255, 0],
  ["dongzhi", "冬至", 270, 0],
] as const;

export type SolarTermInstant = {
  id: string;
  name: string;
  kind: "jie" | "zhongqi";
  calendarYear: number;
  instant: Temporal.Instant;
};

const solarTermCache = new Map<number, SolarTermInstant[]>();

function roundTo(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function jdeToInstant(jde: number) {
  const date = new CalendarGregorian().fromJDE(jde).toDate();
  const roundedMilliseconds = Math.round(date.getTime() / 1_000) * 1_000;
  return Temporal.Instant.from(new Date(roundedMilliseconds).toISOString());
}

function solarTermsForCalendarYear(year: number) {
  const cached = solarTermCache.get(year);
  if (cached) {
    return cached;
  }

  const terms = SOLAR_TERMS.map(([id, name, degrees, yearOffset], index) => {
    const jde = solarLongitude(
      year + yearOffset,
      earth,
      (degrees * Math.PI) / 180,
    );
    return {
      id: `solar_term_${id}`,
      name,
      kind: index % 2 === 0 ? ("jie" as const) : ("zhongqi" as const),
      calendarYear: year,
      instant: jdeToInstant(jde),
    };
  }).sort(
    (left, right) => left.instant.epochMilliseconds - right.instant.epochMilliseconds,
  );
  solarTermCache.set(year, terms);
  return terms;
}

export function solarTermInstantsForCalendarYear(year: number) {
  if (!Number.isInteger(year) || year < 1899 || year > 2102) {
    throw new RangeError(`节气年份超出可计算范围：${year}`);
  }
  return solarTermsForCalendarYear(year).map((term) => ({ ...term }));
}

function candidateList(timeResolution: TimeResolution) {
  if (timeResolution.status === "resolved") {
    return [timeResolution.candidate];
  }
  if (timeResolution.status === "ambiguous") {
    return [...timeResolution.candidates];
  }
  return [];
}

function termAtLocation(term: SolarTermInstant, timeZoneId: string) {
  return {
    id: term.id,
    name: term.name,
    utcInstant: term.instant.toString({ smallestUnit: "second" }),
    localDateTime: term.instant
      .toZonedDateTimeISO(timeZoneId)
      .toPlainDateTime()
      .toString({ smallestUnit: "second" }),
    timeZoneId,
  };
}

function adjacentSolarTerms(candidate: CivilTimeCandidate) {
  const instant = Temporal.Instant.from(candidate.utcInstant);
  const utcYear = instant.toZonedDateTimeISO("UTC").year;
  const terms = [
    ...solarTermsForCalendarYear(utcYear - 1),
    ...solarTermsForCalendarYear(utcYear),
    ...solarTermsForCalendarYear(utcYear + 1),
  ].sort(
    (left, right) => left.instant.epochMilliseconds - right.instant.epochMilliseconds,
  );
  const nextIndex = terms.findIndex(
    (term) => term.instant.epochMilliseconds > instant.epochMilliseconds,
  );
  const previous = terms[nextIndex - 1];
  const next = terms[nextIndex];
  if (!previous || !next) {
    throw new RangeError(`无法定位相邻节气：${candidate.utcInstant}`);
  }

  return {
    previous,
    next,
    secondsSincePrevious:
      (instant.epochMilliseconds - previous.instant.epochMilliseconds) / 1_000,
    secondsUntilNext:
      (next.instant.epochMilliseconds - instant.epochMilliseconds) / 1_000,
  };
}

export function resolveSolarTermContext(
  timeResolution: TimeResolution,
): SolarTermContext {
  if (timeResolution.status === "unknown") {
    return { status: "unavailable", reason: "time_unknown" };
  }
  if (timeResolution.status === "nonexistent") {
    return { status: "unavailable", reason: "time_nonexistent" };
  }

  return solarTermContextSchema.parse({
    status: "resolved",
    candidates: candidateList(timeResolution).map((candidate) => {
      const context = adjacentSolarTerms(candidate);
      return {
        candidateId: candidate.id,
        previous: termAtLocation(context.previous, candidate.timeZoneId),
        next: termAtLocation(context.next, candidate.timeZoneId),
        secondsSincePrevious: context.secondsSincePrevious,
        secondsUntilNext: context.secondsUntilNext,
      };
    }),
    engine: ASTRONOMIA_ENGINE,
  });
}

function instantToJde(instant: Temporal.Instant) {
  return new CalendarGregorian(new Date(instant.epochMilliseconds)).toJDE();
}

export function resolveApparentSolarTime(
  input: CanonicalBirthInput,
  timeResolution: TimeResolution,
): ApparentSolarTime {
  if (input.trueSolarTimeMode === "civil_only") {
    return { status: "not_requested" };
  }
  if (!input.location.coordinates) {
    return { status: "unavailable", reason: "missing_coordinates" };
  }
  if (timeResolution.status === "unknown") {
    return { status: "unavailable", reason: "time_unknown" };
  }
  if (timeResolution.status === "nonexistent") {
    return { status: "unavailable", reason: "time_nonexistent" };
  }

  const longitude = input.location.coordinates.longitude;
  return apparentSolarTimeSchema.parse({
    status: "resolved",
    candidates: candidateList(timeResolution).map((candidate) => {
      const instant = Temporal.Instant.from(candidate.utcInstant);
      const longitudeCorrectionSeconds =
        longitude * LONGITUDE_DEGREE_TO_SECONDS - candidate.utcOffsetSeconds;
      const equationOfTimeSeconds =
        equationOfTime(instantToJde(instant), earth) * RADIAN_TO_TIME_SECONDS;
      const totalCorrectionSeconds =
        longitudeCorrectionSeconds + equationOfTimeSeconds;
      const apparentLocalDateTime = Temporal.PlainDateTime.from(
        candidate.localDateTime,
      )
        .add({ milliseconds: Math.round(totalCorrectionSeconds * 1_000) })
        .toString({ smallestUnit: "second", roundingMode: "halfExpand" });

      return {
        candidateId: candidate.id,
        apparentLocalDateTime,
        longitudeCorrectionSeconds: roundTo(longitudeCorrectionSeconds, 3),
        equationOfTimeSeconds: roundTo(equationOfTimeSeconds, 3),
        totalCorrectionSeconds: roundTo(totalCorrectionSeconds, 3),
      };
    }),
    engine: ASTRONOMIA_ENGINE,
  });
}

function secondsOfDay(localDateTime: string) {
  const value = Temporal.PlainDateTime.from(localDateTime);
  return value.hour * 3_600 + value.minute * 60 + value.second;
}

function signedDistanceToNearestBoundary(
  localSeconds: number,
  boundaries: number[],
) {
  let nearest = Number.POSITIVE_INFINITY;
  for (const boundary of boundaries) {
    for (const dayOffset of [-DAY_SECONDS, 0, DAY_SECONDS]) {
      const distance = localSeconds - (boundary + dayOffset);
      if (Math.abs(distance) < Math.abs(nearest)) {
        nearest = distance;
      }
    }
  }
  return nearest;
}

export function calculateBoundaryDistances(
  timeResolution: TimeResolution,
  solarTermContext: SolarTermContext,
  apparentSolarTime: ApparentSolarTime,
): BoundaryDistance[] {
  if (
    (timeResolution.status !== "resolved" && timeResolution.status !== "ambiguous") ||
    solarTermContext.status !== "resolved"
  ) {
    return [];
  }

  const solarTermsByCandidate = new Map(
    solarTermContext.candidates.map((context) => [context.candidateId, context]),
  );
  const apparentByCandidate = new Map(
    apparentSolarTime.status === "resolved"
      ? apparentSolarTime.candidates.map((candidate) => [candidate.candidateId, candidate])
      : [],
  );
  const shichenBoundaries = Array.from({ length: 12 }, (_, index) => (index * 2 + 1) * 3_600);
  const distances: BoundaryDistance[] = [];

  for (const candidate of candidateList(timeResolution)) {
    const localSeconds = secondsOfDay(candidate.localDateTime);
    const termContext = solarTermsByCandidate.get(candidate.id);
    if (!termContext) {
      throw new RangeError(`缺少候选节气上下文：${candidate.id}`);
    }
    const termDistance =
      termContext.secondsSincePrevious <= termContext.secondsUntilNext
        ? termContext.secondsSincePrevious
        : -termContext.secondsUntilNext;
    distances.push(
      { kind: "solar_term", candidateId: candidate.id, signedSeconds: termDistance },
      {
        kind: "civil_23",
        candidateId: candidate.id,
        signedSeconds: signedDistanceToNearestBoundary(localSeconds, [23 * 3_600]),
      },
      {
        kind: "civil_midnight",
        candidateId: candidate.id,
        signedSeconds: signedDistanceToNearestBoundary(localSeconds, [0]),
      },
      {
        kind: "shichen",
        candidateId: candidate.id,
        signedSeconds: signedDistanceToNearestBoundary(localSeconds, shichenBoundaries),
      },
    );

    const apparent = apparentByCandidate.get(candidate.id);
    if (apparent) {
      const apparentSeconds = secondsOfDay(apparent.apparentLocalDateTime);
      distances.push(
        {
          kind: "apparent_23",
          candidateId: candidate.id,
          signedSeconds: signedDistanceToNearestBoundary(apparentSeconds, [23 * 3_600]),
        },
        {
          kind: "apparent_midnight",
          candidateId: candidate.id,
          signedSeconds: signedDistanceToNearestBoundary(apparentSeconds, [0]),
        },
      );
    }
  }

  return distances.map((distance) => boundaryDistanceSchema.parse(distance));
}
