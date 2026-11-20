"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClickableRow } from "@/components/clickable-row";
import { GridBadge } from "@/components/grid/badge";
import { GridGroupHeaderRow } from "@/components/grid/group-header-row";
import { RowNoCell, RowNoHead } from "@/components/grid/row-no-cell";
import { BalanceSidePanel } from "@/components/grid/balance-side-panel";
import { ListSummaryBar } from "@/components/grid/list-summary-bar";
import { SheetColumnMenu, SortableTh } from "@/components/grid/sheet-parts";
import { useBulkDelete } from "@/components/erp/use-bulk-delete";
import type { FormState } from "@/components/form-message";
import { useSideSplit } from "@/lib/erp-theme-features";
import { formatNumber } from "@/lib/format-number";
import { startRouteProgress } from "@/lib/route-progress";
import { useRowKeyboard, useSheetTable } from "@/lib/use-sheet-table";
import type { BalanceRow } from "@/components/balance-grid-table";

export type PartyListRow = {
  id: string;
  code: string;
  name: string;
  person: string | null;
  phone: string | null;
  email: string | null;
  businessNumber: string | null;
  address: string | null;
  paymentTerms: string | null;
  total: number;
  paid: number;
  balance: number;
  /** 서버(KST)에서 미리 계산한 연체 경과일 — 0이면 연체 아님. */
  daysOverdue: number;
  lastOrderDate: string | null;
};

type Filter = "all" | "balance" | "overdue" | "recent";

function creditBadge(r: PartyListRow): { tone: "ok" | "warn" | "danger"; label: string } {
  if (r.daysOverdue <= 0) return { tone: "ok", label: "정상" };
  return { tone: r.daysOverdue >= 90 ? "danger" : "warn", label: `D+${r.daysOverdue}` };
}

// 열 정의(표 머리글·정렬·열 설정이 같이 쓴다) — 묶음 머리글(거래처 5 | 미수금 2 | 거래 1)과 순서가 같다.
const PARTY_COLS = ["코드", "명", "대표", "연락처", "결제조건", "잔액", "연체", "최근 거래"] as const;
const PARTY_GROUPS = [{ from: 0, to: 4 }, { from: 5, to: 6 }, { from: 7, to: 7 }] as const;
function partyValue(r: PartyListRow, col: number) {
  return [r.code, r.name, r.person, r.phone, r.paymentTerms, r.balance, r.daysOverdue, r.lastOrderDate][col];
}

