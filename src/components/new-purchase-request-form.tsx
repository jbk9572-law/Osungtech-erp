"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { createPurchaseRequest } from "@/app/(dashboard)/purchase-requests/actions";
import { PartySearchSelect } from "@/components/party-search-select";
import { ProductSearchSelect } from "@/components/product-search-select";
import { NumberInput } from "@/components/number-input";
import { FormMessage } from "@/components/form-message";
import { useKeyedRows } from "@/lib/use-keyed-rows";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

type Row = {
  key: number;
  productId: string;
  spec: string;
  quantity: number;
  estimatedUnitPrice: number;
  remark: string;
};

function blankRow(key: number): Row {
  return { key, productId: "", spec: "", quantity: 0, estimatedUnitPrice: 0, remark: "" };
}

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
  const { rows, addRow, removeRow, setRows } = useKeyedRows<Row>(
    prefillItems?.length
      ? prefillItems.map((item, i) => {
          const product = products.find((p) => p.id === item.productId);
          return {
            key: i,
            productId: item.productId,
            spec: product?.spec ?? "",
            quantity: item.quantity,
            estimatedUnitPrice: product?.cost ?? 0,
            remark: "재고 부족 자동 발주 제안",
          };
        })
      : [blankRow(0)],
    blankRow,
  );

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const validRows = rows.filter((r) => r.productId && r.quantity > 0);
  const total = validRows.reduce((sum, r) => sum + r.quantity * r.estimatedUnitPrice, 0);
  const itemsJson = JSON.stringify(
    validRows.map((r) => ({
      productId: r.productId,
      spec: r.spec || null,
      quantity: r.quantity,
      estimatedUnitPrice: r.estimatedUnitPrice,
      remark: r.remark || null,
    }))
  );

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="supplier_id" value={supplierId} />
      <input type="hidden" name="items" value={itemsJson} />

      <div className="grid grid-cols-2 gap-3" style={{ maxWidth: 500 }}>
        <div className="erp-field">
          <label htmlFor="pr-supplier">공급처</label>
          <PartySearchSelect parties={suppliers} value={supplierId} onChange={setSupplierId} id="pr-supplier" />
        </div>
        <div className="erp-field">
          <label htmlFor="pr-date">요청일</label>
          <input id="pr-date" name="request_date" type="date" defaultValue={today} className="erp-input" />
        </div>
      </div>

      <div className="erp-field" style={{ maxWidth: 720 }}>
        <label htmlFor="pr-memo">메모(선택)</label>
        <textarea id="pr-memo" name="memo" rows={2} className="erp-input" style={{ resize: "vertical" }} />
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 260 }}>품목</th>
              <th style={{ width: 140 }}>규격</th>
              <th className="num" style={{ width: 90 }}>수량</th>
              <th className="num" style={{ width: 110 }}>예상단가</th>
              <th className="num" style={{ width: 110 }}>예상금액</th>
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
                        estimatedUnitPrice: row.estimatedUnitPrice || product?.cost || 0,
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
                  <NumberInput
                    value={row.estimatedUnitPrice}
                    onChange={(n) => updateRow(row.key, { estimatedUnitPrice: n })}
                    className="erp-input"
                  />
                </td>
                <td className="num">{(row.quantity * row.estimatedUnitPrice).toLocaleString()}</td>
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
              <td colSpan={3} className="num" style={{ fontWeight: 700 }}>
                합계
              </td>
              <td className="num" style={{ fontWeight: 700 }}>
                {total.toLocaleString()}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
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
          disabled={pending || !supplierId || validRows.length === 0}
        >
          {pending ? "등록 중..." : "F7 구매요청 등록"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
