import {
  chartSnapshotSchema,
  evidenceRefSchema,
  calculateZiwei,
  ziweiCalculationSchema,
  type EvidenceRef,
  type NormalizedBirth,
  type ZiweiCalculation,
} from "@xuanshu/domain";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/core";
import { chartSnapshots } from "../db/schema";
import type { StoredProfile } from "../profiles/core";

type ZiweiSnapshotChart = {
  schemaVersion: 1;
  birthRecordId: string;
  ziwei: ZiweiCalculation;
  evidence: EvidenceRef[];
};

type ZiweiSnapshotPayload = Omit<import("@xuanshu/domain").ChartSnapshot, "chart"> & {
  chart: ZiweiSnapshotChart;
};

export type StoredZiweiSnapshot = {
  id: string;
  profileId: string;
  birthRecordId: string;
  inputHash: string;
  engineVersion: string;
  ruleSetId: string;
  ruleSetVersion: string;
  payload: ZiweiSnapshotPayload;
  createdAt: string;
};

type SnapshotProfile = Pick<StoredProfile, "id"> & {
  birthRecord: Pick<StoredProfile["birthRecord"], "id" | "inputHash" | "normalized">;
};

export type ZiweiSnapshotRepositoryOptions = {
  createId?: () => string;
  now?: () => string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePayload(value: unknown): ZiweiSnapshotPayload {
  const payload = chartSnapshotSchema.parse(value);
  if (!isRecord(payload.chart) || payload.chart.schemaVersion !== 1 || typeof payload.chart.birthRecordId !== "string" || !Array.isArray(payload.chart.evidence)) {
    throw new TypeError("紫微快照 chart 结构无效");
  }
  return {
    ...payload,
    chart: {
      schemaVersion: 1,
      birthRecordId: payload.chart.birthRecordId,
      ziwei: ziweiCalculationSchema.parse(payload.chart.ziwei),
      evidence: payload.chart.evidence.map((item) => evidenceRefSchema.parse(item)),
    },
  };
}

function parseStored(row: {
  id: string;
  profileId: string;
  birthRecordId: string | null;
  system: "bazi" | "ziwei" | "almanac";
  inputHash: string;
  engineVersion: string;
  ruleSetId: string;
  ruleSetVersion: string;
  payloadJson: string;
  warningsJson: string;
  createdAt: string;
}): StoredZiweiSnapshot {
  if (row.system !== "ziwei" || !row.birthRecordId) throw new Error(`快照 ${row.id} 不是绑定出生记录的紫微快照`);
  const payload = parsePayload(JSON.parse(row.payloadJson));
  if (
    payload.id !== row.id ||
    payload.inputHash !== row.inputHash ||
    payload.engineVersion !== row.engineVersion ||
    payload.ruleSet.id !== row.ruleSetId ||
    payload.ruleSet.version !== row.ruleSetVersion ||
    payload.createdAt !== row.createdAt ||
    payload.chart.birthRecordId !== row.birthRecordId ||
    payload.chart.ziwei.inputHash !== row.inputHash ||
    row.warningsJson !== JSON.stringify(payload.warnings)
  ) {
    throw new Error(`紫微快照 ${row.id} 的元数据与内容不一致`);
  }
  return {
    id: row.id,
    profileId: row.profileId,
    birthRecordId: row.birthRecordId,
    inputHash: row.inputHash,
    engineVersion: row.engineVersion,
    ruleSetId: row.ruleSetId,
    ruleSetVersion: row.ruleSetVersion,
    payload,
    createdAt: row.createdAt,
  };
}

function warningMessages(ziwei: ZiweiCalculation) {
  return [...ziwei.warnings, ...ziwei.candidates.flatMap((candidate) => candidate.warnings)];
}

function buildPayload(
  id: string,
  profile: SnapshotProfile,
  ziwei: ZiweiCalculation,
  createdAt: string,
) {
  const warnings = warningMessages(ziwei);
  const ruleIds = ziwei.ruleIds;
  return parsePayload({
    id,
    inputHash: profile.birthRecord.inputHash,
    engineVersion: ziwei.engine.version,
    ruleSet: {
      system: "ziwei",
      id: ziwei.engine.ruleSetId,
      version: ziwei.engine.ruleSetVersion,
      status: "active",
      sourceIds: ziwei.engine.sourceIds,
    },
    chart: {
      schemaVersion: 1,
      birthRecordId: profile.birthRecord.id,
      ziwei,
      evidence: ziwei.evidence,
    },
    calculationTrace: [
      `birth-record:${profile.birthRecord.id}@${profile.birthRecord.inputHash}`,
      `ziwei:${ziwei.engine.id}@${ziwei.engine.version}`,
      ...ruleIds.map((ruleId) => `rule:${ruleId}`),
    ],
    warnings,
    createdAt,
  });
}

export function createZiweiSnapshotRepository(
  db: AppDatabase,
  { createId = randomUUID, now = () => new Date().toISOString() }: ZiweiSnapshotRepositoryOptions = {},
) {
  const findLatest = (profile: SnapshotProfile, ziwei: ZiweiCalculation) => {
    const rows = db.select().from(chartSnapshots).where(and(
      eq(chartSnapshots.profileId, profile.id),
      eq(chartSnapshots.birthRecordId, profile.birthRecord.id),
      eq(chartSnapshots.system, "ziwei"),
    )).orderBy(desc(chartSnapshots.createdAt), desc(chartSnapshots.id)).all();
    for (const row of rows) {
      const parsed = parseStored(row);
      if (
        parsed.engineVersion === ziwei.engine.version &&
        parsed.ruleSetId === ziwei.engine.ruleSetId &&
        parsed.ruleSetVersion === ziwei.engine.ruleSetVersion
      ) return parsed;
    }
    return undefined;
  };

  return {
    createOrReuse(profile: SnapshotProfile) {
      const normalized: NormalizedBirth = profile.birthRecord.normalized;
      if (normalized.inputHash !== profile.birthRecord.inputHash) throw new Error(`档案 ${profile.id} 的出生记录哈希不一致`);
      const ziwei = ziweiCalculationSchema.parse(calculateZiwei({ schemaVersion: 1, normalized }));
      const existing = findLatest(profile, ziwei);
      if (existing) return existing;
      const id = createId();
      const createdAt = now();
      const payload = buildPayload(id, profile, ziwei, createdAt);
      db.insert(chartSnapshots).values({
        id,
        profileId: profile.id,
        birthRecordId: profile.birthRecord.id,
        system: "ziwei",
        inputHash: profile.birthRecord.inputHash,
        engineVersion: ziwei.engine.version,
        ruleSetId: ziwei.engine.ruleSetId,
        ruleSetVersion: ziwei.engine.ruleSetVersion,
        payloadJson: JSON.stringify(payload),
        warningsJson: JSON.stringify(payload.warnings),
        createdAt,
      }).run();
      return parseStored({
        id,
        profileId: profile.id,
        birthRecordId: profile.birthRecord.id,
        system: "ziwei",
        inputHash: profile.birthRecord.inputHash,
        engineVersion: ziwei.engine.version,
        ruleSetId: ziwei.engine.ruleSetId,
        ruleSetVersion: ziwei.engine.ruleSetVersion,
        payloadJson: JSON.stringify(payload),
        warningsJson: JSON.stringify(payload.warnings),
        createdAt,
      });
    },

    getLatest(profile: SnapshotProfile) {
      const ziwei = ziweiCalculationSchema.parse(calculateZiwei({ schemaVersion: 1, normalized: profile.birthRecord.normalized }));
      return findLatest(profile, ziwei);
    },
  };
}
