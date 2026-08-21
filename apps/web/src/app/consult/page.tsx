import { AlertTriangle, BookOpenText, MessageCircleMore, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { createStoredBaziSnapshot } from "@/server/charts";
import {
  getStoredConsultation,
  listStoredConsultations,
  type StoredConsultation,
} from "@/server/consult";
import { listStoredProfiles, type StoredProfile } from "@/server/profiles";
import { ConsultForm } from "./consult-form";

export const metadata = { title: "咨询" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function ProfileSelector({ profiles, selectedId }: { profiles: StoredProfile[]; selectedId?: string }) {
  return (
    <section className="workspace-panel consult-profile-selector" aria-labelledby="consult-profile-title">
      <div className="section-heading">
        <div><h2 id="consult-profile-title">选择人物档案</h2><p>咨询只会引用该档案当前出生记录生成的快照</p></div>
        <Link className="secondary-button" href="/profiles">管理档案</Link>
      </div>
      <form className="consult-profile-form" method="get">
        <label htmlFor="consult-profile">人物</label>
        <select id="consult-profile" name="profileId" defaultValue={selectedId ?? ""} required>
          <option value="" disabled>请选择</option>
          {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
        </select>
        <button className="secondary-button" type="submit">打开咨询</button>
      </form>
    </section>
  );
}

function MessageView({ message }: { message: StoredConsultation["messages"][number] }) {
  return (
    <li className={`consult-message consult-message-${message.role}`}>
      <div className="consult-message-meta">{message.role === "user" ? "你" : message.role === "assistant" ? "玄枢 AI" : "系统"}</div>
      <div className="consult-message-content">
        <p>{message.content}</p>
        {message.claims.length > 0 ? (
          <details className="consult-claims">
            <summary><BookOpenText aria-hidden="true" size={15} />查看引用的事实</summary>
            <ul>
              {message.claims.map((claim) => (
                <li key={claim.id}>
                  <strong>{claim.certainty}</strong>
                  <span>{claim.text}</span>
                  <small>{claim.evidence.map((item) => item.ruleId).join(" · ")}</small>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </li>
  );
}

function ConversationView({ consultation }: { consultation: StoredConsultation }) {
  return (
    <section className="workspace-panel consult-thread" aria-labelledby="consult-thread-title">
      <div className="section-heading">
        <div><p className="chart-eyebrow">本机会话</p><h2 id="consult-thread-title">{consultation.title}</h2></div>
        <span className="status-badge"><ShieldCheck aria-hidden="true" size={14} /> 本地保存</span>
      </div>
      <ol className="consult-message-list">
        {consultation.messages.map((message) => <MessageView key={message.id} message={message} />)}
      </ol>
    </section>
  );
}

export default async function ConsultPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const profileId = firstParam(params.profileId);
  const consultationId = firstParam(params.consultationId);
  let profiles: StoredProfile[] = [];
  try {
    profiles = listStoredProfiles();
  } catch {
    return <div className="page-frame"><PageHeader title="咨询" description="有证据的解释层" /><section className="profiles-error-state" role="alert"><AlertTriangle aria-hidden="true" size={28} /><h2>无法读取人物档案</h2><p>本地数据库暂时不可用，未对现有数据做任何修改。</p><Link className="secondary-button" href="/consult">重新读取</Link></section></div>;
  }

  if (profiles.length === 0) {
    return <div className="page-frame"><PageHeader title="咨询" description="有证据的解释层" /><section className="empty-workspace" aria-labelledby="consult-empty-title"><MessageCircleMore className="empty-icon" aria-hidden="true" size={30} /><h2 id="consult-empty-title">先建立人物档案</h2><p>咨询必须引用一份可复算的出生记录，避免模型自行猜测盘面。</p><Link className="primary-button" href="/profiles">建立档案</Link></section></div>;
  }

  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
  const summaries = listStoredConsultations(profile.id);
  const selectedSummary = summaries.find((item) => item.id === consultationId) ?? summaries[0];
  const consultation = selectedSummary ? getStoredConsultation(selectedSummary.id) : undefined;
  let snapshotReady = false;
  try {
    snapshotReady = Boolean(createStoredBaziSnapshot(profile.id));
  } catch {
    snapshotReady = false;
  }

  return (
    <div className="page-frame">
      <PageHeader title="咨询" description={`${summaries.length} 个本地会话 · 只解释已验证事实`} />
      <ProfileSelector profiles={profiles} selectedId={profile.id} />
      <div className="consult-layout">
        <section className="workspace-panel consult-ask-panel" aria-labelledby="consult-ask-title">
          <div className="section-heading"><div><h2 id="consult-ask-title">提出问题</h2><p>当前档案：{profile.displayName}</p></div><MessageCircleMore aria-hidden="true" size={19} /></div>
          {snapshotReady ? <ConsultForm profileId={profile.id} /> : <div className="consult-blocked" role="alert"><AlertTriangle aria-hidden="true" size={19} /><p>当前档案无法生成经过校验的八字快照，暂不调用模型。</p><Link className="secondary-button" href={`/charts?profileId=${profile.id}`}>查看命盘</Link></div>}
        </section>
        {summaries.length > 0 ? (
          <section className="workspace-panel consult-history-panel" aria-labelledby="consult-history-title">
            <div className="section-heading"><div><h2 id="consult-history-title">历史会话</h2><p>问题与回答均保存在本机</p></div></div>
            <ul className="consult-history-list">
              {summaries.map((item) => <li key={item.id}><Link data-active={item.id === consultation?.id} href={`/consult?profileId=${profile.id}&consultationId=${item.id}`}><strong>{item.title}</strong><small>{item.messageCount} 条消息 · {item.updatedAt.replace("T", " ").replace("Z", " UTC")}</small></Link></li>)}
            </ul>
          </section>
        ) : null}
        {consultation ? <ConversationView consultation={consultation} /> : <section className="empty-inline consult-empty-inline"><MessageCircleMore aria-hidden="true" size={24} /><div><strong>尚无咨询记录</strong><p>配置模型密钥后，从上方提出第一个问题。</p></div></section>}
      </div>
      <p className="chart-disclaimer">咨询结果用于传统文化研究、娱乐与自我反思参考，不构成科学定论，也不替代医疗、法律、投资或其他专业意见。</p>
    </div>
  );
}
