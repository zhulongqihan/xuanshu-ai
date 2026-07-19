import { rawBirthInputSchema, type RawBirthInput } from "@xuanshu/domain";

export type ProfileFormField =
  | "displayName"
  | "calendarKind"
  | "solarDate"
  | "lunarYear"
  | "lunarMonth"
  | "lunarDay"
  | "birthTime"
  | "beforeMinutes"
  | "afterMinutes"
  | "chartSex"
  | "locationLabel"
  | "timeZoneId"
  | "timeZoneConfirmed"
  | "latitude"
  | "longitude"
  | "trueSolarTime";

export type ProfileFormErrors = Partial<Record<ProfileFormField, string[]>>;

export type ProfileFormResult =
  | {
      success: true;
      data: { displayName: string; birthInput: RawBirthInput };
    }
  | {
      success: false;
      errors: ProfileFormErrors;
    };

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function numberValue(formData: FormData, name: string) {
  const value = textValue(formData, name).trim();
  return value === "" ? Number.NaN : Number(value);
}

function addError(
  errors: ProfileFormErrors,
  field: ProfileFormField,
  message: string,
) {
  const messages = errors[field] ?? [];
  if (!messages.includes(message)) {
    messages.push(message);
  }
  errors[field] = messages;
}

function issueField(path: PropertyKey[]): ProfileFormField {
  const fieldPath = path.map(String).join(".");
  if (fieldPath.startsWith("calendarDate.kind")) return "calendarKind";
  if (fieldPath.startsWith("calendarDate.date")) return "solarDate";
  if (fieldPath.startsWith("calendarDate.year")) return "lunarYear";
  if (fieldPath.startsWith("calendarDate.month")) return "lunarMonth";
  if (fieldPath.startsWith("calendarDate.day")) return "lunarDay";
  if (fieldPath.startsWith("time.beforeMinutes")) return "beforeMinutes";
  if (fieldPath.startsWith("time.afterMinutes")) return "afterMinutes";
  if (fieldPath.startsWith("time")) return "birthTime";
  if (fieldPath.startsWith("chartSex")) return "chartSex";
  if (fieldPath.startsWith("location.label")) return "locationLabel";
  if (fieldPath.startsWith("location.timeZoneId")) return "timeZoneId";
  if (fieldPath.startsWith("location.coordinates.latitude")) return "latitude";
  if (fieldPath.startsWith("location.coordinates.longitude")) return "longitude";
  if (fieldPath.startsWith("location.coordinates")) return "trueSolarTime";
  return "displayName";
}

export function parseProfileFormData(formData: FormData): ProfileFormResult {
  const errors: ProfileFormErrors = {};
  const displayName = textValue(formData, "displayName").trim().normalize("NFC");
  if (displayName.length < 1 || displayName.length > 80) {
    addError(errors, "displayName", "档案名称必须为 1 至 80 个字符");
  }

  const calendarKind = textValue(formData, "calendarKind");
  const timeKind = textValue(formData, "timeKind");
  const trueSolarTime = textValue(formData, "trueSolarTime") === "compare";
  const timeZoneConfirmed = formData.get("timeZoneConfirmed") === "on";
  if (calendarKind !== "solar" && calendarKind !== "lunar") {
    addError(errors, "calendarKind", "请选择公历或农历");
  }
  if (!(["exact", "approximate", "unknown"] as const).includes(
    timeKind as "exact" | "approximate" | "unknown",
  )) {
    addError(errors, "birthTime", "请选择出生时间精度");
  }

  const calendarDate =
    calendarKind === "lunar"
      ? {
          kind: "lunar" as const,
          year: numberValue(formData, "lunarYear"),
          month: numberValue(formData, "lunarMonth"),
          day: numberValue(formData, "lunarDay"),
          isLeapMonth: formData.get("isLeapMonth") === "on",
        }
      : {
          kind: "solar" as const,
          date: textValue(formData, "solarDate"),
        };

  const time =
    timeKind === "unknown"
      ? ({ kind: "unknown" } as const)
      : timeKind === "approximate"
        ? ({
            kind: "approximate",
            value: textValue(formData, "birthTime"),
            beforeMinutes: numberValue(formData, "beforeMinutes"),
            afterMinutes: numberValue(formData, "afterMinutes"),
          } as const)
        : ({
            kind: "exact",
            value: textValue(formData, "birthTime"),
          } as const);

  const candidate = {
    schemaVersion: 1,
    calendarDate,
    time,
    chartSex: textValue(formData, "chartSex"),
    location: {
      label: textValue(formData, "locationLabel"),
      timeZoneId: textValue(formData, "timeZoneId"),
      timeZoneSource: "manual",
      timeZoneConfirmed,
      ...(trueSolarTime
        ? {
            coordinates: {
              latitude: numberValue(formData, "latitude"),
              longitude: numberValue(formData, "longitude"),
            },
          }
        : {}),
    },
    trueSolarTimeMode: trueSolarTime ? "compare" : "civil_only",
  };

  const parsed = rawBirthInputSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      addError(errors, issueField(issue.path), issue.message);
    }
  }
  if (!timeZoneConfirmed) {
    addError(errors, "timeZoneConfirmed", "保存前必须确认出生地时区");
  }

  if (!parsed.success || Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { displayName, birthInput: parsed.data },
  };
}
