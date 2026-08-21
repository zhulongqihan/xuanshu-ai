import { consultationFactsSchema, type ConsultationFacts } from "../src/consult";
import { routeQuestion } from "../src/router";

const FIXTURE_FACTS = {
  bazi: "确定性评测事实：日主为癸水。",
  ziwei: "确定性评测事实：命宫主星为紫微。",
  almanac: "确定性评测事实：日干支为甲子。",
  liuyao: "确定性评测事实：本卦为乾。",
} as const;

export function evaluationFactsForQuestion(question: string): ConsultationFacts {
  const route = routeQuestion(question);
  return consultationFactsSchema.parse({
    version: 1,
    route,
    systems: route.systems.map((system) => ({
      system,
      status: "complete",
      facts: [FIXTURE_FACTS[system]],
      evidenceRuleIds: [`evaluation.${system}.fixture-v1`],
    })),
  });
}

export function evaluationResponseForFacts(facts: ConsultationFacts) {
  const highRisk = facts.route?.safety.level === "high_risk";
  return {
    answer: "这是协议级本地模拟回答，仅用于验证结构和证据边界。",
    claims: facts.systems.map((system) => ({
      system: system.system,
      text: system.facts[0] ?? "当前资料已进入 facts。",
      certainty: highRisk ? "ambiguous" as const : "deterministic" as const,
      evidenceRuleIds: system.evidenceRuleIds,
      appliesTo: "协议级评测 fixture",
      uncertainty: highRisk ? ["不能据此对高风险主题作确定性判断"] : [],
    })),
    cautions: highRisk ? ["仅作传统文化研究参考，请咨询相应专业人士"] : [],
  };
}
