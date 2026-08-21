import { z } from "zod";
import type { AppConfig } from "./config";
import { routeDecisionSchema } from "./router";

const MAX_QUESTION_LENGTH = 1_000;

export const consultationFactsSchema = z
  .object({
    version: z.literal(1),
    route: routeDecisionSchema.optional(),
    systems: z.array(
      z
        .object({
          system: z.enum(["bazi", "almanac", "ziwei", "liuyao"]),
          status: z.string().min(1),
          facts: z.array(z.string().min(1).max(500)).max(80),
          evidenceRuleIds: z.array(z.string().min(1)).max(80),
        })
        .strict(),
    ).min(1).max(4),
  })
  .strict();

export type ConsultationFacts = z.infer<typeof consultationFactsSchema>;

export const consultationModelResponseSchema = z
  .object({
    answer: z.string().trim().min(1).max(4_000),
    claims: z.array(
      z
        .object({
          system: z.enum(["bazi", "ziwei", "almanac", "liuyao", "synthesis"]).optional(),
          text: z.string().trim().min(1).max(2_000),
          certainty: z.enum(["deterministic", "rule_based", "interpretive", "ambiguous"]),
          evidenceRuleIds: z.array(z.string().trim().min(1)).min(1).max(8),
          appliesTo: z.string().trim().min(1).max(300),
          uncertainty: z.array(z.string().trim().min(1).max(500)).max(8),
        })
        .strict(),
    ).max(24),
    cautions: z.array(z.string().trim().min(1).max(500)).max(12),
  })
  .strict();

export type ConsultationModelResponse = z.infer<typeof consultationModelResponseSchema>;

/**
 * Validate the semantic boundary between a model claim and the facts bundle.
 * Zod guarantees the shape; this function guarantees that the model cannot
 * relabel another system's evidence or omit all auditable claims when facts
 * are available.
 */
export function validateConsultationModelResponse(
  response: unknown,
  facts: ConsultationFacts,
): ConsultationModelResponse {
  const parsed = consultationModelResponseSchema.parse(response);
  const ownersByRuleId = new Map<string, ConsultationFacts["systems"][number]["system"]>();
  for (const system of facts.systems) {
    for (const ruleId of system.evidenceRuleIds) {
      ownersByRuleId.set(ruleId, system.system);
    }
  }

  const hasAvailableFacts = facts.systems.some((system) => system.status !== "unavailable");
  if (hasAvailableFacts && parsed.claims.length === 0) {
    throw new ConsultationProviderError("模型没有返回任何可核验的事实引用", "schema");
  }
  if (facts.route?.safety.level === "high_risk" && parsed.cautions.length === 0) {
    throw new ConsultationProviderError("高风险问题缺少安全提醒", "schema");
  }

  for (const claim of parsed.claims) {
    const owners = new Set(
      claim.evidenceRuleIds.map((ruleId) => ownersByRuleId.get(ruleId)).filter(
        (owner): owner is ConsultationFacts["systems"][number]["system"] => Boolean(owner),
      ),
    );
    if (owners.size === 0 || claim.evidenceRuleIds.some((ruleId) => !ownersByRuleId.has(ruleId))) {
      throw new ConsultationProviderError("模型引用了当前 facts 之外的规则", "schema");
    }
    if (claim.system && claim.system !== "synthesis" && !owners.has(claim.system)) {
      throw new ConsultationProviderError("模型将其他术数的证据标记成了当前术数", "schema");
    }
    if (claim.system === "synthesis" && facts.route?.mode !== "synthesis") {
      throw new ConsultationProviderError("单术数问题不能生成综合 claim", "schema");
    }
    if (!claim.system && owners.size > 1 && facts.route?.mode !== "synthesis") {
      throw new ConsultationProviderError("跨术数证据必须明确标记为综合 claim", "schema");
    }
  }

  return parsed;
}

export type ConsultRequest = {
  config: AppConfig;
  apiKey: string;
  question: string;
  facts: ConsultationFacts;
  fetcher?: typeof fetch;
};

export class ConsultationProviderError extends Error {
  readonly kind: "configuration" | "transport" | "provider" | "schema";
  readonly retryable: boolean;

  constructor(
    message: string,
    kind: "configuration" | "transport" | "provider" | "schema",
    retryable = false,
  ) {
    super(message);
    this.name = "ConsultationProviderError";
    this.kind = kind;
    this.retryable = retryable;
  }
}

function trimQuestion(question: string) {
  const normalized = question.trim().normalize("NFC");
  if (normalized.length < 2 || normalized.length > MAX_QUESTION_LENGTH) {
    throw new ConsultationProviderError(
      `问题长度必须为 2 至 ${MAX_QUESTION_LENGTH} 个字符`,
      "configuration",
    );
  }
  return normalized;
}

function schemaForProvider() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string", minLength: 1, maxLength: 4_000 },
      claims: {
        type: "array",
        maxItems: 24,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            system: {
              type: "string",
              enum: ["bazi", "ziwei", "almanac", "liuyao", "synthesis"],
            },
            text: { type: "string", minLength: 1, maxLength: 2_000 },
            certainty: {
              type: "string",
              enum: ["deterministic", "rule_based", "interpretive", "ambiguous"],
            },
            evidenceRuleIds: {
              type: "array",
              minItems: 1,
              maxItems: 8,
              items: { type: "string", minLength: 1 },
            },
            appliesTo: { type: "string", minLength: 1, maxLength: 300 },
            uncertainty: {
              type: "array",
              maxItems: 8,
              items: { type: "string", minLength: 1, maxLength: 500 },
            },
          },
          required: ["text", "certainty", "evidenceRuleIds", "appliesTo", "uncertainty"],
        },
      },
      cautions: {
        type: "array",
        maxItems: 12,
        items: { type: "string", minLength: 1, maxLength: 500 },
      },
    },
    required: ["answer", "claims", "cautions"],
  } as const;
}

