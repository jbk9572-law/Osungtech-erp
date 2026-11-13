"use client";

import { useState } from "react";
import { saveDashboardLayout } from "@/lib/dashboard-layout-actions";
import { moveItem } from "@/lib/array-move";
import { normalizeDashboardLayout, stackOrder, widgetTitle, type DashboardLayout, type DashboardWidgetId } from "@/lib/dashboard-layout";

// 좁은 화면(모바일)에서의 메인 화면 편집 — 끌어서 옮기는 편집은 넓은 화면에서만 되므로, 여기서는 ▲▼로 순서를 바꾸고
// 칸별로 숨김만 고른다. 넓은 화면 배치와는 따로 저장된다(layout.mobile).
export function DashboardMobileEditor({
  layout,
  shownIds,
  onSaved,
}: {
  layout: DashboardLayout;
  // 지금 내용이 있어 실제로 그려지는 위젯 id
  shownIds: DashboardWidgetId[];
  onSaved: (next: DashboardLayout) => void;
}) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<DashboardWidgetId[]>([]);
  const [hidden, setHidden] = useState<DashboardWidgetId[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const start = () => {
    setOrder(stackOrder(layout).filter((id) => shownIds.includes(id)));
    setHidden(layout.mobile.hidden);
    setMessage(null);
    setOpen(true);
  };

  async function save() {
    setBusy(true);
    const next = { ...layout, mobile: { order, hidden } };
    const res = await saveDashboardLayout(next);
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error ?? "저장하지 못했습니다.");
      return;
    }
    onSaved(normalizeDashboardLayout(next));
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="erp-widget-bar">
        <span className="erp-daily-report-spacer" />
        <button type="button" className="erp-btn erp-btn-xs" onClick={start}>
          순서·숨김 편집
        </button>
      </div>
    );
  }
  return (
    <div className="erp-widget-picker">
      <p className="erp-widget-picker-title">좁은 화면에서 보일 순서 (▲▼로 옮기고, 안 볼 칸은 체크를 끄세요)</p>
      {order.map((id, i) => (
        <div key={id} className="erp-widget-picker-row">
          <input
            type="checkbox"
            id={`mp-${id}`}
            checked={!hidden.includes(id)}
            onChange={() => setHidden((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]))}
          />
          <label htmlFor={`mp-${id}`}>{widgetTitle(id)}</label>
          <button type="button" className="erp-btn erp-btn-xs" disabled={i === 0} onClick={() => setOrder((o) => moveItem(o, id, -1))} aria-label={`${widgetTitle(id)} 위로`}>
            ▲
          </button>
          <button type="button" className="erp-btn erp-btn-xs" disabled={i === order.length - 1} onClick={() => setOrder((o) => moveItem(o, id, 1))} aria-label={`${widgetTitle(id)} 아래로`}>
            ▼
          </button>
        </div>
      ))}
      {message && <p className="erp-widget-message" role="alert">{message}</p>}
      <div className="erp-widget-bar">
        <span className="erp-daily-report-spacer" />
        <button type="button" className="erp-btn erp-btn-xs" disabled={busy} onClick={() => setOpen(false)}>
          취소
        </button>
        <button type="button" className="erp-btn erp-btn-xs erp-btn-primary" disabled={busy} onClick={save}>
          {busy ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
