"use client";

import { useState } from "react";
import { ErpSelect } from "@/components/erp/erp-select";
import { productOptionLabel } from "@/lib/product-label";

type Product = { id: string; sku: string; name: string; spec?: string | null };
type Warehouse = { id: string; name: string };

// 수불부 조회 폼(GET 폼)은 서버 컴포넌트라 React state를 들 수 없다 —
// ErpSelect는 제어 컴포넌트라 자기 state가 필요해서, 이 작은 클라이언트
// 컴포넌트 하나로 분리한다. 각 ErpSelect가 만드는 숨김 input은 그대로
// 바깥 <form method="get">의 일부로 제출되므로, 부모(서버 컴포넌트)가
// 선택값을 알 필요는 없다.
export function LedgerFilterSelects({
  products,
  warehouses,
  defaultProductId,
  defaultWarehouseId,
  formId,
}: {
  products: Product[];
  warehouses: Warehouse[];
  defaultProductId: string;
  defaultWarehouseId: string;
  /** 주면 도구줄용 한 줄 모양(라벨·칸 래퍼 없이) — 선택값은 이 id의 폼(조회 도구줄)으로 제출된다 */
  formId?: string;
}) {
  const [productId, setProductId] = useState(defaultProductId);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);

  if (formId) {
    return (
      <>
        <div className="erp-fb-select erp-fb-select-wide">
          <ErpSelect
            id="ledger-product-bar"
            ariaLabel="품목"
            name="product_id"
            form={formId}
            required
            placeholder="품목 선택"
            value={productId}
            onChange={setProductId}
            options={products.map((p) => ({ value: p.id, label: productOptionLabel(p) }))}
          />
        </div>
        <div className="erp-fb-select">
          <ErpSelect
            id="ledger-warehouse-bar"
            ariaLabel="창고"
            name="warehouse_id"
            form={formId}
            value={warehouseId}
            onChange={setWarehouseId}
            options={[{ value: "", label: "전체 창고" }, ...warehouses.map((w) => ({ value: w.id, label: w.name }))]}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="erp-field erp-span-4">
        <label htmlFor="ledger-product">품목</label>
        <ErpSelect
          id="ledger-product"
          name="product_id"
          required
          placeholder="선택"
          value={productId}
          onChange={setProductId}
          options={products.map((p) => ({ value: p.id, label: productOptionLabel(p) }))}
        />
      </div>
      <div className="erp-field erp-span-3">
        <label htmlFor="ledger-warehouse">창고</label>
        <ErpSelect
          id="ledger-warehouse"
          name="warehouse_id"
          value={warehouseId}
          onChange={setWarehouseId}
          options={[{ value: "", label: "전체 창고" }, ...warehouses.map((w) => ({ value: w.id, label: w.name }))]}
        />
      </div>
    </>
  );
}
