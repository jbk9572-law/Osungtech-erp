"use client";

import { useState } from "react";
import { ErpSelect } from "@/components/erp/erp-select";

type Product = { id: string; sku: string; name: string };
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
}: {
  products: Product[];
  warehouses: Warehouse[];
  defaultProductId: string;
  defaultWarehouseId: string;
}) {
  const [productId, setProductId] = useState(defaultProductId);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);

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
          options={products.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }))}
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
