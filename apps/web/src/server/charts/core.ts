import {
  baziCalculationSchema,
  baziLuckCalculationSchema,
  baziStrengthCalculationSchema,
  calculateBazi,
  calculateBaziLuck,
  calculateBaziStrength,
  chartSnapshotSchema,
  evidenceRefSchema,
  type BaziCalculation,
  type BaziLuckCalculation,
  type BaziStrengthCalculation,
  type ChartSnapshot,
  type EvidenceRef,
  type NormalizedBirth,
} from "@xuanshu/domain";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/core";
import { chartSnapshots } from "../db/schema";
import type { StoredProfile } from "../profiles/core";

type BaziSnapshotChart = {
  schemaVersion: 2;
  birthRecordId: string;
  bazi: BaziCalculation;
  luck: BaziLuckCalculation;
  strength: BaziStrengthCalculation;
  evidence: EvidenceRef[];
};

type BaziSnapshotPayload = Omit<ChartSnapshot, "chart"> & {
  chart: BaziSnapshotChart;
};

export type StoredBaziSnapshot = {
  id: string;
  profileId: string;
  birthRecordId: string;
  inputHash: string;
  engineVersion: string;
  ruleSetId: string;
  ruleSetVersion: string;
  payload: BaziSnapshotPayload;
  createdAt: string;
};

export type BaziSnapshotRepositoryOptions = {
  createId?: () => string;
  now?: () => string;
};

type SnapshotProfile = Pick<StoredProfile, "id"> & {
  birthRecord: Pick<StoredProfile["birthRecord"], "id" | "inputHash" | "normalized">;
};

const EVIDENCE_BY_RULE: Record<string, Omit<EvidenceRef, "ruleId">> = {
  "bazi.year.lichun-v1": {
    sourceId: "sanming-tonghui",
    locator: "卷二·论太岁；立春为岁首的项目规则释义",
  },
  "bazi.month.jie-v1": {
    sourceId: "sanming-tonghui",
    locator: "卷二·论遁月时；以节定月",
  },
  "bazi.day.gbt-anchor-v1": {
    sourceId: "gbt-33661",
    locator: "第 6.3.2 条；1949-10-01=甲子日锚点",
  },
  "bazi.hour.five-rats-v1": {
    sourceId: "sanming-tonghui",
    locator: "卷二·论遁月时；五鼠遁",
  },
  "bazi.hidden-stems.common-v1": {
    sourceId: "sanming-tonghui",
    locator: "卷二·论人元司事",
  },
  "bazi.ten-gods.element-polarity-v1": {
    sourceId: "yuanhai-ziping",
    locator: "子平法十神生克与阴阳同异规则",
  },
  "bazi.nayin.sixty-cycle-v1": {
    sourceId: "sanming-tonghui",
    locator: "卷二·六十甲子纳音",
  },
  "bazi.growth-stage.v1": {
    sourceId: "sanming-tonghui",
    locator: "卷二·十二长生项目规则表",
  },
  "bazi.luck.direction-year-polarity-v1": {
    sourceId: "sanming-tonghui",
    locator: "卷二·论大运；年干阴阳与男女顺逆",
  },
  "bazi.luck.jie-distance-v1": {
    sourceId: "sanming-tonghui",
    locator: "卷二·论大运；以出生时刻与节气定距离",
  },
  "bazi.luck.three-days-one-year-v1": {
    sourceId: "sanming-tonghui",
    locator: "卷二·论大运；三日折一年",
  },
  "bazi.luck.month-pillar-sequence-v1": {
    sourceId: "sanming-tonghui",
    locator: "卷二·论大运；月柱顺逆排运",
  },
  "bazi.luck.approximate-range-v1": {
    sourceId: "iana-tzdb",
    locator: "已确认 IANA 时区的来源时间窗、夏令时与 fold 候选",
  },
  "bazi.luck.transit-point-v1": {
    sourceId: "iana-tzdb",
    locator: "出生民用本地时间加符号时长后的时区转换",
  },
  "bazi.strength.month-order-v1": {
    sourceId: "ziping-zhenquan",
    locator: "月令与子平旺衰语境",
  },
  "bazi.strength.visible-hidden-count-v1": {
    sourceId: "sanming-tonghui",
    locator: "卷二·论人元司事；透干与藏干基础量",
  },
  "bazi.strength.root-v1": {
    sourceId: "ditiansui",
    locator: "五行气势与根气的项目基础量",
  },
  "bazi.strength.support-ratio-v1": {
    sourceId: "ditiansui",
    locator: "五行生克支持关系的透明工程分级",
  },
};

