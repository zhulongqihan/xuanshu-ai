import { KeyRound, Laptop, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "设置" };

export default function SettingsPage() {
  return (
    <div className="page-frame">
      <PageHeader
        title="设置"
        description="本地运行与模型连接"
        showSettings={false}
      />
      <div className="settings-list">
        <section className="settings-row">
          <Laptop aria-hidden="true" size={21} strokeWidth={1.7} />
          <div>
            <h2>本地数据</h2>
            <p>当前设备 · 尚未初始化数据库</p>
          </div>
          <span className="status-badge">本地</span>
        </section>
        <section className="settings-row">
          <KeyRound aria-hidden="true" size={21} strokeWidth={1.7} />
          <div>
            <h2>模型提供商</h2>
            <p>尚未配置</p>
          </div>
          <button className="secondary-button" type="button" disabled>
            配置
          </button>
        </section>
        <section className="settings-row">
          <ShieldCheck aria-hidden="true" size={21} strokeWidth={1.7} />
          <div>
            <h2>隐私与发送范围</h2>
            <p>默认只发送当前回答所需的脱敏盘面字段</p>
          </div>
          <button className="secondary-button" type="button" disabled>
            查看
          </button>
        </section>
      </div>
    </div>
  );
}
