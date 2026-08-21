import { describe, expect, it } from "vitest";
import { evaluationCases } from "../evaluation/cases";
import {
  consultationFactsSchema,
  consultWithModel,
  loadAppConfig,
  resolveApiKey,
  routeQuestion,
  validateConsultationModelResponse,
} from "../src";

const shouldRun = process.env.XUANSHU_RUN_MODEL_EVAL === "1";
const concurrency = 4;

const fixtureFacts = {
  bazi: "确定性评测事实：日主为癸水。",
  ziwei: "确定性评测事实：命宫主星为紫微。",
  almanac: "确定性评测事实：日干支为甲子。",
  liuyao: "确定性评测事实：本卦为乾。",
} as const;

function factsFor(question: string) {
  const route = routeQuestion(question);
  return consultationFactsSchema.parse({
    version: 1,
    route,
    systems: route.systems.map((system) => ({
      system,
      status: "complete",
      facts: [fixtureFacts[system]],
      evidenceRuleIds: [`evaluation.${system}.fixture-v1`],
    })),
  });
}

describe.skipIf(!shouldRun)("真实模型 200 问题评测", () => {
  it("passes structured output, evidence ownership, and high-risk caution gates", async () => {
    const { config } = await loadAppConfig();
    const apiKey = resolveApiKey(config);
    const failures: Array<{ id: string; kind: string }> = [];

    for (let index = 0; index < evaluationCases.length; index += concurrency) {
      const batch = evaluationCases.slice(index, index + concurrency);
      const results = await Promise.all(batch.map(async (item) => {
        try {
          const facts = factsFor(item.question);
          const response = await consultWithModel({
            config,
            apiKey,
            question: item.question,
            facts,
          });
          validateConsultationModelResponse(response, facts);
          return { id: item.id };
        } catch (error) {
          const kind = typeof error === "object" && error !== null && "kind" in error
            ? String((error as { kind: unknown }).kind)
            : error instanceof Error ? error.name : "unknown";
          return { id: item.id, kind };
        }
      }));
      failures.push(...results.filter((result): result is { id: string; kind: string } => "kind" in result));
    }

    expect(failures).toEqual([]);
  }, 45 * 60 * 1_000);
});
