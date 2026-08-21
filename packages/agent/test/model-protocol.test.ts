import { describe, expect, it, vi } from "vitest";
import { evaluationCases } from "../evaluation/cases";
import {
  consultWithModel,
  defaultAppConfig,
  validateConsultationModelResponse,
} from "../src";
import {
  evaluationFactsForQuestion,
  evaluationResponseForFacts,
} from "../evaluation/fixtures";

describe("200 条评测集的模型协议 dry-run", () => {
  it("runs every case through the adapter and semantic validator without a network key", async () => {
    for (const item of evaluationCases) {
      const facts = evaluationFactsForQuestion(item.question);
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
        output_text: JSON.stringify(evaluationResponseForFacts(facts)),
      }), { status: 200 }));
      const response = await consultWithModel({
        config: {
          ...defaultAppConfig,
          provider: { ...defaultAppConfig.provider, max_retries: 0 },
        },
        apiKey: "dry-run-key",
        question: item.question,
        facts,
        fetcher,
      });
      expect(validateConsultationModelResponse(response, facts)).toEqual(response);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
});
