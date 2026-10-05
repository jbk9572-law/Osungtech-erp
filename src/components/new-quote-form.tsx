"use client";

import { useActionState, useMemo, useState } from "react";
import { createQuote } from "@/app/(dashboard)/quotes/actions";
import { PartySearchSelect } from "@/components/party-search-select";
import { ProductSearchSelect } from "@/components/product-search-select";
import { NumberInput } from "@/components/number-input";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { formatNumber } from "@/lib/format-number";

type Row = {
  key: number;
  productId: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  remark: string;
};

function blankRow(key: number): Row {
  return { key, productId: "", spec: "", quantity: 0, unitPrice: 0, remark: "" };
}

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
  const { rows, addRow, removeRow, setRows } = useKeyedRows<Row>([blankRow(0)], blankRow);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const validRows = rows.filter((r) => r.productId && r.quantity > 0);
  const total = validRows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
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
            <textarea id="q-memo" name="memo" rows={2} className="erp-input erp-textarea-compact w-full" style={{ border: "none" }} />
          </span>
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 320 }}>품목</th>
              <th style={{ width: 140 }}>규격</th>
              <th className="num" style={{ width: 90 }}>수량</th>
              <th className="num" style={{ width: 110 }}>단가</th>
              <th className="num" style={{ width: 110 }}>금액</th>
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
                      const product = productById.get(productId);
                      updateRow(row.key, {
                        productId,
                        spec: product?.spec ?? row.spec,
                        unitPrice: row.unitPrice || product?.price || 0,
                      });
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
                  <NumberInput value={row.unitPrice} onChange={(n) => updateRow(row.key, { unitPrice: n })} className="erp-input" />
                </td>
                <td className="num">{formatNumber((row.quantity * row.unitPrice))}</td>
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
              <td colSpan={4} className="num" style={{ fontWeight: 700 }}>
                합계
              </td>
              <td className="num erp-doc-total">
                {formatNumber(total)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <button type="button" className="erp-btn" onClick={addRow} style={{ alignSelf: "flex-start" }}>
        + 품목 추가
      </button>

      <FormMessage state={state} />

      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending || !customerId || validRows.length === 0} style={{ alignSelf: "flex-start" }}>
        {pending ? "등록 중..." : "견적서 등록"}
      </button>
      </div>
    </form>
  );
}
