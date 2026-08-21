import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import { calculateAlmanac } from "./almanac";
import { sexagenaryDayIndex } from "./bazi";
import { resolveHkoCalendarDate } from "./hko-calendar";
import {
  evidenceRefSchema,
  liuyaoCastSchema,
  liuyaoLineSchema,
  timeZoneSchema,
  type EvidenceRef,
  type LiuyaoCast,
} from "./schemas";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
const ELEMENTS = ["wood", "fire", "earth", "metal", "water"] as const;
const ELEMENT_NAMES = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
} as const;
const SIX_RELATIVES = ["兄弟", "父母", "子孙", "妻财", "官鬼"] as const;
const SIX_SPIRITS = ["青龙", "朱雀", "勾陈", "螣蛇", "白虎", "玄武"] as const;

const LIUYAO_ENGINE = {
  id: "xuanshu-liuyao",
  version: "0.1.0",
  ruleSetId: "liuyao-wenwanggua-v1",
  ruleSetVersion: "1.0.0",
  sourceIds: ["zengshan-buyi", "bushi-zhengzong", "huozhulin", "gbt-33661"],
} as const;

const TRIGRAMS = [
  { key: 0, name: "坤", symbol: "☷", element: "earth", lines: [0, 0, 0] },
  { key: 1, name: "震", symbol: "☳", element: "wood", lines: [1, 0, 0] },
  { key: 2, name: "坎", symbol: "☵", element: "water", lines: [0, 1, 0] },
  { key: 3, name: "兑", symbol: "☱", element: "metal", lines: [1, 1, 0] },
  { key: 4, name: "艮", symbol: "☶", element: "earth", lines: [0, 0, 1] },
  { key: 5, name: "离", symbol: "☲", element: "fire", lines: [1, 0, 1] },
  { key: 6, name: "巽", symbol: "☴", element: "wood", lines: [0, 1, 1] },
  { key: 7, name: "乾", symbol: "☰", element: "metal", lines: [1, 1, 1] },
] as const;

const HEXAGRAM_NAMES: Record<number, string> = {
  63: "乾", 0: "坤", 17: "屯", 34: "蒙", 23: "需", 58: "讼", 2: "师", 16: "比",
  55: "小畜", 59: "履", 7: "泰", 56: "否", 61: "同人", 47: "大有", 4: "谦", 8: "豫",
  25: "随", 38: "蛊", 3: "临", 48: "观", 41: "噬嗑", 37: "贲", 32: "剥", 1: "复",
  57: "无妄", 39: "大畜", 33: "颐", 30: "大过", 18: "坎", 45: "离", 28: "咸", 14: "恒",
  60: "遯", 15: "大壮", 40: "晋", 5: "明夷", 53: "家人", 43: "睽", 20: "蹇", 10: "解",
  35: "损", 49: "益", 31: "夬", 62: "姤", 24: "萃", 6: "升", 26: "困", 22: "井",
  29: "革", 46: "鼎", 9: "震", 36: "艮", 52: "渐", 11: "归妹", 13: "丰", 44: "旅",
  54: "巽", 27: "兑", 50: "涣", 19: "节", 51: "中孚", 12: "小过", 21: "既济", 42: "未济",
};

const PALACE_GROUPS = [
  { name: "乾宫", element: "metal", keys: [63, 62, 60, 56, 48, 32, 40, 47], positions: ["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"] },
  { name: "坎宫", element: "water", keys: [18, 19, 17, 21, 29, 13, 5, 2], positions: ["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"] },
  { name: "艮宫", element: "earth", keys: [36, 37, 39, 35, 43, 59, 51, 52], positions: ["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"] },
  { name: "震宫", element: "wood", keys: [9, 8, 10, 14, 6, 22, 30, 25], positions: ["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"] },
  { name: "巽宫", element: "wood", keys: [54, 55, 53, 49, 57, 41, 33, 38], positions: ["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"] },
  { name: "离宫", element: "fire", keys: [45, 44, 46, 42, 34, 50, 58, 61], positions: ["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"] },
  { name: "坤宫", element: "earth", keys: [0, 1, 3, 7, 15, 31, 23, 16], positions: ["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"] },
  { name: "兑宫", element: "metal", keys: [27, 26, 24, 28, 20, 4, 12, 11], positions: ["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"] },
] as const;

