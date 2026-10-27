"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GridBadge } from "@/components/grid/badge";
import { SplitListFiller } from "@/components/erp/page-header";
import { DocumentIcon } from "@/components/erp/groupware-icons";

export type BoardCategory = "notice" | "hr_doc" | "official" | "approval";

export type BoardRow = {
  id: string;
  category: BoardCategory;
  title: string;
  status: { label: string; tone: "ok" | "warn" | "danger" | "muted" | "info" } | null;
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

// 예전엔 카드를 누르면 각자의 원래 화면(/announcements/[id] 등)으로 아예
// 이동해버려서 "게시판은 훑어보기용, 상세는 딴 데 가서"라는 안내문이
// 따로 필요했다(사용자 지적 — "이건 왜 3분할 디자인 안 한 거야?").
// 메일함/공지사항과 같은 .erp-split3-shell(카테고리 사이드바+목록+상세)
// 구조로 바꿔서, 글을 눌러도 이 화면을 벗어나지 않고 오른쪽에 바로
// 보이게 한다 — 상세 패널은 각 화면이 원래 쓰던 컴포넌트
// (AnnouncementDetailPanel 등)를 board/page.tsx가 그대로 가져다 쓰므로,
// 데이터/워크플로우(수정·삭제·전결 등)는 여전히 하나도 안 건드린다.
export function BoardListBody({
  rows,
  counts,
  writeLinks,
  selectedId,
  selectedType,
  basePath,
}: {
  rows: BoardRow[];
  counts: Record<Filter, number>;
  writeLinks: BoardWriteLink[];
  selectedId?: string;
  selectedType?: BoardCategory;
  basePath: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (filter === "all" || r.category === filter) && (!q || r.title.toLowerCase().includes(q)));
  }, [rows, filter, query]);

  return (
    <>
      <nav className="erp-cat-sidebar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`erp-cat-item${filter === f.key ? " active" : ""}`}
          >
            <span>{f.label}</span>
            <span className="cnt">{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </nav>

      <section className="erp-split-list">
        <div className="erp-split-list-head">
          <span>게시판</span>
          <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>총 {filtered.length}건</span>
        </div>

        {writeLinks.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 8px 0" }}>
            {writeLinks.map((w) => (
              <Link key={w.category} href={w.href} className="erp-btn" style={{ fontSize: 11, minWidth: 0 }}>
                + {w.label}
              </Link>
            ))}
          </div>
        )}

        <div style={{ padding: 8 }}>
          <input
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목으로 검색"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>

        <div className="erp-split-list-body">
          {filtered.map((row) => (
            <Link
              key={`${row.category}-${row.id}`}
              href={`${basePath}?id=${row.id}&type=${row.category}`}
              className={`erp-split-list-row${row.id === selectedId && row.category === selectedType ? " active" : ""}`}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--erp-text-muted)", marginRight: 6 }}>
                {CATEGORY_LABEL[row.category]}
              </span>
              {row.title}
              {row.status && (
                <span style={{ marginLeft: 6 }}>
                  <GridBadge tone={row.status.tone}>{row.status.label}</GridBadge>
                </span>
              )}
              <div className="erp-split-list-row-sub">{new Date(row.date).toLocaleDateString("ko-KR")}</div>
            </Link>
          ))}
          {!filtered.length ? (
            <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
              {query.trim() ? "검색 결과가 없습니다." : "표시할 항목이 없습니다."}
            </p>
          ) : (
            <SplitListFiller icon={<DocumentIcon />} title="위 + 버튼으로 새 글을 작성해보세요" />
          )}
        </div>
      </section>
    </>
  );
}
