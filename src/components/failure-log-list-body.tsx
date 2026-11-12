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

      <div className="erp-card-feed erp-u-minw-0">
        {visibleRows.map((r) => (
          <div className="erp-u-flex erp-u-col erp-u-gap-4 erp-u-bg-panel erp-u-flex-none"
            key={r.id}
            style={{ border: "1px solid var(--erp-comm-border)", borderRadius: "var(--erp-comm-radius-row)", boxShadow: "var(--erp-comm-shadow-row)", padding: "11px 16px" }}
          >
            <div className="erp-u-flex erp-u-items-center erp-u-justify-between erp-u-gap-s5">
              <div className="erp-u-flex erp-u-items-center erp-u-minw-0 erp-u-gap-s2">
                <span className="erp-badge erp-badge-danger" style={{ fontFamily: "monospace" }}>
                  {r.code}
                </span>
                <span className="erp-u-semibold erp-u-text erp-u-text-base">
                  {r.message_ko}
                </span>
              </div>
              <div className="erp-u-muted erp-u-text-caption erp-u-flex-none">
                {new Date(r.created_at).toLocaleString("ko-KR")}
              </div>
            </div>
            <div className="erp-u-muted erp-u-text-caption">
              {r.tenant_name ?? "-"} · {r.action}
              {r.entity_type ? ` (${r.entity_type})` : ""} · {r.actor_name ?? "-"}
            </div>
            {r.detail && r.detail !== r.message_ko && (
              <div className="erp-u-muted erp-u-text-caption" style={{ fontFamily: "monospace" }}>{r.detail}</div>
            )}
          </div>
        ))}
        {!visibleRows.length && <p className="erp-grid-empty">표시할 실패 로그가 없습니다.</p>}
      </div>
    </div>
  );
}
