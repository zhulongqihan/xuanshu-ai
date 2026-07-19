import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  calendarType: text("calendar_type", { enum: ["solar", "lunar"] }).notNull(),
  birthDate: text("birth_date").notNull(),
  birthTime: text("birth_time").notNull(),
  isLeapMonth: integer("is_leap_month", { mode: "boolean" }).notNull().default(false),
  chartSex: text("chart_sex", { enum: ["male", "female"] }).notNull(),
  locationName: text("location_name").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  timeZone: text("time_zone").notNull(),
  uncertaintyMinutes: integer("uncertainty_minutes").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const profileBirthRecords = sqliteTable(
  "profile_birth_records",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    isCurrent: integer("is_current", { mode: "boolean" }).notNull(),
    rawInputJson: text("raw_input_json").notNull(),
    canonicalInputJson: text("canonical_input_json").notNull(),
    inputHash: text("input_hash").notNull(),
    inputSchemaVersion: integer("input_schema_version").notNull(),
    normalizedJson: text("normalized_json").notNull(),
    normalizedSchemaVersion: integer("normalized_schema_version").notNull(),
    normalizerVersion: text("normalizer_version").notNull(),
    dependenciesJson: text("dependencies_json").notNull(),
    sourceRefsJson: text("source_refs_json").notNull(),
    warningsJson: text("warnings_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("profile_birth_records_profile_revision_unique").on(
      table.profileId,
      table.revision,
    ),
    uniqueIndex("profile_birth_records_profile_hash_unique").on(
      table.profileId,
      table.inputHash,
    ),
    uniqueIndex("profile_birth_records_one_current_unique")
      .on(table.profileId)
      .where(sql`${table.isCurrent} = 1`),
    index("profile_birth_records_profile_idx").on(table.profileId),
    check("profile_birth_records_revision_check", sql`${table.revision} >= 1`),
    check(
      "profile_birth_records_hash_check",
      sql`length(${table.inputHash}) = 64 AND ${table.inputHash} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check("profile_birth_records_raw_json_check", sql`json_valid(${table.rawInputJson})`),
    check(
      "profile_birth_records_canonical_json_check",
      sql`json_valid(${table.canonicalInputJson})`,
    ),
    check(
      "profile_birth_records_normalized_json_check",
      sql`json_valid(${table.normalizedJson})`,
    ),
    check(
      "profile_birth_records_dependencies_json_check",
      sql`json_valid(${table.dependenciesJson})`,
    ),
    check(
      "profile_birth_records_sources_json_check",
      sql`json_valid(${table.sourceRefsJson})`,
    ),
    check(
      "profile_birth_records_warnings_json_check",
      sql`json_valid(${table.warningsJson})`,
    ),
  ],
);

export const chartSnapshots = sqliteTable(
  "chart_snapshots",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    birthRecordId: text("birth_record_id").references(() => profileBirthRecords.id, {
      onDelete: "cascade",
    }),
    system: text("system", { enum: ["bazi", "ziwei", "almanac"] }).notNull(),
    inputHash: text("input_hash").notNull(),
    engineVersion: text("engine_version").notNull(),
    ruleSetId: text("rule_set_id").notNull(),
    ruleSetVersion: text("rule_set_version").notNull(),
    payloadJson: text("payload_json").notNull(),
    warningsJson: text("warnings_json").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("chart_snapshots_profile_idx").on(table.profileId),
    index("chart_snapshots_birth_record_idx").on(table.birthRecordId),
  ],
);

export const consultations = sqliteTable("consultations", {
  id: text("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  consultationId: text("consultation_id")
    .notNull()
    .references(() => consultations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "tool"] }).notNull(),
  content: text("content").notNull(),
  claimsJson: text("claims_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
});

export const liuyaoCases = sqliteTable("liuyao_cases", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  method: text("method", {
    enum: ["coins", "manual_lines", "existing_hexagram"],
  }).notNull(),
  linesJson: text("lines_json").notNull(),
  auditJson: text("audit_json"),
  castAt: text("cast_at").notNull(),
  timeZone: text("time_zone").notNull(),
  locationName: text("location_name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const appMetadata = sqliteTable("app_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
