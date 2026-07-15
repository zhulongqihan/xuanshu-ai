import { BookOpenText } from "lucide-react";
import { EmptyWorkspace } from "@/components/empty-workspace";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "规则与来源" };

export default function SourcesPage() {
  return (
    <div className="page-frame">
      <PageHeader title="规则与来源" description="可追溯的计算与解释依据" />
      <EmptyWorkspace
        icon={BookOpenText}
        title="规则索引尚未载入"
        message="已采纳的资料基线保存在项目文档中。"
        actionLabel="查看规则"
      />
    </div>
  );
}
