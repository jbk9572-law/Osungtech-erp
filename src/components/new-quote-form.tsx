"use client";

import { useActionState, useState } from "react";
import { createQuote } from "@/app/(dashboard)/quotes/actions";
import { PartySearchSelect } from "@/components/party-search-select";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { ItemEntryBlock } from "@/components/erp/item-entry-block";
import { blankItemRow, buildItemRow, isBlankItemRow, validItemRows, type ItemEntryRow } from "@/lib/item-entry-rows";

export function NewQuoteForm({
  today,
  customers,
  products,
}: {
  today: string;
  customers: { id: string; name: string }[];
  products: { id: string; sku: string; name: string; spec: string | null; price: number }[];
}) {
  const [state, formAction, pending] = useActionState(createQuote, undefined);
  const [customerId, setCustomerId] = useState("");
  const { rows, addRow, removeRow, setRows, addFilledRow } = useKeyedRows<ItemEntryRow>([blankItemRow(0)], blankItemRow);

  function updateRow(key: number, patch: Partial<ItemEntryRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // 모바일 카드형 패널에서 "품목 추가"를 누르면 호출된다 — 데스크톱 표와 같은
  // rows 상태를 그대로 쓴다.
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
      unitPrice: r.unitPrice,
      remark: r.remark || null,
    }))
  );

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="erp-doc-sheet">
      <div className="erp-doc-paper flex flex-col gap-3">
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="items" value={itemsJson} />

      <h2 className="erp-doc-title">견 적 서</h2>

      <div className="erp-doc-header">
        <div className="erp-doc-header-row">
          <label htmlFor="q-customer" className="erp-doc-header-label">거래처</label>
          <span className="erp-doc-header-value">
            <PartySearchSelect parties={customers} value={customerId} onChange={setCustomerId} id="q-customer" />
          </span>
        </div>
        <div className="erp-doc-header-row">
          <label htmlFor="q-date" className="erp-doc-header-label">견적일</label>
          <span className="erp-doc-header-value">
            <input id="q-date" name="quote_date" type="date" defaultValue={today} className="erp-input" />
          </span>
        </div>
        <div className="erp-doc-header-row">
          <label htmlFor="q-valid-until" className="erp-doc-header-label">유효기간</label>
          <span className="erp-doc-header-value">
            <input id="q-valid-until" name="valid_until" type="date" className="erp-input" />
          </span>
        </div>
        <div className="erp-doc-header-row erp-doc-header-row-full">
          <label htmlFor="q-memo" className="erp-doc-header-label">메모</label>
          <span className="erp-doc-header-value">
            <textarea id="q-memo" name="memo" rows={2} className="erp-input erp-textarea-compact w-full erp-u-border-none" />
          </span>
        </div>
      </div>

      <ItemEntryBlock
        products={products}
        rows={rows}
        withPrice
        defaultPriceOf={(p) => p.price}
        onUpdate={updateRow}
        onRemove={removeRow}
        onAddRow={addRow}
        onMobileAdd={addMobileItem}
      />

      <FormMessage state={state} />

      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending || !customerId || validRows.length === 0} style={{ alignSelf: "flex-start" }}>
        {pending ? "등록 중..." : "견적서 등록"}
      </button>
      </div>
    </form>
  );
}
