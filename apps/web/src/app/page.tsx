import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  CircleUserRound,
  MessageCircleMore,
  Sparkles,
} from "lucide-react";
import { loadAppConfig } from "@xuanshu/agent";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { listStoredProfiles } from "@/server/profiles";

const workbenchItems = [
  {
    href: "/profiles",
    label: "建立人物档案",
    meta: "出生时间与地点",
    icon: CircleUserRound,
  },
  {
    href: "/charts",
    label: "查看综合命盘",
    meta: "八字与紫微",
    icon: ChartNoAxesCombined,
  },
  {
    href: "/almanac",
    label: "比较候选日期",
    meta: "黄历与个人冲合",
    icon: CalendarDays,
  },
  {
    href: "/liuyao",
    label: "记录一次问事",
    meta: "六爻原始卦象",
    icon: Sparkles,
  },
];

const systems = [
  ["八字", "已接入 · 子平规则 1.0.0"],
  ["紫微斗数", "已接入 · 三合基础盘 1.0.0"],
  ["老黄历", "已接入 · 协纪辨方书 1.1.0"],
  ["六爻", "已接入 · 文王卦 1.0.0"],
] as const;

export default async function Home() {
  await connection();
  const now = new Date();
  let profileCount = 0;
  let modelConfigured = false;
  try {
    profileCount = listStoredProfiles().length;
  } catch {
    // The health and settings surfaces expose database failures in detail.
  }
  try {
    const modelConfig = await loadAppConfig();
    modelConfigured = Boolean(
      process.env[modelConfig.config.provider.api_key_env]?.trim(),
    );
  } catch {
    // The settings surface exposes configuration failures in detail.
  }
  const dateLabel = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);

  return (
    <div className="page-frame">
      <PageHeader title="今日" dateLabel={dateLabel} />

      <section className="today-band" aria-label="当前状态">
        <div>
          <span className="today-band-label">历法</span>
          <strong>离线历法已就绪</strong>
        </div>
        <div>
          <span className="today-band-label">人物档案</span>
          <strong>{profileCount > 0 ? `${profileCount} 个档案` : "尚未建立"}</strong>
        </div>
        <div>
          <span className="today-band-label">模型</span>
          <strong>{modelConfigured ? "模型已配置" : "尚未配置"}</strong>
        </div>
        <Link className="text-link" href="/settings">
          检查设置
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </section>

      <div className="dashboard-layout">
        <section className="workspace-panel" aria-labelledby="start-title">
          <div className="section-heading">
            <div>
              <h2 id="start-title">开始</h2>
              <p>选择当前要处理的事情</p>
            </div>
          </div>
          <div className="workbench-list">
            {workbenchItems.map(({ href, label, meta, icon: Icon }) => (
              <Link className="workbench-row" href={href} key={href}>
                <Icon aria-hidden="true" size={20} strokeWidth={1.7} />
                <span>
                  <strong>{label}</strong>
                  <small>{meta}</small>
                </span>
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
            ))}
          </div>
        </section>

        <section className="workspace-panel" aria-labelledby="systems-title">
          <div className="section-heading">
            <div>
              <h2 id="systems-title">四术状态</h2>
              <p>计算模块与规则版本</p>
            </div>
          </div>
          <dl className="system-list">
            {systems.map(([name, status]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>
                  <span className="ready-dot" aria-hidden="true" />
                  {status}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="workspace-panel consultation-panel" aria-labelledby="consult-title">
          <div className="section-heading">
            <div>
              <h2 id="consult-title">最近咨询</h2>
              <p>本机保存的对话</p>
            </div>
            <Link className="text-link" href="/consult">
              全部
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          <div className="empty-inline">
            <MessageCircleMore aria-hidden="true" size={24} strokeWidth={1.6} />
            <div>
              <strong>尚无咨询记录</strong>
              <p>配置模型并建立人物档案后即可开始。</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
