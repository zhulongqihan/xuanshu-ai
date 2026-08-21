import { exportStoredBackup } from "@/server/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const backup = exportStoredBackup();
    const date = backup.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="xuanshu-ai-backup-${date}.json"`,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch {
    return Response.json(
      { error: "本地数据暂时无法导出，请稍后重试。" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
