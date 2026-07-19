import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { listStoredProfiles, type StoredProfile } from "@/server/profiles";
import { ProfilesWorkspace } from "./profiles-workspace";
import type { ProfileListItem } from "./types";

export const metadata = { title: "人物档案" };

function calendarLabel(profile: StoredProfile) {
  const input = profile.birthRecord.rawInput.calendarDate;
  if (input.kind === "solar") {
    return `公历 ${input.date}`;
  }
  return `农历 ${input.year}年${input.isLeapMonth ? "闰" : ""}${input.month}月${input.day}日（公历 ${profile.birthRecord.normalized.calendarResolution.solarDate}）`;
}

function timeLabel(profile: StoredProfile) {
  const time = profile.birthRecord.rawInput.time;
  if (time.kind === "unknown") return "时间未知";
  if (time.kind === "approximate") {
    return `约 ${time.value}（前 ${time.beforeMinutes} / 后 ${time.afterMinutes} 分钟）`;
  }
  return time.value;
}

function toListItem(profile: StoredProfile): ProfileListItem {
  const input = profile.birthRecord.rawInput;
  return {
    id: profile.id,
    displayName: profile.displayName,
    calendarLabel: calendarLabel(profile),
    timeLabel: timeLabel(profile),
    chartSexLabel: input.chartSex === "male" ? "男命" : "女命",
    locationLabel: profile.birthRecord.canonicalInput.location.label,
    timeZoneId: profile.birthRecord.canonicalInput.location.timeZoneId,
    comparesTrueSolarTime: input.trueSolarTimeMode === "compare",
    warningCount: profile.birthRecord.normalized.warnings.length,
  };
}

export default async function ProfilesPage() {
  await connection();
  let profiles: ProfileListItem[] = [];
  let loadError = false;
  try {
    profiles = listStoredProfiles().map(toListItem);
  } catch {
    loadError = true;
  }

  return (
    <div className="page-frame">
      <PageHeader title="人物档案" description={`${profiles.length} 个档案`} />
      <ProfilesWorkspace profiles={profiles} loadError={loadError} />
    </div>
  );
}
