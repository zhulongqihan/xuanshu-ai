import { AlertTriangle, ArrowRight, BookOpenText, CheckCircle2, Star } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { listStoredProfiles, type StoredProfile } from "@/server/profiles";
import { createStoredZiweiSnapshot, type StoredZiweiSnapshot } from "@/server/ziwei";

export const metadata = { title: "紫微斗数" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function ProfileSelector({ profiles, selectedId }: { profiles: StoredProfile[]; selectedId?: string }) {
  return (
    <section className="workspace-panel chart-profile-selector" aria-labelledby="ziwei-profile-selector-title">
      <div className="section-heading">
        <div><h2 id="ziwei-profile-selector-title">选择人物档案</h2><p>紫微单独读取当前出生 revision，不与八字快照混合。</p></div>
        <Link className="secondary-button" href="/profiles">管理档案</Link>
      </div>
      {profiles.length > 0 ? (
        <ul className="chart-profile-list">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <Link className="chart-profile-option" data-selected={profile.id === selectedId} href={`/ziwei?profileId=${profile.id}`}>
                <span><strong>{profile.displayName}</strong><small>revision {profile.birthRecord.revision} · {profile.birthRecord.rawInput.time.kind === "unknown" ? "出生时辰未知" : "有时刻记录"}</small></span>
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
            </li>
          ))}
        </ul>
      ) : <div className="empty-inline"><Star aria-hidden="true" size={22} /><span><strong>还没有人物档案</strong><p>先保存出生资料，再生成紫微事实层。</p></span></div>}
    </section>
  );
}

function Stars({ stars }: { stars: StoredZiweiSnapshot["payload"]["chart"]["ziwei"]["candidates"][number]["palaces"][number]["majorStars"] }) {
  return stars.length > 0 ? <ul className="ziwei-star-list">{stars.map((star) => <li key={`${star.name}-${star.type}-${star.scope}`}><strong>{star.name}</strong>{star.brightness ? <small>{star.brightness}</small> : null}{star.mutagen ? <small>{star.mutagen}</small> : null}</li>)}</ul> : <span className="ziwei-empty-stars">—</span>;
}