// 거래처·공급처관리의 A형(업무 목록) 화면 — 빠른 필터 칩 + 요약 줄 + 묶음 머리글 표 + 오른쪽 상세 패널(340px). 행 클릭=패널, 수정·상세 이동은 패널 버튼.
// 체크박스 일괄삭제는 카드형 목록과 같은 훅(useBulkDelete)을 쓴다. 패널이 없는 좁은 화면에서는 행 클릭이 상세로 이동한다.
export function PartyListA({
  kind,
  rows,
  hrefBase,
  detailHrefBase,
  recentSince,
  partyLabel,
  balanceLabel,
  searchSlot,
  bulkDeleteAction,
  warningText,
  emptyMessage,
}: {
  kind: "customer" | "supplier";
  rows: PartyListRow[];
  /** 이 목록의 주소(예: /customers) — 수정은 `${hrefBase}/${id}` 모달. */
  hrefBase: string;
  /** 거래·잔액 상세(예: /receivables) — 패널의 [상세 보기]와 바로가기. */
  detailHrefBase: string;
  /** "최근 30일 거래" 기준일(YYYY-MM-DD, 서버 KST 계산). */
  recentSince: string;
  partyLabel: string;
  balanceLabel: string;
  searchSlot: ReactNode;
  bulkDeleteAction: (state: FormState, formData: FormData) => Promise<FormState>;
  warningText: string;
  emptyMessage: string;
}) {
  const sideSplit = useSideSplit();
  const [filter, setFilter] = useState<Filter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      balance: rows.filter((r) => r.balance > 0).length,
      overdue: rows.filter((r) => r.daysOverdue > 0).length,
      recent: rows.filter((r) => !!r.lastOrderDate && r.lastOrderDate >= recentSince).length,
    }),
    [rows, recentSince],
  );
  const visible = useMemo(
    () =>
      rows.filter((r) =>
        filter === "balance" ? r.balance > 0 : filter === "overdue" ? r.daysOverdue > 0 : filter === "recent" ? !!r.lastOrderDate && r.lastOrderDate >= recentSince : true,
      ),
    [rows, filter, recentSince],
  );
  const { ordered, sort, toggleSort, widths, setWidth, hidden, toggleHidden, isVisible, ariaSort } = useSheetTable(visible, partyValue);
  const router = useRouter();
  const balanceSum = rows.reduce((n, r) => n + (r.balance > 0 ? r.balance : 0), 0);

  const { selected, toggle, bar } = useBulkDelete(bulkDeleteAction, visible.map((r) => ({ id: r.id, label: r.name })), warningText);
  const active = ordered.find((r) => r.id === activeId) ?? null;
  const onKeyDown = useRowKeyboard(
    ordered.map((r) => r.id),
    activeId,
    setActiveId,
    (id) => {
      startRouteProgress();
      router.push(`${hrefBase}/${id}`);
    },
    (id) => {
      const r = ordered.find((x) => x.id === id);
      return r ? PARTY_COLS.map((_, c) => partyValue(r, c) ?? "").join("\t") : "";
    },
  );
  const labelOf = (i: number) => (i === 1 ? partyLabel + "명" : i === 5 ? balanceLabel : PARTY_COLS[i]);
  const groupSpan = (g: { from: number; to: number }) => PARTY_COLS.slice(g.from, g.to + 1).filter((_, k) => isVisible(g.from + k)).length;
  const activeRow: BalanceRow | null = active
    ? { id: active.id, name: active.name, total: active.total, paid: active.paid, balance: active.balance, daysOverdue: active.daysOverdue }
    : null;
  const paidWord = kind === "customer" ? "수금" : "지급";
  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "balance", label: kind === "customer" ? "미수 있음" : "미지급 있음" },
    { key: "overdue", label: "연체" },
    { key: "recent", label: "최근 30일 거래" },
  ];

  return (
    <>
      <div className="erp-party-toolbar">
        <div className="erp-date-presets">
          {filters.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`erp-date-preset-btn${filter === f.key ? " active" : ""}`}>
              {f.label}
              <b className="erp-date-preset-count">{formatNumber(counts[f.key])}</b>
            </button>
          ))}
        </div>
        {searchSlot}
      </div>
      <ListSummaryBar
        items={[
          { label: partyLabel, value: `${formatNumber(rows.length)}곳` },
          { label: `${balanceLabel} 합계`, value: formatNumber(balanceSum) },
          { label: `연체 ${partyLabel}`, value: `${formatNumber(counts.overdue)}곳` },
        ]}
      />
      {bar}
      <div className="erp-u-flex erp-u-justify-end erp-u-mb-8">
        <SheetColumnMenu labels={PARTY_COLS.map((_, i) => labelOf(i))} hidden={hidden} onToggle={toggleHidden} />
      </div>
      <div className={sideSplit ? "erp-master-detail" : undefined}>
        <div className={sideSplit ? "erp-master-detail-main" : undefined}>
          <div className="erp-grid-wrap has-card-view erp-sheet" tabIndex={0} onKeyDown={onKeyDown} aria-label="목록 — 위아래 방향키로 행 이동, Enter로 열기, Ctrl+C로 행 복사">
            <table className="erp-grid">
              <thead>
                <GridGroupHeaderRow
                  before={1}
                  groups={[
                    { span: groupSpan(PARTY_GROUPS[0]), label: partyLabel },
                    { span: groupSpan(PARTY_GROUPS[1]), label: kind === "customer" ? "미수금" : "미지급금" },
                    { span: groupSpan(PARTY_GROUPS[2]), label: "거래" },
                  ].filter((g) => g.span > 0)}
                />
                <tr>
                  <RowNoHead checkbox={<span aria-hidden />} />
                  {PARTY_COLS.map((_, i) =>
                    isVisible(i) ? <SortableTh key={i} label={labelOf(i)} col={i} sort={sort} ariaSort={ariaSort(i)} onSort={toggleSort} num={i === 5} width={widths[i]} onResize={(px) => setWidth(i, px)} /> : null,
                  )}
                </tr>
              </thead>
              <tbody>
                {ordered.map((r, i) => {
                  const { tone, label } = creditBadge(r);
                  const cells = [
                    <td key={0} className="erp-u-muted">{r.code}</td>,
                    <td key={1} className="erp-u-bold">{r.name}</td>,
                    <td key={2}>{r.person ?? "-"}</td>,
                    <td key={3}>{r.phone ?? "-"}</td>,
                    <td key={4} className="erp-u-muted">{r.paymentTerms ?? "-"}</td>,
                    <td key={5} className={`num${r.balance > 0 ? " erp-u-danger erp-u-bold" : ""}`}>{formatNumber(r.balance)}</td>,
                    <td key={6}><GridBadge tone={tone}>{label}</GridBadge></td>,
                    <td key={7} className="erp-u-muted">{r.lastOrderDate ? r.lastOrderDate.slice(5).replace("-", "/") : "-"}</td>,
                  ];
                  return (
                    <ClickableRow
                      key={r.id}
                      href={`${hrefBase}/${r.id}`}
                      className={activeId === r.id ? "master-active" : undefined}
                      onActivate={sideSplit ? () => setActiveId(r.id) : undefined}
                    >
                      <RowNoCell n={i + 1} checkbox={<input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`${r.name} 선택`} />} />
                      {cells.filter((_, ci) => isVisible(ci))}
                    </ClickableRow>
                  );
                })}
                {!visible.length && (
                  <tr>
                    <td colSpan={PARTY_COLS.filter((_, i) => isVisible(i)).length + 2} className="erp-grid-empty">
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {sideSplit && (
          <BalanceSidePanel
            kind={kind}
            row={activeRow}
            hrefBase={detailHrefBase}
            badge={active ? creditBadge(active) : { tone: "ok", label: "정상" }}
            totalLabel={kind === "customer" ? "매출" : "매입"}
            paidLabel={paidWord}
            profile={
              active
                ? {
                    code: active.code,
                    email: active.email,
                    businessNumber: active.businessNumber,
                    address: active.address,
                    paymentTerms: active.paymentTerms,
                    lastOrderDate: active.lastOrderDate,
                    editHref: `${hrefBase}/${active.id}`,
                  }
                : null
            }
          />
        )}
      </div>

      <div className="erp-row-card-list">
        {ordered.map((r) => {
          const { tone, label } = creditBadge(r);
          return (
            <Link key={r.id} href={`${hrefBase}/${r.id}`} className="erp-row-card">
              <div className="erp-row-card-head">
                <span className="erp-row-card-partner">{r.name}</span>
                <GridBadge tone={tone}>{label}</GridBadge>
              </div>
              <div className="erp-u-muted erp-u-text-compact">{[r.code, r.person, r.phone].filter(Boolean).join(" · ")}</div>
              <div className="erp-row-card-foot">
                <span className="erp-u-muted">{balanceLabel}</span>
                <span className="erp-row-card-amount">{formatNumber(r.balance)}</span>
              </div>
            </Link>
          );
        })}
        {!visible.length && <p className="erp-grid-empty">{emptyMessage}</p>}
      </div>
    </>
  );
}
