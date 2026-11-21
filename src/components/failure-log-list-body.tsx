"use client";

import { formatKstDateTime } from "@/lib/kst-date";
import { useMemo, useState } from "react";
import { GridBadge } from "@/components/grid/badge";
import { SplitFilterColumn } from "@/components/erp/split-filter-column";
import { SplitDetailEmpty } from "@/components/erp/page-header";
import { DocumentIcon } from "@/components/erp/groupware-icons";

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

// activity-log-list-body.tsx와 같은 B형(소통형 3분할) 구조 — 필터 열 | 목록 | 상세(개발헌법 12번).
export function FailureLogListBody({ rows }: { rows: FailureLogRow[] }) {
  const [tenant, setTenant] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tenantCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const name = r.tenant_name ?? "미지정";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const visibleRows = tenant === "all" ? rows : rows.filter((r) => (r.tenant_name ?? "미지정") === tenant);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const pick = (name: string) => {
    setTenant(name);
    setSelectedId(null);
  };

  return (
    <div className="erp-split3-shell" data-mobile-view={selected ? "detail" : "list"}>
      <SplitFilterColumn
        ariaLabel="회사 필터"
        groups={[
          {
            heading: "회사",
            items: [
              { key: "all", label: "전체", count: rows.length, active: tenant === "all", onSelect: () => pick("all") },
              ...tenantCounts.map(([name, count]) => ({ key: name, label: name, count, active: tenant === name, onSelect: () => pick(name) })),
            ],
          },
        ]}
      />

      <section className="erp-split-list">
        <div className="erp-split-list-head">
          <span>실패 로그</span>
          <span className="erp-u-muted erp-u-normal">{visibleRows.length}건</span>
        </div>
        <div className="erp-split-list-body">
          {visibleRows.map((r) => (
            <button key={r.id} type="button" onClick={() => setSelectedId(r.id)} className={`erp-split-list-row erp-split-list-row-btn${r.id === selectedId ? " active" : ""}`}>
              <GridBadge tone="danger">{r.code}</GridBadge>
              <span className="erp-u-ml-s2">{r.message_ko}</span>
              <div className="erp-split-list-row-sub">
                {r.tenant_name ?? "-"} · {formatKstDateTime(r.created_at)}
              </div>
            </button>
          ))}
          {!visibleRows.length && <p className="erp-grid-empty">표시할 실패 로그가 없습니다.</p>}
        </div>
      </section>

      <div className="erp-split-detail">
        {selected ? (
          <div className="erp-info-grid">
            {[
              ["코드", selected.code],
              ["내용", selected.message_ko],
              ["회사", selected.tenant_name ?? "-"],
              ["동작", `${selected.action}${selected.entity_type ? ` (${selected.entity_type})` : ""}`],
              ["수행자", selected.actor_name ?? "-"],
              ["시각", formatKstDateTime(selected.created_at)],
              ...(selected.detail && selected.detail !== selected.message_ko ? [["상세", selected.detail]] : []),
            ].map(([label, value]) => (
              <div key={label} className="erp-info-cell">
                <div className="erp-info-label">{label}</div>
                <div className="erp-info-value">{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <SplitDetailEmpty icon={<DocumentIcon />} title="로그를 선택해주세요" hint="왼쪽 목록에서 로그를 누르면 여기에 자세한 내용이 표시됩니다." />
        )}
      </div>
    </div>
  );
}
