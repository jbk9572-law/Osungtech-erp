import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { GuardedLink } from "@/components/erp/guarded-link";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { RecordListA, type RecordColumn, type RecordRow } from "@/components/grid/record-list-a";
import { formatNumber } from "@/lib/format-number";

// A형(업무 목록) 일반형 화면의 서버 틀 — 제목줄(신규) + 조회 조건(filters 슬롯) + 표/패널 + 더보기.
// 조회 조건(기간 빠른선택·검색 폼)은 화면마다 다르므로 슬롯으로 받는다. 신규는 C형 모달(`${basePath}/new`).
export function RecordPageA({
  title,
  basePath,
  newLabel,
  searchFormId,
  filters,
  columns,
  rows,
  panelAriaLabel,
  hasMore,
  moreHref,
  moreStep,
  emptyMessage,
  bulkDelete,
  newHref,
}: {
  title: string;
  basePath: string;
  newLabel: string;
  /** 검색 폼이 있으면 그 id — F5(조회) 단축키가 이 폼을 제출한다. */
  searchFormId?: string;
  filters: ReactNode;
  columns: RecordColumn[];
  rows: RecordRow[];
  panelAriaLabel: string;
  hasMore: boolean;
  moreHref: string;
  moreStep: number;
  emptyMessage: string;
  bulkDelete?: ComponentProps<typeof RecordListA>["bulkDelete"];
  /** 신규 버튼 주소 — 기본은 `${basePath}/new`. */
  newHref?: string;
}) {
  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: newHref ?? `${basePath}/new` },
          ...(searchFormId ? { F5: { submitFormSelector: `#${searchFormId}` } } : {}),
          Escape: { href: "/dashboard" },
        }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="erp-h1">{title}</h1>
        <div className="erp-toolbar erp-u-mb-0">
          <GuardedLink href={newHref ?? `${basePath}/new`} className="erp-btn erp-btn-primary">
            F2 {newLabel}
          </GuardedLink>
        </div>
      </div>
      {filters}
      <div className="erp-u-text-compact erp-u-muted erp-u-mb-8">총 {formatNumber(rows.length)}건</div>
      <RecordListA
        columns={columns}
        rows={rows}
        panelAriaLabel={panelAriaLabel}
        panelEmptyText="행을 선택하면 상세가 여기에 보입니다."
        emptyMessage={emptyMessage}
        bulkDelete={bulkDelete}
      />
      {hasMore && (
        <div className="erp-u-p-8">
          <Link href={moreHref} className="erp-btn erp-u-w-full">
            더보기 (다음 {formatNumber(moreStep)}건)
          </Link>
        </div>
      )}
    </div>
  );
}
