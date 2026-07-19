import type { ProfileFormErrors } from "./form-schema";

export type ProfileListItem = {
  id: string;
  displayName: string;
  calendarLabel: string;
  timeLabel: string;
  chartSexLabel: string;
  locationLabel: string;
  timeZoneId: string;
  comparesTrueSolarTime: boolean;
  warningCount: number;
};

export type CreateProfileState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: ProfileFormErrors;
  operationId?: string;
};

export type DeleteProfileState = {
  status: "idle" | "error" | "success";
  message?: string;
};
