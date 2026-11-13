"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { sumInventoryQuantity } from "@/lib/inventory-quantity";
import type { StockLookupProduct } from "@/components/quick-stock-lookup";

// 메인 화면 맨 윗줄 "재고 조회"에 쓸 품목 목록 — 재고관리 > 재고현황과 같은 products+inventory 조인(sumInventoryQuantity 기준)이라
// 항상 같은 수치가 나온다. 예전에는 메인 화면을 열 때마다 이 전체 목록을 받아 왔는데(품목이 많을수록 무겁다), 이제 검색창을
// 처음 쓸 때 한 번만 불러온다. 로그인한 사용자의 권한(RLS) 그대로 조회한다.
export async function loadStockLookupProducts(): Promise<StockLookupProduct[]> {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const rows = await fetchAllRows<{
    id: string;
    sku: string;
    name: string;
    spec: string | null;
    unit: string;
    base_package_qty: number | null;
    reorder_point: number | null;
    categories: { name: string } | null;
    inventory: { quantity: number; warehouse_id: string }[];
  }>((from, to) =>
    supabase
      .from("products")
      .select("id, sku, name, spec, unit, base_package_qty, reorder_point, categories(name), inventory(quantity, warehouse_id)")
      .order("name")
      .range(from, to),
  );
  return rows.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    spec: p.spec,
    unit: p.unit,
    categoryName: p.categories?.name ?? null,
    basePackageQty: p.base_package_qty,
    reorderPoint: p.reorder_point,
    quantity: sumInventoryQuantity(p.inventory),
  }));
}
