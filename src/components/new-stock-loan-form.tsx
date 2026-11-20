"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { createStockLoan } from "@/app/(dashboard)/inventory/loans/actions";
import { PartySearchSelect } from "@/components/party-search-select";
import { ErpSelect } from "@/components/erp/erp-select";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { useFormRedirect } from "@/lib/use-form-redirect";
import { ItemEntryBlock } from "@/components/erp/item-entry-block";
import { blankItemRow, buildItemRow, isBlankItemRow, validItemRows, type ItemEntryRow } from "@/lib/item-entry-rows";
import { DocSubmitBar, useDocSheetClass } from "@/components/erp/voucher-chrome";
import { PartyContextStrip } from "@/components/erp/party-context-strip";

// 일시반출 등록(빌려줬다가 돌려받는 거래) — 매출 전표 등록 화면의 "일시반출" 탭. 재고는 바로 빠지고, 거래처에 반납되면 '일시반출 현황'에서 반납 처리한다.
// 단가·금액이 없는 문서(견적요청서와 같은 틀)라 매출·미수금·세금계산서에는 잡히지 않는다.
// 제목줄은 전환기(VoucherTypeBar)가 그린다.
export function NewStockLoanForm({
  today,
  customers,
  warehouses,
  products,
}: {
  today: string;
  customers: { id: string; name: string; notes?: string | null }[];
  warehouses: { id: string; name: string }[];
  products: { id: string; sku: string; name: string; spec: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(createStockLoan, undefined);
  useFormRedirect(state);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const { rows, addRow, removeRow, setRows, addFilledRow } = useKeyedRows<ItemEntryRow>([blankItemRow(0)], blankItemRow);

  function updateRow(key: number, patch: Partial<ItemEntryRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addMobileItem(productId: string, quantity: number) {
    const product = products.find((p) => p.id === productId);
    addFilledRow((key) => buildItemRow(key, product, productId, quantity, 0), isBlankItemRow);
  }

  const validRows = validItemRows(rows);
  const itemsJson = useMemo(() => JSON.stringify(validRows.map((r) => ({ productId: r.productId, quantity: r.quantity, remark: r.remark || null }))), [validRows]);
  const docSheetClass = useDocSheetClass();

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className={docSheetClass}>
      <div className="erp-doc-paper flex flex-col gap-3">
        <input type="hidden" name="customer_id" value={customerId} />
        <input type="hidden" name="items" value={itemsJson} />
        <PartyContextStrip kind="customer" partyId={customerId} partyName={customers.find((c) => c.id === customerId)?.name ?? ""} />

        <div className="erp-doc-header">
          <div className="erp-doc-header-row">
            <label htmlFor="loan-customer" className="erp-doc-header-label">반출처</label>
            <span className="erp-doc-header-value">
              <PartySearchSelect parties={customers} value={customerId} onChange={setCustomerId} id="loan-customer" placeholder="반출처(거래처) 검색" />
            </span>
          </div>
          <div className="erp-doc-header-row">
            <label htmlFor="loan-warehouse" className="erp-doc-header-label">반출 창고</label>
            <span className="erp-doc-header-value">
              <ErpSelect id="loan-warehouse" name="warehouse_id" value={warehouseId} onChange={setWarehouseId} required options={warehouses.map((w) => ({ value: w.id, label: w.name }))} />
            </span>
          </div>
          <div className="erp-doc-header-row">
            <label htmlFor="loan-date" className="erp-doc-header-label">반출일</label>
            <span className="erp-doc-header-value">
              <input id="loan-date" name="loan_date" type="date" defaultValue={today} className="erp-input" />
            </span>
          </div>
          <div className="erp-doc-header-row">
            <label htmlFor="loan-due" className="erp-doc-header-label">반납 예정일</label>
            <span className="erp-doc-header-value">
              <input id="loan-due" name="due_date" type="date" min={today} className="erp-input" />
            </span>
          </div>
          <div className="erp-doc-header-row erp-doc-header-row-full">
            <label htmlFor="loan-memo" className="erp-doc-header-label">사유·메모</label>
            <span className="erp-doc-header-value">
              <textarea id="loan-memo" name="memo" rows={2} placeholder="예: 시연용, 품질 테스트, 전시" className="erp-input erp-textarea-compact w-full erp-u-border-none" />
            </span>
          </div>
        </div>

        <ItemEntryBlock products={products} rows={rows} withPrice={false} onUpdate={updateRow} onRemove={removeRow} onAddRow={addRow} onMobileAdd={addMobileItem} />

        <DocSubmitBar>
          <div className="erp-form-actions">
            <button ref={submitRef} type="submit" className="erp-btn erp-btn-primary erp-form-submit" disabled={pending || !customerId || !warehouseId || validRows.length === 0}>
              {pending ? "등록 중..." : "F7 일시반출 등록"}
            </button>
            <FormMessage state={state} />
          </div>
        </DocSubmitBar>
      </div>
    </form>
  );
}
