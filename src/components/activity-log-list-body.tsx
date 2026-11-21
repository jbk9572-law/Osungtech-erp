"use client";

import { formatKstDateTime } from "@/lib/kst-date";
import { useMemo, useState } from "react";
import { GridBadge } from "@/components/grid/badge";
import { SplitFilterColumn } from "@/components/erp/split-filter-column";
import { SplitDetailEmpty } from "@/components/erp/page-header";
import { DocumentIcon } from "@/components/erp/groupware-icons";

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

// B형(소통형 3분할) — 왼쪽 회사 필터 열 | 로그 목록 | 선택한 로그 상세. 필터 열은 공용 SplitFilterColumn(개발헌법 12번).
export function ActivityLogListBody({ rows }: { rows: ActivityLogRow[] }) {
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
          <span>활동 로그</span>
          <span className="erp-u-muted erp-u-normal">{visibleRows.length}건</span>
        </div>
        <div className="erp-split-list-body">
          {visibleRows.map((r) => (
            <button key={r.id} type="button" onClick={() => setSelectedId(r.id)} className={`erp-split-list-row erp-split-list-row-btn${r.id === selectedId ? " active" : ""}`}>
              {r.tenant_name ?? "-"}
              <span className="erp-u-ml-s2">
                <GridBadge tone="muted">{ACTION_LABELS[r.action] ?? r.action}</GridBadge>
              </span>
              <div className="erp-split-list-row-sub">
                {r.table_name} · {r.actor_name ?? "-"} · {formatKstDateTime(r.created_at)}
              </div>
            </button>
          ))}
          {!visibleRows.length && <p className="erp-grid-empty">표시할 활동 로그가 없습니다.</p>}
        </div>
      </section>

      <div className="erp-split-detail">
        {selected ? (
          <div className="erp-info-grid">
            {[
              ["회사", selected.tenant_name ?? "-"],
              ["동작", ACTION_LABELS[selected.action] ?? selected.action],
              ["대상", selected.table_name],
              ["수행자", selected.actor_name ?? "-"],
              ["시각", formatKstDateTime(selected.created_at)],
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