const NAIJIA = {
  7: { innerStem: "甲", innerBranches: [0, 2, 4], outerStem: "壬", outerBranches: [6, 8, 10] },
  0: { innerStem: "乙", innerBranches: [7, 5, 3], outerStem: "癸", outerBranches: [1, 11, 9] },
  1: { innerStem: "庚", innerBranches: [0, 2, 4], outerStem: "庚", outerBranches: [6, 8, 10] },
  6: { innerStem: "辛", innerBranches: [1, 11, 9], outerStem: "辛", outerBranches: [7, 5, 3] },
  2: { innerStem: "戊", innerBranches: [2, 4, 6], outerStem: "戊", outerBranches: [8, 10, 0] },
  5: { innerStem: "己", innerBranches: [3, 1, 11], outerStem: "己", outerBranches: [9, 7, 5] },
  4: { innerStem: "丙", innerBranches: [4, 6, 8], outerStem: "丙", outerBranches: [10, 0, 2] },
  3: { innerStem: "丁", innerBranches: [5, 3, 1], outerStem: "丁", outerBranches: [11, 9, 7] },
} as const;

const STEM_ELEMENT: Record<string, (typeof ELEMENTS)[number]> = {
  甲: "wood", 乙: "wood", 丙: "fire", 丁: "fire", 戊: "earth",
  己: "earth", 庚: "metal", 辛: "metal", 壬: "water", 癸: "water",
};
const BRANCH_ELEMENT: Record<string, (typeof ELEMENTS)[number]> = {
  子: "water", 丑: "earth", 寅: "wood", 卯: "wood", 辰: "earth", 巳: "fire",
  午: "fire", 未: "earth", 申: "metal", 酉: "metal", 戌: "earth", 亥: "water",
};

const trigramSchema = z.object({
  key: z.number().int().min(0).max(7),
  name: z.string().length(1),
  symbol: z.string().length(1),
  element: z.enum(ELEMENTS),
}).strict();

const palaceSchema = z.object({
  name: z.string().length(2),
  element: z.enum(ELEMENTS),
  position: z.enum(["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"]),
}).strict();

const hexagramRefSchema = z.object({
  key: z.number().int().min(0).max(63),
  name: z.string().min(1),
  upper: trigramSchema,
  lower: trigramSchema,
  palace: palaceSchema,
}).strict();

const lineSchema = z.object({
  position: z.number().int().min(1).max(6),
  value: liuyaoLineSchema,
  yinYang: z.enum(["阴", "阳"]),
  moving: z.boolean(),
  changedYinYang: z.enum(["阴", "阳"]),
  stem: z.string().length(1),
  branch: z.string().length(1),
  element: z.enum(ELEMENTS),
  sixRelative: z.enum(SIX_RELATIVES),
  sixSpirit: z.enum(SIX_SPIRITS),
  isShi: z.boolean(),
  isYing: z.boolean(),
  isVoid: z.boolean(),
}).strict();

const contextSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lunar: z.object({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(30),
    isLeapMonth: z.boolean(),
  }).strict(),
  monthBranch: z.string().length(1),
  day: z.object({
    ganZhiIndex: z.number().int().min(0).max(59),
    name: z.string().length(2),
    stem: z.string().length(1),
    branch: z.string().length(1),
  }).strict(),
  xunKong: z.tuple([z.string().length(1), z.string().length(1)]),
}).strict();

export const liuyaoInputSchema = z.object({
  schemaVersion: z.literal(1),
  cast: liuyaoCastSchema,
}).strict();

export const liuyaoCalculationSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.literal("complete"),
  input: liuyaoInputSchema,
  engine: z.object({
    id: z.literal(LIUYAO_ENGINE.id),
    version: z.literal(LIUYAO_ENGINE.version),
    ruleSetId: z.literal(LIUYAO_ENGINE.ruleSetId),
    ruleSetVersion: z.literal(LIUYAO_ENGINE.ruleSetVersion),
    sourceIds: z.array(z.string().min(1)).min(1),
  }).strict(),
  cast: liuyaoCastSchema,
  hexagram: z.object({
    base: hexagramRefSchema,
    changed: hexagramRefSchema,
  }).strict(),
  lines: z.tuple([lineSchema, lineSchema, lineSchema, lineSchema, lineSchema, lineSchema]),
  context: contextSchema,
  warnings: z.array(z.string().min(1)),
  evidence: z.array(evidenceRefSchema).min(1),
  ruleIds: z.array(z.string().min(1)).min(1),
}).strict();

export type LiuyaoInput = z.infer<typeof liuyaoInputSchema>;
export type LiuyaoCalculation = z.infer<typeof liuyaoCalculationSchema>;
export type LiuyaoLineValue = z.infer<typeof liuyaoLineSchema>;

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function trigram(key: number) {
  const item = TRIGRAMS[key];
  if (!item) throw new RangeError(`八卦索引无效：${key}`);
  return {
    key: item.key,
    name: item.name,
    symbol: item.symbol,
    element: item.element,
  };
}

function palaceFor(key: number) {
  for (const palace of PALACE_GROUPS) {
    const index = (palace.keys as readonly number[]).indexOf(key);
    if (index >= 0) {
      return {
        name: palace.name,
        element: palace.element,
        position: palace.positions[index],
      } as const;
    }
  }
  throw new RangeError(`六十四卦未登记八宫归属：${key}`);
}

