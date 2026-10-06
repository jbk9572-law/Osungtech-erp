"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnnouncementCheckbox } from "@/components/announcement-checkbox";
import { GridBadge } from "@/components/grid/badge";
import { formatNumber } from "@/lib/format-number";

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

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pinned", label: "고정" },
  { key: "general", label: "일반" },
];

function compareValues(a: AnnouncementRow, b: AnnouncementRow, key: SortKey): number {
  return String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "ko");
}

// announcements/page.tsx의 3분할(카테고리+목록+상세) 화면에서 왼쪽 두
// 칸(사이드바+목록)을 전부 이 컴포넌트가 그린다 — 사이드바의 "고정"
// 버튼이 목록의 filter 상태를 그대로 조작해야 해서 하나의 클라이언트
// 컴포넌트로 묶여 있다(Fragment라 실제 DOM/그리드에서는 두 개의 형제
// 칸으로 따로 배치됨). 검색·필터·정렬 상태는 클라이언트에만 있어도
// 되므로(서버 재조회 불필요) 여기서 들고 있는다 — basePath 문자열만
// 서버에서 넘겨받아 여기서 직접 href를 조립한다(서버 컴포넌트가 만든
// 클로저 함수를 클라이언트 컴포넌트 prop으로 그대로 넘기면 RSC
// 직렬화 경계를 넘지 못해 "Minified React error #441"로 깨진다 —
// 이전엔 rowHref를 함수로 그대로 넘겼었다).
export function AnnouncementListBody({
  rows,
  selectedId,
  basePath,
  limit,
  hasMore,
  moreHref,
}: {
  rows: AnnouncementRow[];
  selectedId?: string;
  basePath: string;
  limit: number;
  hasMore: boolean;
  moreHref: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("createdAt");

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.title.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const pinnedCount = useMemo(() => rows.filter((r) => r.pinned).length, [rows]);
  const generalCount = rows.length - pinnedCount;

  const gridRows = useMemo(() => {
    const base =
      filter === "pinned"
        ? searched.filter((r) => r.pinned)
        : filter === "general"
          ? searched.filter((r) => !r.pinned)
          : searched;
    return [...base].sort((a, b) => {
      const cmp = compareValues(a, b, sort);
      return sort === "createdAt" ? -cmp : cmp;
    });
  }, [searched, filter, sort]);

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
            <span className="cnt">
              {f.key === "all" ? rows.length : f.key === "pinned" ? pinnedCount : generalCount}
            </span>
          </button>
        ))}
      </div>

      <section className="erp-split-list">
        <div className="erp-split-list-head">
          <span>공지 목록</span>
          <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>
            최근 {formatNumber(limit)}건까지{hasMore ? " · 더 있음" : ""}
          </span>
        </div>

        <div className="erp-search" style={{ margin: 8, padding: 8, gap: 6, flexWrap: "wrap" }}>
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

        <div className="erp-split-list-body">
          {gridRows.map((row) => (
            <Link
              key={row.id}
              href={`${basePath}${basePath.includes("?") ? "&" : "?"}id=${row.id}`}
              className={`erp-split-list-row${row.id === selectedId ? " active" : ""}`}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    flex: "0 0 auto",
                    background: row.read ? "var(--erp-border-strong)" : "var(--erp-primary)",
                  }}
                />
                <span style={row.read ? { color: "var(--erp-text-muted)" } : { fontWeight: 700 }}>{row.title}</span>
              </span>
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
        {hasMore && (
          <div style={{ padding: 8, borderTop: "1px solid var(--erp-border)" }}>
            <Link href={moreHref} className="erp-btn" style={{ width: "100%" }}>
              더보기 (다음 {formatNumber(limit)}건)
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
