import Link from "next/link";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PartyListA, type PartyListRow } from "@/components/grid/party-list-a";
import type { FormState } from "@/components/form-message";
import { formatNumber } from "@/lib/format-number";

// 거래처·공급처관리 A형(업무 목록) 화면의 서버 틀 — 제목줄(신규·새로고침) + 검색 + 표/패널(PartyListA) + 더보기.
// 두 화면이 같은 틀을 쓰도록 한 곳에서 그린다. 신규·수정은 C형 모달(`${basePath}/new`, `${basePath}/[id]` 가로채기 경로).
export function PartyPageA({
  kind,
  title,
  basePath,
  rows,
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
}: {
  kind: "customer" | "supplier";
  title: string;
  basePath: string;
  rows: PartyListRow[];
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
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="erp-h1">{title}</h1>
        <div className="erp-toolbar erp-u-mb-0">
          <Link href={`${basePath}/new`} className="erp-btn erp-btn-primary">
            F2 신규
          </Link>
          <Link href={q ? `${basePath}?q=${encodeURIComponent(q)}` : basePath} className="erp-btn">
            새로고침
          </Link>
        </div>
      </div>
      <form id={formId} method="get" className="erp-search-row erp-u-mb-8">
        <div className="erp-field">
          <input type="text" name="q" autoComplete="off" defaultValue={q ?? ""} placeholder={searchPlaceholder} className="erp-input erp-u-w-full" />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        <span className="erp-u-muted erp-u-text-compact">총 {formatNumber(rows.length)}건</span>
      </form>
      <PartyListA
        kind={kind}
        rows={rows}
        hrefBase={basePath}
        partyLabel={partyLabel}
        balanceLabel={balanceLabel}
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
