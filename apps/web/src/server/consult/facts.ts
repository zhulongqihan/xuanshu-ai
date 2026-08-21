import {
  consultationFactsSchema,
  type ConsultationFacts,
} from "@xuanshu/agent";
import type { StoredBaziSnapshot } from "../charts/core";

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
