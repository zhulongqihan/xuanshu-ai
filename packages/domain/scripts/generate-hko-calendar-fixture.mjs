import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const START_YEAR = 1901;
const END_YEAR = 2100;
const TERMINAL_MONTH_DAYS = 29;
const SOURCE_URL_PATTERN =
  "https://www.hko.gov.hk/en/gts/time/calendar/text/files/T{year}e.txt";
const WEEKDAY_PATTERN =
  "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday";
const DATA_ROW_PATTERN = new RegExp(
  `^(\\d{4})/(\\d{1,2})/(\\d{1,2})\\s+(.+?)\\s+(${WEEKDAY_PATTERN})(?:\\s+(.*?))?\\s*$`,
);
const MONTH_START_PATTERN = /^(\d{1,2})(?:st|nd|rd|th) Lunar month$/i;
const KNOWN_SOURCE_PATCHES = [
  {
    solarDate: "2069-12-30",
    lunarField: "17",
    weekday: "Monday",
    solarTerm: "",
    reason: "HKO T2069e.txt omits this Gregorian date between lunar days 16 and 18.",
    evidence: {
      filename: "2069e.pdf",
      url: "https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2069e.pdf",
      page: 1,
      location: "December row, Gregorian day 30",
    },
  },
];

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function expectedDaysInYear(year) {
  return new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29 ? 366 : 365;
}

function nextIsoDate(date) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function parseAnnualRows(year, content) {
  const rows = [];
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(DATA_ROW_PATTERN);
    if (!match) continue;
    const [, rowYear, month, day, lunarField, weekday, solarTerm = ""] = match;
    if (Number(rowYear) !== year) {
      throw new Error(`T${year}e.txt 包含其他年份日期：${rowYear}/${month}/${day}`);
    }
    rows.push({
      solarDate: isoDate(year, Number(month), Number(day)),
      lunarField: lunarField.trim(),
      weekday,
      solarTerm: solarTerm.trim(),
    });
  }

  const sourceRowCount = rows.length;
  const patches = KNOWN_SOURCE_PATCHES.filter(
    (patch) => Number(patch.solarDate.slice(0, 4)) === year,
  );
  for (const patch of patches) {
    if (rows.some((row) => row.solarDate === patch.solarDate)) {
      throw new Error(
        `已知缺行 ${patch.solarDate} 已出现在年度文本中，必须复核并移除补丁`,
      );
    }
    rows.push({
      solarDate: patch.solarDate,
      lunarField: patch.lunarField,
      weekday: patch.weekday,
      solarTerm: patch.solarTerm,
    });
  }
  rows.sort((first, second) => first.solarDate.localeCompare(second.solarDate));

  const expectedRows = expectedDaysInYear(year);
  if (rows.length !== expectedRows) {
    throw new Error(`T${year}e.txt 应有 ${expectedRows} 日，实际解析 ${rows.length} 日`);
  }
  if (rows[0].solarDate !== `${year}-01-01`) {
    throw new Error(`T${year}e.txt 首日不是 1 月 1 日`);
  }
  if (rows.at(-1)?.solarDate !== `${year}-12-31`) {
    throw new Error(`T${year}e.txt 末日不是 12 月 31 日`);
  }
  return { rows, sourceRowCount, patches };
}

