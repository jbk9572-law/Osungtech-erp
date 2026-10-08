"use client";

import { useActionState, useMemo, useRef } from "react";
import { createTaxInvoiceCorrection } from "@/app/(dashboard)/sales/[id]/tax-invoice/actions";
import { NumberInput } from "@/components/number-input";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { KeyboardHintBar } from "@/components/erp/keyboard-hint-bar";
import { PageGuide } from "@/components/erp/page-guide";
import { calcVat } from "@/lib/tax";
import { formatNumber } from "@/lib/format-number";

const MAX_ROWS = 16;
const ITEM_GRID_TOTAL_WIDTH = 110 + 200 + 110 + 70 + 90 + 110 + 90 + 140 + 50;

const MODIFICATION_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "error_correction", label: "기재사항 착오정정" },
  { value: "duplicate_issued", label: "착오에 의한 이중발급" },
  { value: "supply_amount_change", label: "공급가액 변동" },
  { value: "contract_cancelled", label: "계약의 해제" },
  { value: "goods_returned", label: "재화의 환입" },
  { value: "export_lc_after", label: "내국신용장 등 사후 개설" },
];

type Row = {
  key: number;
  lineDate: string;
  itemName: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  supplyAmount: number;
  taxAmount: number;
  remark: string;
};

function blankRow(key: number, defaultDate: string): Row {
  return { key, lineDate: defaultDate, itemName: "", spec: "", quantity: 0, unitPrice: 0, supplyAmount: 0, taxAmount: 0, remark: "" };
}

