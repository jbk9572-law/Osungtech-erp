"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { PageGuide } from "@/components/erp/page-guide";

type ComponentInfo = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  qtyPerUnit: number;
  stockByWarehouse: Record<string, number>;
};
type ProducibleProduct = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  components: ComponentInfo[];
};
type WarehouseOption = { id: string; name: string };

// 생산지시 등록 폼 — 완제품을 고르면 BOM에 등록된 구성품별 단위당
// 소요량과 현재 재고를 보여주고, 수량을 입력하면 그 자리에서 필요수량을
// 다시 계산해 부족한 구성품에 배지를 띄운다. 실제로 재고가 빠지는 곳은
// 아래에서 고른 그 창고 하나뿐이라, 현재재고도 창고를 바꿀 때마다 그
// 창고 기준으로 다시 계산한다. 매출/매입 등록 화면의 "재고 부족" 표시와
// 같은 소프트 경고 방식 — 등록 자체를 막지는 않는다(재고가 0 밑으로
// 내려가도 DB에서 막지 않는 기존 정책과 동일).
export function WorkOrderForm({
  action,
  producibleProducts,
  warehouses,
  today,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  producibleProducts: ProducibleProduct[];
  warehouses: WarehouseOption[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const [productId, setProductId] = useState(producibleProducts[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");

  const selected = useMemo(
    () => producibleProducts.find((p) => p.id === productId),
    [producibleProducts, productId]
  );
  const qtyNum = Number(quantity) || 0;
  const requirements = useMemo(
    () =>
      (selected?.components ?? []).map((c) => {
        const currentStock = warehouseId ? (c.stockByWarehouse[warehouseId] ?? 0) : 0;
        return {
          ...c,
          currentStock,
          needed: c.qtyPerUnit * qtyNum,
          short: c.qtyPerUnit * qtyNum > currentStock,
        };
      }),
    [selected, qtyNum, warehouseId]
  );
  const hasShortage = requirements.some((r) => r.short);

  if (producibleProducts.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
        아직 BOM(구성품)이 등록된 품목이 없습니다. 품목관리에서 완제품을 열어
        BOM을 먼저 등록해주세요.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <div className="erp-field md:col-span-2">
        <label htmlFor="wo-product">완제품</label>
        <select
          id="wo-product"
          name="product_id"
          className="erp-input w-full"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          required
        >
          {producibleProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} · {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="erp-field">
        <label htmlFor="wo-warehouse">창고</label>
        <select
          id="wo-warehouse"
          name="warehouse_id"
          className="erp-input w-full"
          required
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
        >
          <option value="" disabled>
            선택
          </option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      <div className="erp-field">
        <label htmlFor="wo-quantity">
          생산 수량 {selected ? `(${selected.unit})` : ""}
        </label>
        <input
          id="wo-quantity"
          type="number"
          name="quantity"
          step="0.0001"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="erp-input w-full"
          required
        />
      </div>
      <div className="erp-field">
        <label htmlFor="wo-date">지시일자</label>
        <input id="wo-date" type="date" name="order_date" defaultValue={today} className="erp-input w-full" required />
      </div>
      <div className="erp-field md:col-span-3">
        <label htmlFor="wo-memo">메모 (선택)</label>
        <input id="wo-memo" type="text" name="memo" autoComplete="off" className="erp-input w-full" />
      </div>

      {requirements.length > 0 && (
        <div className="md:col-span-4">
          <PageGuide className="mb-1.5">
            구성품 소요량입니다. 현재재고는 위에서 고른 창고 기준입니다.
          </PageGuide>
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th>구성품</th>
                  <th className="num" style={{ width: 120 }}>
                    필요수량
                  </th>
                  <th className="num" style={{ width: 120 }}>
                    현재재고
                  </th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {requirements.map((r) => (
                  <tr key={r.productId}>
                    <td>
                      {r.sku} · {r.name}
                    </td>
                    <td className="num">
                      {r.needed.toLocaleString()} {r.unit}
                    </td>
                    <td className="num">
                      {r.currentStock.toLocaleString()} {r.unit}
                    </td>
                    <td>
                      {r.short && (
                        <span
                          className="text-xs font-semibold"
                          style={{ color: "var(--erp-danger)" }}
                        >
                          재고 부족
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasShortage && (
            <p
              className="mt-2 rounded-sm px-3 py-2 text-xs font-medium"
              style={{ background: "var(--erp-warning-bg)", color: "var(--erp-warning)" }}
            >
              ⚠ 구성품 재고가 부족합니다. 그래도 등록하면 해당 구성품 재고가
              음수가 될 수 있습니다.
            </p>
          )}
        </div>
      )}

      <div className="md:col-span-4 flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 등록 중...
            </>
          ) : (
            "F7 생산지시 등록"
          )}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
