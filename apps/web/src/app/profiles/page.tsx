import { CircleUserRound } from "lucide-react";
import { EmptyWorkspace } from "@/components/empty-workspace";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "人物档案" };

export default function ProfilesPage() {
  return (
    <div className="page-frame">
      <PageHeader title="人物档案" description="0 个档案" />
      <EmptyWorkspace
        icon={CircleUserRound}
        title="尚无人物档案"
        message="出生信息只保存在当前设备。"
        actionLabel="新建档案"
      />
    </div>
  );
}
