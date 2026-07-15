import { MessageCircleMore } from "lucide-react";
import { EmptyWorkspace } from "@/components/empty-workspace";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "咨询" };

export default function ConsultPage() {
  return (
    <div className="page-frame">
      <PageHeader title="咨询" description="0 个本地会话" />
      <EmptyWorkspace
        icon={MessageCircleMore}
        title="尚无咨询记录"
        message="模型只会收到回答当前问题所需的数据。"
        actionLabel="新建咨询"
      />
    </div>
  );
}
