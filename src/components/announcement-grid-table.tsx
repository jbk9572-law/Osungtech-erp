"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
import { AnnouncementCheckbox } from "@/components/announcement-checkbox";
import { GridBadge } from "@/components/grid/badge";

export type AnnouncementRow = {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  authorName: string | null;
  read: boolean;
};

type SortKey = "title" | "authorName" | "createdAt";
type Filter = "all" | "pinned" | "general";

function compareValues(a: AnnouncementRow, b: AnnouncementRow, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  return String(av ?? "").localeCompare(String(bv ?? ""), "ko");
}

export function AnnouncementGridTable({ rows }: { rows: AnnouncementRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>({ key: "createdAt", dir: -1 });

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.title.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const pinnedRows = useMemo(() => searched.filter((r) => r.pinned), [searched]);

  // "전체"/"일반" 둘 다 표에는 일반 공지만 담는다 — 고정 공지는 "전체"일 때
  // 위 배너에 이미 나오므로, 표에까지 또 넣으면 같은 공지가 두 번 보인다.
  const gridRows = useMemo(() => {
    const base = filter === "pinned" ? pinnedRows : searched.filter((r) => !r.pinned);
    if (!sort) return base;
    return [...base].sort((a, b) => compareValues(a, b, sort.key) * sort.dir);
  }, [searched, pinnedRows, filter, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 1 };
      if (prev.dir === 1) return { key, dir: -1 };
      return null;
    });
  }

  function sortIndicator(key: SortKey) {
    if (!sort || sort.key !== key) return "";
    return sort.dir === 1 ? " ▲" : " ▼";
  }

  function sortableHeader(label: string, key: SortKey, style?: CSSProperties) {
    const isSorted = sort?.key === key;
    return (
      <th style={style} aria-sort={isSorted ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggleSort(key)} className="erp-th-btn">
          {label}
          {sortIndicator(key)}
        </button>
      </th>
    );
  }

  return (
    <>
      <div className="erp-search">
        <div className="erp-field">
          <label htmlFor="ann-filter">구분</label>
          <select
            id="ann-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="erp-select"
            style={{ width: 100 }}
          >
            <option value="all">전체</option>
            <option value="pinned">고정</option>
            <option value="general">일반</option>
          </select>
        </div>
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="ann-search-q">제목 검색</label>
          <input
            id="ann-search-q"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목으로 검색"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
      </div>

      {filter === "all" && pinnedRows.length > 0 && (
        <div
          className="erp-grid-wrap"
          style={{
            marginBottom: 12,
            background: "var(--erp-info-bg)",
            border: "1px solid var(--erp-info-border)",
            padding: "8px 12px",
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-info-text)", margin: "0 0 6px" }}>
            📌 고정 공지
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {pinnedRows.map((row) => (
              <Link
                key={row.id}
                href={`/announcements/${row.id}`}
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--erp-info-text)",
                  display: "block",
                  padding: "2px 0",
                }}
              >
                {row.title} · {new Date(row.createdAt).toLocaleDateString("ko-KR")} · {row.authorName ?? "-"}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 40 }}>읽음</th>
              {sortableHeader("제목", "title")}
              {sortableHeader("작성자", "authorName", { width: 140 })}
              {sortableHeader("작성일", "createdAt", { width: 120 })}
            </tr>
          </thead>
          <tbody>
            {gridRows.map((row) => (
              <ClickableRow key={row.id} href={`/announcements/${row.id}`}>
                <td style={{ textAlign: "center" }}>
                  <AnnouncementCheckbox id={row.id} read={row.read} />
                </td>
                <td style={!row.read ? { fontWeight: 700 } : { color: "var(--erp-text-muted)" }}>
                  {!row.read && (
                    <GridBadge tone="danger" style={{ marginRight: 6 }}>
                      안읽음
                    </GridBadge>
                  )}
                  {row.title}
                </td>
                <td>{row.authorName ?? "-"}</td>
                <td>{new Date(row.createdAt).toLocaleDateString("ko-KR")}</td>
              </ClickableRow>
            ))}
            {!gridRows.length && (
              <tr>
                <td colSpan={4} className="erp-grid-empty">
                  {query.trim() ? "검색 결과가 없습니다." : "등록된 공지사항이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
