"use server";

import {
  ConsultationProviderError,
  consultWithModel,
  consultationModelResponseSchema,
  loadAppConfig,
  resolveApiKey,
} from "@xuanshu/agent";
import { claimSchema } from "@xuanshu/domain";
import { revalidatePath } from "next/cache";
import {
  appendStoredMessage,
  buildBaziConsultationFacts,
  createStoredConsultation,
} from "@/server/consult";
import { createStoredBaziSnapshot } from "@/server/charts";
import { listStoredProfiles } from "@/server/profiles";

export type ConsultActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  consultationId?: string;
};

function textField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().normalize("NFC") : "";
}

function errorMessage(error: unknown) {
  if (error instanceof ConsultationProviderError) {
    if (error.kind === "configuration") return error.message;
    if (error.kind === "schema") return "模型返回的解释未通过证据结构校验，请重试。";
    if (error.kind === "transport") return "暂时无法连接模型服务，请检查网络或稍后重试。";
    return "模型服务暂时不可用，请稍后重试。";
  }
  if (error instanceof Error && error.message.startsWith("缺少环境变量")) {
    return `${error.message}。请在本机配置模型密钥后重试。`;
  }
  return "咨询未完成，系统没有保存未经校验的模型回答。";
}

export async function askConsultationAction(
  _previousState: ConsultActionState,
  formData: FormData,
): Promise<ConsultActionState> {
  const profileId = textField(formData, "profileId");
  const question = textField(formData, "question");
  if (!profileId || profileId.length > 128) {
    return { status: "error", message: "请先选择人物档案。" };
  }
  if (question.length < 2 || question.length > 1_000) {
    return { status: "error", message: "问题长度必须为 2 至 1000 个字符。" };
  }

  try {
    const profile = listStoredProfiles().find((item) => item.id === profileId);
    if (!profile) return { status: "error", message: "人物档案不存在，可能已经被删除。" };
    const snapshot = createStoredBaziSnapshot(profile.id);
    if (!snapshot) return { status: "error", message: "当前档案还没有可验证的八字快照。" };

    const appConfig = await loadAppConfig();
    const apiKey = resolveApiKey(appConfig.config);
    const response = consultationModelResponseSchema.parse(await consultWithModel({
      config: appConfig.config,
      apiKey,
      question,
      facts: buildBaziConsultationFacts(snapshot),
    }));
    const evidenceByRuleId = new Map(snapshot.payload.chart.evidence.map((item) => [item.ruleId, item]));
    const claims = response.claims.map((claim, index) => {
      const evidence = claim.evidenceRuleIds.map((ruleId) => evidenceByRuleId.get(ruleId));
      if (evidence.some((item) => !item)) {
        throw new ConsultationProviderError("模型引用了当前快照之外的规则", "schema");
      }
      return claimSchema.parse({
        id: `model-claim-${index + 1}`,
        text: claim.text,
        system: "bazi",
        certainty: claim.certainty,
        evidence,
        appliesTo: claim.appliesTo,
        uncertainty: claim.uncertainty,
      });
    });
    const content = response.cautions.length > 0
      ? `${response.answer}\n\n注意：${response.cautions.join("；")}`
      : response.answer;
    const consultation = createStoredConsultation(profile.id, question.slice(0, 80));
    appendStoredMessage(consultation.id, { role: "user", content: question });
    appendStoredMessage(consultation.id, { role: "assistant", content, claims });
    revalidatePath("/consult");
    revalidatePath("/");
    return { status: "success", message: "咨询已完成。", consultationId: consultation.id };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}
