"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createStoredProfile, deleteStoredProfile } from "@/server/profiles";
import { parseProfileFormData } from "./form-schema";
import type { CreateProfileState, DeleteProfileState } from "./types";

export async function createProfileAction(
  _previousState: CreateProfileState,
  formData: FormData,
): Promise<CreateProfileState> {
  const parsed = parseProfileFormData(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "请检查标出的出生资料。",
      errors: parsed.errors,
    };
  }

  try {
    createStoredProfile(parsed.data);
    revalidatePath("/profiles");
    revalidatePath("/");
    return {
      status: "success",
      message: "人物档案已保存在本机。",
      operationId: randomUUID(),
    };
  } catch {
    return {
      status: "error",
      message: "档案无法保存。请核对日期、时区和经纬度后重试。",
    };
  }
}

export async function deleteProfileAction(
  profileId: string,
  _previousState: DeleteProfileState,
  _formData: FormData,
): Promise<DeleteProfileState> {
  void _previousState;
  void _formData;
  if (profileId.length < 1 || profileId.length > 128) {
    return { status: "error", message: "档案标识无效。" };
  }

  try {
    if (!deleteStoredProfile(profileId)) {
      return { status: "error", message: "档案已不存在。" };
    }
    revalidatePath("/profiles");
    revalidatePath("/");
    return { status: "success", message: "档案及关联数据已删除。" };
  } catch {
    return { status: "error", message: "暂时无法删除档案，请稍后重试。" };
  }
}
