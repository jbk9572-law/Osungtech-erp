"use client";

import { useActionState, useState } from "react";
import { bulkCreateTaxInvoices, type BulkTaxInvoiceState } from "@/app/(dashboard)/sales/tax-invoices/bulk-create/actions";
import { FormMessage } from "@/components/form-message";
import { formatNumber } from "@/lib/format-number";

export type BulkEligibleOrder = {
  id: string;
  docNo: number | null;
  date: string;
  customerName: string | null;
  supplyAmount: number;
};

export function BulkTaxInvoiceForm({ orders, today }: { orders: BulkEligibleOrder[]; today: string }) {
  const [state, formAction, pending] = useActionState<BulkTaxInvoiceState, FormData>(bulkCreateTaxInvoices, undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = orders.length > 0 && selected.size === orders.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedTotal = orders
    .filter((o) => selected.has(o.id))
    .reduce((sum, o) => sum + o.supplyAmount, 0);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="sales_order_ids" value={JSON.stringify([...selected])} />

      <div className="erp-field-grid">
        <div className="erp-field erp-span-2" style={{ minWidth: 160 }}>
          <label htmlFor="bulk-ti-date">작성일자</label>
          <input id="bulk-ti-date" name="issue_date" type="date" defaultValue={today} className="erp-input" required />
        </div>
        <div className="erp-field erp-span-2" style={{ minWidth: 120 }}>
          <label htmlFor="bulk-ti-claim">청구/영수</label>
          <select id="bulk-ti-claim" name="claim_type" defaultValue="claim" className="erp-select">
            <option value="claim">청구</option>
            <option value="receipt">영수</option>
          </select>
        </div>
        <button type="submit" className="erp-btn erp-btn-primary" disabled={pending || selected.size === 0}>
          {pending ? "발행 중..." : `F7 선택 ${selected.size}건 일괄 발행`}
        </button>
      </div>

      <FormMessage state={state} />

      {state?.skipped && state.skipped.length > 0 && (
        <div className="erp-detail" style={{ marginTop: 0 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active" style={{ cursor: "default" }}>
              제외된 건 {state.skipped.length}건
            </span>
          </div>
          <div className="erp-detail-body" style={{ fontSize: 12.5 }}>
            <ul style={{ paddingLeft: 16 }}>
              {state.skipped.map((s, i) => (
                <li key={i} style={{ color: "var(--erp-text-muted)" }}>
                  {s.docNo ?? "-"} · {s.customerName ?? "-"} — {s.reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" />
              </th>
              <th style={{ width: 90 }}>거래일자</th>
              <th style={{ width: 90 }}>전표번호</th>
              <th>출고처</th>
              <th className="num" style={{ width: 120 }}>
                공급가액
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggleOne(o.id)}
                    aria-label={`${o.docNo ?? o.id} 선택`}
                  />
                </td>
                <td>{new Date(o.date).toLocaleDateString("ko-KR")}</td>
                <td>{o.docNo ?? "-"}</td>
                <td>{o.customerName ?? "-"}</td>
                <td className="num">{formatNumber(o.supplyAmount)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  세금계산서 발행 대상인 매출 건이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {orders.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} style={{ fontWeight: 700 }}>
                  선택 {selected.size}건 합계
                </td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {formatNumber(selectedTotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </form>
  );
}
