import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InventoryAdjustForm } from "@/components/inventory-adjust-form";
import { InventoryGridTable } from "@/components/inventory-grid-table";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const [{ data: products }, { data: warehouse }] = await Promise.all([
    // 매입/매출/조정이 한 번도 없어 inventory 행이 아예 없는 상품도 수량 0으로
    // 표시하기 위해 products를 기준으로 재고를 왼쪽 조인한다.
    supabase
      .from("products")
      .select("id, sku, name, spec, unit, reorder_point, base_package_qty, inventory(quantity, warehouse_id)")
      .order("name"),
    supabase.from("warehouses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const allStockRows = (products ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    spec: p.spec,
    reorderPoint: p.reorder_point,
    quantity: p.inventory?.[0]?.quantity ?? 0,
  }));

  const keyword = q?.trim().toLowerCase();
  const stockRows = keyword
    ? allStockRows.filter(
        (row) =>
          row.name.toLowerCase().includes(keyword) ||
          row.sku.toLowerCase().includes(keyword) ||
          (row.spec ?? "").toLowerCase().includes(keyword)
      )
    : allStockRows;

  const stockLevels = (products ?? []).flatMap((p) =>
    p.inventory.map((inv) => ({
      product_id: p.id,
      warehouse_id: inv.warehouse_id,
      quantity: inv.quantity,
    }))
  );

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-[#182338]">재고관리 &gt; 재고현황</h1>
      <p className="mb-4 text-xs text-[#6b7280]">
        재고 수량은 매입(입고) · 매출(출고) · 아래 재고 조정 내역의 합으로 자동 계산됩니다. 직접
        수량을 바꿀 수는 없고, 기초재고를 등록하거나 실사 후 수량을 맞출 때는 아래 재고 조정을
        사용하세요.
      </p>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">재고 조정 (기초재고 등록 등)</span>
        </div>
        <div className="erp-detail-body">
          <InventoryAdjustForm
            products={(products ?? []).map((p) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              spec: p.spec,
              unit: p.unit,
              base_package_qty: p.base_package_qty,
            }))}
            warehouseId={warehouse?.id ?? ""}
            stockLevels={stockLevels}
          />
        </div>
      </div>

      <form method="get" className="erp-search">
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label>품목 / 규격 검색</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="상품명, SKU, 규격"
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

      <InventoryGridTable rows={stockRows} keyword={keyword} />
    </div>
  );
}
