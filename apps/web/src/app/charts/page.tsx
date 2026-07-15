import { ChartNoAxesCombined } from "lucide-react";
import { EmptyWorkspace } from "@/components/empty-workspace";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "命盘" };

export default function ChartsPage() {
  return (
    <div className="page-frame">
      <PageHeader title="命盘" description="八字与紫微斗数" />
      <EmptyWorkspace
        icon={ChartNoAxesCombined}
        title="请先选择人物档案"
        message="命盘会记录输入、规则版本和计算依据。"
        actionLabel="选择档案"
      />
    </div>
  );
}
