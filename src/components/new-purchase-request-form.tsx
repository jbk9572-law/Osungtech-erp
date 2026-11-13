"use client";

import { useActionState, useRef, useState } from "react";
import { createPurchaseRequest } from "@/app/(dashboard)/purchase-requests/actions";
import { PartySearchSelect } from "@/components/party-search-select";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { ItemEntryBlock } from "@/components/erp/item-entry-block";
import { blankItemRow, buildItemRow, isBlankItemRow, validItemRows, type ItemEntryRow } from "@/lib/item-entry-rows";

export function NewPurchaseRequestForm({
  today,
  suppliers,
  products,
  prefillSupplierId,
  prefillItems,
}: {
  today: string;
  suppliers: { id: string; name: string }[];
  products: { id: string; sku: string; name: string; spec: string | null; cost: number }[];
  // 재고 부족 자동 발주 제안(/inventory/reorder-suggestions)에서 "구매요청
  // 작성으로 보내기"를 눌렀을 때만 채워진다(new-purchase-form.tsx의
  // prefillSupplierId/prefillItems와 동일한 패턴).
  prefillSupplierId?: string;
  prefillItems?: { productId: string; quantity: number }[];
}) {
  const [state, formAction, pending] = useActionState(createPurchaseRequest, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const [supplierId, setSupplierId] = useState(prefillSupplierId ?? "");
  const { rows, addRow, removeRow, setRows, addFilledRow } = useKeyedRows<ItemEntryRow>(
    prefillItems?.length
      ? prefillItems.map((item, i) => {
          const product = products.find((p) => p.id === item.productId);
          return buildItemRow(i, product, item.productId, item.quantity, product?.cost ?? 0, "재고 부족 자동 발주 제안");
        })
      : [blankItemRow(0)],
    blankItemRow,
  );

  function updateRow(key: number, patch: Partial<ItemEntryRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addMobileItem(productId: string, quantity: number, unitPrice: number) {
    const product = products.find((p) => p.id === productId);
    addFilledRow((key) => buildItemRow(key, product, productId, quantity, unitPrice), isBlankItemRow);
  }

  const validRows = validItemRows(rows);
  const itemsJson = JSON.stringify(
    validRows.map((r) => ({
      productId: r.productId,
      spec: r.spec || null,
      quantity: r.quantity,
      estimatedUnitPrice: r.unitPrice,
      remark: r.remark || null,
    }))
  );

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="erp-doc-sheet">
      <div className="erp-doc-paper flex flex-col gap-3">
      <input type="hidden" name="supplier_id" value={supplierId} />
      <input type="hidden" name="items" value={itemsJson} />

      <h2 className="erp-doc-title">구 매 요 청 서</h2>

      <div className="erp-doc-header">
        <div className="erp-doc-header-row">
          <label htmlFor="pr-supplier" className="erp-doc-header-label">공급처</label>
          <span className="erp-doc-header-value">
            <PartySearchSelect parties={suppliers} value={supplierId} onChange={setSupplierId} id="pr-supplier" />
          </span>
        </div>
        <div className="erp-doc-header-row">
          <label htmlFor="pr-date" className="erp-doc-header-label">요청일</label>
          <span className="erp-doc-header-value">
            <input id="pr-date" name="request_date" type="date" defaultValue={today} className="erp-input" />
          </span>
        </div>
        <div className="erp-doc-header-row erp-doc-header-row-full">
          <label htmlFor="pr-memo" className="erp-doc-header-label">메모</label>
          <span className="erp-doc-header-value">
            <textarea id="pr-memo" name="memo" rows={2} className="erp-input erp-textarea-compact w-full erp-u-border-none" />
          </span>
        </div>
      </div>

      <ItemEntryBlock
        products={products}
        rows={rows}
        withPrice
        priceLabel="예상단가"
        amountLabel="예상금액"
        defaultPriceOf={(p) => p.cost}
        onUpdate={updateRow}
        onRemove={removeRow}
        onAddRow={addRow}
        onMobileAdd={addMobileItem}
      />

      <div className="erp-form-actions">
        <button
          ref={submitRef}
          type="submit"
          className="erp-btn erp-btn-primary erp-form-submit"
          disabled={pending || !supplierId || validRows.length === 0}
        >
          {pending ? "등록 중..." : "F7 구매요청 등록"}
        </button>
        <FormMessage state={state} />
      </div>
      </div>
    </form>
  );
}
