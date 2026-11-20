"use client";

import { useState } from "react";
import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
import { GridBadge } from "@/components/grid/badge";
import { RowNoCell, RowNoHead } from "@/components/grid/row-no-cell";
import { BalanceSidePanel } from "@/components/grid/balance-side-panel";
import { useBulkDelete } from "@/components/erp/use-bulk-delete";
import type { FormState } from "@/components/form-message";
import { useSideSplit } from "@/lib/erp-theme-features";
import { formatNumber } from "@/lib/format-number";
import type { BalanceRow } from "@/components/balance-grid-table";

export type PartyListRow = {
  id: string;
  code: string;
  name: string;
  person: string | null;
  phone: string | null;
  total: number;
  paid: number;
  balance: number;
  /** 서버(KST)에서 미리 계산한 연체 경과일 — 0이면 연체 아님. */
  daysOverdue: number;
  lastOrderDate: string | null;
};

function creditBadge(r: PartyListRow): { tone: "ok" | "warn" | "danger"; label: string } {
  if (!(r.balance > 0)) return { tone: "ok", label: "정상" };
  if (r.daysOverdue >= 30) return { tone: "danger", label: `D+${r.daysOverdue} 연체` };
  return { tone: "warn", label: "주의" };
}

// 거래처·공급처관리의 A형(업무 목록) 화면 — 표 + 오른쪽 상세 패널(340px). 행 클릭=패널, 이동은 패널의 [상세 보기].
// 체크박스 일괄삭제는 카드형 목록과 같은 훅(useBulkDelete)을 쓴다. 패널이 없는 좁은 화면에서는 행 클릭이 상세로 이동한다.
export function PartyListA({
  kind,
  rows,
  hrefBase,
  partyLabel,
  balanceLabel,
  bulkDeleteAction,
  warningText,
  emptyMessage,
}: {
  kind: "customer" | "supplier";
  rows: PartyListRow[];
  hrefBase: string;
  partyLabel: string;
  balanceLabel: string;
  bulkDeleteAction: (state: FormState, formData: FormData) => Promise<FormState>;
  warningText: string;
  emptyMessage: string;
}) {
  const sideSplit = useSideSplit();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { selected, toggle, bar } = useBulkDelete(bulkDeleteAction, rows.map((r) => ({ id: r.id, label: r.name })), warningText);
  const active = rows.find((r) => r.id === activeId) ?? null;
  const activeRow: BalanceRow | null = active
    ? { id: active.id, name: active.name, total: active.total, paid: active.paid, balance: active.balance, daysOverdue: active.daysOverdue }
    : null;
  const paidWord = kind === "customer" ? "수금" : "지급";

  return (
    <>
      {bar}
      <div className={sideSplit ? "erp-master-detail" : undefined}>
        <div className={sideSplit ? "erp-master-detail-main" : undefined}>
          <div className="erp-grid-wrap has-card-view">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th className="erp-col-check" aria-label="선택" />
                  <RowNoHead />
                  <th>코드</th>
                  <th>{partyLabel}</th>
                  <th>대표·담당</th>
                  <th>연락처</th>
                  <th className="num">{balanceLabel}</th>
                  <th>상태</th>
                  <th>최근 거래</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
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
                      <td>{r.name}</td>
                      <td>{r.person ?? "-"}</td>
                      <td>{r.phone ?? "-"}</td>
                      <td className={`num${r.balance > 0 ? " erp-u-danger erp-u-bold" : ""}`}>{formatNumber(r.balance)}</td>
                      <td>
                        <GridBadge tone={tone}>{label}</GridBadge>
                      </td>
                      <td className="erp-u-muted">{r.lastOrderDate ?? "-"}</td>
                    </ClickableRow>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={9} className="erp-grid-empty">
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
            hrefBase={hrefBase}
            badge={active ? creditBadge(active) : { tone: "ok", label: "정상" }}
            totalLabel={kind === "customer" ? "매출" : "매입"}
            paidLabel={paidWord}
          />
        )}
      </div>

      <div className="erp-row-card-list">
        {rows.map((r) => {
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
        {!rows.length && <p className="erp-grid-empty">{emptyMessage}</p>}
      </div>
    </>
  );
}
