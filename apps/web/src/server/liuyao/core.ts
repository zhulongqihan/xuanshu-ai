import {
  liuyaoCalculationSchema,
  liuyaoCastSchema,
  type LiuyaoCalculation,
} from "@xuanshu/domain";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/core";
import { liuyaoCases } from "../db/schema";

export type CreateLiuyaoCaseInput = {
  profileId?: string;
  calculation: LiuyaoCalculation;
};

export type StoredLiuyaoCase = {
  id: string;
  profileId?: string;
  question: string;
  method: LiuyaoCalculation["cast"]["method"];
  cast: LiuyaoCalculation["cast"];
  calculation: LiuyaoCalculation;
  createdAt: string;
};

export type LiuyaoCaseRepositoryOptions = {
  createId?: () => string;
  now?: () => string;
};

export class StoredLiuyaoCaseCorruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoredLiuyaoCaseCorruptionError";
  }
}

function parseStoredCase(row: {
  id: string;
  profileId: string | null;
  question: string;
  method: "coins" | "manual_lines" | "existing_hexagram";
  linesJson: string;
  auditJson: string | null;
  castAt: string;
  timeZone: string;
  locationName: string;
  createdAt: string;
}): StoredLiuyaoCase {
  if (!row.auditJson) {
    throw new StoredLiuyaoCaseCorruptionError(`六爻案例 ${row.id} 缺少可复算审计内容`);
  }
  const calculation = liuyaoCalculationSchema.parse(JSON.parse(row.auditJson));
  const cast = liuyaoCastSchema.parse(calculation.cast);
  if (
    cast.question !== row.question ||
    cast.method !== row.method ||
    JSON.stringify(cast.lines) !== row.linesJson ||
    cast.castAt !== row.castAt ||
    cast.timeZone !== row.timeZone ||
    cast.locationName !== row.locationName
  ) {
    throw new StoredLiuyaoCaseCorruptionError(`六爻案例 ${row.id} 的表字段与审计内容不一致`);
  }
  return {
    id: row.id,
    profileId: row.profileId ?? undefined,
    question: cast.question,
    method: cast.method,
    cast,
    calculation,
    createdAt: row.createdAt,
  };
}

export function createLiuyaoCaseRepository(
  db: AppDatabase,
  {
    createId = randomUUID,
    now = () => new Date().toISOString(),
  }: LiuyaoCaseRepositoryOptions = {},
) {
  const parseRows = (rows: Array<{
    id: string;
    profileId: string | null;
    question: string;
    method: "coins" | "manual_lines" | "existing_hexagram";
    linesJson: string;
    auditJson: string | null;
    castAt: string;
    timeZone: string;
    locationName: string;
    createdAt: string;
  }>) => rows.map(parseStoredCase);

  return {
    create(input: CreateLiuyaoCaseInput) {
      const calculation = liuyaoCalculationSchema.parse(input.calculation);
      const profileId = input.profileId?.trim() || null;
      const id = createId();
      const createdAt = now();
      db.insert(liuyaoCases)
        .values({
          id,
          profileId,
          question: calculation.cast.question,
          method: calculation.cast.method,
          linesJson: JSON.stringify(calculation.cast.lines),
          auditJson: JSON.stringify(calculation),
          castAt: calculation.cast.castAt,
          timeZone: calculation.cast.timeZone,
          locationName: calculation.cast.locationName,
          createdAt,
        })
        .run();
      return parseStoredCase({
        id,
        profileId,
        question: calculation.cast.question,
        method: calculation.cast.method,
        linesJson: JSON.stringify(calculation.cast.lines),
        auditJson: JSON.stringify(calculation),
        castAt: calculation.cast.castAt,
        timeZone: calculation.cast.timeZone,
        locationName: calculation.cast.locationName,
        createdAt,
      });
    },

    list(profileId?: string) {
      const query = db
        .select()
        .from(liuyaoCases)
        .orderBy(desc(liuyaoCases.createdAt), desc(liuyaoCases.id));
      const rows = profileId
        ? query.where(eq(liuyaoCases.profileId, profileId)).all()
        : query.all();
      return parseRows(rows);
    },

    get(id: string) {
      const row = db
        .select()
        .from(liuyaoCases)
        .where(eq(liuyaoCases.id, id))
        .get();
      return row ? parseStoredCase(row) : undefined;
    },

  };
}
