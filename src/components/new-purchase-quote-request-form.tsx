"use client";

import { useActionState, useRef, useState } from "react";
import { createPurchaseQuoteRequest } from "@/app/(dashboard)/purchase-quote-requests/actions";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { ItemEntryBlock } from "@/components/erp/item-entry-block";
import { blankItemRow, buildItemRow, isBlankItemRow, validItemRows, type ItemEntryRow } from "@/lib/item-entry-rows";

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

  function toggleSupplier(id: string) {
    setSupplierIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function addMobileItem(productId: string, quantity: number) {
    const product = products.find((p) => p.id === productId);
    addFilledRow((key) => buildItemRow(key, product, productId, quantity, 0), isBlankItemRow);
  }

  const validRows = validItemRows(rows);
  const itemsJson = JSON.stringify(
    validRows.map((r) => ({ productId: r.productId, spec: r.spec || null, quantity: r.quantity, remark: r.remark || null }))
  );

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="erp-doc-sheet">
      <div className="erp-doc-paper flex flex-col gap-3">
      {supplierIds.map((id) => (
        <input key={id} type="hidden" name="supplier_id" value={id} />
      ))}
      <input type="hidden" name="items" value={itemsJson} />

      <h2 className="erp-doc-title">구 매 견 적 요 청 서</h2>

      <div className="erp-doc-header">
        <div className="erp-doc-header-row erp-doc-header-row-full">
          <span className="erp-doc-header-label">공급처</span>
          <span className="erp-doc-header-value erp-u-p-0" style={{ display: "block" }}>
            <div className="erp-grid-wrap erp-u-border-none erp-u-overflow-y-auto" style={{ maxHeight: 160 }}>
              <table className="erp-grid">
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id}>
                      <td style={{ width: 32 }}>
                        <input
                          type="checkbox"
                          checked={supplierIds.includes(s.id)}
                          onChange={() => toggleSupplier(s.id)}
                          aria-label={`${s.name} 선택`}
                        />
                      </td>
                      <td>{s.name}</td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && (
                    <tr>
                      <td className="erp-grid-empty">등록된 공급처가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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

      <div className="erp-form-actions">
        <button
          ref={submitRef}
          type="submit"
          className="erp-btn erp-btn-primary erp-form-submit"
          disabled={pending || supplierIds.length === 0 || validRows.length === 0}
        >
          {pending ? "등록 중..." : "F7 견적요청 등록"}
        </button>
        <FormMessage state={state} />
      </div>
      </div>
    </form>
  );
}
