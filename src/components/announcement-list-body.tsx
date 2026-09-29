"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnnouncementCheckbox } from "@/components/announcement-checkbox";
import { GridBadge } from "@/components/grid/badge";

export type AnnouncementRow = {
  id: string;
  title: string;
  content: string | null;
  pinned: boolean;
  createdAt: string;
  authorName: string | null;
  read: boolean;
};

type SortKey = "createdAt" | "title" | "authorName";
type Filter = "all" | "pinned" | "general";

function compareValues(a: AnnouncementRow, b: AnnouncementRow, key: SortKey): number {
  return String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "ko");
}

export function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays < 7;
}

// announcements/page.tsx의 3분할(목록+상세) 화면에서 왼쪽 목록 칸 안에
// 들어가는 필터/정렬/검색 + 행 목록. 검색·필터·정렬 상태는 클라이언트에만
// 있어도 되므로(서버 재조회 불필요) 여기서 들고 있는다 — rowHref만
// 서버가 계산해 넘겨준 함수를 그대로 쓴다.
export function AnnouncementListBody({
  rows,
  selectedId,
  rowHref,
}: {
  rows: AnnouncementRow[];
  selectedId?: string;
  rowHref: (id: string) => string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("createdAt");

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.title.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const pinnedRows = useMemo(() => searched.filter((r) => r.pinned), [searched]);

  // "전체"/"일반" 둘 다 목록에는 일반 공지만 담는다 — 고정 공지는 "전체"일
  // 때 위 배너에 이미 나오므로, 목록에까지 또 넣으면 같은 공지가 두 번
  // 보인다.
  const gridRows = useMemo(() => {
    const base = filter === "pinned" ? pinnedRows : searched.filter((r) => !r.pinned);
    return [...base].sort((a, b) => {
      const cmp = compareValues(a, b, sort);
      return sort === "createdAt" ? -cmp : cmp;
    });
  }, [searched, pinnedRows, filter, sort]);

  return (
    <>
      <div className="erp-search" style={{ margin: 8, padding: 8, gap: 6, flexWrap: "wrap" }}>
        <div className="erp-field" style={{ minWidth: 90 }}>
          <label htmlFor="ann-filter">구분</label>
          <select
            id="ann-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="erp-select"
            style={{ width: "100%" }}
          >
            <option value="all">전체</option>
            <option value="pinned">고정</option>
            <option value="general">일반</option>
          </select>
        </div>
        <div className="erp-field" style={{ minWidth: 90 }}>
          <label htmlFor="ann-sort">정렬</label>
          <select
            id="ann-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="erp-select"
            style={{ width: "100%" }}
          >
            <option value="createdAt">최신순</option>
            <option value="title">제목순</option>
            <option value="authorName">작성자순</option>
          </select>
        </div>
        <div className="erp-field" style={{ minWidth: "100%" }}>
          <label htmlFor="ann-search-q">제목 검색</label>
          <input
            id="ann-search-q"
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

      {filter === "all" && pinnedRows.length > 0 && (
        <div style={{ margin: "0 8px 8px", background: "var(--erp-info-bg)", border: "1px solid var(--erp-info-border)", padding: "8px 10px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-info-text)", margin: "0 0 6px" }}>고정 공지</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {pinnedRows.map((row) => (
              <Link
                key={row.id}
                href={rowHref(row.id)}
                style={{ fontSize: 12, fontWeight: 600, color: "var(--erp-info-text)", display: "block", padding: "2px 0" }}
              >
                {row.title} · {new Date(row.createdAt).toLocaleDateString("ko-KR")}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="erp-split-list-body">
        {gridRows.map((row) => (
          <Link
            key={row.id}
            href={rowHref(row.id)}
            className={`erp-split-list-row${row.id === selectedId ? " active" : ""}`}
          >
            <span style={row.read ? { color: "var(--erp-text-muted)" } : { fontWeight: 700 }}>{row.title}</span>
            {!row.read && (
              <span style={{ marginLeft: 6 }}>
                <GridBadge tone="danger">안읽음</GridBadge>
              </span>
            )}
            {row.pinned && (
              <span style={{ marginLeft: 6 }}>
                <GridBadge tone="info">고정</GridBadge>
              </span>
            )}
            <div className="erp-split-list-row-sub" style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
              <span>
                {row.authorName ?? "-"} · {new Date(row.createdAt).toLocaleDateString("ko-KR")}
              </span>
              <AnnouncementCheckbox id={row.id} read={row.read} label={row.title} />
            </div>
          </Link>
        ))}
        {!gridRows.length && (
          <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
            {query.trim() ? "검색 결과가 없습니다." : "등록된 공지사항이 없습니다."}
          </p>
        )}
      </div>
    </>
  );
}
