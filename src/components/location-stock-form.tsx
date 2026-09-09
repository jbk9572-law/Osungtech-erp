"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { setLocationStockBatch } from "@/app/(dashboard)/inventory/locations/actions";
import { ProductSearchSelect } from "@/components/product-search-select";
import { QuantityWithBoxInput } from "@/components/quantity-with-box-input";
import { FormMessage } from "@/components/form-message";
import { PageGuide } from "@/components/erp/page-guide";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { focusSameColumnNextRow, focusGridArrowNav } from "@/lib/grid-enter-nav";

type Product = {
  id: string;
  sku: string;
  name: string;
  spec?: string | null;
  totalQuantity: number;
  basePackageQty: number | null;
};

type Row = { key: number; productId: string; quantity: number };

// 매입/매출/할일 등록 폼과 같은 방식으로 여러 품목을 한 번에 입력받아
// 한 번의 요청으로 저장한다 — 한 줄씩 저장할 때마다 페이지가 매번
// 새로고침돼 여러 품목을 등록할 때 너무 오래 걸린다는 지적이 있었다.
export function LocationStockForm({
  locationId,
  code,
  products,
}: {
  locationId: string;
  code: string;
  products: Product[];
}) {
  const [state, formAction, pending] = useActionState(setLocationStockBatch, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [rows, setRows] = useState<Row[]>([{ key: 0, productId: "", quantity: 0 }]);
  const [nextKey, setNextKey] = useState(1);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local UI state in reaction to a server action result, not derived state
      setRows([{ key: nextKey, productId: "", quantity: 0 }]);
      setNextKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on state changes, nextKey is read not depended on
  }, [state]);

  function addRow() {
    setRows((prev) => [...prev, { key: nextKey, productId: "", quantity: 0 }]);
    setNextKey((k) => k + 1);
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  const itemsJson = JSON.stringify(
    rows.filter((row) => row.productId).map((row) => ({ productId: row.productId, quantity: row.quantity })),
  );

  return (
    <form ref={formRef} action={formAction} onKeyDown={preventEnterSubmit}>
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="items" value={itemsJson} />

      <div className="erp-grid-wrap" style={{ marginBottom: 8 }}>
        <table className="erp-grid" style={{ width: "100%", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th>품목</th>
              <th className="num" style={{ width: 170 }}>
                이 위치 보관수량
              </th>
              <th style={{ width: 64 }} />
            </tr>
          </thead>
          <tbody
            onKeyDown={(e) => {
              focusSameColumnNextRow(e);
              focusGridArrowNav(e);
            }}
          >
            {rows.map((row) => {
              const product = products.find((p) => p.id === row.productId);
              return (
                <tr key={row.key}>
                  <td>
                    <ProductSearchSelect
                      products={products}
                      value={row.productId}
                      onChange={(productId) => updateRow(row.key, { productId, quantity: 0 })}
                    />
                    {product && (
                      <div style={{ fontSize: 11, color: "var(--erp-primary-dark)", marginTop: 2 }}>
                        미배정 {product.totalQuantity.toLocaleString()}개 (다른 위치에 이미 등록해 둔 만큼
                        뺀 참고값, 자동으로 채워지진 않습니다)
                      </div>
                    )}
                  </td>
                  <td className="num">
                    <QuantityWithBoxInput
                      quantity={row.quantity}
                      onQuantityChange={(n) => updateRow(row.key, { quantity: n })}
                      allowFormula
                      basePackageQty={product?.basePackageQty}
                      label="수량"
                      className="erp-input w-full"
                    />
                  </td>
                  <td className="num">
                    <button
                      type="button"
                      className="erp-btn erp-btn-danger"
                      style={{ minWidth: 0, height: 26, padding: "0 8px" }}
                      onClick={() => removeRow(row.key)}
                      disabled={rows.length === 1}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={addRow} className="erp-btn">
          + 품목 추가
        </button>
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 저장 중...
            </>
          ) : (
            "일괄 등록/수정"
          )}
        </button>
        <FormMessage state={state} />
      </div>

      <PageGuide className="mt-2 mb-0">
        품목을 고르면 아래에 참고용 미배정 재고가 뜹니다(자동으로 채워지진 않습니다) — 이 위치에 실제로
        있는 수량을 세어서 입력하세요. 포장수량이 있는 품목은 몇 박스인지 바로 보여주고, 수량 칸에
        &quot;=10+5&quot;처럼 계산식을 입력해도 됩니다. &quot;+ 품목 추가&quot;로 여러 품목을 한 번에
        등록한 뒤 한 번만 저장하면 됩니다.
      </PageGuide>
    </form>
  );
}
