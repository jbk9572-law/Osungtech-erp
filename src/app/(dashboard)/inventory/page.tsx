import { createClient } from "@/lib/supabase/server";
import { InventoryAdjustForm } from "@/components/inventory-adjust-form";

export default async function InventoryPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: warehouse }] = await Promise.all([
    // 매입/매출/조정이 한 번도 없어 inventory 행이 아예 없는 상품도 수량 0으로
    // 표시하기 위해 products를 기준으로 재고를 왼쪽 조인한다.
    supabase
      .from("products")
      .select("id, sku, name, spec, reorder_point, inventory(quantity, warehouse_id)")
      .order("name"),
    supabase.from("warehouses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const stockRows = (products ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    reorderPoint: p.reorder_point,
    quantity: p.inventory?.[0]?.quantity ?? 0,
  }));

  const stockLevels = (products ?? []).flatMap((p) =>
    p.inventory.map((inv) => ({
      product_id: p.id,
      warehouse_id: inv.warehouse_id,
      quantity: inv.quantity,
    }))
  );

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-[#1c1c1c]">재고관리 &gt; 재고현황</h1>
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
            products={(products ?? []).map((p) => ({ id: p.id, sku: p.sku, name: p.name, spec: p.spec }))}
            warehouseId={warehouse?.id ?? ""}
            stockLevels={stockLevels}
          />
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>상품명</th>
              <th className="num">수량</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {stockRows.map((row) => {
              const isLow = row.quantity <= (row.reorderPoint ?? 0);
              return (
                <tr key={row.id}>
                  <td>{row.sku}</td>
                  <td>{row.name}</td>
                  <td className="num">{row.quantity.toLocaleString()}</td>
                  <td>
                    <span className={`erp-badge ${isLow ? "erp-badge-danger" : "erp-badge-success"}`}>
                      {isLow ? "재주문 필요" : "정상"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!stockRows.length && (
              <tr>
                <td colSpan={4} className="erp-grid-empty">
                  등록된 상품이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
