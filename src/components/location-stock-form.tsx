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
          {/* table-layout:fixed에서 칸 하나라도 폭을 안 주면 그 칸이 표
              폭(100%)의 남는 부분을 전부 떠안고, 반대로 표를 auto/
              fit-content로 줄이면 이번엔 표 자체가 컨테이너보다 작아져
              잘린 것처럼 보인다. 모든 칸에 %로 폭을 주고 합이 100%가
              되게 해서 표는 항상 컨테이너 전체 폭을 채우면서 칸 비율도
              고정되게 한다. */}
          <thead>
            <tr>
              <th style={{ width: "34%" }}>품목</th>
              <th style={{ width: "16%" }}>규격</th>
              <th className="num" style={{ width: "12%" }}>
                미배정
              </th>
              <th className="num" style={{ width: "28%" }}>
                이 위치 보관수량
              </th>
              <th style={{ width: "10%" }} />
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
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{product?.spec ?? "-"}</td>
                  <td className="num" style={{ color: "var(--erp-primary-dark)" }}>
                    {product ? `${product.totalQuantity.toLocaleString()}개` : "-"}
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
        &quot;미배정&quot;은 창고 전체 재고에서 다른 위치에 이미 등록해 둔 만큼 뺀 참고값입니다(자동으로
        채워지진 않습니다) — 이 위치에 실제로 있는 수량을 세어서 &quot;이 위치 보관수량&quot;에 입력하세요.
        포장수량이 있는 품목은 몇 박스인지 바로 보여주고, 수량 칸에 &quot;=10+5&quot;처럼 계산식을
        입력해도 됩니다. &quot;+ 품목 추가&quot;로 여러 품목을 한 번에 등록한 뒤 한 번만 저장하면 됩니다.
      </PageGuide>
    </form>
  );
}
