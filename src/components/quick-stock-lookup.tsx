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

// 대시보드에서 품명/규격/SKU만 입력하면 바로 현재 재고가 뜨는 패널 —
// ProductSearchSelect(매출/매입 등록 폼에서 이미 쓰는 공용 검색창)로
// 품목을 고르면, 이미 넘겨받은 재고 목록(재고관리 > 재고현황과 같은
// products+inventory 조인, sumInventoryQuantity 기준)에서 그 자리에서
// 바로 찾아 보여준다 — 재고현황 전체 목록 화면으로 이동할 필요가 없다.
export function QuickStockLookup({ products, compact = false }: { products: StockLookupProduct[]; compact?: boolean }) {
  const [selectedId, setSelectedId] = useState("");
  const selected = products.find((p) => p.id === selectedId) ?? null;
  const isLow =
    !!selected && (selected.reorderPoint ?? 0) > 0 && selected.quantity <= (selected.reorderPoint ?? 0);
  const boxCount =
    selected && shouldShowBoxCountOnDashboard(selected.name, selected.categoryName)
      ? formatBoxCount(selected.quantity, selected.basePackageQty)
      : null;

  // 메인 화면 맨 윗줄용 — 검색창 한 칸 + 고른 품목의 재고를 한 줄로 바로 옆에 보여준다.
  if (compact) {
    return (
      <div className="erp-dash-lookup">
        <div className="erp-dash-lookup-search">
          <ProductSearchSelect products={products} value={selectedId} onChange={setSelectedId} placeholder="재고 조회: 품명·규격·SKU" />
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

  return (
    <div className="erp-home-panel">
      <div className="erp-home-panel-title">퀵 재고조회</div>
      <div className="erp-u-pad-10-12">
        <ProductSearchSelect
          products={products}
          value={selectedId}
          onChange={setSelectedId}
          placeholder="품명, 규격, SKU로 검색"
        />
      </div>
      {selected ? (
        <Link
          href={`/inventory/item/${selected.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            margin: "0 12px 12px",
            padding: "10px 12px",
            border: "1px solid var(--erp-border)",
            background: "var(--erp-bg-subtle)",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <span className="erp-u-minw-0 erp-u-overflow-hidden erp-u-ellipsis erp-u-nowrap">
            {selected.sku} · {selected.name}
            {selected.spec ? ` (${selected.spec})` : ""}
          </span>
          <span className="erp-u-flex erp-u-items-center erp-u-gap-6 erp-u-flex-none">
            <GridBadge tone={isLow ? "danger" : "ok"}>{isLow ? "재주문 필요" : "정상"}</GridBadge>
            <span className="erp-u-bold erp-u-tabular">
              {formatNumber(selected.quantity)}
              {selected.unit}
              {boxCount ? ` (${boxCount})` : ""}
            </span>
          </span>
        </Link>
      ) : (
        <p className="erp-home-empty">품목을 검색해서 선택하면 현재 재고가 바로 표시됩니다.</p>
      )}
    </div>
  );
}
