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

function initialOf(name: string | null): string {
  return name?.trim()?.[0] ?? "?";
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays < 7;
}

export function AnnouncementGridTable({ rows }: { rows: AnnouncementRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("createdAt");

  const unreadCount = useMemo(() => rows.filter((r) => !r.read).length, [rows]);
  const pinnedCount = useMemo(() => rows.filter((r) => r.pinned).length, [rows]);
  const thisWeekCount = useMemo(
    () => rows.filter((r) => isThisWeek(r.createdAt)).length,
    [rows],
  );

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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            전체 공지
          </div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{rows.length.toLocaleString()}건</div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            안읽음
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: unreadCount ? "var(--erp-danger)" : undefined }}>
            {unreadCount.toLocaleString()}건
          </div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            고정 공지
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--erp-primary)" }}>
            {pinnedCount.toLocaleString()}건
          </div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            이번주 등록
          </div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{thisWeekCount.toLocaleString()}건</div>
        </div>
      </div>

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
        <div className="erp-field">
          <label htmlFor="ann-sort">정렬</label>
          <select
            id="ann-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="erp-select"
            style={{ width: 100 }}
          >
            <option value="createdAt">최신순</option>
            <option value="title">제목순</option>
            <option value="authorName">작성자순</option>
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
            고정 공지
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

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {gridRows.map((row) => (
          <Link
            key={row.id}
            href={`/announcements/${row.id}`}
            className={`erp-item-card${!row.read ? " unread" : ""}`}
          >
            <div className={`erp-avatar${row.read ? " muted" : ""}`}>{initialOf(row.authorName)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                <span
                  style={
                    !row.read
                      ? { fontSize: 13.5, fontWeight: 700, color: "var(--erp-text)" }
                      : { fontSize: 13.5, fontWeight: 500, color: "var(--erp-text-muted)" }
                  }
                >
                  {row.title}
                </span>
                {!row.read && <GridBadge tone="danger">안읽음</GridBadge>}
                {row.pinned && <GridBadge tone="info">고정</GridBadge>}
              </div>
              {row.content && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--erp-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.content}
                </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 4,
                fontSize: 11,
                color: "var(--erp-text-muted)",
                flexShrink: 0,
              }}
            >
              <div>{row.authorName ?? "-"}</div>
              <div>{new Date(row.createdAt).toLocaleDateString("ko-KR")}</div>
              <AnnouncementCheckbox id={row.id} read={row.read} label={row.title} />
            </div>
          </Link>
        ))}
        {!gridRows.length && (
          <p className="erp-grid-empty">
            {query.trim() ? "검색 결과가 없습니다." : "등록된 공지사항이 없습니다."}
          </p>
        )}
      </div>
    </>
  );
}