function evidenceForRules(ruleIds: string[]) {
  return [...new Set(ruleIds)].map((ruleId) => {
    const evidence = EVIDENCE_BY_RULE[ruleId];
    if (!evidence) {
      throw new Error(`八字规则缺少证据映射：${ruleId}`);
    }
    return evidenceRefSchema.parse({ ...evidence, ruleId });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBaziSnapshotPayload(value: unknown): BaziSnapshotPayload {
  const payload = chartSnapshotSchema.parse(value);
  if (!isRecord(payload.chart)) {
    throw new TypeError("八字快照缺少结构化 chart 内容");
  }
  if (
    payload.chart.schemaVersion !== 2 ||
    typeof payload.chart.birthRecordId !== "string" ||
    !Array.isArray(payload.chart.evidence)
  ) {
    throw new TypeError("八字快照 chart 结构无效");
  }
  return {
    ...payload,
    chart: {
      schemaVersion: 2,
      birthRecordId: payload.chart.birthRecordId,
      bazi: baziCalculationSchema.parse(payload.chart.bazi),
      luck: baziLuckCalculationSchema.parse(payload.chart.luck),
      strength: baziStrengthCalculationSchema.parse(payload.chart.strength),
      evidence: payload.chart.evidence.map((item) => evidenceRefSchema.parse(item)),
    },
  };
}

function warningMessages(
  bazi: BaziCalculation,
  luck: BaziLuckCalculation,
  strength: BaziStrengthCalculation,
) {
  return [
    ...bazi.warnings.map((warning) => warning.message),
    ...luck.warnings.map((warning) => warning.message),
    ...strength.warnings.map((warning) => warning.message),
    ...strength.candidates.flatMap((candidate) =>
      candidate.warnings.map((warning) => warning.message),
    ),
  ];
}

function parseStoredSnapshot(row: {
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
}): StoredBaziSnapshot {
  if (row.system !== "bazi" || !row.birthRecordId) {
    throw new Error(`快照 ${row.id} 不是绑定出生记录的八字快照`);
  }
  const payload = parseBaziSnapshotPayload(JSON.parse(row.payloadJson));
  if (
    payload.id !== row.id ||
    payload.inputHash !== row.inputHash ||
    payload.engineVersion !== row.engineVersion ||
    payload.ruleSet.id !== row.ruleSetId ||
    payload.ruleSet.version !== row.ruleSetVersion ||
    payload.createdAt !== row.createdAt ||
    payload.chart.birthRecordId !== row.birthRecordId ||
    payload.chart.bazi.inputHash !== row.inputHash ||
    payload.chart.luck.inputHash !== row.inputHash ||
    payload.chart.strength.inputHash !== row.inputHash ||
    row.warningsJson !== JSON.stringify(payload.warnings)
  ) {
    throw new Error(`八字快照 ${row.id} 的元数据与内容不一致`);
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

function buildPayload(
  id: string,
  profile: SnapshotProfile,
  bazi: BaziCalculation,
  luck: BaziLuckCalculation,
  strength: BaziStrengthCalculation,
  createdAt: string,
) {
  const ruleIds = [...bazi.ruleIds, ...luck.ruleIds, ...strength.ruleIds];
  const warnings = warningMessages(bazi, luck, strength);
  return parseBaziSnapshotPayload({
    id,
    inputHash: profile.birthRecord.inputHash,
    engineVersion: bazi.engine.version,
    ruleSet: {
      system: "bazi",
      id: bazi.engine.ruleSetId,
      version: bazi.engine.ruleSetVersion,
      status: "active",
      sourceIds: [...new Set([
        ...bazi.engine.sourceIds,
        ...luck.engine.sourceIds,
        ...strength.engine.sourceIds,
      ])],
    },
    chart: {
      schemaVersion: 2,
      birthRecordId: profile.birthRecord.id,
      bazi,
      luck,
      strength,
      evidence: evidenceForRules(ruleIds),
    },
    calculationTrace: [
      `birth-record:${profile.birthRecord.id}@${profile.birthRecord.inputHash}`,
      `bazi:${bazi.engine.id}@${bazi.engine.version}`,
      `bazi-candidates:${bazi.candidates.map((candidate) => candidate.id).join(",") || "none"}`,
      `luck:${luck.engine.id}@${luck.engine.version}`,
      `strength:${strength.engine.id}@${strength.engine.version}`,
      ...ruleIds.map((ruleId) => `rule:${ruleId}`),
    ],
    warnings,
    createdAt,
  });
}

export function createBaziSnapshotRepository(
  db: AppDatabase,
  {
    createId = randomUUID,
    now = () => new Date().toISOString(),
  }: BaziSnapshotRepositoryOptions = {},
) {
  const findLatest = (profile: SnapshotProfile, engineVersion: string, ruleSetId: string, ruleSetVersion: string) => {
    const row = db
      .select()
      .from(chartSnapshots)
      .where(and(
        eq(chartSnapshots.profileId, profile.id),
        eq(chartSnapshots.birthRecordId, profile.birthRecord.id),
        eq(chartSnapshots.system, "bazi"),
        eq(chartSnapshots.engineVersion, engineVersion),
        eq(chartSnapshots.ruleSetId, ruleSetId),
        eq(chartSnapshots.ruleSetVersion, ruleSetVersion),
      ))
      .orderBy(desc(chartSnapshots.createdAt), desc(chartSnapshots.id))
      .limit(1)
      .get();
    if (!row) return undefined;
    const rawPayload = JSON.parse(row.payloadJson) as { chart?: { schemaVersion?: unknown } };
    if (rawPayload.chart?.schemaVersion === 1) {
      return undefined;
    }
    return parseStoredSnapshot(row);
  };

  return {
    createOrReuse(profile: SnapshotProfile, options: { cycleCount?: number } = {}) {
      const normalized: NormalizedBirth = profile.birthRecord.normalized;
      if (normalized.inputHash !== profile.birthRecord.inputHash) {
        throw new Error(`档案 ${profile.id} 的出生记录哈希不一致`);
      }
      const bazi = baziCalculationSchema.parse(calculateBazi(normalized));
      const luck = baziLuckCalculationSchema.parse(
        calculateBaziLuck(normalized, bazi, options),
      );
      const strength = baziStrengthCalculationSchema.parse(calculateBaziStrength(bazi));
      const existing = findLatest(
        profile,
        bazi.engine.version,
        bazi.engine.ruleSetId,
        bazi.engine.ruleSetVersion,
      );
      if (existing) {
        return existing;
      }

      const id = createId();
      const createdAt = now();
      const payload = buildPayload(id, profile, bazi, luck, strength, createdAt);
      db.insert(chartSnapshots)
        .values({
          id,
          profileId: profile.id,
          birthRecordId: profile.birthRecord.id,
          system: "bazi",
          inputHash: profile.birthRecord.inputHash,
          engineVersion: bazi.engine.version,
          ruleSetId: bazi.engine.ruleSetId,
          ruleSetVersion: bazi.engine.ruleSetVersion,
          payloadJson: JSON.stringify(payload),
          warningsJson: JSON.stringify(payload.warnings),
          createdAt,
        })
        .run();
      return parseStoredSnapshot({
        id,
        profileId: profile.id,
        birthRecordId: profile.birthRecord.id,
        system: "bazi",
        inputHash: profile.birthRecord.inputHash,
        engineVersion: bazi.engine.version,
        ruleSetId: bazi.engine.ruleSetId,
        ruleSetVersion: bazi.engine.ruleSetVersion,
        payloadJson: JSON.stringify(payload),
        warningsJson: JSON.stringify(payload.warnings),
        createdAt,
      });
    },

    getLatest(profile: SnapshotProfile) {
      const bazi = baziCalculationSchema.parse(calculateBazi(profile.birthRecord.normalized));
      return findLatest(
        profile,
        bazi.engine.version,
        bazi.engine.ruleSetId,
        bazi.engine.ruleSetVersion,
      );
    },
  };
}