async function main() {
  const [sourceArg, outputArg, runtimeArg, retrievedOn = ""] = process.argv.slice(2);
  if (
    !sourceArg ||
    !outputArg ||
    !runtimeArg ||
    !/^\d{4}-\d{2}-\d{2}$/.test(retrievedOn)
  ) {
    throw new Error(
      "用法：node generate-hko-calendar-fixture.mjs <HKO源目录> <输出目录> <运行时月界JSON> <YYYY-MM-DD>",
    );
  }

  const sourceDirectory = resolve(sourceArg);
  const outputDirectory = resolve(outputArg);
  const runtimePath = resolve(runtimeArg);
  const sources = [];
  const annualRows = [];

  for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    const filename = `T${year}e.txt`;
    const path = join(sourceDirectory, filename);
    const buffer = await readFile(path);
    const content = buffer.toString("utf8");
    const parsed = parseAnnualRows(year, content);
    const { rows } = parsed;
    annualRows.push(...rows);
    sources.push({
      year,
      filename,
      url: SOURCE_URL_PATTERN.replace("{year}", String(year)),
      bytes: buffer.byteLength,
      rows: parsed.sourceRowCount,
      sha256: sha256(buffer),
    });
  }

  const expectedTotal = Array.from(
    { length: END_YEAR - START_YEAR + 1 },
    (_, index) => expectedDaysInYear(START_YEAR + index),
  ).reduce((sum, value) => sum + value, 0);
  if (annualRows.length !== expectedTotal) {
    throw new Error(`全区间应有 ${expectedTotal} 日，实际 ${annualRows.length} 日`);
  }

  const fixtureRows = [];
  const lunarMonths = [];
  const lunar = {
    year: 1900,
    month: 11,
    day: 11,
    isLeapMonth: false,
  };
  let currentMonth = {
    solarStart: "1900-12-22",
    lunarYear: lunar.year,
    lunarMonth: lunar.month,
    isLeapMonth: lunar.isLeapMonth,
    days: undefined,
  };
  let previousSolarDate;

  for (const [index, row] of annualRows.entries()) {
    if (previousSolarDate && row.solarDate !== nextIsoDate(previousSolarDate)) {
      throw new Error(`公历日期不连续：${previousSolarDate} 后为 ${row.solarDate}`);
    }

    const monthStart = row.lunarField.match(MONTH_START_PATTERN);
    if (monthStart) {
      const nextMonth = Number(monthStart[1]);
      if (nextMonth < 1 || nextMonth > 12) {
        throw new Error(`${row.solarDate} 的农历月序无效：${row.lunarField}`);
      }
      if (lunar.day !== 29 && lunar.day !== 30) {
        throw new Error(`${row.solarDate} 换月前一月仅有 ${lunar.day} 日`);
      }
      currentMonth.days = lunar.day;
      lunarMonths.push(currentMonth);
      const expectedNextMonth = (lunar.month % 12) + 1;
      const repeatsMonth = nextMonth === lunar.month;
      if (!repeatsMonth && nextMonth !== expectedNextMonth) {
        throw new Error(
          `${row.solarDate} 农历月份跳跃：${lunar.month} 后为 ${nextMonth}`,
        );
      }
      if (repeatsMonth && lunar.isLeapMonth) {
        throw new Error(`${row.solarDate} 出现连续两个闰 ${nextMonth} 月`);
      }
      if (nextMonth === 1 && !repeatsMonth) {
        lunar.year = Number(row.solarDate.slice(0, 4));
      }
      lunar.month = nextMonth;
      lunar.day = 1;
      lunar.isLeapMonth = repeatsMonth;
      currentMonth = {
        solarStart: row.solarDate,
        lunarYear: lunar.year,
        lunarMonth: lunar.month,
        isLeapMonth: lunar.isLeapMonth,
        days: undefined,
      };
    } else {
      const lunarDay = Number(row.lunarField);
      if (!Number.isInteger(lunarDay) || lunarDay < 1 || lunarDay > 30) {
        throw new Error(`${row.solarDate} 的农历日无效：${row.lunarField}`);
      }
      if (index === 0) {
        if (lunarDay !== lunar.day) {
          throw new Error(`1901-01-01 的固定起点应为十一月十一，实际日为 ${lunarDay}`);
        }
      } else if (lunarDay !== lunar.day + 1) {
        throw new Error(
          `${row.solarDate} 农历日不连续：预期 ${lunar.day + 1}，实际 ${lunarDay}`,
        );
      } else {
        lunar.day = lunarDay;
      }
    }

    fixtureRows.push(
      [
        row.solarDate,
        lunar.year,
        lunar.month,
        lunar.day,
        lunar.isLeapMonth ? 1 : 0,
      ].join(","),
    );
    previousSolarDate = row.solarDate;
  }

  currentMonth.days = TERMINAL_MONTH_DAYS;
  lunarMonths.push(currentMonth);

  const fixture = [
    "# schema=hko-calendar-fixture-v1",
    "# source_id=hko-calendar",
    `# source_url_pattern=${SOURCE_URL_PATTERN}`,
    `# solar_range=${START_YEAR}-01-01..${END_YEAR}-12-31`,
    "solar_date,lunar_year,lunar_month,lunar_day,is_leap_month",
    ...fixtureRows,
    "",
  ].join("\n");
  const fixtureFilename = `hko-calendar-${START_YEAR}-${END_YEAR}.csv`;
  const fixturePath = join(outputDirectory, fixtureFilename);
  const sourcePatches = [];
  for (const patch of KNOWN_SOURCE_PATCHES) {
    const evidencePath = join(sourceDirectory, patch.evidence.filename);
    const evidence = await readFile(evidencePath);
    sourcePatches.push({
      solarDate: patch.solarDate,
      insertedLunarDay: Number(patch.lunarField),
      reason: patch.reason,
      evidence: {
        ...patch.evidence,
        bytes: evidence.byteLength,
        sha256: sha256(evidence),
      },
    });
  }
  const manifest = {
    schemaVersion: 1,
    sourceId: "hko-calendar",
    sourceUrlPattern: SOURCE_URL_PATTERN,
    retrievedOn,
    solarRange: {
      start: `${START_YEAR}-01-01`,
      end: `${END_YEAR}-12-31`,
    },
    rowCount: fixtureRows.length,
    fixture: {
      filename: fixtureFilename,
      bytes: Buffer.byteLength(fixture),
      sha256: sha256(fixture),
    },
    sourcePatches,
    terminalMonthDays: {
      solarStart: "2100-12-31",
      days: TERMINAL_MONTH_DAYS,
      source: "lunar-typescript@1.8.6 cross-check; HKO 2100 table is range-truncated",
    },
    sources,
  };

  await writeFile(fixturePath, fixture, "utf8");
  await writeFile(
    join(outputDirectory, `hko-calendar-${START_YEAR}-${END_YEAR}.manifest.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  const runtimeMonths = lunarMonths.map((month) => [
    month.solarStart,
    month.lunarYear,
    month.lunarMonth,
    month.isLeapMonth ? 1 : 0,
    month.days,
  ]);
  const runtimeData = [
    "{",
    '  "schemaVersion": 1,',
    '  "sourceId": "hko-calendar",',
    '  "solarRange": {',
    `    "start": "${START_YEAR}-01-01",`,
    `    "end": "${END_YEAR}-12-31"`,
    "  },",
    `  "terminalMonthDays": ${TERMINAL_MONTH_DAYS},`,
    '  "months": [',
    ...runtimeMonths.map(
      (month, index) =>
        `    ${JSON.stringify(month)}${index === runtimeMonths.length - 1 ? "" : ","}`,
    ),
    "  ]",
    "}",
    "",
  ].join("\n");
  await writeFile(runtimePath, runtimeData, "utf8");
  process.stdout.write(
    `${basename(fixturePath)}: ${fixtureRows.length} rows, sha256=${manifest.fixture.sha256}\n`,
  );
}

await main();
