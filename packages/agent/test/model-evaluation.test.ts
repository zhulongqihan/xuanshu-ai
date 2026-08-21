import { describe, expect, it } from "vitest";
import { evaluationCases } from "../evaluation/cases";
import { evaluationFactsForQuestion } from "../evaluation/fixtures";
import {
  consultWithModel,
  loadAppConfig,
  resolveApiKey,
  validateConsultationModelResponse,
} from "../src";

const shouldRun = process.env.XUANSHU_RUN_MODEL_EVAL === "1";
const concurrency = 4;

describe.skipIf(!shouldRun)("真实模型 200 问题评测", () => {
  it("passes structured output, evidence ownership, and high-risk caution gates", async () => {
    const { config } = await loadAppConfig();
    const apiKey = resolveApiKey(config);
    const failures: Array<{ id: string; kind: string }> = [];

    for (let index = 0; index < evaluationCases.length; index += concurrency) {
      const batch = evaluationCases.slice(index, index + concurrency);
      const results = await Promise.all(batch.map(async (item) => {
        try {
          const facts = evaluationFactsForQuestion(item.question);
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
