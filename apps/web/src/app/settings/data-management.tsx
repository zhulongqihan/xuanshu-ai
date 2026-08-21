"use client";

import { AlertTriangle, Download, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import {
  deleteAllDataAction,
  restoreBackupAction,
  type DataActionState,
} from "./actions";

const INITIAL_STATE: DataActionState = { status: "idle" };

function Feedback({ state }: { state: DataActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p className={state.status === "error" ? "form-error" : "form-success"} role={state.status === "error" ? "alert" : "status"}>
      {state.message}
    </p>
  );
}

export function DataManagement() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreBackupAction,
    INITIAL_STATE,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAllDataAction,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (restoreState.status === "success" || deleteState.status === "success") {
      router.refresh();
    }
  }, [deleteState.status, restoreState.status, router]);

  return (
    <section className="settings-data-panel" aria-labelledby="data-management-title">
      <div className="section-heading">
        <div>
          <h2 id="data-management-title">数据管理</h2>
          <p>出生资料、盘面、咨询和六爻案例均保存在本机</p>
        </div>
        <ShieldIcon aria-hidden="true" />
      </div>
      <div className="settings-data-content">
        <p className="settings-data-note">
          JSON 备份包含出生日期、时间、地点等敏感资料，请只保存到你信任的位置。恢复会替换本机现有数据。
        </p>
        <div className="settings-data-actions">
          <a className="secondary-button button-with-icon" href="/api/backup">
            <Download aria-hidden="true" size={16} />
            下载 JSON 备份
          </a>
          <form
            action={restoreAction}
            className="settings-data-form"
            onSubmit={(event) => {
              if (!window.confirm("恢复备份会替换本机现有数据，确定继续吗？")) event.preventDefault();
            }}
          >
            <button
              className="secondary-button button-with-icon"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={restorePending}
            >
              <Upload aria-hidden="true" size={16} />
              选择备份并恢复
            </button>
            <input
              ref={fileInputRef}
              id="backup-file"
              name="backupFile"
              type="file"
              accept="application/json,.json"
              required
              disabled={restorePending}
            />
            <button className="primary-button button-with-icon" type="submit" disabled={restorePending}>
              {restorePending ? <LoaderCircle className="button-spinner" aria-hidden="true" size={16} /> : null}
              {restorePending ? "正在恢复" : "确认恢复"}
            </button>
          </form>
          <form
            action={deleteAction}
            onSubmit={(event) => {
              if (!window.confirm("这会删除本机全部人物档案、盘面、咨询和案例，且无法撤销。确定清空吗？")) event.preventDefault();
            }}
          >
            <button className="danger-button button-with-icon" type="submit" disabled={deletePending}>
              {deletePending ? <LoaderCircle className="button-spinner" aria-hidden="true" size={16} /> : <Trash2 aria-hidden="true" size={16} />}
              清空本机数据
            </button>
          </form>
        </div>
        <Feedback state={restoreState} />
        <Feedback state={deleteState} />
        <p className="settings-data-warning"><AlertTriangle aria-hidden="true" size={14} />清空前请先下载备份；模型服务不会自动获得这份文件。</p>
      </div>
    </section>
  );
}

function ShieldIcon(props: { "aria-hidden": "true" }) {
  return <span className="settings-data-icon" {...props}>本机</span>;
}
