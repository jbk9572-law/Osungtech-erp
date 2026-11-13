"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { createTaxInvoiceCorrection } from "@/app/(dashboard)/sales/[id]/tax-invoice/actions";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { PageGuide } from "@/components/erp/page-guide";
import { ErpSelect } from "@/components/erp/erp-select";
import {
  applyTaxInvoiceRowPatch,
  blankTaxInvoiceRow,
  seedTaxInvoiceRows,
  summarizeTaxInvoiceRows,
  type TaxInvoiceRow,
} from "@/lib/tax-invoice-rows";
import { TaxInvoiceItemsGrid } from "@/components/tax-invoice-items-grid";
import { formatNumber } from "@/lib/format-number";


const MODIFICATION_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "error_correction", label: "기재사항 착오정정" },
  { value: "duplicate_issued", label: "착오에 의한 이중발급" },
  { value: "supply_amount_change", label: "공급가액 변동" },
  { value: "contract_cancelled", label: "계약의 해제" },
  { value: "goods_returned", label: "재화의 환입" },
  { value: "export_lc_after", label: "내국신용장 등 사후 개설" },
];

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
  const [modificationReason, setModificationReason] = useState("error_correction");
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const seeded = useMemo<TaxInvoiceRow[]>(
    () => seedTaxInvoiceRows(originalItems, today, { negateQuantity: true }),
    [originalItems, today],
  );

  const { rows, addRow, removeRow, setRows } = useKeyedRows<TaxInvoiceRow>(seeded, (key) => blankTaxInvoiceRow(key, today));

  function updateRow(key: number, patch: Partial<TaxInvoiceRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? applyTaxInvoiceRowPatch(r, patch) : r)));
  }

  const { validRows, totalSupply, totalTax, totalAmount, itemsJson } = summarizeTaxInvoiceRows(rows);

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

        <p className="text-xs erp-u-muted">
          당초 세금계산서 작성일자: {new Date(originalIssueDate).toLocaleDateString("ko-KR")}
        </p>

        <div className="erp-doc-header">
          <div className="erp-doc-header-row">
            <label htmlFor="ti-mod-reason" className="erp-doc-header-label">수정사유</label>
            <span className="erp-doc-header-value">
              <ErpSelect
                id="ti-mod-reason"
                name="modification_reason"
                value={modificationReason}
                onChange={setModificationReason}
                options={MODIFICATION_REASON_OPTIONS}
              />
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
              <textarea id="ti-mod-remark" name="remark" rows={2} className="erp-input erp-textarea-compact w-full erp-u-border-none" />
            </span>
          </div>
        </div>
        <PageGuide className="mb-0">
          작성일자는 원칙적으로 당초 세금계산서 작성일자를 따르되, 계약 해제·재화 환입 등 사유에 따라 달라질 수 있습니다 — 정확한 기준은 세무사와 확인해주세요.
        </PageGuide>

        <TaxInvoiceItemsGrid
          rows={rows}
          onUpdate={updateRow}
          onRemove={removeRow}
          onAdd={addRow}
          totalSupply={totalSupply}
          totalTax={totalTax}
          allowNegative
        />

        <div className="erp-doc-header">
          <div className="erp-doc-header-row">
            <span className="erp-doc-header-label">합계금액</span>
            <span className="erp-doc-header-value erp-u-bold">
              {formatNumber(totalAmount)}원
            </span>
          </div>
        </div>

        <FormMessage state={state} />
        <button
          ref={submitRef}
          type="submit"
          className="erp-btn erp-btn-primary erp-form-submit"
          disabled={pending || validRows.length === 0}
        >
          {pending ? "발행 중..." : "F7 수정세금계산서 발행"}
        </button>
      </div>
    </form>
  );
}
