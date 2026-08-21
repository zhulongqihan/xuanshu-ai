import { z } from "zod";

const ROUTABLE_SYSTEMS = ["bazi", "ziwei", "almanac", "liuyao"] as const;

const KEYWORD_GROUPS = [
  {
    system: "bazi",
    terms: ["八字", "四柱", "日主", "日元", "十神", "大运", "流年", "旺衰", "藏干", "出生盘"],
  },
  {
    system: "ziwei",
    terms: ["紫微", "斗数", "命宫", "身宫", "夫妻宫", "官禄宫", "四化", "星曜", "大限"],
  },
  {
    system: "almanac",
    terms: ["黄历", "择日", "通胜", "今天", "明天", "后天", "日期", "日子", "出行", "搬家", "搬迁", "签约", "祭祀"],
  },
  {
    system: "liuyao",
    terms: ["六爻", "起卦", "本卦", "变卦", "动爻", "世应", "纳甲", "六神", "旬空", "爻值"],
  },
] as const;

const HIGH_RISK_TERMS = [
  "健康", "身体", "疾病", "诊断", "治疗", "怀孕", "生育", "死亡", "寿命", "自杀",
  "犯罪", "违法", "诉讼", "法律", "投资", "股票", "基金", "借贷", "理财", "赌博",
] as const;

export const routeDecisionSchema = z.object({
  version: z.literal(1),
  primarySystem: z.enum(["bazi", "ziwei", "almanac", "liuyao", "synthesis"]),
  systems: z.array(z.enum(ROUTABLE_SYSTEMS)).min(1).max(4),
  mode: z.enum(["single", "synthesis"]),
  matchedTerms: z.array(z.string().min(1)).max(24),
  reasons: z.array(z.string().min(1).max(300)).min(1).max(8),
  safety: z.object({
    level: z.enum(["normal", "high_risk"]),
    cautions: z.array(z.string().min(1).max(500)).max(8),
  }).strict(),
}).strict();

export type RouteDecision = z.infer<typeof routeDecisionSchema>;

function normalizedQuestion(question: string) {
  const normalized = question.trim().normalize("NFC");
  if (normalized.length < 2 || normalized.length > 1_000) {
    throw new RangeError("问题长度必须为 2 至 1000 个字符");
  }
  return normalized;
}

export function routeQuestion(question: string): RouteDecision {
  const normalized = normalizedQuestion(question);
  const matched = KEYWORD_GROUPS
    .map((group) => ({
      system: group.system,
      terms: group.terms.filter((term) => normalized.includes(term)),
    }))
    .filter((group) => group.terms.length > 0);
  const systems = matched.map((group) => group.system);
  const matchedTerms = matched.flatMap((group) => group.terms);
  const asksForSynthesis = /综合|结合|比较|分别看看|多个方面|四术/.test(normalized);
  const mode = systems.length > 1 || asksForSynthesis ? "synthesis" : "single";
  const primarySystem = mode === "synthesis" ? "synthesis" : systems[0] ?? "synthesis";
  const highRisk = HIGH_RISK_TERMS.filter((term) => normalized.includes(term));
  const reasons = systems.length > 0
    ? matched.map((group) => `命中${group.system}术语：${group.terms.join("、")}`)
    : ["未命中特定术语，保留为综合入口并要求模型先说明资料范围"];
  if (mode === "synthesis" && systems.length > 1) {
    reasons.push(`问题同时涉及 ${systems.join("、")}，需要分术取事实后再合并解释`);
  } else if (asksForSynthesis) {
    reasons.push("用户明确要求综合或比较，不能只用单一术数代替其他事实");
  }
  return routeDecisionSchema.parse({
    version: 1,
    primarySystem,
    systems: systems.length > 0 ? systems : ROUTABLE_SYSTEMS.slice(0, 1),
    mode,
    matchedTerms,
    reasons,
    safety: {
      level: highRisk.length > 0 ? "high_risk" : "normal",
      cautions: highRisk.length > 0
        ? [`问题包含高风险主题：${highRisk.join("、")}。只能提供传统文化层面的克制参考，必须建议用户咨询相应专业人士。`]
        : [],
    },
  });
}
