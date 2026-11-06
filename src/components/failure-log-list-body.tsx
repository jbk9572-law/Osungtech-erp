"use client";

import { useMemo, useState } from "react";

export type FailureLogRow = {
  id: string;
  tenant_name: string | null;
  code: string;
  message_ko: string;
  action: string;
  entity_type: string | null;
  detail: string | null;
  actor_name: string | null;
  created_at: string;
};

// activity-log-list-body.tsx와 같은 구조(왼쪽 회사 필터 사이드바 +
// .erp-split-shell 2분할)를 그대로 재사용한다 — 같은 종류의 플랫폼관리자
// 로그 화면이 화면마다 다른 레이아웃을 쓰면 안 된다는 기준(개발헌법 3번).
export function FailureLogListBody({ rows }: { rows: FailureLogRow[] }) {
  const [tenant, setTenant] = useState<string>("all");

  const tenantCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const name = r.tenant_name ?? "미지정";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const visibleRows = tenant === "all" ? rows : rows.filter((r) => (r.tenant_name ?? "미지정") === tenant);

  return (
    <div className="erp-split-shell">
      <div className="erp-cat-sidebar">
        <button type="button" onClick={() => setTenant("all")} className={`erp-cat-item${tenant === "all" ? " active" : ""}`}>
          <span>전체</span>
          <span className="cnt">{rows.length}</span>
        </button>
        {tenantCounts.map(([name, count]) => (
          <button
            key={name}
            type="button"
            onClick={() => setTenant(name)}
            className={`erp-cat-item${tenant === name ? " active" : ""}`}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            <span className="cnt">{count}</span>
          </button>
        ))}
      </div>

      <div className="erp-card-feed" style={{ minWidth: 0 }}>
        {visibleRows.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              background: "var(--erp-panel)",
              border: "1px solid var(--erp-comm-border)",
              borderRadius: "var(--erp-comm-radius-row)",
              boxShadow: "var(--erp-comm-shadow-row)",
              padding: "11px 16px",
              flex: "0 0 auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--erp-space-5)" }}>
              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: "var(--erp-space-2)" }}>
                <span className="erp-badge erp-badge-danger" style={{ fontFamily: "monospace" }}>
                  {r.code}
                </span>
                <span style={{ fontSize: "var(--erp-font-base)", fontWeight: 600, color: "var(--erp-text)" }}>
                  {r.message_ko}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--erp-text-muted)", flex: "0 0 auto" }}>
                {new Date(r.created_at).toLocaleString("ko-KR")}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--erp-text-muted)" }}>
              {r.tenant_name ?? "-"} · {r.action}
              {r.entity_type ? ` (${r.entity_type})` : ""} · {r.actor_name ?? "-"}
            </div>
            {r.detail && r.detail !== r.message_ko && (
              <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontFamily: "monospace" }}>{r.detail}</div>
            )}
          </div>
        ))}
        {!visibleRows.length && <p className="erp-grid-empty">표시할 실패 로그가 없습니다.</p>}
      </div>
    </div>
  );
}
