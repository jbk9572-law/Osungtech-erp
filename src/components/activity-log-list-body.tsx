"use client";

import { useMemo, useState } from "react";

export type ActivityLogRow = {
  id: string;
  tenant_name: string | null;
  action: string;
  table_name: string;
  actor_name: string | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  insert: "등록",
  update: "수정",
  delete: "삭제",
};

// 회사 구분 없이 전체를 쭉 훑기 힘들다는 지적 — 공지사항의
// AnnouncementListBody와 같은 구조(왼쪽 회사 필터 사이드바가 목록의
// 필터 상태를 그대로 조작)로 맞춘다. 활동 로그는 "선택 시 상세"가
// 따로 없다(행 자체가 이미 전부 다 보여주는 요약이라 분할뷰 3번째
// 칸은 불필요) — 그래서 .erp-split3-shell이 아니라 2분할
// (.erp-split-shell, 거래처/품목 등 13개 화면이 쓰는 것과 같은 공용
// 클래스)로 충분하다.
//
// 처음엔 이 클래스 대신 직접 <div style={{display:"flex"}}>로 똑같은
// 모양을 손으로 짰었는데, .erp-split-shell에 이미 있는 "768px 이하면
// 사이드바+본문을 세로로 쌓는다"는 반응형 규칙이 전혀 안 걸려서
// 모바일에서 고정폭(180px) 사이드바가 안 줄어들고 카드 영역이 거의
// 0px로 눌려 회사명이 한 글자씩 세로로 깨져 보이는 버그가 났다
// (사용자 스크린샷으로 재현/확인됨) — 직접 만들지 않고 공용 클래스를
// 썼다면 처음부터 없었을 버그다(개발헌법 3번).
export function ActivityLogListBody({ rows }: { rows: ActivityLogRow[] }) {
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
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--erp-space-5)",
              background: "var(--erp-panel)",
              border: "1px solid var(--erp-comm-border)",
              borderRadius: "var(--erp-comm-radius-row)",
              boxShadow: "var(--erp-comm-shadow-row)",
              padding: "11px 16px",
              flex: "0 0 auto",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "var(--erp-font-base)", fontWeight: 600, color: "var(--erp-text)" }}>
                {r.tenant_name ?? "-"}
                <span style={{ marginLeft: "var(--erp-space-2)" }}>
                  <span className="erp-badge erp-badge-muted">{ACTION_LABELS[r.action] ?? r.action}</span>
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--erp-text-muted)", marginTop: 3 }}>
                {r.table_name} · {r.actor_name ?? "-"}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--erp-text-muted)", flex: "0 0 auto" }}>
              {new Date(r.created_at).toLocaleString("ko-KR")}
            </div>
          </div>
        ))}
        {!visibleRows.length && <p className="erp-grid-empty">표시할 활동 로그가 없습니다.</p>}
      </div>
    </div>
  );
}
