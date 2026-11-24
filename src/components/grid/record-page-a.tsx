import { ListTitleBar } from "@/components/erp/page-header";
import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { FilterBarForm, FilterControls } from "@/components/erp/list-filter-bar";
import type { DatePreset } from "@/lib/date-presets";
import { RecordListA, type RecordColumn, type RecordRow } from "@/components/grid/record-list-a";
import { formatNumber } from "@/lib/format-number";

// A형(업무 목록) 일반형 화면의 서버 틀 — 제목줄 + 조회 조건(filters 슬롯) + 표/패널 + 더보기.
// 조회 조건(기간 빠른선택·검색 폼)은 화면마다 다르므로 슬롯으로 받는다. 신규는 C형 모달(`${basePath}/new`).
export function RecordPageA({
  title,
  basePath,
  newLabel,
  searchFormId,
  filters,
  filterBar,
  search,
  columns,
  rows,
  panelAriaLabel,
  hasMore,
  moreHref,
  moreStep,
  emptyMessage,
  bulkDelete,
  newHref,
  excelHref,
}: {
  title: string;
  basePath: string;
  newLabel: string;
  /** 검색 폼이 있으면 그 id — F5(조회) 단축키가 이 폼을 제출한다. */
  searchFormId?: string;
  /** 검색 줄 위에 놓는 안내·기간 조건 등. 한 칸짜리 검색은 search로 — 도구 줄 오른쪽 끝에 놓인다. */
  filters?: ReactNode;
  /** 조회 조건을 도구줄 한 줄(조회·기간·검색)에 모아 그린다 — searchFormId를 폼 id로 쓴다. filters(예전 조건 카드)와 같이 쓰지 않는다. */
  filterBar?: { from?: string; to?: string; q?: string; searchPlaceholder: string; presets: DatePreset[]; monthButtons: DatePreset[]; showReset: boolean };
  /** 한 칸짜리 검색 폼(ListSearchForm) — 도구 줄 오른쪽 끝. */
  search?: ReactNode;
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
  /** 전체 목록 엑셀 내려받기 경로 — 없으면 [엑셀] 버튼을 그리지 않는다. */
  excelHref?: string;
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
      <ListTitleBar title={<>{title}</>} />
      {filters}
      {filterBar && searchFormId && <FilterBarForm formId={searchFormId} basePath={basePath} />}
      <RecordListA
        columns={columns}
        rows={rows}
        panelAriaLabel={panelAriaLabel}
        panelEmptyText="행을 선택하면 상세가 여기에 보입니다."
        emptyMessage={emptyMessage}
        bulkDelete={bulkDelete}
        searchFormId={searchFormId}
        newHref={newHref ?? `${basePath}/new`}
        newLabel={newLabel}
        excelHref={excelHref}
        search={search}
        filters={
          filterBar && searchFormId ? (
            <FilterControls formId={searchFormId} basePath={basePath} from={filterBar.from} to={filterBar.to} q={filterBar.q} searchPlaceholder={filterBar.searchPlaceholder} presets={filterBar.presets} monthButtons={filterBar.monthButtons} showReset={filterBar.showReset} />
          ) : undefined
        }
        partial={hasMore}
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
