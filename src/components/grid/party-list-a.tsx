"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
import { GridBadge } from "@/components/grid/badge";
import { GridGroupHeaderRow } from "@/components/grid/group-header-row";
import { RowNoCell, RowNoHead } from "@/components/grid/row-no-cell";
import { BalanceSidePanel } from "@/components/grid/balance-side-panel";
import { ListSummaryBar } from "@/components/grid/list-summary-bar";
import { useBulkDelete } from "@/components/erp/use-bulk-delete";
import type { FormState } from "@/components/form-message";
import { useSideSplit, useThemeFeatures } from "@/lib/erp-theme-features";
import { formatNumber } from "@/lib/format-number";
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
  const { groupedHeader } = useThemeFeatures();
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
  const balanceSum = rows.reduce((n, r) => n + (r.balance > 0 ? r.balance : 0), 0);

  const { selected, toggle, bar } = useBulkDelete(bulkDeleteAction, visible.map((r) => ({ id: r.id, label: r.name })), warningText);
  const active = visible.find((r) => r.id === activeId) ?? null;
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
      <div className={sideSplit ? "erp-master-detail" : undefined}>
        <div className={sideSplit ? "erp-master-detail-main" : undefined}>
          <div className="erp-grid-wrap has-card-view">
            <table className="erp-grid">
              <thead>
                <GridGroupHeaderRow
                  before={1 + (groupedHeader ? 1 : 0)}
                  groups={[
                    { span: 5, label: partyLabel },
                    { span: 2, label: kind === "customer" ? "미수금" : "미지급금" },
                    { span: 1, label: "거래" },
                  ]}
                />
                <tr>
                  <th className="erp-col-check" aria-label="선택" />
                  <RowNoHead />
                  <th>코드</th>
                  <th>{partyLabel}명</th>
                  <th>대표</th>
                  <th>연락처</th>
                  <th>결제조건</th>
                  <th className="num">{balanceLabel}</th>
                  <th>연체</th>
                  <th>최근 거래</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  const { tone, label } = creditBadge(r);
                  return (
                    <ClickableRow
                      key={r.id}
                      href={`${hrefBase}/${r.id}`}
                      className={sideSplit && activeId === r.id ? "master-active" : undefined}
                      onActivate={sideSplit ? () => setActiveId(r.id) : undefined}
                    >
                      <td className="erp-col-check" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`${r.name} 선택`} />
                      </td>
                      <RowNoCell n={i + 1} />
                      <td className="erp-u-muted">{r.code}</td>
                      <td className="erp-u-bold">{r.name}</td>
                      <td>{r.person ?? "-"}</td>
                      <td>{r.phone ?? "-"}</td>
                      <td className="erp-u-muted">{r.paymentTerms ?? "-"}</td>
                      <td className={`num${r.balance > 0 ? " erp-u-danger erp-u-bold" : ""}`}>{formatNumber(r.balance)}</td>
                      <td>
                        <GridBadge tone={tone}>{label}</GridBadge>
                      </td>
                      <td className="erp-u-muted">{r.lastOrderDate ? r.lastOrderDate.slice(5).replace("-", "/") : "-"}</td>
                    </ClickableRow>
                  );
                })}
                {!visible.length && (
                  <tr>
                    <td colSpan={10} className="erp-grid-empty">
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
        {visible.map((r) => {
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
