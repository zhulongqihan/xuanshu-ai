import { Sparkles } from "lucide-react";
import { EmptyWorkspace } from "@/components/empty-workspace";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "六爻问事" };

export default function LiuyaoPage() {
  return (
    <div className="page-frame">
      <PageHeader title="六爻问事" description="0 条问事记录" />
      <EmptyWorkspace
        icon={Sparkles}
        title="记录一个明确问题"
        message="原始爻值和起卦时间会一并保存。"
        actionLabel="开始问事"
      />
    </div>
  );
}
