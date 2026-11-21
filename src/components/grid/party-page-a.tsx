import { ListTitleBar } from "@/components/erp/page-header";
import Link from "next/link";
import { ListSearchForm } from "@/components/erp/list-search-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PartyListA, type PartyListRow } from "@/components/grid/party-list-a";
import type { FormState } from "@/components/form-message";
import { formatNumber } from "@/lib/format-number";

// 거래처·공급처관리 A형(업무 목록) 화면의 서버 틀 — 제목줄 + 도구 줄(조회·신규·수정·삭제·엑셀·열 설정, PartyListA 안) + 검색 + 표/패널(PartyListA) + 더보기.
// 두 화면이 같은 틀을 쓰도록 한 곳에서 그린다. 신규·수정은 C형 모달(`${basePath}/new`, `${basePath}/[id]` 가로채기 경로).
export function PartyPageA({
  kind,
  title,
  basePath,
  rows,
  detailHrefBase,
  recentSince,
  q,
  hasMore,
  moreHref,
  moreStep,
  partyLabel,
  balanceLabel,
  searchPlaceholder,
  bulkDeleteAction,
  warningText,
  emptyMessage,
  excelHref,
}: {
  kind: "customer" | "supplier";
  title: string;
  basePath: string;
  rows: PartyListRow[];
  detailHrefBase: string;
  recentSince: string;
  q?: string;
  hasMore: boolean;
  moreHref: string;
  moreStep: number;
  partyLabel: string;
  balanceLabel: string;
  searchPlaceholder: string;
  bulkDeleteAction: (state: FormState, formData: FormData) => Promise<FormState>;
  warningText: string;
  emptyMessage: string;
  /** 전체 목록 엑셀 내려받기 경로 — 없으면 [엑셀] 버튼을 그리지 않는다. */
  excelHref?: string;
}) {
  const formId = `${kind}s-search-form`;
  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: `${basePath}/new` },
          F5: { submitFormSelector: `#${formId}` },
          Escape: { href: "/dashboard" },
        }}
      />
      <ListTitleBar title={<>{title}</>} />
      <PartyListA
        kind={kind}
        rows={rows}
        hrefBase={basePath}
        detailHrefBase={detailHrefBase}
        recentSince={recentSince}
        partyLabel={partyLabel}
        balanceLabel={balanceLabel}
        searchSlot={
          <ListSearchForm formId={formId} q={q} placeholder={searchPlaceholder} ariaLabel={`${partyLabel} 검색`} resetHref={basePath} hideSubmit />
        }
        searchFormId={formId}
        newHref={`${basePath}/new`}
        excelHref={excelHref}
        bulkDeleteAction={bulkDeleteAction}
        warningText={warningText}
        emptyMessage={emptyMessage}
      />
      {!q && hasMore && (
        <div className="erp-u-p-8">
          <Link href={moreHref} className="erp-btn erp-u-w-full">
            더보기 ({formatNumber(moreStep)}개 더)
          </Link>
        </div>
      )}
    </div>
  );
}