function hexagram(key: number) {
  const upper = Math.floor(key / 8);
  const lower = key % 8;
  return {
    key,
    name: HEXAGRAM_NAMES[key] ?? `卦${key}`,
    upper: trigram(upper),
    lower: trigram(lower),
    palace: palaceFor(key),
  };
}

function lineElementRelation(palaceElement: (typeof ELEMENTS)[number], lineElement: (typeof ELEMENTS)[number]) {
  if (palaceElement === lineElement) return "兄弟" as const;
  const produces = (from: (typeof ELEMENTS)[number], to: (typeof ELEMENTS)[number]) =>
    modulo(ELEMENTS.indexOf(to) - ELEMENTS.indexOf(from), ELEMENTS.length) === 1;
  const controls = (from: (typeof ELEMENTS)[number], to: (typeof ELEMENTS)[number]) =>
    ({ wood: "earth", fire: "metal", earth: "water", metal: "wood", water: "fire" } as const)[from] === to;
  if (produces(palaceElement, lineElement)) return "子孙" as const;
  if (produces(lineElement, palaceElement)) return "父母" as const;
  if (controls(palaceElement, lineElement)) return "妻财" as const;
  return "官鬼" as const;
}

function sixSpiritFor(dayStemIndex: number, position: number) {
  const start = dayStemIndex <= 1 ? 0 : dayStemIndex <= 3 ? 1 : dayStemIndex === 4 ? 2 : dayStemIndex === 5 ? 3 : dayStemIndex <= 7 ? 4 : 5;
  return SIX_SPIRITS[modulo(start + position - 1, SIX_SPIRITS.length)];
}

function xunKongFor(dayIndex: number): [string, string] {
  const groups = [[10, 11], [8, 9], [6, 7], [4, 5], [2, 3], [0, 1]] as const;
  const pair = groups[Math.floor(dayIndex / 10)];
  return [BRANCHES[pair[0]], BRANCHES[pair[1]]];
}

function naJiaFor(key: number, position: number) {
  const lowerKey = key % 8;
  const upperKey = Math.floor(key / 8);
  const lower = NAIJIA[lowerKey as keyof typeof NAIJIA];
  const upper = NAIJIA[upperKey as keyof typeof NAIJIA];
  if (!lower || !upper) throw new RangeError(`纳甲卦索引无效：${key}`);
  const isInner = position <= 3;
  const index = (position - 1) % 3;
  const stem = isInner ? lower.innerStem : upper.outerStem;
  const branchIndex = isInner ? lower.innerBranches[index] : upper.outerBranches[index];
  const branch = BRANCHES[branchIndex];
  return { stem, branch, element: BRANCH_ELEMENT[branch] };
}

