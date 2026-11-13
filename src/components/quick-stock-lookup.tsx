"use client";

import Link from "next/link";
import { useState } from "react";
import { ProductSearchSelect } from "@/components/product-search-select";
import { GridBadge } from "@/components/grid/badge";
import { formatNumber } from "@/lib/format-number";
import { formatBoxCount } from "@/lib/package-qty";
import { shouldShowBoxCountOnDashboard } from "@/components/dashboard-calendar";

export type StockLookupProduct = {
  id: string;
  sku: string;
  name: string;
  spec: string | null;
  unit: string;
  categoryName: string | null;
  basePackageQty: number | null;
  reorderPoint: number | null;
  quantity: number;
};

// 메인 화면 맨 윗줄 "재고 조회" — 품명/규격/SKU를 입력해 품목을 고르면 바로 옆에 현재 재고가 한 줄로 뜬다.
// ProductSearchSelect(매출/매입 등록 폼에서 이미 쓰는 공용 검색창)를 재사용하고, 품목 목록은 검색창을 처음 쓸 때(포커스/입력)
// 한 번만 서버에서 불러온다 — 메인 화면을 열 때마다 전체 품목+재고를 받던 것을 없앴다(loadProducts는 서버 액션).
export function QuickStockLookup({ loadProducts }: { loadProducts: () => Promise<StockLookupProduct[]> }) {
  const [products, setProducts] = useState<StockLookupProduct[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "done">("idle");
  const [selectedId, setSelectedId] = useState("");
  const selected = products.find((p) => p.id === selectedId) ?? null;
  const isLow = !!selected && (selected.reorderPoint ?? 0) > 0 && selected.quantity <= (selected.reorderPoint ?? 0);
  const boxCount =
    selected && shouldShowBoxCountOnDashboard(selected.name, selected.categoryName)
      ? formatBoxCount(selected.quantity, selected.basePackageQty)
      : null;

  const ensureLoaded = () => {
    if (loadState !== "idle") return;
    setLoadState("loading");
    loadProducts()
      .then((list) => setProducts(list))
      .catch(() => undefined)
      .finally(() => setLoadState("done"));
  };

  return (
    <div className="erp-dash-lookup">
      <div className="erp-dash-lookup-search" onFocusCapture={ensureLoaded} onKeyDownCapture={ensureLoaded}>
        <ProductSearchSelect
          products={products}
          value={selectedId}
          onChange={setSelectedId}
          placeholder={loadState === "loading" ? "품목을 불러오는 중..." : "재고 조회: 품명·규격·SKU"}
        />
      </div>
      {selected && (
        <Link href={`/inventory/item/${selected.id}`} className="erp-dash-lookup-result">
          <span className="erp-dash-lookup-name">
            {selected.name}
            {selected.spec ? ` (${selected.spec})` : ""}
          </span>
          <GridBadge tone={isLow ? "danger" : "ok"}>{isLow ? "재주문 필요" : "정상"}</GridBadge>
          <strong className="erp-u-tabular">
            {formatNumber(selected.quantity)}
            {selected.unit}
            {boxCount ? ` (${boxCount})` : ""}
          </strong>
        </Link>
      )}
    </div>
  );
}
