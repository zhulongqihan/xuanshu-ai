import { describe, expect, it, vi } from "vitest";
import { defaultAppConfig } from "../src/config";
import {
  consultationModelResponseSchema,
  consultWithModel,
  ConsultationProviderError,
  validateConsultationModelResponse,
} from "../src/consult";

const facts = {
  version: 1 as const,
  systems: [
    {
      system: "bazi" as const,
      status: "complete",
      facts: ["日主：癸水", "月令：巳火"],
      evidenceRuleIds: ["bazi.day.gbt-anchor-v1", "bazi.strength.month-order-v1"],
    },
  ],
};

function config(overrides: Partial<typeof defaultAppConfig.provider> = {}) {
  return {
    ...defaultAppConfig,
    provider: { ...defaultAppConfig.provider, timeout_ms: 1_000, max_retries: 0, ...overrides },
  };
}

describe("consultation model adapter", () => {
  it("sends Responses API structured output with provider storage disabled", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        output_text: JSON.stringify({
          answer: "事实层显示日主为癸水。",
          claims: [{
            text: "当前结构的日主为癸水。",
            certainty: "deterministic",
            evidenceRuleIds: ["bazi.day.gbt-anchor-v1"],
            appliesTo: "民用时间主候选",
            uncertainty: [],
          }],
          cautions: [],
        }),
      }), { status: 200 }),
    );
    const result = await consultWithModel({
      config: config(),
      apiKey: "secret",
      question: "请解释日主。",
      facts,
      fetcher,
    });
    expect(result).toEqual(expect.objectContaining({ answer: "事实层显示日主为癸水。" }));
    const request = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(request.store).toBe(false);
    expect(request.text.format.type).toBe("json_schema");
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/responses");
  });

  it("supports chat completions and rejects unsupported model output", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "不是 JSON" } }] }), { status: 200 }),
    );
    await expect(consultWithModel({
      config: config({ api_mode: "chat_completions" }),
      apiKey: "secret",
      question: "请解释。",
      facts,
      fetcher,
    })).rejects.toMatchObject({ kind: "schema" });
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("retries transient provider failures only", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        output_text: JSON.stringify({ answer: "已恢复。", claims: [], cautions: [] }),
      }), { status: 200 }));
    const result = await consultWithModel({
      config: config({ max_retries: 1 }),
      apiKey: "secret",
      question: "请解释。",
      facts,
      fetcher,
    });
    expect(result.answer).toBe("已恢复。");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects an empty key and invalid question before network access", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(consultWithModel({ config: config(), apiKey: "", question: "请解释。", facts, fetcher }))
      .rejects.toBeInstanceOf(ConsultationProviderError);
    await expect(consultWithModel({ config: config(), apiKey: "secret", question: "", facts, fetcher }))
      .rejects.toMatchObject({ kind: "configuration" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps the response schema strict", () => {
    expect(() => consultationModelResponseSchema.parse({ answer: "ok", claims: [], cautions: [], extra: true })).toThrow();
  });

  it("rejects a claim that relabels another system's evidence", () => {
    const almanacFacts = {
      version: 1 as const,
      route: {
        version: 1 as const,
        primarySystem: "almanac" as const,
        systems: ["almanac" as const],
        mode: "single" as const,
        matchedTerms: ["黄历"],
        reasons: ["命中黄历术语"],
        safety: { level: "normal" as const, cautions: [] },
      },
      systems: [{
        system: "almanac" as const,
        status: "complete",
        facts: ["日干支：甲子"],
        evidenceRuleIds: ["almanac.day-v1"],
      }],
    };
    expect(() => validateConsultationModelResponse({
      answer: "这是八字事实。",
      claims: [{
        system: "bazi",
        text: "这是八字事实。",
        certainty: "deterministic",
        evidenceRuleIds: ["almanac.day-v1"],
        appliesTo: "当前日期",
        uncertainty: [],
      }],
      cautions: [],
    }, almanacFacts)).toThrow("标记成了当前术数");
  });

  it("requires a safety caution for high-risk questions", () => {
    const highRiskFacts = {
      ...facts,
      route: {
        version: 1 as const,
        primarySystem: "bazi" as const,
        systems: ["bazi" as const],
        mode: "single" as const,
        matchedTerms: ["健康"],
        reasons: ["命中健康术语"],
        safety: { level: "high_risk" as const, cautions: ["请咨询专业人士"] },
      },
    };
    expect(() => validateConsultationModelResponse({
      answer: "只能作传统文化参考。",
      claims: [{
        system: "bazi",
        text: "日主为癸水。",
        certainty: "deterministic",
        evidenceRuleIds: ["bazi.day.gbt-anchor-v1"],
        appliesTo: "当前候选",
        uncertainty: [],
      }],
      cautions: [],
    }, highRiskFacts)).toThrow("安全提醒");
  });
});
