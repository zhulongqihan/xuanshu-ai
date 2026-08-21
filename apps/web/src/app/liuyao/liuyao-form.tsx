"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createLiuyaoCaseAction,
  type LiuyaoActionState,
} from "./actions";

const INITIAL_STATE: LiuyaoActionState = { status: "idle" };
const LINE_OPTIONS = [6, 7, 8, 9];

export function LiuyaoForm({
  profiles,
  selectedProfileId,
  defaultCastAt,
}: {
  profiles: Array<{ id: string; displayName: string }>;
  selectedProfileId?: string;
  defaultCastAt: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState("coins");
  const [state, formAction, pending] = useActionState(createLiuyaoCaseAction, INITIAL_STATE);

  useEffect(() => {
    if (state.status === "success" && state.caseId) {
      router.push(`/liuyao?caseId=${encodeURIComponent(state.caseId)}`);
    }
  }, [router, state]);

  return (
    <form className="liuyao-form" action={formAction}>
      <div className="liuyao-form-grid">
        <div className="liuyao-form-field liuyao-form-field-wide">
          <label htmlFor="liuyao-question">要问的事情</label>
          <textarea
            id="liuyao-question"
            name="question"
            rows={3}
            minLength={2}
            maxLength={1_000}
            placeholder="例如：这份工作机会是否值得在本月继续推进？"
            required
            disabled={pending}
          />
        </div>
        <div className="liuyao-form-field">
          <label htmlFor="liuyao-profile">关联人物（可选）</label>
          <select id="liuyao-profile" name="profileId" defaultValue={selectedProfileId ?? ""} disabled={pending}>
            <option value="">不关联人物</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
          </select>
        </div>
        <div className="liuyao-form-field">
          <label htmlFor="liuyao-method">起卦方式</label>
          <select id="liuyao-method" name="method" value={method} onChange={(event) => setMethod(event.target.value)} disabled={pending}>
            <option value="coins">三枚硬币（自动审计）</option>
            <option value="manual_lines">手工输入爻值</option>
            <option value="existing_hexagram">录入已有卦值</option>
          </select>
        </div>
        <div className="liuyao-form-field">
          <label htmlFor="liuyao-cast-at">起卦时间</label>
          <input id="liuyao-cast-at" name="castAt" type="datetime-local" defaultValue={defaultCastAt} required disabled={pending} />
        </div>
        <div className="liuyao-form-field">
          <label htmlFor="liuyao-time-zone">IANA 时区</label>
          <input id="liuyao-time-zone" name="timeZone" defaultValue="Asia/Shanghai" required disabled={pending} />
        </div>
        <div className="liuyao-form-field">
          <label htmlFor="liuyao-location">起卦地点</label>
          <input id="liuyao-location" name="locationName" placeholder="例如：上海市" maxLength={120} required disabled={pending} />
        </div>
      </div>
      {method === "coins" ? (
        <p className="liuyao-form-note">系统会保存 18 次 2/3 原始投掷值，并由它们复算六爻；不会把随机结果伪装成手工输入。</p>
      ) : (
        <fieldset className="liuyao-lines-fieldset">
          <legend>六爻爻值（初爻 → 上爻）</legend>
          <div className="liuyao-line-inputs">
            {Array.from({ length: 6 }, (_, index) => (
              <label key={index} htmlFor={`liuyao-line-${index + 1}`}>
                <span>{index === 0 ? "初爻" : index === 5 ? "上爻" : `${index + 1}爻`}</span>
                <select id={`liuyao-line-${index + 1}`} name={`line-${index + 1}`} defaultValue="7" disabled={pending}>
                  {LINE_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="liuyao-form-footer">
        <p>结果用于传统文化研究、娱乐与自我反思参考；首版只展示可复算盘面，不自动给出不可验证的断语。</p>
        <button className="primary-button button-with-icon" type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="button-spinner" aria-hidden="true" size={16} /> : <Save aria-hidden="true" size={16} />}
          {pending ? "正在起卦" : "保存并查看盘面"}
        </button>
      </div>
      {state.status === "error" ? <p className="form-message form-message-error" role="alert">{state.message}</p> : null}
    </form>
  );
}
