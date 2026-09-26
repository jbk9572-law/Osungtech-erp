"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";

export type BoardCategory = "notice" | "hr_doc" | "official" | "approval";

export type BoardRow = {
  id: string;
  category: BoardCategory;
  title: string;
  status: { label: string; tone: BadgeTone } | null;
  date: string;
  href: string;
};

const CATEGORY_LABEL: Record<BoardCategory, string> = {
  notice: "공지",
  hr_doc: "인사문서",
  official: "공문",
  approval: "결재",
};

const CATEGORY_TONE: Record<BoardCategory, BadgeTone> = {
  notice: "info",
  hr_doc: "muted",
  official: "danger",
  approval: "warn",
};

type Filter = "all" | BoardCategory;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "notice", label: "공지사항" },
  { key: "hr_doc", label: "인사문서" },
  { key: "official", label: "공문" },
  { key: "approval", label: "결재/기안" },
];

// 공지사항/인사문서함/공문함/기안함 — 전부 "확인해야 할 문서 목록"이라는
// 점은 같은데 트리메뉴에서 4곳에 흩어져 있어 한 번에 훑어보기 어려웠다.
// 각 화면의 데이터/워크플로우는 그대로 두고(테이블도, RLS도, 상세 화면도
// 안 건드림), 진입 지점만 이 화면 하나로 모아서 카테고리 칩으로 구분해
// 보여준다 — 클릭하면 각자의 원래 상세 화면으로 그대로 연결된다.
export function BoardGridTable({ rows, counts }: { rows: BoardRow[]; counts: Record<Filter, number> }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (filter === "all" || r.category === filter) && (!q || r.title.toLowerCase().includes(q)));
  }, [rows, filter, query]);

  return (
    <>
      <div className="erp-date-presets" style={{ marginBottom: 10 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`erp-date-preset-btn${filter === f.key ? " active" : ""}`}
          >
            {f.label} ({counts[f.key] ?? 0})
          </button>
        ))}
      </div>

      <div className="erp-search" style={{ marginBottom: 10 }}>
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="board-search-q">제목 검색</label>
          <input
            id="board-search-q"
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목으로 검색"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((row) => (
          <Link key={`${row.category}-${row.id}`} href={row.href} className="erp-item-card" style={{ textDecoration: "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <GridBadge tone={CATEGORY_TONE[row.category]}>{CATEGORY_LABEL[row.category]}</GridBadge>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--erp-text)" }}>{row.title}</span>
                {row.status && <GridBadge tone={row.status.tone}>{row.status.label}</GridBadge>}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--erp-text-muted)", flexShrink: 0 }}>
              {new Date(row.date).toLocaleDateString("ko-KR")}
            </div>
          </Link>
        ))}
        {!filtered.length && (
          <p className="erp-grid-empty">{query.trim() ? "검색 결과가 없습니다." : "표시할 항목이 없습니다."}</p>
        )}
      </div>
    </>
  );
}
