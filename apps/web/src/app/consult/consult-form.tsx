"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { askConsultationAction, type ConsultActionState } from "./actions";

const INITIAL_STATE: ConsultActionState = { status: "idle" };

export function ConsultForm({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(askConsultationAction, INITIAL_STATE);

  useEffect(() => {
    if (state.status === "success" && state.consultationId) {
      router.push(`/consult?profileId=${encodeURIComponent(profileId)}&consultationId=${encodeURIComponent(state.consultationId)}`);
    }
  }, [profileId, router, state]);

  return (
    <form className="consult-form" action={formAction}>
      <input type="hidden" name="profileId" value={profileId} />
      <label htmlFor="consult-almanac-date">黄历日期（择日问题可选）</label>
      <input id="consult-almanac-date" name="almanacDate" type="date" disabled={pending} />
      <label htmlFor="consult-question">想问什么？</label>
      <textarea
        id="consult-question"
        name="question"
        rows={5}
        minLength={2}
        maxLength={1_000}
        placeholder="例如：请先解释这份八字快照中的日主、月令关系与不确定性。"
        required
        disabled={pending}
      />
      <div className="consult-form-footer">
        <p>模型只接收路由后所需的脱敏事实，不接收原始出生资料；回答必须引用当前证据。</p>
        <button className="primary-button button-with-icon" type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="button-spinner" aria-hidden="true" size={16} /> : <Send aria-hidden="true" size={16} />}
          {pending ? "正在解释" : "开始咨询"}
        </button>
      </div>
      {state.status === "error" ? <p className="form-message form-message-error" role="alert">{state.message}</p> : null}
    </form>
  );
}
