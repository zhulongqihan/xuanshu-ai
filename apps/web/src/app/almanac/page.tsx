import { AlertTriangle, ArrowRight, BookOpenText, CalendarDays, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { calculateAlmanac, type AlmanacCalculation } from "@xuanshu/domain";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "择日" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function todayInShanghai() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatTerm(term: AlmanacCalculation["solarTerms"]["previous"]) {
  return `${term.name} · ${term.localDateTime.replace("T", " ")}`;
}

function AlmanacFacts({ result }: { result: AlmanacCalculation }) {
  return (
    <div className="almanac-view">
      <section className="workspace-panel almanac-context" aria-labelledby="almanac-context-title">
        <div className="section-heading">
          <div>
            <p className="chart-eyebrow">离线确定性日期事实</p>
            <h2 id="almanac-context-title">{result.input.solarDate}</h2>
          </div>
          <span className="status-badge"><CheckCircle2 aria-hidden="true" size={14} /> 已计算</span>
        </div>
        <dl className="chart-fact-list">
          <div><dt>农历</dt><dd>{result.lunar.year}年{result.lunar.isLeapMonth ? "闰" : ""}{result.lunar.month}月{result.lunar.day}日 · {result.lunar.monthDays}天月</dd></div>
          <div><dt>日干支</dt><dd>{result.day.name} · {result.day.stem.name}{result.day.stem.element === "wood" ? "木" : result.day.stem.element === "fire" ? "火" : result.day.stem.element === "earth" ? "土" : result.day.stem.element === "metal" ? "金" : "水"} · {result.day.branch.name}</dd></div>
          <div><dt>建除</dt><dd>{result.jianChu.name} · 月令 {result.jianChu.monthBranch} · 日支 {result.jianChu.dayBranch}</dd></div>
          <div><dt>冲煞</dt><dd>日支 {result.clash.dayBranch} 冲 {result.clash.clashBranch}</dd></div>
          <div><dt>时区</dt><dd>{result.input.timeZoneId}</dd></div>
        </dl>
      </section>

      <section className="workspace-panel almanac-terms" aria-labelledby="almanac-terms-title">
        <div className="section-heading"><div><h2 id="almanac-terms-title">节气上下文</h2><p>按所选 IANA 时区展示，本地时间不替换 UTC 事实</p></div></div>
        <dl className="chart-fact-list">
          <div><dt>上一节气</dt><dd>{formatTerm(result.solarTerms.previous)}</dd></div>
          <div><dt>当前节</dt><dd>{formatTerm(result.solarTerms.currentJie)}</dd></div>
          <div><dt>下一节</dt><dd>{formatTerm(result.solarTerms.nextJie)}</dd></div>
          <div><dt>下一节气</dt><dd>{formatTerm(result.solarTerms.next)}</dd></div>
        </dl>
      </section>

      <section className="workspace-panel almanac-activities" aria-labelledby="almanac-activities-title">
        <div className="section-heading"><div><h2 id="almanac-activities-title">事项入口</h2><p>先选具体事项，再逐条加载对应规则</p></div></div>
        <ul className="almanac-activity-list">
          {result.activities.map((activity) => (
            <li key={activity.id}>
              <div><strong>{activity.label}</strong><small>{activity.message}</small></div>
              <span className="almanac-pending-badge"><AlertTriangle aria-hidden="true" size={13} />待补充规则</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="workspace-panel almanac-evidence" aria-labelledby="almanac-evidence-title">
        <div className="section-heading"><div><h2 id="almanac-evidence-title">规则与来源</h2><p>首版输出的每一条日期事实都有规则定位</p></div><BookOpenText aria-hidden="true" size={19} /></div>
        <ul className="evidence-list">
          {result.evidence.map((item) => <li key={item.ruleId}><strong>{item.ruleId}</strong><span>{item.sourceId}</span><small>{item.locator}</small></li>)}
        </ul>
      </section>
      <p className="chart-disclaimer">黄历事实用于传统文化研究、娱乐与自我反思参考，不构成科学定论；具体事项规则完成前，不将日期标为绝对吉凶。</p>
    </div>
  );
}

export default async function AlmanacPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const solarDate = firstParam(params.date) ?? todayInShanghai();
  const timeZoneId = firstParam(params.timeZoneId) ?? "Asia/Shanghai";
  let result: AlmanacCalculation | undefined;
  let errorMessage: string | undefined;
  try {
    result = calculateAlmanac({ schemaVersion: 1, solarDate, timeZoneId });
  } catch {
    errorMessage = "日期或 IANA 时区无效，无法生成经过校验的黄历事实。";
  }

  return (
    <div className="page-frame">
      <PageHeader title="择日" description="老黄历事实与事项入口" />
      <section className="workspace-panel almanac-input-panel" aria-labelledby="almanac-input-title">
        <div className="section-heading">
          <div><h2 id="almanac-input-title">选择日期</h2><p>断网可用，正式范围为 1901-01-01 至 2100-12-31</p></div>
          <CalendarDays aria-hidden="true" size={19} />
        </div>
        <form className="almanac-form" method="get">
          <label htmlFor="almanac-date">公历日期</label>
          <input id="almanac-date" name="date" type="date" defaultValue={solarDate} required />
          <label htmlFor="almanac-time-zone">IANA 时区</label>
          <input id="almanac-time-zone" name="timeZoneId" type="text" defaultValue={timeZoneId} list="almanac-time-zones" required autoCapitalize="none" spellCheck={false} />
          <datalist id="almanac-time-zones"><option value="Asia/Shanghai" /><option value="Asia/Hong_Kong" /><option value="America/New_York" /><option value="America/Los_Angeles" /><option value="Europe/London" /></datalist>
          <button className="primary-button button-with-icon" type="submit">查看日期 <ArrowRight aria-hidden="true" size={15} /></button>
        </form>
      </section>
      {errorMessage ? <section className="profiles-error-state almanac-error" role="alert"><AlertTriangle aria-hidden="true" size={28} /><h2>无法计算这一天</h2><p>{errorMessage}</p><Link className="secondary-button" href="/almanac">回到今天</Link></section> : result ? <AlmanacFacts result={result} /> : null}
    </div>
  );
}
