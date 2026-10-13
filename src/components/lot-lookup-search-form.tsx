"use client";

import { useState } from "react";
import { ProductSearchSelect } from "@/components/product-search-select";

type Product = { id: string; sku: string; name: string; spec: string | null };

// 관리번호(로트) 정확히 알고 있을 때는 텍스트로, 로트를 모르고 품목만
// 알 때는 ProductSearchSelect로 — 두 방식을 한 폼에서 같이 받는다(사용자
// 피드백: "품명 규격 로트로 불량/수불 파악하려던 건데" — 로트 전용
// 검색만으로는 부족하다는 지적).
export function LotLookupSearchForm({
  products,
  q,
  productId,
}: {
  products: Product[];
  q: string;
  productId: string;
}) {
  const [selectedProductId, setSelectedProductId] = useState(productId);

  return (
    <form method="get" className="erp-field-grid">
      <div className="erp-field erp-span-3">
        <label htmlFor="lot-q">관리번호(LOT)</label>
        <input
          id="lot-q"
          type="text"
          name="q"
          autoComplete="off"
          defaultValue={q}
          placeholder="예: LOT1024"
          className="erp-input"
          style={{ width: "100%", textTransform: "uppercase" }}
        />
      </div>
      <div className="erp-field erp-span-4">
        <label htmlFor="lot-product">또는 품목으로 찾기</label>
        <ProductSearchSelect
          id="lot-product"
          products={products}
          value={selectedProductId}
          onChange={setSelectedProductId}
          placeholder="코드, 품명 또는 규격"
        />
        <input type="hidden" name="productId" value={selectedProductId} />
      </div>
      <button type="submit" className="erp-btn erp-btn-primary">
        F5 조회
      </button>
    </form>
  );
}
