import { claimSchema, type Claim } from "@xuanshu/domain";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/core";
import { consultations, messages } from "../db/schema";

export type StoredConsultationMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  claims: Claim[];
  createdAt: string;
};

export type StoredConsultation = {
  id: string;
  profileId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredConsultationMessage[];
};

export type ConsultationSummary = Omit<StoredConsultation, "messages"> & {
  messageCount: number;
};

export type ConsultationRepositoryOptions = {
  createId?: () => string;
  now?: () => string;
};

export class StoredConsultationCorruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoredConsultationCorruptionError";
  }
}

function normalizeText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") throw new TypeError(`${label}必须是文本`);
  const text = value.trim().normalize("NFC");
  if (text.length < 1 || text.length > maxLength) {
    throw new RangeError(`${label}长度必须为 1 至 ${maxLength} 个字符`);
  }
  return text;
}

function parseClaims(value: string, messageId: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new StoredConsultationCorruptionError(`消息 ${messageId} 的 claims 不是合法 JSON`);
  }
  if (!Array.isArray(parsed)) {
    throw new StoredConsultationCorruptionError(`消息 ${messageId} 的 claims 不是数组`);
  }
  try {
    return parsed.map((claim) => claimSchema.parse(claim));
  } catch {
    throw new StoredConsultationCorruptionError(`消息 ${messageId} 的 claims 未通过结构校验`);
  }
}

export function createConsultationRepository(
  db: AppDatabase,
  {
    createId = randomUUID,
    now = () => new Date().toISOString(),
  }: ConsultationRepositoryOptions = {},
) {
  const parseMessage = (row: typeof messages.$inferSelect): StoredConsultationMessage => ({
    id: row.id,
    role: row.role,
    content: row.content,
    claims: parseClaims(row.claimsJson, row.id),
    createdAt: row.createdAt,
  });

  const parseConsultation = (
    row: typeof consultations.$inferSelect,
    messageRows: typeof messages.$inferSelect[],
  ): StoredConsultation => ({
    id: row.id,
    profileId: row.profileId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    messages: messageRows.sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map(parseMessage),
  });

  const getRow = (id: string) =>
    db.select().from(consultations).where(eq(consultations.id, id)).get();

  const getMessages = (consultationId: string) =>
    db.select().from(messages).where(eq(messages.consultationId, consultationId)).all();

  return {
    create(profileId: string, title: string) {
      const normalizedProfileId = normalizeText(profileId, "档案标识", 128);
      const normalizedTitle = normalizeText(title, "咨询标题", 80);
      const id = createId();
      const createdAt = now();
      db.insert(consultations).values({
        id,
        profileId: normalizedProfileId,
        title: normalizedTitle,
        createdAt,
        updatedAt: createdAt,
      }).run();
      const row = getRow(id);
      if (!row) throw new Error(`咨询创建后无法读取：${id}`);
      return parseConsultation(row, []);
    },

    appendMessage(
      consultationId: string,
      input: { role: "user" | "assistant" | "tool"; content: string; claims?: Claim[] },
    ) {
      const content = normalizeText(input.content, "消息内容", 8_000);
      const claims = (input.claims ?? []).map((claim) => claimSchema.parse(claim));
      const existing = getRow(consultationId);
      if (!existing) return undefined;
      const id = createId();
      const createdAt = now();
      db.transaction((transaction) => {
        transaction.insert(messages).values({
          id,
          consultationId,
          role: input.role,
          content,
          claimsJson: JSON.stringify(claims),
          createdAt,
        }).run();
        transaction.update(consultations).set({ updatedAt: createdAt })
          .where(eq(consultations.id, consultationId)).run();
      });
      const row = getRow(consultationId);
      if (!row) throw new Error(`消息写入后无法读取咨询：${consultationId}`);
      return parseConsultation(row, getMessages(consultationId));
    },

    get(id: string) {
      const row = getRow(id);
      return row ? parseConsultation(row, getMessages(id)) : undefined;
    },

    list(profileId?: string) {
      const rows = profileId
        ? db.select().from(consultations).where(eq(consultations.profileId, profileId))
          .orderBy(desc(consultations.updatedAt), desc(consultations.id)).all()
        : db.select().from(consultations)
          .orderBy(desc(consultations.updatedAt), desc(consultations.id)).all();
      return rows.map((row): ConsultationSummary => ({
        id: row.id,
        profileId: row.profileId,
        title: row.title,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        messageCount: db.select().from(messages).where(eq(messages.consultationId, row.id)).all().length,
      }));
    },

    delete(id: string) {
      return db.delete(consultations).where(eq(consultations.id, id)).run().changes > 0;
    },
  };
}
