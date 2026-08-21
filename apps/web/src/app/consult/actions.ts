"use server";

import {
  ConsultationProviderError,
  consultWithModel,
  loadAppConfig,
  routeQuestion,
  resolveApiKey,
  validateConsultationModelResponse,
} from "@xuanshu/agent";
import { calculateAlmanac, claimSchema, type EvidenceRef } from "@xuanshu/domain";
import { revalidatePath } from "next/cache";
import {
  appendStoredMessage,
  buildAlmanacConsultationSystem,
  buildBaziConsultationFacts,
  buildConsultationFacts,
  buildLiuyaoConsultationSystem,
  buildUnavailableConsultationSystem,
  buildZiweiConsultationSystem,
  createStoredConsultation,
} from "@/server/consult";
import { createStoredBaziSnapshot } from "@/server/charts";
import { listStoredLiuyaoCases } from "@/server/liuyao";
import { listStoredProfiles } from "@/server/profiles";
import { createStoredZiweiSnapshot } from "@/server/ziwei";

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

function todayInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function resolveAlmanacDate(question: string, requestedDate: string, timeZone: string) {
  if (requestedDate) return requestedDate;
  const today = todayInTimeZone(timeZone);
  if (question.includes("后天")) return addDays(today, 2);
  if (question.includes("明天")) return addDays(today, 1);
  if (question.includes("今天")) return today;
  return undefined;
}

export async function askConsultationAction(
  _previousState: ConsultActionState,
  formData: FormData,
): Promise<ConsultActionState> {
  const profileId = textField(formData, "profileId");
  const question = textField(formData, "question");
  const requestedAlmanacDate = textField(formData, "almanacDate");
  if (!profileId || profileId.length > 128) {
    return { status: "error", message: "请先选择人物档案。" };
  }
  if (question.length < 2 || question.length > 1_000) {
    return { status: "error", message: "问题长度必须为 2 至 1000 个字符。" };
  }

  try {
    const profile = listStoredProfiles().find((item) => item.id === profileId);
    if (!profile) return { status: "error", message: "人物档案不存在，可能已经被删除。" };
    const route = routeQuestion(question);
    const snapshot = route.systems.includes("bazi")
      ? createStoredBaziSnapshot(profile.id)
      : undefined;
    if (route.systems.includes("bazi") && !snapshot) {
      return { status: "error", message: "当前档案还没有可验证的八字快照。" };
    }

    const systems = snapshot
      ? [buildBaziConsultationFacts(snapshot).systems[0]]
      : [];
    const profileTimeZone = profile.birthRecord.rawInput.location.timeZoneId;
    const ziweiSnapshot = route.systems.includes("ziwei") ? createStoredZiweiSnapshot(profile.id) : undefined;
    const liuyaoCase = route.systems.includes("liuyao") ? listStoredLiuyaoCases(profile.id)[0] : undefined;
    const almanacDate = route.systems.includes("almanac")
      ? resolveAlmanacDate(question, requestedAlmanacDate, profileTimeZone)
      : undefined;
    const almanacResult = almanacDate
      ? calculateAlmanac({ schemaVersion: 1, solarDate: almanacDate, timeZoneId: profileTimeZone })
      : undefined;
    if (route.systems.includes("ziwei")) {
      systems.push(ziweiSnapshot
        ? buildZiweiConsultationSystem(ziweiSnapshot)
        : buildUnavailableConsultationSystem("ziwei", "当前档案没有可用的紫微候选盘"));
    }
    if (route.systems.includes("liuyao")) {
      systems.push(liuyaoCase
        ? buildLiuyaoConsultationSystem(liuyaoCase)
        : buildUnavailableConsultationSystem("liuyao", "当前档案没有已保存的六爻案例"));
    }
    if (route.systems.includes("almanac")) {
      systems.push(almanacResult
        ? buildAlmanacConsultationSystem(almanacResult)
        : buildUnavailableConsultationSystem("almanac", "请在问题中写明今天/明天，或在表单中选择一个黄历日期"));
    }
    const facts = buildConsultationFacts(route, systems);

    const appConfig = await loadAppConfig();
    const apiKey = resolveApiKey(appConfig.config);
    const response = validateConsultationModelResponse(await consultWithModel({
      config: appConfig.config,
      apiKey,
      question,
      facts,
    }), facts);
    const evidenceSources = new Map<string, EvidenceRef>();
    const evidenceOwnerByRuleId = new Map<string, "bazi" | "ziwei" | "almanac" | "liuyao">();
    const addEvidence = (items: EvidenceRef[], owner: "bazi" | "ziwei" | "almanac" | "liuyao") => {
      for (const item of items) {
        evidenceSources.set(item.ruleId, item);
        evidenceOwnerByRuleId.set(item.ruleId, owner);
      }
    };
    addEvidence(snapshot?.payload.chart.evidence ?? [], "bazi");
    addEvidence(ziweiSnapshot?.payload.chart.evidence ?? [], "ziwei");
    addEvidence(liuyaoCase?.calculation.evidence ?? [], "liuyao");
    addEvidence(almanacResult?.evidence ?? [], "almanac");
    const claims = response.claims.map((claim, index) => {
      const evidence = claim.evidenceRuleIds.map((ruleId) => evidenceSources.get(ruleId));
      if (evidence.some((item) => !item)) {
        throw new ConsultationProviderError("模型引用了当前快照之外的规则", "schema");
      }
      const claimSystem = claim.system ?? evidenceOwnerByRuleId.get(claim.evidenceRuleIds[0] ?? "") ?? (route.primarySystem === "synthesis" ? "synthesis" : route.primarySystem);
      return claimSchema.parse({
        id: `model-claim-${index + 1}`,
        text: claim.text,
        system: claimSystem,
        certainty: claim.certainty,
        evidence: evidence as EvidenceRef[],
        appliesTo: claim.appliesTo,
        uncertainty: claim.uncertainty,
      });
    });
    const cautions = [...new Set([...response.cautions, ...route.safety.cautions])];
    const content = cautions.length > 0
      ? `${response.answer}\n\n注意：${cautions.join("；")}`
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
