"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GridBadge } from "@/components/grid/badge";

export type DocumentTemplateRow = {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  hr_contract: "인사 · 계약서",
  hr_certificate: "인사 · 증명서",
  approval: "전자결재 서식",
  general: "기타",
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[];

// announcements/announcement-list-body.tsx와 같은 패턴 — 분류 사이드바
// (전체/카테고리별)와 양식 목록을 한 클라이언트 컴포넌트가 함께 그려서
// 사이드바 클릭이 목록 필터를 바로 조작하게 한다. 양식이 몇십 건 수준
// 이라 서버 재조회 없이 클라이언트에서 거른다.
export function DocumentTemplateListBody({
  rows,
  selectedId,
  basePath,
}: {
  rows: DocumentTemplateRow[];
  selectedId?: string;
  basePath: string;
}) {
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.category] = (counts[r.category] ?? 0) + 1;
    return counts;
  }, [rows]);

  const gridRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, category, query]);

  return (
    <>
      <nav className="erp-cat-sidebar">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={`erp-cat-item${category === "all" ? " active" : ""}`}
        >
          <span>전체</span>
          <span className="cnt">{rows.length}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`erp-cat-item${category === c ? " active" : ""}`}
          >
            <span>{CATEGORY_LABELS[c]}</span>
            <span className="cnt">{countByCategory[c] ?? 0}</span>
          </button>
        ))}
      </nav>

      <section className="erp-split-list">
        <div className="erp-split-list-head">
          <span>양식 목록</span>
          <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>총 {gridRows.length}건</span>
        </div>

        <div className="erp-field-grid" style={{ margin: 8, padding: 8, gap: 6 }}>
          <div className="erp-field erp-span-12">
            <label htmlFor="tpl-search-q">양식 이름 검색</label>
            <input
              id="tpl-search-q"
              type="text"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="양식 이름으로 검색"
              className="erp-input"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div className="erp-split-list-body">
          {gridRows.map((row) => (
            <Link
              key={row.id}
              href={`${basePath}${basePath.includes("?") ? "&" : "?"}id=${row.id}`}
              className={`erp-split-list-row${row.id === selectedId ? " active" : ""}`}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: row.id === selectedId ? 700 : 500 }}>{row.name}</span>
                <GridBadge tone={row.isActive ? "ok" : "muted"}>{row.isActive ? "사용중" : "미사용"}</GridBadge>
              </span>
              <div className="erp-split-list-row-sub">{CATEGORY_LABELS[row.category] ?? row.category}</div>
            </Link>
          ))}
          {!gridRows.length && (
            <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
              {query.trim() ? "검색 결과가 없습니다." : "등록된 양식이 없습니다."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
