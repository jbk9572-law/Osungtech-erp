"use client";

import { useActionState, useRef, useState } from "react";
import { createPurchaseQuoteRequest } from "@/app/(dashboard)/purchase-quote-requests/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { NumberInput } from "@/components/number-input";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

type Row = { key: number; productId: string; spec: string; quantity: number; remark: string };

function blankRow(key: number): Row {
  return { key, productId: "", spec: "", quantity: 0, remark: "" };
}

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
  const { rows, addRow, removeRow, setRows } = useKeyedRows<Row>([blankRow(0)], blankRow);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function toggleSupplier(id: string) {
    setSupplierIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  const validRows = rows.filter((r) => r.productId && r.quantity > 0);
  const itemsJson = JSON.stringify(
    validRows.map((r) => ({ productId: r.productId, spec: r.spec || null, quantity: r.quantity, remark: r.remark || null }))
  );

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="flex flex-col gap-3">
      {supplierIds.map((id) => (
        <input key={id} type="hidden" name="supplier_id" value={id} />
      ))}
      <input type="hidden" name="items" value={itemsJson} />

      <div className="erp-field" style={{ maxWidth: 620 }}>
        <label>견적을 받을 공급처 (복수 선택 가능)</label>
        <div className="erp-grid-wrap" style={{ maxHeight: 200, overflowY: "auto" }}>
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
      </div>

      <div className="grid grid-cols-2 gap-3" style={{ maxWidth: 400 }}>
        <div className="erp-field">
          <label htmlFor="pq-date">요청일</label>
          <input id="pq-date" name="request_date" type="date" defaultValue={today} className="erp-input" />
        </div>
      </div>

      <div className="erp-field" style={{ maxWidth: 720 }}>
        <label htmlFor="pq-memo">메모(선택)</label>
        <textarea id="pq-memo" name="memo" rows={2} className="erp-input" style={{ resize: "vertical" }} />
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 280 }}>품목</th>
              <th style={{ width: 140 }}>규격</th>
              <th className="num" style={{ width: 100 }}>수량</th>
              <th>비고</th>
              <th style={{ width: 50 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <ProductSearchSelect
                    products={products}
                    value={row.productId}
                    onChange={(productId) => {
                      const product = products.find((p) => p.id === productId);
                      updateRow(row.key, { productId, spec: product?.spec ?? row.spec });
                    }}
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
                  <NumberInput value={row.quantity} onChange={(n) => updateRow(row.key, { quantity: n })} className="erp-input" />
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
        </table>
      </div>

      <button type="button" className="erp-btn" onClick={addRow} style={{ alignSelf: "flex-start" }}>
        + 품목 추가
      </button>

      <div className="flex items-center gap-2">
        <button
          ref={submitRef}
          type="submit"
          className="erp-btn erp-btn-primary"
          disabled={pending || supplierIds.length === 0 || validRows.length === 0}
        >
          {pending ? "등록 중..." : "F7 견적요청 등록"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
