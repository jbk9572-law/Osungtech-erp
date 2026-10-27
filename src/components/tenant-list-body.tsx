"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GridBadge } from "@/components/grid/badge";

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planLabel: string;
  createdAt: string;
  statusLabel: string;
  statusTone: "ok" | "warn" | "danger";
};

type PlanFilter = "all" | "active" | "trial" | "suspended";

const FILTERS: { key: PlanFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "active", label: "정상 이용 중" },
  { key: "trial", label: "체험 이용 중" },
  { key: "suspended", label: "이용 중지" },
];

// platform-admin/page.tsx의 3분할(상태 필터+목록+상세) 화면에서 왼쪽 두
// 칸을 그린다 — 다른 그룹웨어 분할뷰(공지사항의 AnnouncementListBody)와
// 같은 구조: 사이드바 필터 버튼이 목록 필터 상태를 그대로 조작해야 해서
// 하나의 클라이언트 컴포넌트로 묶는다(Fragment라 실제 그리드에서는 두
// 형제 칸으로 배치된다).
export function TenantListBody({
  rows,
  selectedId,
  basePath,
}: {
  rows: TenantRow[];
  selectedId?: string;
  basePath: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PlanFilter>("all");

  const filterCounts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((r) => r.plan === "active").length,
      trial: rows.filter((r) => r.plan === "trial").length,
      suspended: rows.filter((r) => r.plan === "suspended").length,
    }),
    [rows],
  );

  const visibleRows = useMemo(() => {
    const byPlan = filter === "all" ? rows : rows.filter((r) => r.plan === filter);
    const q = query.trim().toLowerCase();
    return q ? byPlan.filter((r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)) : byPlan;
  }, [rows, filter, query]);

  return (
    <>
      <div className="erp-cat-sidebar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`erp-cat-item${filter === f.key ? " active" : ""}`}
          >
            <span>{f.label}</span>
            <span className="cnt">{filterCounts[f.key]}</span>
          </button>
        ))}
      </div>

      <section className="erp-split-list">
        <div className="erp-split-list-head">
          <span>고객사 목록</span>
          <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>{rows.length}개</span>
        </div>

        <div className="erp-field-grid" style={{ margin: 8, padding: 8, gap: 6 }}>
          <div className="erp-field erp-span-12">
            <label htmlFor="tenant-search-q">회사명 / 슬러그 검색</label>
            <input
              id="tenant-search-q"
              type="text"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="회사명 또는 슬러그 검색"
              className="erp-input"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div className="erp-split-list-body">
          {visibleRows.map((row) => (
            <Link
              key={row.id}
              href={`${basePath}${basePath.includes("?") ? "&" : "?"}id=${row.id}`}
              className={`erp-split-list-row${row.id === selectedId ? " active" : ""}`}
            >
              <span style={{ fontWeight: 700 }}>{row.name}</span>
              <span style={{ marginLeft: 6 }}>
                <GridBadge tone={row.statusTone}>{row.statusLabel}</GridBadge>
              </span>
              <div className="erp-split-list-row-sub" style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                <span>
                  {row.slug} · {row.planLabel}
                </span>
                <span>{new Date(row.createdAt).toLocaleDateString("ko-KR")}</span>
              </div>
            </Link>
          ))}
          {!visibleRows.length && (
            <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
              {query.trim() ? "검색 결과가 없습니다." : "등록된 회사가 없습니다."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
