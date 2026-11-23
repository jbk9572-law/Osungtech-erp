"use client";

import { useActionState, useRef, useState } from "react";
import { createPurchaseQuoteRequest } from "@/app/(dashboard)/purchase-quote-requests/actions";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { CheckListPicker } from "@/components/erp/check-list-picker";
import { ItemEntryBlock } from "@/components/erp/item-entry-block";
import { blankItemRow, buildItemRow, isBlankItemRow, validItemRows, type ItemEntryRow } from "@/lib/item-entry-rows";
import { DocSubmitBar, VoucherTitle, useDocSheetClass } from "@/components/erp/voucher-chrome";

export function NewPurchaseQuoteRequestForm({
  today,
  suppliers,
  products,
}: {
  today: string;
  suppliers: { id: string; name: string }[];
  products: { id: string; sku: string; name: string; spec: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(createPurchaseQuoteRequest, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const { rows, addRow, removeRow, setRows, addFilledRow } = useKeyedRows<ItemEntryRow>([blankItemRow(0)], blankItemRow);

  function updateRow(key: number, patch: Partial<ItemEntryRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addMobileItem(productId: string, quantity: number) {
    const product = products.find((p) => p.id === productId);
    addFilledRow((key) => buildItemRow(key, product, productId, quantity, 0), isBlankItemRow);
  }

  const validRows = validItemRows(rows);
  const itemsJson = JSON.stringify(
    validRows.map((r) => ({
      productId: r.productId,
      spec: r.spec || null,
      quantity: r.quantity,
      quantityFormula: r.quantityFormula ?? null,
      remark: r.remark || null,
    }))
  );

  const docSheetClass = useDocSheetClass();
  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className={docSheetClass}>
      <div className="erp-doc-paper flex flex-col gap-3">
      {supplierIds.map((id) => (
        <input key={id} type="hidden" name="supplier_id" value={id} />
      ))}
      <input type="hidden" name="items" value={itemsJson} />

      <VoucherTitle title="구매견적요청서" savedAt={null} />

      <div className="erp-doc-header">
        <div className="erp-doc-header-row erp-doc-header-row-full">
          <span className="erp-doc-header-label">공급처</span>
          <span className="erp-doc-header-value erp-u-p-0">
            <CheckListPicker
              items={suppliers}
              selected={supplierIds}
              onChange={setSupplierIds}
              ariaLabel="견적을 받을 공급처"
              searchPlaceholder="공급처 이름 검색"
              emptyText="등록된 공급처가 없습니다. 공급처관리에서 먼저 등록하세요."
            />
          </span>
        </div>
        <div className="erp-doc-header-row erp-doc-header-row-full">
          <label htmlFor="pq-date" className="erp-doc-header-label">요청일</label>
          <span className="erp-doc-header-value">
            <input id="pq-date" name="request_date" type="date" defaultValue={today} className="erp-input" style={{ maxWidth: 180 }} />
          </span>
        </div>
        <div className="erp-doc-header-row erp-doc-header-row-full">
          <label htmlFor="pq-memo" className="erp-doc-header-label">메모</label>
          <span className="erp-doc-header-value">
            <textarea id="pq-memo" name="memo" rows={2} className="erp-input erp-textarea-compact w-full erp-u-border-none" />
          </span>
        </div>
      </div>

      <ItemEntryBlock
        products={products}
        rows={rows}
        withPrice={false}
        onUpdate={updateRow}
        onRemove={removeRow}
        onAddRow={addRow}
        onMobileAdd={addMobileItem}
      />

      <DocSubmitBar>
      <div className="erp-form-actions">
        <button
          ref={submitRef}
          type="submit"
          className="erp-btn erp-btn-primary erp-form-submit"
          disabled={pending || supplierIds.length === 0 || validRows.length === 0}
        >
          {pending ? "등록 중..." : "F7 견적요청 등록"}
        </button>
        {!pending && (supplierIds.length === 0 || validRows.length === 0) && (
          <span className="erp-u-muted erp-u-text-compact">
            {supplierIds.length === 0 ? "공급처를 1곳 이상 고르세요." : "품목을 1개 이상 입력하세요(수량 1 이상)."}
          </span>
        )}
        <FormMessage state={state} />
      </div>
      </DocSubmitBar>
      </div>
    </form>
  );
}
