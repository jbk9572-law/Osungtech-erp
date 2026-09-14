import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { InventoryAdjustForm } from "@/components/inventory-adjust-form";
import { ProductGridTable, type ProductGridRow } from "@/components/product-grid-table";
import { PageGuide } from "@/components/erp/page-guide";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  // 재고 조정 폼(위쪽)에 필요한 건 전체 품목 목록 + 현재 재고 수량뿐이라,
  // 카테고리/공급처까지 조인하는 아래 그리드용 무거운 쿼리를 기다리지
  // 않고 먼저 렌더링할 수 있게 따로 가져온다. 그리드 자체는 그 무거운
  // 쿼리가 끝나는 대로 Suspense로 뒤이어 스트리밍된다.
  const [pickerProducts, stockLevels, { data: warehouse }] = await Promise.all([
    fetchAllRows<{
      id: string;
      sku: string;
      name: string;
      spec: string | null;
      unit: string;
      base_package_qty: number | null;
    }>((from, to) =>
      supabase
        .from("products")
        .select("id, sku, name, spec, unit, base_package_qty")
        .order("name")
        .range(from, to),
    ),
    fetchAllRows<{ product_id: string; warehouse_id: string; quantity: number }>((from, to) =>
      supabase.from("inventory").select("product_id, warehouse_id, quantity").range(from, to),
    ),
    supabase.from("warehouses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">재고관리 &gt; 재고현황</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href="/inventory/reorder-suggestions" className="erp-btn">
            재고 부족 자동 발주 제안
          </Link>
          <Link href="/inventory/count" className="erp-btn erp-btn-primary">
            재고 실사
          </Link>
        </div>
      </div>
      <PageGuide>
        재고 수량은 매입(입고) · 매출(출고) · 재고 조정 내역의 합으로 자동 계산됩니다. 직접 수량을
        바꿀 수는 없고, 기초재고를 등록할 때는 아래 재고 조정을, 전체 품목을 한 번에 실사해 맞출
        때는 우측 상단 &quot;재고 실사&quot;를 사용하세요.
      </PageGuide>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">재고 조정 (기초재고 등록 등)</span>
        </div>
        <div className="erp-detail-body">
          <InventoryAdjustForm
            products={pickerProducts}
            warehouseId={warehouse?.id ?? ""}
            stockLevels={stockLevels}
          />
        </div>
      </div>

      <form method="get" className="erp-search">
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="search-q">품목 / 규격 검색</label>
          <input
            id="search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="상품명, SKU, 규격, 카테고리, 공급처"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          조회
        </button>
        {q && (
          <Link href="/inventory" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <Suspense fallback={<div className="erp-loading-panel"><div className="erp-loading-gauge" aria-hidden />품목 불러오는 중...</div>}>
        <InventoryGrid q={q} />
      </Suspense>
    </div>
  );
}

// 카테고리/공급처 조인 + 재고 배열까지 붙는, 이 화면에서 제일 무거운
// 쿼리는 이 컴포넌트 안에 가둬서 위쪽(재고 조정 폼)이 이걸 기다리지
// 않고 먼저 뜨게 한다.
async function InventoryGrid({ q }: { q?: string }) {
  const supabase = await createClient();
  // 매입/매출/조정이 한 번도 없어 inventory 행이 아예 없는 상품도 수량 0으로
  // 표시하기 위해 products를 기준으로 재고를 왼쪽 조인한다.
  const products = await fetchAllRows<{
    id: string;
    sku: string;
    name: string;
    spec: string | null;
    unit: string;
    reorder_point: number | null;
    base_package_qty: number | null;
    cost: number;
    price: number;
    categories: { name: string } | null;
    suppliers: { name: string } | null;
    inventory: { quantity: number; warehouse_id: string }[];
  }>((from, to) =>
    supabase
      .from("products")
      .select(
        "id, sku, name, spec, unit, reorder_point, base_package_qty, cost, price, categories(name), suppliers(name), inventory(quantity, warehouse_id)"
      )
      .order("name")
      .range(from, to),
  );

  const allStockRows: ProductGridRow[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    spec: p.spec,
    unit: p.unit,
    basePackageQty: p.base_package_qty,
    categoryName: p.categories?.name ?? null,
    supplierName: p.suppliers?.name ?? null,
    cost: p.cost,
    price: p.price,
    reorderPoint: p.reorder_point,
    quantity: p.inventory?.[0]?.quantity ?? 0,
  }));

  const keyword = q?.trim().toLowerCase();
  const stockRows = keyword
    ? allStockRows.filter((row) =>
        matchesSearch(keyword, row.name, row.sku, row.spec, row.categoryName, row.supplierName),
      )
    : allStockRows;

  return <ProductGridTable rows={stockRows} mode="inventory" keyword={keyword} />;
}