function localCastDate(castAt: string, timeZone: string) {
  return Temporal.Instant.from(castAt).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

function evidence(ruleId: string, sourceId: EvidenceRef["sourceId"], locator: string) {
  return evidenceRefSchema.parse({ ruleId, sourceId, locator });
}

function validateCoinAudit(cast: LiuyaoCast) {
  if (cast.method !== "coins") return;
  const draws = cast.randomAudit?.draws;
  if (!draws) throw new TypeError("三枚硬币起卦缺少 18 次原始投掷记录");
  const lines = Array.from({ length: 6 }, (_, index) =>
    draws.slice(index * 3, index * 3 + 3).reduce((sum, value) => sum + value, 0),
  );
  if (lines.some((value, index) => value !== cast.lines[index])) {
    throw new TypeError("硬币原始记录与爻值不一致，拒绝保存未经复算的卦");
  }
}

function buildContext(cast: LiuyaoCast) {
  const localDate = localCastDate(cast.castAt, cast.timeZone);
  const calendar = resolveHkoCalendarDate({ kind: "solar", date: localDate });
  const almanac = calculateAlmanac({ schemaVersion: 1, solarDate: localDate, timeZoneId: cast.timeZone });
  const dayIndex = sexagenaryDayIndex(localDate);
  const dayStemIndex = dayIndex % 10;
  const dayBranchIndex = dayIndex % 12;
  return {
    localDate,
    lunar: {
      year: calendar.lunarDate.year,
      month: calendar.lunarDate.month,
      day: calendar.lunarDate.day,
      isLeapMonth: calendar.lunarDate.isLeapMonth,
    },
    monthBranch: almanac.jianChu.monthBranch,
    day: {
      ganZhiIndex: dayIndex,
      name: `${STEMS[dayStemIndex]}${BRANCHES[dayBranchIndex]}`,
      stem: STEMS[dayStemIndex],
      branch: BRANCHES[dayBranchIndex],
    },
    xunKong: xunKongFor(dayIndex),
  };
}

export function calculateLiuyao(input: LiuyaoInput): LiuyaoCalculation {
  const normalized = liuyaoInputSchema.parse(input);
  const cast = liuyaoCastSchema.parse(normalized.cast);
  validateCoinAudit(cast);
  const baseKey = cast.lines.reduce((key, value, index) =>
    key | ((value === 7 || value === 9 ? 1 : 0) << index), 0);
  const changedKey = cast.lines.reduce((key, value, index) =>
    key | ((value <= 7 ? 1 : 0) << index), 0);
  const base = hexagram(baseKey);
  const changed = hexagram(changedKey);
  const context = buildContext(cast);
  const dayStemIndex = context.day.ganZhiIndex % 10;
  const shiPosition = [6, 1, 2, 3, 4, 5, 4, 3][
    base.palace.position === "本宫" ? 0 : ["一世", "二世", "三世", "四世", "五世", "游魂", "归魂"].indexOf(base.palace.position) + 1
  ];
  const yingPosition = shiPosition <= 3 ? shiPosition + 3 : shiPosition - 3;
  const lines = cast.lines.map((value, index) => {
    const position = index + 1;
    const naJia = naJiaFor(baseKey, position);
    const moving = value === 6 || value === 9;
    const yinYang = value === 6 || value === 8 ? "阴" : "阳";
    const changedYinYang = value <= 7 ? "阳" : "阴";
    return {
      position,
      value,
      yinYang,
      moving,
      changedYinYang,
      stem: naJia.stem,
      branch: naJia.branch,
      element: naJia.element,
      sixRelative: lineElementRelation(base.palace.element, naJia.element),
      sixSpirit: sixSpiritFor(dayStemIndex, position),
      isShi: position === shiPosition,
      isYing: position === yingPosition,
      isVoid: context.xunKong.includes(naJia.branch),
    };
  }) as LiuyaoCalculation["lines"];
  const warnings = [
    "首版提供可复算的纳甲盘面与基础关系，不替代具体流派的旺衰、用神、伏神和断法判断。",
    "月建取起卦当地时刻对应的节气月支；真太阳时、日界换日和流派差异仍需后续扩展。",
  ];
  const ruleIds = [
    "liuyao.coin-value-v1",
    "liuyao.hexagram-bits-v1",
    "liuyao.najia-v1",
    "liuyao.palace-six-relatives-v1",
    "liuyao.six-spirit-v1",
    "liuyao.xun-kong-v1",
    "liuyao.shi-ying-v1",
    "liuyao.cast-time-context-v1",
  ];
  return liuyaoCalculationSchema.parse({
    schemaVersion: 1,
    status: "complete",
    input: normalized,
    engine: LIUYAO_ENGINE,
    cast,
    hexagram: { base, changed },
    lines,
    context,
    warnings,
    evidence: [
      evidence("liuyao.coin-value-v1", "bushi-zhengzong", "三枚硬币取数：两仪爻值 6、7、8、9；首版保留逐次投掷值"),
      evidence("liuyao.hexagram-bits-v1", "bushi-zhengzong", "六爻自下而上成卦；动爻阴阳翻转为变卦"),
      evidence("liuyao.najia-v1", "huozhulin", "八卦纳甲、纳支与五行对应表"),
      evidence("liuyao.palace-six-relatives-v1", "zengshan-buyi", "八宫卦序与我生、生我、我克、克我六亲关系"),
      evidence("liuyao.six-spirit-v1", "bushi-zhengzong", "按日干安六神，初爻起顺排"),
      evidence("liuyao.xun-kong-v1", "gbt-33661", "干支六十循环与旬空工程推导"),
      evidence("liuyao.shi-ying-v1", "zengshan-buyi", "八宫本宫、一世至五世、游魂、归魂世应位置"),
      evidence("liuyao.cast-time-context-v1", "gbt-33661", "起卦当地日期的农历与干支日上下文"),
    ],
    ruleIds,
  });
}

export function castLiuyaoFromCoins(
  input: Omit<LiuyaoCast, "lines" | "method"> & {
    method: "coins";
    randomAudit: NonNullable<LiuyaoCast["randomAudit"]> & {
      draws: [2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3];
    };
  },
) {
  const lines = Array.from({ length: 6 }, (_, index) =>
    (input.randomAudit.draws.slice(index * 3, index * 3 + 3) as number[]).reduce((sum, value) => sum + value, 0),
  ) as unknown as LiuyaoCast["lines"];
  return calculateLiuyao({ schemaVersion: 1, cast: { ...input, lines } });
}

export const liuyaoLineDisplay = {
  yin: "阴",
  yang: "阳",
  elements: ELEMENT_NAMES,
  stems: STEMS,
  branches: BRANCHES,
} as const;
