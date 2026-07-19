import {
  canonicalBirthInputSchema,
  canonicalBirthJson,
  canonicalizeBirthInput,
  hashCanonicalBirthInput,
  normalizeBirth,
  normalizedBirthSchema,
  rawBirthInputSchema,
  type CanonicalBirthInput,
  type NormalizedBirth,
  type RawBirthInput,
} from "@xuanshu/domain";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/core";
import { profileBirthRecords, profiles } from "../db/schema";

export type CreateProfileInput = {
  displayName: unknown;
  birthInput: unknown;
};

export type StoredProfile = {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  birthRecord: {
    id: string;
    revision: number;
    inputHash: string;
    rawInput: RawBirthInput;
    canonicalInput: CanonicalBirthInput;
    normalized: NormalizedBirth;
    createdAt: string;
  };
};

export type ProfileRepositoryOptions = {
  createId?: () => string;
  now?: () => string;
};

export class StoredProfileCorruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoredProfileCorruptionError";
  }
}

function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") {
    throw new TypeError("档案名称必须是文本");
  }
  const displayName = value.trim().normalize("NFC");
  if (displayName.length < 1 || displayName.length > 80) {
    throw new RangeError("档案名称必须为 1 至 80 个字符");
  }
  return displayName;
}

function legacyBirthDate(input: RawBirthInput) {
  if (input.calendarDate.kind === "solar") {
    return input.calendarDate.date;
  }
  const { year, month, day } = input.calendarDate;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function legacyUncertaintyMinutes(input: RawBirthInput) {
  return input.time.kind === "approximate"
    ? Math.max(input.time.beforeMinutes, input.time.afterMinutes)
    : 0;
}

function parseStoredProfile(row: {
  profileId: string;
  displayName: string;
  profileCreatedAt: string;
  profileUpdatedAt: string;
  birthRecordId: string;
  revision: number;
  inputHash: string;
  rawInputJson: string;
  canonicalInputJson: string;
  normalizedJson: string;
  dependenciesJson: string;
  sourceRefsJson: string;
  warningsJson: string;
  inputSchemaVersion: number;
  normalizedSchemaVersion: number;
  normalizerVersion: string;
  birthCreatedAt: string;
}): StoredProfile {
  const rawInput = rawBirthInputSchema.parse(JSON.parse(row.rawInputJson));
  const canonicalInput = canonicalBirthInputSchema.parse(
    JSON.parse(row.canonicalInputJson),
  );
  const normalized = normalizedBirthSchema.parse(JSON.parse(row.normalizedJson));
  const canonicalizedRawInput = canonicalizeBirthInput(rawInput);
  if (
    row.inputSchemaVersion !== rawInput.schemaVersion ||
    row.normalizedSchemaVersion !== normalized.schemaVersion ||
    row.normalizerVersion !== normalized.provenance.normalizer.version ||
    row.inputHash !== normalized.inputHash ||
    row.inputHash !== hashCanonicalBirthInput(canonicalInput) ||
    canonicalBirthJson(canonicalInput) !== canonicalBirthJson(normalized.canonicalInput) ||
    canonicalBirthJson(canonicalizedRawInput) !== canonicalBirthJson(canonicalInput) ||
    row.dependenciesJson !== JSON.stringify(normalized.provenance.dependencies) ||
    row.sourceRefsJson !== JSON.stringify(normalized.provenance.sourceIds) ||
    row.warningsJson !== JSON.stringify(normalized.warnings)
  ) {
    throw new StoredProfileCorruptionError(
      `档案 ${row.profileId} 的出生记录 ${row.birthRecordId} 无法通过复算校验`,
    );
  }

  return {
    id: row.profileId,
    displayName: row.displayName,
    createdAt: row.profileCreatedAt,
    updatedAt: row.profileUpdatedAt,
    birthRecord: {
      id: row.birthRecordId,
      revision: row.revision,
      inputHash: row.inputHash,
      rawInput,
      canonicalInput,
      normalized,
      createdAt: row.birthCreatedAt,
    },
  };
}

export function createProfileRepository(
  db: AppDatabase,
  {
    createId = randomUUID,
    now = () => new Date().toISOString(),
  }: ProfileRepositoryOptions = {},
) {
  const currentProfileQuery = db
    .select({
      profileId: profiles.id,
      displayName: profiles.displayName,
      profileCreatedAt: profiles.createdAt,
      profileUpdatedAt: profiles.updatedAt,
      birthRecordId: profileBirthRecords.id,
      revision: profileBirthRecords.revision,
      inputHash: profileBirthRecords.inputHash,
      rawInputJson: profileBirthRecords.rawInputJson,
      canonicalInputJson: profileBirthRecords.canonicalInputJson,
      normalizedJson: profileBirthRecords.normalizedJson,
      dependenciesJson: profileBirthRecords.dependenciesJson,
      sourceRefsJson: profileBirthRecords.sourceRefsJson,
      warningsJson: profileBirthRecords.warningsJson,
      inputSchemaVersion: profileBirthRecords.inputSchemaVersion,
      normalizedSchemaVersion: profileBirthRecords.normalizedSchemaVersion,
      normalizerVersion: profileBirthRecords.normalizerVersion,
      birthCreatedAt: profileBirthRecords.createdAt,
    })
    .from(profiles)
    .innerJoin(
      profileBirthRecords,
      and(
        eq(profileBirthRecords.profileId, profiles.id),
        eq(profileBirthRecords.isCurrent, true),
      ),
    );

  return {
    create(input: CreateProfileInput) {
      const displayName = normalizeDisplayName(input.displayName);
      const rawInput = rawBirthInputSchema.parse(input.birthInput);
      const createdAt = now();
      const normalized = normalizeBirth(rawInput, { normalizedAt: createdAt });
      const profileId = createId();
      const birthRecordId = createId();
      const coordinates = rawInput.location.coordinates;

      db.transaction((transaction) => {
        transaction
          .insert(profiles)
          .values({
            id: profileId,
            displayName,
            calendarType: rawInput.calendarDate.kind,
            birthDate: legacyBirthDate(rawInput),
            birthTime: rawInput.time.kind === "unknown" ? "unknown" : rawInput.time.value,
            isLeapMonth:
              rawInput.calendarDate.kind === "lunar" &&
              rawInput.calendarDate.isLeapMonth,
            chartSex: rawInput.chartSex,
            locationName: rawInput.location.label,
            latitude: coordinates?.latitude,
            longitude: coordinates?.longitude,
            timeZone: rawInput.location.timeZoneId,
            uncertaintyMinutes: legacyUncertaintyMinutes(rawInput),
            createdAt,
            updatedAt: createdAt,
          })
          .run();
        transaction
          .insert(profileBirthRecords)
          .values({
            id: birthRecordId,
            profileId,
            revision: 1,
            isCurrent: true,
            rawInputJson: JSON.stringify(rawInput),
            canonicalInputJson: JSON.stringify(normalized.canonicalInput),
            inputHash: normalized.inputHash,
            inputSchemaVersion: rawInput.schemaVersion,
            normalizedJson: JSON.stringify(normalized),
            normalizedSchemaVersion: normalized.schemaVersion,
            normalizerVersion: normalized.provenance.normalizer.version,
            dependenciesJson: JSON.stringify(normalized.provenance.dependencies),
            sourceRefsJson: JSON.stringify(normalized.provenance.sourceIds),
            warningsJson: JSON.stringify(normalized.warnings),
            createdAt,
          })
          .run();
      });

      return parseStoredProfile({
        profileId,
        displayName,
        profileCreatedAt: createdAt,
        profileUpdatedAt: createdAt,
        birthRecordId,
        revision: 1,
        inputHash: normalized.inputHash,
        rawInputJson: JSON.stringify(rawInput),
        canonicalInputJson: JSON.stringify(normalized.canonicalInput),
        normalizedJson: JSON.stringify(normalized),
        dependenciesJson: JSON.stringify(normalized.provenance.dependencies),
        sourceRefsJson: JSON.stringify(normalized.provenance.sourceIds),
        warningsJson: JSON.stringify(normalized.warnings),
        inputSchemaVersion: rawInput.schemaVersion,
        normalizedSchemaVersion: normalized.schemaVersion,
        normalizerVersion: normalized.provenance.normalizer.version,
        birthCreatedAt: createdAt,
      });
    },

    list() {
      return currentProfileQuery
        .orderBy(desc(profiles.updatedAt), desc(profiles.id))
        .all()
        .map(parseStoredProfile);
    },

    get(profileId: string) {
      const row = currentProfileQuery.where(eq(profiles.id, profileId)).get();
      return row ? parseStoredProfile(row) : undefined;
    },

    delete(profileId: string) {
      return db.delete(profiles).where(eq(profiles.id, profileId)).run().changes > 0;
    },
  };
}
