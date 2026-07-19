import { PageHeader } from "@/components/page-header";

export default function ProfilesLoading() {
  return (
    <div className="page-frame" aria-busy="true" aria-label="正在读取人物档案">
      <PageHeader title="人物档案" description="正在读取本机数据" />
      <div className="profiles-loading-toolbar" />
      <div className="profiles-loading-panel">
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}
