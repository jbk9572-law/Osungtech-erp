"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BadgeTone } from "@/components/grid/badge";

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

type Filter = "all" | BoardCategory;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "notice", label: "공지사항" },
  { key: "hr_doc", label: "인사문서" },
  { key: "official", label: "공문" },
  { key: "approval", label: "결재/기안" },
];

export type BoardWriteLink = { category: BoardCategory; label: string; href: string };

// 공지사항/인사문서함/공문함/기안함 — 전부 "확인해야 할 문서 목록"이라는
// 점은 같은데 트리메뉴에서 4곳에 흩어져 있어 한 번에 훑어보기 어려웠다.
// 각 화면의 데이터/워크플로우는 그대로 두고(테이블도, RLS도, 상세 화면도
// 안 건드림), 진입 지점만 이 화면 하나로 모아서 카테고리 칩으로 구분해
// 보여준다 — 클릭하면 각자의 원래 상세 화면으로 그대로 연결된다.
export function BoardGridTable({
  rows,
  counts,
  writeLinks,
}: {
  rows: BoardRow[];
  counts: Record<Filter, number>;
  // 공지사항/문서함/공문함/기안함을 독립 메뉴 항목에서 내리면서(erp-menu.ts),
  // 이 목록은 "이미 있는 글"만 보여줄 뿐 각 화면의 목록 루트(새로 쓰기
  // 진입점이 있는 곳)로 가는 길이 없어진다 — 그래서 카테고리별 "새로
  // 작성" 바로가기를 여기 직접 둔다. 기능이 꺼진 카테고리는 board/page.tsx가
  // 애초에 넘기지 않는다.
  writeLinks: BoardWriteLink[];
}) {
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

      {writeLinks.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {writeLinks.map((w) => (
            <Link key={w.category} href={w.href} className="erp-btn">
              + {w.label}
            </Link>
          ))}
        </div>
      )}

      <div className="erp-field-grid" style={{ marginBottom: 10 }}>
        <div className="erp-field erp-span-6">
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
        <div
          className="erp-field erp-span-6"
          style={{ alignItems: "flex-end", flexDirection: "row", justifyContent: "flex-end" }}
        >
          <span style={{ fontSize: 12, color: "var(--erp-text-muted)", height: 30, display: "flex", alignItems: "center" }}>
            총 {filtered.length}건
          </span>
        </div>
      </div>

      <div className="erp-board-feed">
        {filtered.map((row) => (
          <Link key={`${row.category}-${row.id}`} href={row.href} className="erp-board-card">
            <div className="erp-board-card-body">
              <div className="erp-board-card-cat">{CATEGORY_LABEL[row.category]}</div>
              <div className="erp-board-card-title">{row.title}</div>
              {row.status && (
                <div className="erp-board-card-sub">
                  <span className="erp-status-dot" data-tone={row.status.tone} />
                  {row.status.label}
                </div>
              )}
            </div>
            <div className="erp-board-card-time">{new Date(row.date).toLocaleDateString("ko-KR")}</div>
          </Link>
        ))}
        {!filtered.length && (
          <p className="erp-grid-empty">{query.trim() ? "검색 결과가 없습니다." : "표시할 항목이 없습니다."}</p>
        )}
      </div>
    </>
  );
}
