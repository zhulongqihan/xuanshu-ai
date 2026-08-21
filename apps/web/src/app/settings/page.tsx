import { KeyRound, Laptop, ShieldCheck } from "lucide-react";
import { loadAppConfig } from "@xuanshu/agent";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { readDatabaseStatus } from "@/server/db";
import { DataManagement } from "./data-management";

export const metadata = { title: "设置" };

export default async function SettingsPage() {
  await connection();
  const [database, modelConfig] = await Promise.all([
    readDatabaseStatus(),
    loadAppConfig(),
  ]);

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
            <p>{database.path}</p>
          </div>
          <span className="status-badge">本地</span>
        </section>
        <section className="settings-row">
          <KeyRound aria-hidden="true" size={21} strokeWidth={1.7} />
          <div>
            <h2>模型提供商</h2>
            <p>
              {modelConfig.source === "file"
                ? `${modelConfig.config.provider.model} · ${modelConfig.config.provider.api_mode}`
                : `默认配置 · ${modelConfig.config.provider.model}`}
            </p>
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
      <DataManagement />
    </div>
  );
}
