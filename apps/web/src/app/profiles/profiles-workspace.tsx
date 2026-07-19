"use client";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createProfileAction, deleteProfileAction } from "./actions";
import type { ProfileFormField } from "./form-schema";
import type {
  CreateProfileState,
  DeleteProfileState,
  ProfileListItem,
} from "./types";

const INITIAL_CREATE_STATE: CreateProfileState = { status: "idle" };
const INITIAL_DELETE_STATE: DeleteProfileState = { status: "idle" };

function FieldError({
  field,
  state,
}: {
  field: ProfileFormField;
  state: CreateProfileState;
}) {
  const messages = state.errors?.[field];
  return messages ? (
    <p className="field-error" id={`${field}-error`}>
      {messages.join("；")}
    </p>
  ) : null;
}

function CreateProfileForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (message: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [calendarKind, setCalendarKind] = useState<"solar" | "lunar">("solar");
  const [timeKind, setTimeKind] = useState<"exact" | "approximate" | "unknown">(
    "exact",
  );
  const [compareTrueSolarTime, setCompareTrueSolarTime] = useState(false);
  const [state, formAction, pending] = useActionState(
    createProfileAction,
    INITIAL_CREATE_STATE,
  );

  useEffect(() => {
    if (state.status === "success" && state.operationId) {
      formRef.current?.reset();
      onCreated(state.message ?? "人物档案已保存。");
    }
  }, [onCreated, state]);

  const hasError = (field: ProfileFormField) => Boolean(state.errors?.[field]);

  return (
    <section className="profile-form-panel" aria-labelledby="profile-form-title">
      <div className="section-heading profile-form-heading">
        <div>
          <h2 id="profile-form-title">新建人物档案</h2>
          <p>出生资料将生成可复算的本地记录</p>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onCancel}
          aria-label="关闭新建档案表单"
          title="关闭"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <form ref={formRef} action={formAction} className="profile-form">
        <div className="profile-form-grid">
          <div className="form-field form-field-wide">
            <label htmlFor="displayName">档案名称</label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              maxLength={80}
              required
              autoComplete="off"
              placeholder="例如：本人"
              aria-invalid={hasError("displayName")}
              aria-describedby={hasError("displayName") ? "displayName-error" : undefined}
            />
            <FieldError field="displayName" state={state} />
          </div>

          <fieldset className="form-field form-field-wide">
            <legend>历法</legend>
            <div className="segmented-control">
              <label className="segmented-option">
                <input
                  type="radio"
                  name="calendarKind"
                  value="solar"
                  checked={calendarKind === "solar"}
                  onChange={() => setCalendarKind("solar")}
                />
                <span>公历</span>
              </label>
              <label className="segmented-option">
                <input
                  type="radio"
                  name="calendarKind"
                  value="lunar"
                  checked={calendarKind === "lunar"}
                  onChange={() => setCalendarKind("lunar")}
                />
                <span>农历</span>
              </label>
            </div>
          </fieldset>

          {calendarKind === "solar" ? (
            <div className="form-field form-field-wide">
              <label htmlFor="solarDate">出生日期</label>
              <input
                id="solarDate"
                name="solarDate"
                type="date"
                min="1901-01-01"
                max="2100-12-31"
                required
                aria-invalid={hasError("solarDate")}
                aria-describedby={hasError("solarDate") ? "solarDate-error" : undefined}
              />
              <FieldError field="solarDate" state={state} />
            </div>
          ) : (
            <div className="form-field form-field-wide">
              <span className="field-label">农历日期</span>
              <div className="lunar-date-grid">
                <label>
                  <span>年</span>
                  <input
                    name="lunarYear"
                    type="number"
                    inputMode="numeric"
                    min="1900"
                    max="2100"
                    required
                    aria-invalid={hasError("lunarYear")}
                  />
                </label>
                <label>
                  <span>月</span>
                  <input
                    name="lunarMonth"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="12"
                    required
                    aria-invalid={hasError("lunarMonth")}
                  />
                </label>
                <label>
                  <span>日</span>
                  <input
                    name="lunarDay"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="30"
                    required
                    aria-invalid={hasError("lunarDay")}
                  />
                </label>
              </div>
              <label className="checkbox-row">
                <input name="isLeapMonth" type="checkbox" />
                <span>闰月</span>
              </label>
              <FieldError field="lunarYear" state={state} />
              <FieldError field="lunarMonth" state={state} />
              <FieldError field="lunarDay" state={state} />
            </div>
          )}

          <fieldset className="form-field form-field-wide">
            <legend>出生时间</legend>
            <div className="segmented-control segmented-control-three">
              {[
                ["exact", "精确"],
                ["approximate", "约略"],
                ["unknown", "未知"],
              ].map(([value, label]) => (
                <label className="segmented-option" key={value}>
                  <input
                    type="radio"
                    name="timeKind"
                    value={value}
                    checked={timeKind === value}
                    onChange={() =>
                      setTimeKind(value as "exact" | "approximate" | "unknown")
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {timeKind !== "unknown" ? (
            <div className="form-field">
              <label htmlFor="birthTime">当地时间</label>
              <input
                id="birthTime"
                name="birthTime"
                type="time"
                required
                aria-invalid={hasError("birthTime")}
                aria-describedby={hasError("birthTime") ? "birthTime-error" : undefined}
              />
              <FieldError field="birthTime" state={state} />
            </div>
          ) : null}

          {timeKind === "approximate" ? (
            <div className="form-field uncertainty-fields">
              <span className="field-label">不确定范围（分钟）</span>
              <div>
                <label>
                  <span>提前</span>
                  <input
                    name="beforeMinutes"
                    type="number"
                    min="0"
                    max="720"
                    inputMode="numeric"
                    defaultValue="30"
                    required
                    aria-invalid={hasError("beforeMinutes")}
                  />
                </label>
                <label>
                  <span>延后</span>
                  <input
                    name="afterMinutes"
                    type="number"
                    min="0"
                    max="720"
                    inputMode="numeric"
                    defaultValue="30"
                    required
                    aria-invalid={hasError("afterMinutes")}
                  />
                </label>
              </div>
              <FieldError field="beforeMinutes" state={state} />
              <FieldError field="afterMinutes" state={state} />
            </div>
          ) : null}

          <fieldset className="form-field">
            <legend>排盘性别</legend>
            <div className="segmented-control">
              <label className="segmented-option">
                <input type="radio" name="chartSex" value="male" defaultChecked />
                <span>男命</span>
              </label>
              <label className="segmented-option">
                <input type="radio" name="chartSex" value="female" />
                <span>女命</span>
              </label>
            </div>
            <FieldError field="chartSex" state={state} />
          </fieldset>

          <div className="form-field">
            <label htmlFor="locationLabel">出生地点</label>
            <input
              id="locationLabel"
              name="locationLabel"
              type="text"
              maxLength={120}
              required
              placeholder="城市或区县"
              aria-invalid={hasError("locationLabel")}
              aria-describedby={
                hasError("locationLabel") ? "locationLabel-error" : undefined
              }
            />
            <FieldError field="locationLabel" state={state} />
          </div>

          <div className="form-field">
            <label htmlFor="timeZoneId">IANA 时区</label>
            <input
              id="timeZoneId"
              name="timeZoneId"
              type="text"
              list="profile-time-zones"
              defaultValue="Asia/Shanghai"
              required
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={hasError("timeZoneId")}
              aria-describedby={hasError("timeZoneId") ? "timeZoneId-error" : undefined}
            />
            <datalist id="profile-time-zones">
              <option value="Asia/Shanghai" />
              <option value="Asia/Hong_Kong" />
              <option value="Asia/Taipei" />
              <option value="Asia/Urumqi" />
              <option value="America/Los_Angeles" />
              <option value="America/New_York" />
              <option value="Europe/London" />
            </datalist>
            <FieldError field="timeZoneId" state={state} />
          </div>

          <div className="form-field form-field-wide">
            <label className="checkbox-row confirmation-row">
              <input name="timeZoneConfirmed" type="checkbox" required />
              <span>我已确认该时区对应出生地点与当时采用的民用时间</span>
            </label>
            <FieldError field="timeZoneConfirmed" state={state} />
          </div>

          <div className="form-field form-field-wide">
            <label className="toggle-row">
              <span>
                <strong>并列比较真太阳时</strong>
                <small>保留民用时间，同时计算经度与均时差修正</small>
              </span>
              <input
                name="trueSolarTime"
                type="checkbox"
                value="compare"
                checked={compareTrueSolarTime}
                onChange={(event) => setCompareTrueSolarTime(event.target.checked)}
              />
            </label>
            <FieldError field="trueSolarTime" state={state} />
          </div>

          {compareTrueSolarTime ? (
            <>
              <div className="form-field">
                <label htmlFor="latitude">纬度</label>
                <input
                  id="latitude"
                  name="latitude"
                  type="number"
                  inputMode="decimal"
                  min="-90"
                  max="90"
                  step="any"
                  required
                  placeholder="31.2304"
                  aria-invalid={hasError("latitude")}
                  aria-describedby={hasError("latitude") ? "latitude-error" : undefined}
                />
                <FieldError field="latitude" state={state} />
              </div>
              <div className="form-field">
                <label htmlFor="longitude">经度</label>
                <input
                  id="longitude"
                  name="longitude"
                  type="number"
                  inputMode="decimal"
                  min="-180"
                  max="180"
                  step="any"
                  required
                  placeholder="121.4737"
                  aria-invalid={hasError("longitude")}
                  aria-describedby={
                    hasError("longitude") ? "longitude-error" : undefined
                  }
                />
                <FieldError field="longitude" state={state} />
              </div>
            </>
          ) : null}
        </div>

        {state.status === "error" ? (
          <div className="form-message form-message-error" role="alert">
            <AlertCircle aria-hidden="true" size={18} />
            <span>{state.message}</span>
          </div>
        ) : null}

        <div className="profile-form-footer">
          <p>
            <ShieldCheck aria-hidden="true" size={16} />
            资料仅写入当前设备，不用于模型训练。
          </p>
          <div>
            <button className="secondary-button" type="button" onClick={onCancel}>
              取消
            </button>
            <button className="primary-button button-with-icon" type="submit" disabled={pending}>
              <Save aria-hidden="true" size={16} />
              {pending ? "正在保存" : "保存档案"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function ProfileRow({
  profile,
  onDeleted,
}: {
  profile: ProfileListItem;
  onDeleted: (message: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const deleteAction = useMemo(
    () => deleteProfileAction.bind(null, profile.id),
    [profile.id],
  );
  const [state, formAction, pending] = useActionState(
    deleteAction,
    INITIAL_DELETE_STATE,
  );

  useEffect(() => {
    if (state.status === "success") {
      onDeleted(state.message ?? "档案已删除。");
    }
  }, [onDeleted, state]);

  return (
    <li className="profile-row">
      <CircleUserRound aria-hidden="true" size={22} strokeWidth={1.6} />
      <div className="profile-row-content">
        <div className="profile-row-title">
          <strong>{profile.displayName}</strong>
          <span className="profile-sex-badge">{profile.chartSexLabel}</span>
          {profile.warningCount > 0 ? (
            <span className="profile-warning-badge">{profile.warningCount} 项待核对</span>
          ) : null}
        </div>
        <div className="profile-row-meta">
          <span>
            <CalendarDays aria-hidden="true" size={14} />
            {profile.calendarLabel}
          </span>
          <span>
            <Clock3 aria-hidden="true" size={14} />
            {profile.timeLabel}
          </span>
          <span>
            <MapPin aria-hidden="true" size={14} />
            {profile.locationLabel} · {profile.timeZoneId}
          </span>
        </div>
        {profile.comparesTrueSolarTime ? (
          <p className="profile-row-note">已保留真太阳时并列候选</p>
        ) : null}
        {state.status === "error" ? (
          <p className="profile-delete-error" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
      <div className="profile-row-actions">
        {confirming ? (
          <div className="delete-confirmation" role="group" aria-label={`删除 ${profile.displayName}`}>
            <span>同时删除关联数据？</span>
            <button
              className="text-button"
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              取消
            </button>
            <form action={formAction}>
              <button className="danger-button" type="submit" disabled={pending}>
                {pending ? "删除中" : "确认删除"}
              </button>
            </form>
          </div>
        ) : (
          <button
            className="icon-button profile-delete-button"
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`删除 ${profile.displayName}`}
            title="删除档案"
          >
            <Trash2 aria-hidden="true" size={17} />
          </button>
        )}
      </div>
    </li>
  );
}

export function ProfilesWorkspace({
  profiles,
  loadError = false,
}: {
  profiles: ProfileListItem[];
  loadError?: boolean;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [announcement, setAnnouncement] = useState<string>();

  const handleCreated = useCallback((message: string) => {
    setAnnouncement(message);
    setShowCreate(false);
  }, []);
  const handleDeleted = useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  if (loadError) {
    return (
      <section className="profiles-error-state" role="alert" aria-labelledby="profiles-error-title">
        <AlertCircle aria-hidden="true" size={28} />
        <h2 id="profiles-error-title">无法读取人物档案</h2>
        <p>本地数据库暂时不可用，未对现有数据做任何修改。</p>
        <button className="secondary-button button-with-icon" type="button" onClick={() => router.refresh()}>
          <RefreshCw aria-hidden="true" size={16} />
          重新读取
        </button>
      </section>
    );
  }

  return (
    <>
      <div className="profiles-toolbar">
        <p>
          <ShieldCheck aria-hidden="true" size={17} />
          出生资料与归一化结果仅保存在当前设备
        </p>
        {!showCreate ? (
          <button
            className="primary-button button-with-icon"
            type="button"
            onClick={() => {
              setAnnouncement(undefined);
              setShowCreate(true);
            }}
          >
            <Plus aria-hidden="true" size={17} />
            新建档案
          </button>
        ) : null}
      </div>

      <div className="workspace-announcement" aria-live="polite">
        {announcement ? (
          <span>
            <CheckCircle2 aria-hidden="true" size={17} />
            {announcement}
          </span>
        ) : null}
      </div>

      {showCreate ? (
        <CreateProfileForm onCancel={() => setShowCreate(false)} onCreated={handleCreated} />
      ) : null}

      {profiles.length === 0 && !showCreate ? (
        <section className="empty-workspace profiles-empty" aria-labelledby="profiles-empty-title">
          <CircleUserRound className="empty-icon" aria-hidden="true" size={30} strokeWidth={1.6} />
          <h2 id="profiles-empty-title">尚无人物档案</h2>
          <p>建立第一份出生记录后，命盘、择日和咨询才能引用同一组可复算输入。</p>
          <button
            className="primary-button button-with-icon"
            type="button"
            onClick={() => setShowCreate(true)}
          >
            <Plus aria-hidden="true" size={17} />
            新建档案
          </button>
        </section>
      ) : profiles.length > 0 ? (
        <section className="profiles-list-panel" aria-labelledby="profile-list-title">
          <div className="section-heading">
            <div>
              <h2 id="profile-list-title">本机档案</h2>
              <p>按最近更新时间排列</p>
            </div>
          </div>
          <ul className="profiles-list">
            {profiles.map((profile) => (
              <ProfileRow key={profile.id} profile={profile} onDeleted={handleDeleted} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
