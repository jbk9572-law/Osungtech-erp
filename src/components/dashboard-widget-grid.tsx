"use client";

import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { resetDashboardLayout, saveDashboardLayout } from "@/lib/dashboard-layout-actions";
import {
  DASHBOARD_COLS,
  DASHBOARD_MARGIN,
  DASHBOARD_ROW_HEIGHT,
  DASHBOARD_WIDGETS,
  defaultDashboardLayout,
  normalizeDashboardLayout,
  stackOrder,
  widgetMin,
  widgetTitle,
  type DashboardLayout,
  type DashboardLayoutItem,
  type DashboardWidgetId,
} from "@/lib/dashboard-layout";

// 메인 대시보드 위젯 배치 — 평소(보기)에는 CSS grid로 그려서 서버 렌더링과 똑같이 깜빡임 없이 나오고,
// "화면 편집"을 누를 때만 react-grid-layout을 띄워 끌어서 옮기고 모서리로 크기를 바꾼다. 두 방식의
// 칸 계산(행 높이·간격)이 같아서 편집 중 모양과 저장 후 모양이 일치한다. 좁은 화면(<1100px)은
// 위→아래 순서대로 한 줄로 쌓고 편집은 막는다.

const EDIT_MIN_WIDTH = 1100;

const WIDE_QUERY = `(min-width: ${EDIT_MIN_WIDTH}px)`;

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// 서버/첫 렌더는 "좁음"으로 시작해 어긋남 없이 맞춘 뒤 실제 화면 폭을 반영한다.
function useIsWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
}

export function DashboardWidgetGrid({
  initialLayout,
  widgets,
}: {
  initialLayout: DashboardLayout;
  widgets: Record<DashboardWidgetId, ReactNode>;
}) {
  const wide = useIsWide();
  const [layout, setLayout] = useState<DashboardLayout>(initialLayout);
  const [editRequested, setEditing] = useState(false);
  // 화면이 좁아지면 편집은 자동으로 끝난 것으로 본다(좁은 화면은 편집을 지원하지 않는다).
  const editing = editRequested && wide;
  const [draft, setDraft] = useState<DashboardLayout>(initialLayout);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { width, containerRef, mounted } = useContainerWidth();

  const startEdit = () => {
    setDraft(layout);
    setMessage(null);
    setEditing(true);
  };

  const onLayoutChange = useCallback((next: Layout) => {
    setDraft((d) => ({
      ...d,
      items: next
        .filter((n): n is typeof n & { i: DashboardWidgetId } => DASHBOARD_WIDGETS.some((w) => w.id === n.i))
        .map((n): DashboardLayoutItem => ({ id: n.i, x: n.x, y: n.y, w: n.w, h: n.h })),
    }));
  }, []);

  const hideWidget = (id: DashboardWidgetId) =>
    setDraft((d) => ({ items: d.items.filter((i) => i.id !== id), hidden: [...d.hidden, id] }));
  const showWidget = (id: DashboardWidgetId) =>
    setDraft((d) => {
      const def = DASHBOARD_WIDGETS.find((w) => w.id === id)!.def;
      const bottom = d.items.reduce((m, i) => Math.max(m, i.y + i.h), 0);
      return { items: [...d.items, { id, ...def, x: 0, y: bottom }], hidden: d.hidden.filter((h) => h !== id) };
    });

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await saveDashboardLayout(draft);
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error ?? "저장하지 못했습니다.");
      return;
    }
    setLayout(normalizeDashboardLayout(draft));
    setEditing(false);
  }

  async function reset() {
    setBusy(true);
    setMessage(null);
    const res = await resetDashboardLayout();
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error ?? "기본값으로 되돌리지 못했습니다.");
      return;
    }
    const def = defaultDashboardLayout();
    setLayout(def);
    setDraft(def);
    setEditing(false);
  }

  const shown = editing ? draft : layout;
  const order = stackOrder(layout);

  return (
    <div className="erp-widget-wrap">
      {wide && (
        <div className="erp-widget-bar">
          {editing ? (
            <>
              <span className="erp-widget-bar-hint">위젯 위쪽 바를 끌어서 옮기고, 위젯의 왼쪽·오른쪽·아래 가장자리나 아래 모서리를 끌어서 크기를 바꾸세요.</span>
              {draft.hidden.map((id) => (
                <button key={id} type="button" className="erp-btn erp-btn-xs" onClick={() => showWidget(id)}>
                  ＋ {widgetTitle(id)}
                </button>
              ))}
              <span className="erp-daily-report-spacer" />
              <button type="button" className="erp-btn erp-btn-xs" disabled={busy} onClick={reset}>
                기본값으로
              </button>
              <button type="button" className="erp-btn erp-btn-xs" disabled={busy} onClick={() => setEditing(false)}>
                취소
              </button>
              <button type="button" className="erp-btn erp-btn-xs erp-btn-primary" disabled={busy} onClick={save}>
                {busy ? "저장 중..." : "저장"}
              </button>
            </>
          ) : (
            <>
              <span className="erp-daily-report-spacer" />
              <button type="button" className="erp-btn erp-btn-xs" onClick={startEdit}>
                화면 편집
              </button>
            </>
          )}
        </div>
      )}
      {message && <p className="erp-widget-message" role="alert">{message}</p>}

      {editing && wide ? (
        <div ref={containerRef} className="erp-widget-edit">
          {mounted && (
            <ReactGridLayout
              width={width}
              layout={shown.items.map((i) => ({ i: i.id, x: i.x, y: i.y, w: i.w, h: i.h, minW: widgetMin(i.id).w, minH: widgetMin(i.id).h }))}
              gridConfig={{ cols: DASHBOARD_COLS, rowHeight: DASHBOARD_ROW_HEIGHT, margin: [DASHBOARD_MARGIN, DASHBOARD_MARGIN], containerPadding: [0, 0], maxRows: Infinity }}
              dragConfig={{ enabled: true, bounded: false, handle: ".erp-widget-handle", threshold: 3 }}
              resizeConfig={{ enabled: true, handles: ["e", "w", "s", "se", "sw"] }}
              compactor={verticalCompactor}
              onLayoutChange={onLayoutChange}
            >
              {shown.items.map((i) => (
                <div key={i.id} className="erp-widget is-editing">
                  <div className="erp-widget-handle">
                    <span>{widgetTitle(i.id)}</span>
                    <button
                      type="button"
                      className="erp-widget-hide"
                      aria-label={`${widgetTitle(i.id)} 숨기기`}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => hideWidget(i.id)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="erp-widget-body">{widgets[i.id]}</div>
                </div>
              ))}
            </ReactGridLayout>
          )}
        </div>
      ) : (
        <div className="erp-widget-grid">
          {layout.items.map((i) => (
            <div
              key={i.id}
              className="erp-widget"
              style={{
                gridColumn: `${i.x + 1} / span ${i.w}`,
                gridRow: `${i.y + 1} / span ${i.h}`,
                order: order.indexOf(i.id),
              }}
            >
              <div className="erp-widget-body">{widgets[i.id]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