export function TaxInvoiceCorrectionForm({
  salesOrderId,
  originalInvoiceId,
  today,
  originalIssueDate,
  originalItems,
}: {
  salesOrderId: string;
  originalInvoiceId: string;
  today: string;
  originalIssueDate: string;
  // 원본 품목 — 기본값으로 수량을 음수로 뒤집어 깔아준다(이중발급 취소/전체
  // 취소 후 재발행이 제일 흔한 케이스라서). 부분 수정이면 사용자가 직접
  // 금액을 고쳐 쓰면 된다.
  originalItems: { itemName: string; spec: string; quantity: number; unitPrice: number }[];
}) {
  const [state, formAction, pending] = useActionState(createTaxInvoiceCorrection, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const seeded = useMemo<Row[]>(() => {
    if (originalItems.length === 0) return [blankRow(0, today)];
    return originalItems.slice(0, MAX_ROWS).map((r, i) => {
      const quantity = -r.quantity;
      const supplyAmount = quantity * r.unitPrice;
      return {
        key: i,
        lineDate: today,
        itemName: r.itemName,
        spec: r.spec,
        quantity,
        unitPrice: r.unitPrice,
        supplyAmount,
        taxAmount: calcVat(supplyAmount),
        remark: "",
      };
    });
  }, [originalItems, today]);

  const { rows, addRow, removeRow, setRows } = useKeyedRows<Row>(seeded, (key) => blankRow(key, today));

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (patch.quantity !== undefined || patch.unitPrice !== undefined) {
          next.supplyAmount = next.quantity * next.unitPrice;
          next.taxAmount = calcVat(next.supplyAmount);
        }
        return next;
      }),
    );
  }

  const validRows = rows.filter((r) => r.itemName.trim());
  const totalSupply = validRows.reduce((sum, r) => sum + r.supplyAmount, 0);
  const totalTax = validRows.reduce((sum, r) => sum + r.taxAmount, 0);
  const totalAmount = totalSupply + totalTax;
  const itemsJson = JSON.stringify(
    validRows.map((r) => ({
      lineDate: r.lineDate || null,
      itemName: r.itemName,
      spec: r.spec || null,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      supplyAmount: r.supplyAmount,
      taxAmount: r.taxAmount,
      remark: r.remark || null,
    })),
  );

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="erp-doc-sheet">
      <div className="erp-doc-paper flex flex-col gap-3">
        <input type="hidden" name="sales_order_id" value={salesOrderId} />
        <input type="hidden" name="original_invoice_id" value={originalInvoiceId} />
        <input type="hidden" name="items" value={itemsJson} />
        <input type="hidden" name="supply_amount" value={totalSupply} />
        <input type="hidden" name="tax_amount" value={totalTax} />
        <input type="hidden" name="total_amount" value={totalAmount} />

        <h2 className="erp-doc-title">수 정 세 금 계 산 서</h2>

        <p className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
          당초 세금계산서 작성일자: {new Date(originalIssueDate).toLocaleDateString("ko-KR")}
        </p>

        <div className="erp-doc-header">
          <div className="erp-doc-header-row">
            <label htmlFor="ti-mod-reason" className="erp-doc-header-label">수정사유</label>
            <span className="erp-doc-header-value">
              <select id="ti-mod-reason" name="modification_reason" defaultValue="error_correction" className="erp-select">
                {MODIFICATION_REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div className="erp-doc-header-row">
            <label htmlFor="ti-mod-date" className="erp-doc-header-label">작성일자</label>
            <span className="erp-doc-header-value">
              <input id="ti-mod-date" name="issue_date" type="date" defaultValue={today} className="erp-input" required />
            </span>
          </div>
          <div className="erp-doc-header-row erp-doc-header-row-full">
            <label htmlFor="ti-mod-remark" className="erp-doc-header-label">비고</label>
            <span className="erp-doc-header-value">
              <textarea id="ti-mod-remark" name="remark" rows={2} className="erp-input erp-textarea-compact w-full" style={{ border: "none" }} />
            </span>
          </div>
        </div>
        <PageGuide className="mb-0">
          작성일자는 원칙적으로 당초 세금계산서 작성일자를 따르되, 계약 해제·재화 환입 등 사유에 따라 달라질 수 있습니다 — 정확한 기준은 세무사와 확인해주세요.
        </PageGuide>

        <div className="erp-grid-wrap">
          <table
            className="erp-grid"
            style={{ tableLayout: "fixed", width: ITEM_GRID_TOTAL_WIDTH, minWidth: ITEM_GRID_TOTAL_WIDTH }}
          >
            <thead>
              <tr>
                <th style={{ width: 110 }}>날짜</th>
                <th style={{ width: 200 }}>품목</th>
                <th style={{ width: 110 }}>규격</th>
                <th className="num" style={{ width: 70 }}>수량</th>
                <th className="num" style={{ width: 90 }}>단가</th>
                <th className="num" style={{ width: 110 }}>공급가액</th>
                <th className="num" style={{ width: 90 }}>세액</th>
                <th style={{ width: 140 }}>비고</th>
                <th style={{ width: 50 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <input
                      type="date"
                      value={row.lineDate}
                      onChange={(e) => updateRow(row.key, { lineDate: e.target.value })}
                      className="erp-input"
                    />
                  </td>
                  <td>
                    <input
                      value={row.itemName}
                      onChange={(e) => updateRow(row.key, { itemName: e.target.value })}
                      className="erp-input"
                      autoComplete="off"
                    />
                  </td>
                  <td>
                    <input
                      value={row.spec}
                      onChange={(e) => updateRow(row.key, { spec: e.target.value })}
                      className="erp-input"
                      autoComplete="off"
                    />
                  </td>
                  <td>
                    <NumberInput value={row.quantity} onChange={(n) => updateRow(row.key, { quantity: n })} className="erp-input" allowNegative />
                  </td>
                  <td>
                    <NumberInput value={row.unitPrice} onChange={(n) => updateRow(row.key, { unitPrice: n })} className="erp-input" allowNegative />
                  </td>
                  <td>
                    <NumberInput
                      value={row.supplyAmount}
                      onChange={(n) => updateRow(row.key, { supplyAmount: n })}
                      className="erp-input"
                      allowNegative
                    />
                  </td>
                  <td>
                    <NumberInput value={row.taxAmount} onChange={(n) => updateRow(row.key, { taxAmount: n })} className="erp-input" allowNegative />
                  </td>
                  <td>
                    <input
                      value={row.remark}
                      onChange={(e) => updateRow(row.key, { remark: e.target.value })}
                      className="erp-input"
                      autoComplete="off"
                    />
                  </td>
                  <td>
                    <button type="button" className="erp-btn" onClick={() => removeRow(row.key)} style={{ minWidth: 0 }}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="num" style={{ fontWeight: 700 }}>
                  합계
                </td>
                <td className="num erp-doc-total">{formatNumber(totalSupply)}</td>
                <td className="num erp-doc-total">{formatNumber(totalTax)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>

        <button
          type="button"
          className="erp-btn"
          onClick={addRow}
          disabled={rows.length >= MAX_ROWS}
          style={{ alignSelf: "flex-start" }}
        >
          + 품목 추가 ({rows.length}/{MAX_ROWS})
        </button>

        <div className="erp-doc-header">
          <div className="erp-doc-header-row">
            <span className="erp-doc-header-label">합계금액</span>
            <span className="erp-doc-header-value" style={{ fontWeight: 700 }}>
              {formatNumber(totalAmount)}원
            </span>
          </div>
        </div>

        <FormMessage state={state} />
        <button
          ref={submitRef}
          type="submit"
          className="erp-btn erp-btn-primary"
          disabled={pending || validRows.length === 0}
          style={{ alignSelf: "flex-start" }}
        >
          {pending ? "발행 중..." : "F7 수정세금계산서 발행"}
        </button>
      </div>
      <KeyboardHintBar items={[{ key: "F7", label: "발행" }]} />
    </form>
  );
}