const SYSTEM_PROMPT = `你是玄枢 AI 的解释层。你只能解释用户提供的结构化事实，不能重新排盘、补算、猜测或捏造任何规则结果。
先遵守 facts.route 中的 primarySystem、systems、mode 和 safety；status 为 unavailable 的系统不能被补写成已知事实。综合问题必须分别说明各术数的适用范围、共识与冲突，不能把一套术数的结论冒充另一套。
输出必须严格符合给定 JSON Schema。每条 claim 至少引用一个 facts 中已有的 evidenceRuleIds；如果事实不足，明确写入 uncertainty 或 cautions，并说明需要补充什么。
回答定位为传统文化研究、娱乐与自我反思参考，不得对医疗、法律、投资、死亡、犯罪或其他高风险事项作确定性结论，也不得用恐惧或绝对化表达诱导用户。
不要复述出生日期、地点、时区等原始个人信息；只使用 facts 中已脱敏的结果。`;

function endpoint(baseUrl: string, mode: AppConfig["provider"]["api_mode"]) {
  return `${baseUrl}/${mode === "responses" ? "responses" : "chat/completions"}`;
}

function responseBody(
  config: AppConfig,
  question: string,
  facts: ConsultationFacts,
) {
  const userInput = JSON.stringify({ question, facts });
  if (config.provider.api_mode === "responses") {
    return {
      model: config.provider.model,
      store: false,
      input: [
        { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
        { role: "user", content: [{ type: "input_text", text: userInput }] },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "xuanshu_consultation",
          strict: true,
          schema: schemaForProvider(),
        },
      },
      ...(config.provider.reasoning_effort === "none"
        ? {}
        : { reasoning: { effort: config.provider.reasoning_effort } }),
    };
  }

  return {
    model: config.provider.model,
    store: false,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userInput },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "xuanshu_consultation",
        strict: true,
        schema: schemaForProvider(),
      },
    },
    ...(config.provider.reasoning_effort === "none"
      ? {}
      : { reasoning_effort: config.provider.reasoning_effort }),
  };
}

function textFromResponsesPayload(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return undefined;
  for (const item of record.output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const text = (part as Record<string, unknown>).text;
      if (typeof text === "string") return text;
    }
  }
  return undefined;
}

function textFromChatPayload(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return undefined;
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const message = choices[0];
  if (typeof message !== "object" || message === null) return undefined;
  const value = (message as Record<string, unknown>).message;
  if (typeof value !== "object" || value === null) return undefined;
  const content = (value as Record<string, unknown>).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  return content
    .map((part) =>
      typeof part === "object" && part !== null && typeof (part as Record<string, unknown>).text === "string"
        ? (part as Record<string, string>).text
        : "",
    )
    .join("");
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function readError(response: Response) {
  try {
    const body = await response.text();
    return body.slice(0, 500);
  } catch {
    return "无法读取服务商错误信息";
  }
}

export async function consultWithModel({
  config,
  apiKey,
  question,
  facts,
  fetcher = fetch,
}: ConsultRequest): Promise<ConsultationModelResponse> {
  const normalizedQuestion = trimQuestion(question);
  if (!apiKey.trim()) {
    throw new ConsultationProviderError("模型密钥为空", "configuration");
  }
  const parsedFacts = consultationFactsSchema.parse(facts);
  const requestBody = responseBody(config, normalizedQuestion, parsedFacts);
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.provider.max_retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.provider.timeout_ms);
    try {
      const response = await fetcher(endpoint(config.provider.base_url, config.provider.api_mode), {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey.trim()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new ConsultationProviderError(
          `模型服务返回 ${response.status}：${await readError(response)}`,
          "provider",
          isRetryableStatus(response.status),
        );
        lastError = error;
        if (!error.retryable || attempt >= config.provider.max_retries) throw error;
        continue;
      }
      const payload = await response.json();
      const text = config.provider.api_mode === "responses"
        ? textFromResponsesPayload(payload)
        : textFromChatPayload(payload);
      if (!text) {
        throw new ConsultationProviderError("模型响应中没有结构化文本", "schema");
      }
      try {
        return consultationModelResponseSchema.parse(JSON.parse(text));
      } catch {
        throw new ConsultationProviderError("模型响应未通过玄枢 AI 的结构校验", "schema");
      }
    } catch (error) {
      if (error instanceof ConsultationProviderError) {
        lastError = error;
        if (!error.retryable || attempt >= config.provider.max_retries) throw error;
      } else {
        const transportError = new ConsultationProviderError(
          error instanceof Error && error.name === "AbortError"
            ? "模型请求超时"
            : "无法连接模型服务",
          "transport",
          true,
        );
        lastError = transportError;
        if (attempt >= config.provider.max_retries) throw transportError;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ConsultationProviderError("模型请求失败", "transport");
}
