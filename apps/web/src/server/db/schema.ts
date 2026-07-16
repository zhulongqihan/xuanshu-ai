import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const chartSnapshots = sqliteTable("chart_snapshots", {
  id: text("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  system: text("system", { enum: ["bazi", "ziwei", "almanac"] }).notNull(),
  inputHash: text("input_hash").notNull(),
  engineVersion: text("engine_version").notNull(),
  ruleSetId: text("rule_set_id").notNull(),
  ruleSetVersion: text("rule_set_version").notNull(),
  payloadJson: text("payload_json").notNull(),
  warningsJson: text("warnings_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
});

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
  profileId: text("profile_id").references(() => profiles.id, { onDelete: "set null" }),
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
