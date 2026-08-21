"use server";

import { revalidatePath } from "next/cache";
import { deleteAllStoredData, restoreStoredBackup } from "@/server/data";

export type DataActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

const DATA_PATHS = ["/", "/profiles", "/bazi", "/ziwei", "/liuyao", "/consult", "/settings"];

function refreshDataViews() {
  for (const path of DATA_PATHS) revalidatePath(path);
}

export async function restoreBackupAction(
  _previousState: DataActionState,
  formData: FormData,
): Promise<DataActionState> {
  const file = formData.get("backupFile");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "请选择 JSON 备份文件。" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { status: "error", message: "备份文件不能超过 10 MB。" };
  }

  try {
    const input: unknown = JSON.parse(await file.text());
    restoreStoredBackup(input);
  } catch {
    return {
      status: "error",
      message: "备份无效或与当前版本不兼容，现有数据未被修改。",
    };
  }
  try {
    refreshDataViews();
  } catch {
    return { status: "success", message: "本地数据已恢复，请刷新页面查看最新内容。" };
  }
  return { status: "success", message: "本地数据已恢复。" };
}

export async function deleteAllDataAction(
  _previousState: DataActionState,
  _formData: FormData,
): Promise<DataActionState> {
  void _previousState;
  void _formData;
  try {
    deleteAllStoredData();
  } catch {
    return { status: "error", message: "数据清空失败，现有数据未被修改。" };
  }
  try {
    refreshDataViews();
  } catch {
    return { status: "success", message: "本机保存的全部数据已清空，请刷新页面查看最新内容。" };
  }
  return { status: "success", message: "本机保存的全部数据已清空。" };
}