function ZiweiView({ snapshot }: { snapshot: StoredZiweiSnapshot }) {
  const { ziwei, evidence } = snapshot.payload.chart;
  const candidate = ziwei.candidates[0];
  const warnings = [...ziwei.warnings, ...ziwei.candidates.flatMap((item) => item.warnings)];
  return (
    <div className="ziwei-view">
      <section className="workspace-panel ziwei-context" aria-labelledby="ziwei-context-title">
        <div className="section-heading"><div><p className="chart-eyebrow">三合基础盘 · {candidate ? "事实层" : "不可用"}</p><h2 id="ziwei-context-title">紫微斗数</h2></div><span className="status-badge">{candidate ? <><CheckCircle2 aria-hidden="true" size={14} /> {ziwei.status === "complete" ? "已计算" : "部分可用"}</> : <><AlertTriangle aria-hidden="true" size={14} /> 无时辰</>}</span></div>
        {candidate ? <dl className="chart-fact-list ziwei-facts"><div><dt>农历 / 干支</dt><dd>{candidate.lunarDate} · {candidate.chineseDate}</dd></div><div><dt>命宫 / 身宫</dt><dd>{candidate.earthlyBranchOfSoulPalace} / {candidate.earthlyBranchOfBodyPalace}</dd></div><div><dt>命主 / 身主</dt><dd>{candidate.soul} / {candidate.body}</dd></div><div><dt>五行局</dt><dd>{candidate.fiveElementsClass}</dd></div><div><dt>时间候选</dt><dd>{candidate.timeBasis} · {candidate.timePrecision} · {candidate.localDateTime.replace("T", " ")}</dd></div></dl> : <div className="consult-blocked" role="alert"><AlertTriangle aria-hidden="true" size={19} /><p>{ziwei.warnings[0] ?? "当前记录无法生成紫微盘。"}</p><Link className="secondary-button" href="/profiles">修订档案</Link></div>}
      </section>
      {warnings.length > 0 ? <section className="chart-warning-panel" aria-labelledby="ziwei-warning-title"><div className="section-heading"><div><h2 id="ziwei-warning-title">需要留意</h2><p>候选和规则边界不会被压成单一确定结论</p></div></div><ul className="chart-warning-list">{warnings.map((warning, index) => <li key={`${warning}-${index}`}><AlertTriangle aria-hidden="true" size={16} />{warning}</li>)}</ul></section> : null}
      {candidate ? <section className="workspace-panel ziwei-palace-panel" aria-labelledby="ziwei-palace-title"><div className="section-heading"><div><h2 id="ziwei-palace-title">十二宫</h2><p>展示排盘事实，不在此处生成格局或事件断语；大限区间随宫位保留。</p></div></div><ul className="ziwei-palace-grid">{candidate.palaces.map((palace) => <li key={palace.index} className={palace.isBodyPalace ? "ziwei-palace-card ziwei-body-palace" : "ziwei-palace-card"}><div className="ziwei-palace-heading"><div><h3>{palace.name}</h3><small>{palace.heavenlyStem}{palace.earthlyBranch}</small></div>{palace.isBodyPalace ? <span>身宫</span> : palace.isOriginalPalace ? <span>命宫</span> : null}</div><div className="ziwei-star-group"><small>主星</small><Stars stars={palace.majorStars} /></div><div className="ziwei-star-group"><small>辅星</small><Stars stars={palace.minorStars} /></div><div className="ziwei-star-group"><small>大限</small><p>{palace.decadal.range[0]}–{palace.decadal.range[1]} 岁 · {palace.decadal.heavenlyStem}{palace.decadal.earthlyBranch}</p></div></li>)}</ul></section> : null}
      <section className="workspace-panel chart-evidence-panel" aria-labelledby="ziwei-evidence-title"><div className="section-heading"><div><h2 id="ziwei-evidence-title">规则与来源</h2><p>紫微排盘版本、配置和适配器来源均保留在快照中。</p></div><BookOpenText aria-hidden="true" size={19} /></div><ul className="evidence-list">{evidence.map((item) => <li key={item.ruleId}><strong>{item.ruleId}</strong><span>{item.sourceId}</span><small>{item.locator}</small></li>)}</ul><details className="chart-trace-details"><summary>查看计算轨迹</summary><ul>{snapshot.payload.calculationTrace.map((item) => <li key={item}>{item}</li>)}</ul></details></section>
      <p className="chart-disclaimer">紫微结果用于传统文化研究、娱乐与自我反思参考，不构成科学定论；本页只展示排盘事实，不替代医疗、法律、投资或其他专业意见。</p>
    </div>
  );
}

export default async function ZiweiPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const selectedId = firstParam(params.profileId);
  let profiles: StoredProfile[] = [];
  try { profiles = listStoredProfiles(); } catch { return <div className="page-frame"><PageHeader title="紫微斗数" description="三合基础事实层" /><section className="profiles-error-state" role="alert"><AlertTriangle aria-hidden="true" size={28} /><h2>无法读取人物档案</h2><p>本地数据库暂时不可用，未对现有数据做任何修改。</p><Link className="secondary-button" href="/ziwei">重新读取</Link></section></div>; }
  if (!selectedId) return <div className="page-frame"><PageHeader title="紫微斗数" description="三合基础事实层" /><ProfileSelector profiles={profiles} /></div>;
  const profile = profiles.find((item) => item.id === selectedId);
  if (!profile) return <div className="page-frame"><PageHeader title="紫微斗数" description="三合基础事实层" /><ProfileSelector profiles={profiles} /><p className="chart-error-note" role="alert">没有找到该人物档案，可能已经被删除。</p></div>;
  let snapshot: StoredZiweiSnapshot | undefined;
  try { snapshot = createStoredZiweiSnapshot(profile.id); } catch { snapshot = undefined; }
  return <div className="page-frame"><PageHeader title="紫微斗数" description="三合基础事实层" /><ProfileSelector profiles={profiles} selectedId={profile.id} />{snapshot ? <ZiweiView snapshot={snapshot} /> : <section className="profiles-error-state" role="alert"><AlertTriangle aria-hidden="true" size={28} /><h2>紫微快照暂时无法生成</h2><p>出生记录或紫微规则校验失败，系统没有展示未经验证的结果。</p><Link className="secondary-button" href={`/ziwei?profileId=${profile.id}`}>重新计算</Link></section>}</div>;
}
