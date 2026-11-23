import { fetchAllRows } from "@/lib/fetch-all-rows";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// 재고 조정 폼(재고현황 화면의 인라인 폼 / 모달 / 전용 화면)이 같이 쓰는 데이터 — 한 곳에서만 가져온다.
export async function loadInventoryAdjustData(supabase: Supabase) {
  const [pickerProducts, stockLevels, warehouses] = await Promise.all([
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
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("warehouses").select("id, name").order("created_at", { ascending: true }).range(from, to),
    ),
  ]);
  return { pickerProducts, stockLevels, warehouses };
}
