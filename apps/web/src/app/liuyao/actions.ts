"use server";

import { Temporal } from "@js-temporal/polyfill";
import {
  calculateLiuyao,
  timeZoneSchema,
  type LiuyaoCast,
} from "@xuanshu/domain";
import { randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  createStoredLiuyaoCase,
} from "@/server/liuyao";
import { listStoredProfiles } from "@/server/profiles";

export type LiuyaoActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  caseId?: string;
};

type CoinDraws = [
  2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3,
  2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3,
  2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3, 2 | 3,
];

function textField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().normalize("NFC") : "";
}

function parseMethod(value: string): LiuyaoCast["method"] | undefined {
  return value === "coins" || value === "manual_lines" || value === "existing_hexagram"
    ? value
    : undefined;
}

function parseLines(formData: FormData): LiuyaoCast["lines"] {
  const values = Array.from({ length: 6 }, (_, index) => {
    const value = Number(textField(formData, `line-${index + 1}`));
    return value === 6 || value === 7 || value === 8 || value === 9 ? value : undefined;
  });
  if (values.some((value) => value === undefined)) {
    throw new TypeError("请为六爻输入 6、7、8 或 9");
  }
  return values as unknown as LiuyaoCast["lines"];
}

function randomCoinDraws(): CoinDraws {
  return Array.from({ length: 18 }, () => randomInt(2, 4) as 2 | 3) as unknown as CoinDraws;
}

function castAtFromForm(value: string, timeZone: string) {
  if (!value) throw new TypeError("请选择起卦时间");
  try {
    return Temporal.PlainDateTime.from(value)
      .toZonedDateTime(timeZone)
      .toInstant()
      .toString({ smallestUnit: "second" });
  } catch {
    throw new TypeError("起卦时间或 IANA 时区无效");
  }
}

export async function createLiuyaoCaseAction(
  _previousState: LiuyaoActionState,
  formData: FormData,
): Promise<LiuyaoActionState> {
  const profileId = textField(formData, "profileId");
  const question = textField(formData, "question");
  const method = parseMethod(textField(formData, "method"));
  const timeZone = textField(formData, "timeZone");
  const requestedLocation = textField(formData, "locationName");
  if (question.length < 2 || question.length > 1_000) {
    return { status: "error", message: "问题长度必须为 2 至 1000 个字符。" };
  }
  if (!method) return { status: "error", message: "请选择有效的起卦方式。" };
  if (profileId.length > 128) return { status: "error", message: "人物档案标识无效。" };
  if (timeZone.length < 1) return { status: "error", message: "请填写有效的 IANA 时区。" };

  try {
    timeZoneSchema.parse(timeZone);
    const profile = profileId ? listStoredProfiles().find((item) => item.id === profileId) : undefined;
    if (profileId && !profile) return { status: "error", message: "人物档案不存在，可能已经被删除。" };
    const locationName = requestedLocation || profile?.birthRecord.rawInput.location.label || "";
    if (locationName.length < 1 || locationName.length > 120) {
      return { status: "error", message: "请填写 1 至 120 个字符的起卦地点。" };
    }
    const castAt = castAtFromForm(textField(formData, "castAt"), timeZone);
    const draws = method === "coins" ? randomCoinDraws() : undefined;
    const lines = method === "coins"
      ? Array.from({ length: 6 }, (_, index) =>
        draws!.slice(index * 3, index * 3 + 3).reduce((sum, value) => sum + value, 0),
      ) as unknown as LiuyaoCast["lines"]
      : parseLines(formData);
    const cast: LiuyaoCast = {
      question,
      method,
      lineOrder: "bottom_to_top",
      lines,
      castAt,
      timeZone,
      locationName,
      ...(draws ? {
        randomAudit: {
          algorithm: "node:crypto.randomInt(2,4)",
          nonce: randomUUID(),
          draws,
        },
      } : {}),
    };
    const calculation = calculateLiuyao({ schemaVersion: 1, cast });
    const stored = createStoredLiuyaoCase(calculation, profileId || undefined);
    revalidatePath("/liuyao");
    revalidatePath("/");
    return { status: "success", message: "六爻案例已保存。", caseId: stored.id };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("时间")) {
      return { status: "error", message: error.message };
    }
    if (error instanceof Error && error.message.includes("六爻")) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "六爻案例未保存，请检查输入后重试。" };
  }
}
