"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ChartsError({ reset }: { reset: () => void }) {
  return (
    <div className="page-frame">
      <section className="profiles-error-state" role="alert">
        <AlertTriangle aria-hidden="true" size={28} />
        <h2>命盘页面遇到问题</h2>
        <p>未验证的计算结果不会继续展示，可以重新读取本地数据。</p>
        <button className="secondary-button button-with-icon" type="button" onClick={reset}>
          <RefreshCw aria-hidden="true" size={16} />
          重新读取
        </button>
      </section>
    </div>
  );
}
