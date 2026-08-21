import { AlertTriangle, ArrowRight, BookOpenText, CalendarClock, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { createStoredBaziSnapshot, type StoredBaziSnapshot } from "@/server/charts";
import { listStoredProfiles, type StoredProfile } from "@/server/profiles";

export const metadata = { title: "命盘" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function timeLabel(profile: StoredProfile) {
  const time = profile.birthRecord.rawInput.time;
  if (time.kind === "unknown") return "出生时间未知";
  if (time.kind === "approximate") {
    return `约 ${time.value}（前 ${time.beforeMinutes} / 后 ${time.afterMinutes} 分钟）`;
  }
  return `民用时间 ${time.value}`;
}

function calendarLabel(profile: StoredProfile) {
  const input = profile.birthRecord.rawInput.calendarDate;
  if (input.kind === "solar") return `公历 ${input.date}`;
  return `农历 ${input.year}年${input.isLeapMonth ? "闰" : ""}${input.month}月${input.day}日 · 公历 ${profile.birthRecord.normalized.calendarResolution.solarDate}`;
}

function formatLocal(value: string) {
  return value.replace("T", " ");
}

function candidateLabel(candidate: StoredBaziSnapshot["payload"]["chart"]["bazi"]["candidates"][number]) {
  if (candidate.timePrecision === "approximate") return "约略时间候选";
  if (candidate.timePrecision === "unknown") return "未知时间候选";
  return candidate.timeBasis === "civil" ? "民用时间主候选" : "真太阳时并列候选";
}

function ageLabel(age: {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
}) {
  return `${age.years}年 ${age.months}个月 ${age.days}天 ${age.hours}小时 ${age.minutes}分钟`;
}

const ELEMENT_LABELS = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
} as const;

const RELATION_LABELS = {
  same: "同类",
  resource: "资源",
  drain: "泄",
  wealth: "财",
  officer: "官",
} as const;

const SUPPORT_LABELS = {
  supportive: "支持较多",
  balanced: "支持与其他接近",
  less_supported: "支持较少",
} as const;

function StrengthSection({
  snapshot,
  candidateId,
}: {
  snapshot: StoredBaziSnapshot;
  candidateId: string;
}) {
  const strength = snapshot.payload.chart.strength.candidates.find(
    (item) => item.baziCandidateId === candidateId,
  );
  if (!strength) return null;
  return (
    <div className="chart-strength-block">
      <div className="chart-subheading">
        <h3>旺衰基础量</h3>
        <span>{strength.status === "complete" ? "四柱" : "三柱部分结果"}</span>
      </div>
      <dl className="chart-fact-list chart-strength-facts">
        <div><dt>日主</dt><dd>{strength.dayMaster.name} · {ELEMENT_LABELS[strength.dayMaster.element]} · {strength.dayMaster.polarity === "yang" ? "阳" : "阴"}</dd></div>
        <div><dt>月令关系</dt><dd>{strength.monthContext.branchName}（{ELEMENT_LABELS[strength.monthContext.element]}）· {RELATION_LABELS[strength.monthContext.relationToDayMaster]}</dd></div>
        <div><dt>根气</dt><dd>{strength.root.isRooted ? `有根 · ${strength.root.branchNames.join("、")}` : "未检出同元素藏干根"}</dd></div>
        <div><dt>支持比例</dt><dd>{Math.round(strength.support.supportRatio * 100)}% · {SUPPORT_LABELS[strength.support.level]}</dd></div>
      </dl>
      <div className="strength-table-wrap">
        <table className="strength-table">
          <caption>五行透干、藏干与加权分</caption>
          <thead><tr><th scope="col">元素</th><th scope="col">透干</th><th scope="col">藏干</th><th scope="col">分数</th></tr></thead>
          <tbody>
            {strength.distribution.map((item) => (
              <tr key={item.element}>
                <th scope="row">{ELEMENT_LABELS[item.element]}</th>
                <td>{item.visibleStemCount}</td>
                <td>{item.hiddenStemCount}</td>
                <td>{item.weightedScore.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {strength.warnings.length > 0 ? <p className="chart-strength-note"><AlertTriangle aria-hidden="true" size={14} />{strength.warnings[0].message}</p> : null}
    </div>
  );
}

function CandidatePillars({
  candidate,
}: {
  candidate: StoredBaziSnapshot["payload"]["chart"]["bazi"]["candidates"][number];
}) {
  const pillars = [
    ["年柱", candidate.pillars.year],
    ["月柱", candidate.pillars.month],
    ["日柱", candidate.pillars.day],
    ["时柱", candidate.pillars.hour],
  ] as const;
  return (
    <div className="pillar-table-wrap">
      <table className="pillar-table">
        <caption className="sr-only">{candidateLabel(candidate)}四柱明细</caption>
        <thead>
          <tr>
            <th scope="col">项目</th>
            {pillars.map(([label]) => <th key={label} scope="col">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">干支</th>
            {pillars.map(([label, pillar]) => <td key={label} className="pillar-name">{pillar?.name ?? "未知"}</td>)}
          </tr>
          <tr>
            <th scope="row">天干</th>
            {pillars.map(([label, pillar]) => <td key={label}>{pillar?.stem.name ?? "—"}</td>)}
          </tr>
          <tr>
            <th scope="row">地支</th>
            {pillars.map(([label, pillar]) => <td key={label}>{pillar?.branch.name ?? "—"}</td>)}
          </tr>
          <tr>
            <th scope="row">天干十神</th>
            {pillars.map(([label, pillar]) => <td key={label}>{pillar?.stemTenGod.name ?? "—"}</td>)}
          </tr>
          <tr>
            <th scope="row">藏干</th>
            {pillars.map(([label, pillar]) => (
              <td key={label}>{pillar?.hiddenStems.map((item) => item.stem.name).join("、") ?? "—"}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">纳音 / 长生</th>
            {pillars.map(([label, pillar]) => (
              <td key={label}>{pillar ? `${pillar.naYin} · ${pillar.growthStage}` : "—"}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function LuckSection({
  snapshot,
  candidateId,
}: {
  snapshot: StoredBaziSnapshot;
  candidateId: string;
}) {
  const luck = snapshot.payload.chart.luck.candidates.find(
    (item) => item.baziCandidateId === candidateId,
  );
  if (!luck) {
    return (
      <div className="chart-inline-status chart-inline-status-warning">
        <AlertTriangle aria-hidden="true" size={17} />
        <span>当前候选无法生成大运单点或范围，详见下方警告。</span>
      </div>
    );
  }

  const age = luck.startAge
    ? ageLabel(luck.startAge)
    : luck.startAgeRange
      ? `${ageLabel(luck.startAgeRange.min)} 至 ${ageLabel(luck.startAgeRange.max)}`
      : "不可用";
  const transit = luck.transit
    ? formatLocal(luck.transit.localDateTime)
    : luck.transitRange
      ? `${formatLocal(luck.transitRange.min.localDateTime)} 至 ${formatLocal(luck.transitRange.max.localDateTime)}`
      : "不可用";

  return (
    <>
      <dl className="chart-fact-list chart-luck-facts">
        <div><dt>顺逆</dt><dd>{luck.direction === "forward" ? "顺行" : "逆行"}</dd></div>
        <div><dt>起运参考</dt><dd>{luck.referenceJie.name}</dd></div>
        <div><dt>起运年龄</dt><dd>{age}</dd></div>
        <div><dt>交运公历</dt><dd>{transit}</dd></div>
      </dl>
      <div className="luck-cycle-table-wrap">
        <table className="luck-cycle-table">
          <caption>十年大运序列</caption>
          <thead><tr><th scope="col">序号</th><th scope="col">大运</th><th scope="col">符号年龄</th></tr></thead>
          <tbody>
            {luck.cycles.map((cycle) => (
              <tr key={cycle.index}>
                <th scope="row">{cycle.index}</th>
                <td className="cycle-name">{cycle.name}</td>
                <td>{cycle.startOffsetYears}–{cycle.endOffsetYears} 岁</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProfileSelector({
  profiles,
  selectedId,
}: {
  profiles: StoredProfile[];
  selectedId?: string;
}) {
  return (
    <section className="chart-profile-selector workspace-panel" aria-labelledby="chart-profile-selector-title">
      <div className="section-heading">
        <div>
          <h2 id="chart-profile-selector-title">选择人物档案</h2>
          <p>命盘只读取当前 revision，不覆盖旧出生记录</p>
        </div>
        <Link className="secondary-button button-with-icon" href="/profiles">
          管理档案 <ArrowRight aria-hidden="true" size={15} />
        </Link>
        <Link className="secondary-button" href={selectedId ? `/ziwei?profileId=${selectedId}` : "/ziwei"}>
          打开紫微盘
        </Link>
      </div>
      {profiles.length > 0 ? (
        <ul className="chart-profile-list">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <Link
                className="chart-profile-option"
                data-selected={profile.id === selectedId}
                href={`/charts?profileId=${profile.id}`}
              >
                <span>
                  <strong>{profile.displayName}</strong>
                  <small>{calendarLabel(profile)} · {timeLabel(profile)}</small>
                </span>
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-inline chart-empty-inline">
          <CalendarClock aria-hidden="true" size={22} />
          <span><strong>还没有人物档案</strong><p>先保存出生资料，再回来查看可复算命盘。</p></span>
        </div>
      )}
    </section>
  );
}

function ChartView({
  profile,
  snapshot,
}: {
  profile: StoredProfile;
  snapshot: StoredBaziSnapshot;
}) {
  const { bazi, luck, evidence } = snapshot.payload.chart;
  const primary = bazi.candidates[0];
  const rawTime = profile.birthRecord.rawInput.time;
  const warnings = [
    ...bazi.warnings.map((warning) => warning.message),
    ...luck.warnings.map((warning) => warning.message),
  ];

  return (
    <>
      <section className="chart-context workspace-panel" aria-labelledby="chart-context-title">
        <div className="section-heading">
          <div>
            <p className="chart-eyebrow">当前人物</p>
            <h2 id="chart-context-title">{profile.displayName}</h2>
          </div>
          <span className="status-badge"><CheckCircle2 aria-hidden="true" size={14} /> 已保存快照</span>
        </div>
        <dl className="chart-fact-list chart-context-facts">
          <div><dt>出生日期</dt><dd>{calendarLabel(profile)}</dd></div>
          <div><dt>出生时间</dt><dd>{timeLabel(profile)}</dd></div>
          <div><dt>地点与时区</dt><dd>{profile.birthRecord.canonicalInput.location.label} · {profile.birthRecord.canonicalInput.location.timeZoneId}</dd></div>
          <div><dt>档案版本</dt><dd>revision {profile.birthRecord.revision} · {profile.birthRecord.inputHash.slice(0, 12)}…</dd></div>
          <div><dt>引擎</dt><dd>{bazi.engine.id} {bazi.engine.version} · {bazi.engine.ruleSetId}</dd></div>
        </dl>
        {rawTime.kind === "approximate" ? (
          <p className="chart-disclosure"><AlertTriangle aria-hidden="true" size={16} /> 约略时间不会被压成单一时刻，以下候选与大运范围需并列阅读。</p>
        ) : null}
      </section>

      {warnings.length > 0 ? (
        <section className="chart-warning-panel" aria-labelledby="chart-warning-title">
          <div className="section-heading">
            <div><h2 id="chart-warning-title">需要留意</h2><p>这些提示来自归一化和确定性计算层</p></div>
          </div>
          <ul className="chart-warning-list">
            {warnings.map((warning, index) => <li key={`${warning}-${index}`}><AlertTriangle aria-hidden="true" size={16} />{warning}</li>)}
          </ul>
        </section>
      ) : null}

      {primary ? (
        <section className="chart-primary-panel workspace-panel" aria-labelledby="chart-primary-title">
          <div className="section-heading">
            <div>
              <p className="chart-eyebrow">主候选 · {candidateLabel(primary)}</p>
              <h2 id="chart-primary-title">四柱命盘</h2>
            </div>
            <span className="chart-status-text">{bazi.status === "complete" ? "事实层完成" : "部分可用"}</span>
          </div>
          <div className="chart-primary-body">
            <CandidatePillars candidate={primary} />
            <div className="chart-side-stack">
              <div className="chart-luck-block">
                <div className="chart-subheading"><h3>大运</h3><span>{luck.status === "complete" ? "确定性结果" : "需结合警告阅读"}</span></div>
                <LuckSection snapshot={snapshot} candidateId={primary.id} />
              </div>
              <StrengthSection snapshot={snapshot} candidateId={primary.id} />
            </div>
          </div>
        </section>
      ) : (
        <section className="profiles-error-state" role="alert"><AlertTriangle aria-hidden="true" size={28} /><h2>没有可用命盘候选</h2><p>当前出生记录无法生成八字事实层，请检查档案中的日期、时间和时区。</p></section>
      )}

      {bazi.candidates.length > 1 ? (
        <section className="chart-candidates-panel workspace-panel" aria-labelledby="chart-candidates-title">
          <div className="section-heading"><div><h2 id="chart-candidates-title">并列候选</h2><p>候选不做平均；请根据输入边界与规则来源判断适用范围</p></div></div>
          <div className="chart-candidate-details-list">
            {bazi.candidates.slice(1).map((candidate) => (
              <details key={candidate.id} className="chart-candidate-details">
                <summary><span><strong>{candidateLabel(candidate)}</strong><small>{candidate.timeBasis} · {candidate.timePrecision} · {candidate.dayBoundary}</small></span><ArrowRight aria-hidden="true" size={16} /></summary>
                <div className="chart-candidate-body"><CandidatePillars candidate={candidate} /><div className="chart-side-stack"><div className="chart-luck-block"><div className="chart-subheading"><h3>对应大运</h3></div><LuckSection snapshot={snapshot} candidateId={candidate.id} /></div><StrengthSection snapshot={snapshot} candidateId={candidate.id} /></div></div>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="chart-evidence-panel workspace-panel" aria-labelledby="chart-evidence-title">
        <div className="section-heading"><div><h2 id="chart-evidence-title">规则与来源</h2><p>每个输出规则都保留来源定位，可用于复核而非替代判断</p></div><BookOpenText aria-hidden="true" size={19} /></div>
        <ul className="evidence-list">
          {evidence.map((item) => <li key={item.ruleId}><strong>{item.ruleId}</strong><span>{item.sourceId}</span><small>{item.locator}</small></li>)}
        </ul>
        <details className="chart-trace-details"><summary>查看计算轨迹</summary><ul>{snapshot.payload.calculationTrace.map((item) => <li key={item}>{item}</li>)}</ul></details>
      </section>

      <p className="chart-disclaimer">以上结果用于传统文化研究、娱乐与自我反思参考，不构成科学定论，也不替代医疗、法律、投资或其他专业意见。</p>
    </>
  );
}

export default async function ChartsPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const selectedId = firstParam(params.profileId);
  let profiles: StoredProfile[] = [];
  try {
    profiles = listStoredProfiles();
  } catch {
    return <div className="page-frame"><PageHeader title="命盘" description="八字事实层与大运" /><section className="profiles-error-state" role="alert"><AlertTriangle aria-hidden="true" size={28} /><h2>无法读取人物档案</h2><p>本地数据库暂时不可用，未对现有数据做任何修改。</p><Link className="secondary-button" href="/charts">重新读取</Link></section></div>;
  }

  if (!selectedId) {
    return <div className="page-frame"><PageHeader title="命盘" description="八字事实层与大运" /><ProfileSelector profiles={profiles} /></div>;
  }
  const profile = profiles.find((item) => item.id === selectedId);
  if (!profile) {
    return <div className="page-frame"><PageHeader title="命盘" description="八字事实层与大运" /><ProfileSelector profiles={profiles} /><p className="chart-error-note" role="alert">没有找到该人物档案，可能已经被删除。请重新选择。</p></div>;
  }

  let snapshot: StoredBaziSnapshot | undefined;
  try {
    snapshot = createStoredBaziSnapshot(profile.id);
  } catch {
    snapshot = undefined;
  }
  if (!snapshot) {
    return <div className="page-frame"><PageHeader title="命盘" description="八字事实层与大运" /><ProfileSelector profiles={profiles} selectedId={profile.id} /><section className="profiles-error-state" role="alert"><AlertTriangle aria-hidden="true" size={28} /><h2>命盘暂时无法生成</h2><p>出生记录或规则快照校验失败，系统没有展示未经验证的结果。</p><Link className="secondary-button" href={`/charts?profileId=${profile.id}`}>重新计算</Link></section></div>;
  }
  return <div className="page-frame"><PageHeader title="命盘" description="八字事实层与大运" /><ProfileSelector profiles={profiles} selectedId={profile.id} /><div className="chart-view"><ChartView profile={profile} snapshot={snapshot} /></div></div>;
}
