import { AlertTriangle, BookOpenText, CircleHelp, Coins, History, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { listStoredLiuyaoCases, type StoredLiuyaoCase } from "@/server/liuyao";
import { listStoredProfiles } from "@/server/profiles";
import { LiuyaoForm } from "./liuyao-form";

export const metadata = { title: "六爻问事" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function defaultCastAt() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function lineValueLabel(value: 6 | 7 | 8 | 9) {
  return ({ 6: "老阴", 7: "少阳", 8: "少阴", 9: "老阳" } as const)[value];
}

function positionLabel(position: number) {
  return position === 1 ? "初爻" : position === 6 ? "上爻" : `${position}爻`;
}

function CaseHistory({ cases, selectedId }: { cases: StoredLiuyaoCase[]; selectedId?: string }) {
  return (
    <section className="workspace-panel liuyao-history-panel" aria-labelledby="liuyao-history-title">
      <div className="section-heading">
        <div><h2 id="liuyao-history-title">历史问事</h2><p>原始爻值、时间和规则结果保存在本机</p></div>
        <History aria-hidden="true" size={19} />
      </div>
      {cases.length > 0 ? (
        <ul className="liuyao-history-list">
          {cases.map((item) => (
            <li key={item.id}>
              <Link data-active={item.id === selectedId} href={`/liuyao?caseId=${encodeURIComponent(item.id)}${item.profileId ? `&profileId=${encodeURIComponent(item.profileId)}` : ""}`}>
                <strong>{item.question}</strong>
                <small>{item.calculation.hexagram.base.name} → {item.calculation.hexagram.changed.name} · {item.cast.method === "coins" ? "硬币" : "录入"} · {item.createdAt.replace("T", " ").replace("Z", " UTC")}</small>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-inline liuyao-empty-history"><CircleHelp aria-hidden="true" size={22} /><div><strong>尚无六爻记录</strong><p>从左侧提出一个明确问题，首版会先保存可复算盘面。</p></div></div>
      )}
    </section>
  );
}

function CaseView({ item }: { item: StoredLiuyaoCase }) {
  const { calculation } = item;
  const lines = [...calculation.lines].reverse();
  return (
    <div className="liuyao-result-view">
      <section className="workspace-panel liuyao-result-summary" aria-labelledby="liuyao-result-title">
        <div className="section-heading">
          <div><p className="chart-eyebrow">可复算盘面</p><h2 id="liuyao-result-title">{item.question}</h2></div>
          <span className="status-badge"><ShieldCheck aria-hidden="true" size={14} /> 已保存</span>
        </div>
        <div className="liuyao-hexagram-pair">
          <div><small>本卦</small><strong>{calculation.hexagram.base.name}</strong><span>{calculation.hexagram.base.upper.name}{calculation.hexagram.base.lower.name} · {calculation.hexagram.base.palace.name}</span></div>
          <div className="liuyao-arrow" aria-hidden="true">→</div>
          <div><small>变卦</small><strong>{calculation.hexagram.changed.name}</strong><span>{calculation.hexagram.changed.upper.name}{calculation.hexagram.changed.lower.name} · {calculation.hexagram.changed.palace.name}</span></div>
        </div>
        <dl className="liuyao-fact-list">
          <div><dt>起卦日期</dt><dd>{calculation.context.localDate} · {calculation.context.day.name}</dd></div>
          <div><dt>月建</dt><dd>{calculation.context.monthBranch} · 旬空 {calculation.context.xunKong.join("、")}</dd></div>
          <div><dt>农历</dt><dd>{calculation.context.lunar.year} 年{calculation.context.lunar.isLeapMonth ? "闰" : ""}{calculation.context.lunar.month} 月{calculation.context.lunar.day} 日</dd></div>
          <div><dt>输入方式</dt><dd>{item.cast.method === "coins" ? "三枚硬币（18 次原始投掷已保存）" : item.cast.method === "manual_lines" ? "手工输入爻值" : "录入已有卦值"}</dd></div>
        </dl>
      </section>

      <section className="workspace-panel liuyao-lines-panel" aria-labelledby="liuyao-lines-title">
        <div className="section-heading"><div><h2 id="liuyao-lines-title">六爻盘面</h2><p>展示顺序为上爻 → 初爻；原始输入仍按初爻 → 上爻保存</p></div><Coins aria-hidden="true" size={19} /></div>
        <div className="liuyao-table-wrap">
          <table className="liuyao-line-table">
            <thead><tr><th scope="col">爻位</th><th scope="col">爻值</th><th scope="col">阴阳</th><th scope="col">纳甲</th><th scope="col">六亲</th><th scope="col">六神</th><th scope="col">标记</th></tr></thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.position} data-moving={line.moving}>
                  <th scope="row">{positionLabel(line.position)}</th>
                  <td><strong>{line.value}</strong><small>{lineValueLabel(line.value)}</small></td>
                  <td>{line.yinYang} → {line.changedYinYang}</td>
                  <td><strong>{line.stem}{line.branch}</strong><small>{line.element === "wood" ? "木" : line.element === "fire" ? "火" : line.element === "earth" ? "土" : line.element === "metal" ? "金" : "水"}</small></td>
                  <td>{line.sixRelative}</td>
                  <td>{line.sixSpirit}</td>
                  <td><span className="liuyao-line-tags">{line.moving ? "动" : "静"}{line.isShi ? " · 世" : ""}{line.isYing ? " · 应" : ""}{line.isVoid ? " · 空" : ""}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="chart-disclosure"><CircleHelp aria-hidden="true" size={15} /> 六亲以八宫五行为“我”计算，世应按八宫序列定位；这两项属于当前规则版本，不代表所有流派都相同。</p>
      </section>

      <section className="workspace-panel liuyao-evidence-panel" aria-labelledby="liuyao-evidence-title">
        <div className="section-heading"><div><h2 id="liuyao-evidence-title">规则与证据</h2><p>{calculation.engine.id}@{calculation.engine.version} · {calculation.engine.ruleSetId}@{calculation.engine.ruleSetVersion}</p></div><BookOpenText aria-hidden="true" size={19} /></div>
        <ul className="evidence-list">
          {calculation.evidence.map((item) => <li key={item.ruleId}><strong>{item.ruleId}</strong><span>{item.sourceId}</span><small>{item.locator}</small></li>)}
        </ul>
        <ul className="liuyao-warning-list">
          {calculation.warnings.map((warning) => <li key={warning}><AlertTriangle aria-hidden="true" size={15} />{warning}</li>)}
        </ul>
      </section>
      <p className="chart-disclaimer">六爻结果用于传统文化研究、娱乐与自我反思参考，不构成科学定论，也不替代医疗、法律、投资或其他专业意见。</p>
    </div>
  );
}

export default async function LiuyaoPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const requestedProfileId = firstParam(params.profileId);
  const requestedCaseId = firstParam(params.caseId);
  let profiles: Array<{ id: string; displayName: string; birthRecord: { rawInput: { location: { label: string } } } }> = [];
  try {
    profiles = listStoredProfiles();
  } catch {
    return <div className="page-frame"><PageHeader title="六爻问事" description="可复算的问事盘面" /><section className="profiles-error-state" role="alert"><AlertTriangle aria-hidden="true" size={28} /><h2>无法读取人物档案</h2><p>本地数据库暂时不可用，未对现有数据做任何修改。</p><Link className="secondary-button" href="/liuyao">重新读取</Link></section></div>;
  }
  const selectedProfile = profiles.find((profile) => profile.id === requestedProfileId);
  let cases: StoredLiuyaoCase[] = [];
  try {
    cases = listStoredLiuyaoCases(selectedProfile?.id);
  } catch {
    return <div className="page-frame"><PageHeader title="六爻问事" description="可复算的问事盘面" /><section className="profiles-error-state" role="alert"><AlertTriangle aria-hidden="true" size={28} /><h2>已有案例无法通过审计</h2><p>系统拒绝展示字段与盘面不一致的案例，请保留本地数据后联系维护者。</p><Link className="secondary-button" href="/liuyao">重新读取</Link></section></div>;
  }
  const selectedCase = cases.find((item) => item.id === requestedCaseId) ?? cases[0];
  const profilesForForm = profiles.map((profile) => ({ id: profile.id, displayName: profile.displayName }));
  return (
    <div className="page-frame">
      <PageHeader title="六爻问事" description={`${cases.length} 条问事记录 · 盘面与原始输入均可追溯`} />
      <div className="liuyao-layout">
        <section className="workspace-panel liuyao-ask-panel" aria-labelledby="liuyao-ask-title">
          <div className="section-heading"><div><h2 id="liuyao-ask-title">记录一个明确问题</h2><p>先保存起卦事实，再进入解释层</p></div><CircleHelp aria-hidden="true" size={19} /></div>
          <LiuyaoForm profiles={profilesForForm} selectedProfileId={selectedProfile?.id} defaultCastAt={defaultCastAt()} />
        </section>
        <CaseHistory cases={cases} selectedId={selectedCase?.id} />
        {selectedCase ? <CaseView item={selectedCase} /> : <section className="empty-inline liuyao-empty-result"><CircleHelp aria-hidden="true" size={24} /><div><strong>还没有选中的盘面</strong><p>可以先用三枚硬币自动起卦，也可以录入已有的六爻值。</p></div></section>}
      </div>
    </div>
  );
}
