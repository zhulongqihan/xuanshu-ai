import { CalendarDays } from "lucide-react";
import { EmptyWorkspace } from "@/components/empty-workspace";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "择日" };

export default function AlmanacPage() {
  return (
    <div className="page-frame">
      <PageHeader title="择日" description="老黄历与个人冲合" />
      <EmptyWorkspace
        icon={CalendarDays}
        title="尚无择日任务"
        message="选择事项和候选日期后再进行比较。"
        actionLabel="新建择日"
      />
    </div>
  );
}
