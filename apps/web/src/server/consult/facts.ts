import {
  consultationFactsSchema,
  type RouteDecision,
  type ConsultationFacts,
} from "@xuanshu/agent";
import type { AlmanacCalculation } from "@xuanshu/domain";
import type { StoredBaziSnapshot } from "../charts/core";
import type { StoredLiuyaoCase } from "../liuyao/core";
import type { StoredZiweiSnapshot } from "../ziwei/core";

const ELEMENT_LABELS = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
} as const;

const RELATION_LABELS = {
  same: "同类",
  resource: "生扶",
  drain: "泄",
  wealth: "财",
  officer: "官杀",
} as const;

const SUPPORT_LABELS = {
  supportive: "支持较多",
  balanced: "支持与其他接近",
  less_supported: "支持较少",
} as const;

function candidateFacts(
  snapshot: StoredBaziSnapshot,
  candidate: StoredBaziSnapshot["payload"]["chart"]["bazi"]["candidates"][number],
) {
  const strength = snapshot.payload.chart.strength.candidates.find(
    (item) => item.baziCandidateId === candidate.id,
  );
  const luck = snapshot.payload.chart.luck.candidates.find(
    (item) => item.baziCandidateId === candidate.id,
  );
  const pillarNames = [candidate.pillars.year, candidate.pillars.month, candidate.pillars.day, candidate.pillars.hour]
    .map((pillar) => pillar?.name ?? "未知");
  const facts = [
    `候选类型：${candidate.timeBasis === "civil" ? "民用时间" : "真太阳时"} · ${candidate.timePrecision}`,
    `四柱：${pillarNames.join(" / ")}`,
    `日柱：${candidate.pillars.day.name} · 日主 ${candidate.pillars.day.stem.name}${ELEMENT_LABELS[candidate.pillars.day.stem.element]}`,
  ];
  if (strength) {
    facts.push(
      `月令关系：${strength.monthContext.branchName}${ELEMENT_LABELS[strength.monthContext.element]} · ${RELATION_LABELS[strength.monthContext.relationToDayMaster]}`,
      `根气：${strength.root.isRooted ? `有根（${strength.root.branchNames.join("、")}）` : "未检出同元素藏干根"}`,
      `支持比例：${Math.round(strength.support.supportRatio * 100)}% · ${SUPPORT_LABELS[strength.support.level]}`,
    );
  }
  if (luck) {
    const first = luck.cycles[0];
    if (first) facts.push(`首步大运：${first.name} · ${luck.direction === "forward" ? "顺排" : "逆排"}`);
    facts.push(`大运起运：${luck.startAge ? "单点可用" : luck.startAgeRange ? "范围可用" : "不可用"}`);
  }
  return facts;
}

export function buildBaziConsultationFacts(snapshot: StoredBaziSnapshot): ConsultationFacts {
  const chart = snapshot.payload.chart;
  const evidenceRuleIds = chart.evidence.map((item) => item.ruleId);
  return consultationFactsSchema.parse({
    version: 1,
    systems: [{
      system: "bazi",
      status: chart.bazi.status,
      facts: chart.bazi.candidates.flatMap((candidate) => candidateFacts(snapshot, candidate)),
      evidenceRuleIds,
    }],
  });
}

export function buildZiweiConsultationSystem(snapshot: StoredZiweiSnapshot): ConsultationFacts["systems"][number] {
  const chart = snapshot.payload.chart.ziwei;
  const candidate = chart.candidates[0];
  if (!candidate) {
    return {
      system: "ziwei",
      status: chart.status,
      facts: [...chart.warnings, "当前紫微记录没有可用候选盘"],
      evidenceRuleIds: chart.evidence.map((item) => item.ruleId),
    };
  }
  const palaceFacts = candidate.palaces.map((palace) => {
    const stars = palace.majorStars.map((star) => star.name).join("、") || "无主星记录";
    return `${palace.name}：${stars}${palace.isBodyPalace ? " · 身宫" : ""}${palace.isOriginalPalace ? " · 命宫" : ""}`;
  });
  return {
    system: "ziwei",
    status: chart.status,
    facts: [
      `历法日期：${candidate.chineseDate}`,
      `命宫地支：${candidate.earthlyBranchOfSoulPalace} · 身宫地支：${candidate.earthlyBranchOfBodyPalace}`,
      `命主：${candidate.soul} · 身主：${candidate.body} · 五行局：${candidate.fiveElementsClass}`,
      ...palaceFacts,
      ...candidate.warnings,
    ],
    evidenceRuleIds: chart.evidence.map((item) => item.ruleId),
  };
}

export function buildLiuyaoConsultationSystem(item: StoredLiuyaoCase): ConsultationFacts["systems"][number] {
  const calculation = item.calculation;
  return {
    system: "liuyao",
    status: calculation.status,
    facts: [
      `本卦：${calculation.hexagram.base.name} · ${calculation.hexagram.base.palace.name}`,
      `变卦：${calculation.hexagram.changed.name} · ${calculation.hexagram.changed.palace.name}`,
      `起卦日期：${calculation.context.localDate} · ${calculation.context.day.name}`,
      `月建：${calculation.context.monthBranch} · 旬空：${calculation.context.xunKong.join("、")}`,
      ...calculation.lines.map((line) => `${line.position}爻：${line.stem}${line.branch} · ${line.sixRelative} · ${line.sixSpirit}${line.moving ? " · 动" : ""}${line.isShi ? " · 世" : ""}${line.isYing ? " · 应" : ""}${line.isVoid ? " · 空" : ""}`),
      ...calculation.warnings,
    ],
    evidenceRuleIds: calculation.evidence.map((item) => item.ruleId),
  };
}

export function buildAlmanacConsultationSystem(result: AlmanacCalculation): ConsultationFacts["systems"][number] {
  return {
    system: "almanac",
    status: result.status,
    facts: [
      `公历：${result.input.solarDate} · 时区 ${result.input.timeZoneId}`,
      `农历：${result.lunar.year}年${result.lunar.isLeapMonth ? "闰" : ""}${result.lunar.month}月${result.lunar.day}日`,
      `日干支：${result.day.name} · 建除：${result.jianChu.name}`,
      `日支：${result.day.branch.name} · 冲支：${result.clash.clashBranch}`,
      ...result.activities.map((activity) => `${activity.label}：${activity.status} · ${activity.message}`),
    ],
    evidenceRuleIds: result.evidence.map((item) => item.ruleId),
  };
}

export function buildUnavailableConsultationSystem(
  system: ConsultationFacts["systems"][number]["system"],
  message: string,
): ConsultationFacts["systems"][number] {
  return { system, status: "unavailable", facts: [message], evidenceRuleIds: [] };
}

export function buildConsultationFacts(
  route: RouteDecision,
  systems: ConsultationFacts["systems"],
): ConsultationFacts {
  const routedSystems = new Set(route.systems);
  if (systems.some((item) => !routedSystems.has(item.system))) {
    throw new TypeError("咨询 facts 包含路由未声明的术数系统");
  }
  const unique = systems.filter((item, index, all) => all.findIndex((candidate) => candidate.system === item.system) === index);
  return consultationFactsSchema.parse({ version: 1, route, systems: unique });
}
