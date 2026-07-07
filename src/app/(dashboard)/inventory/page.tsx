import { createClient } from "@/lib/supabase/server";
import { InventoryAdjustForm } from "@/components/inventory-adjust-form";

export default async function InventoryPage() {
  const supabase = await createClient();
  const [{ data: inventory }, { data: products }, { data: warehouses }] = await Promise.all([
    supabase
      .from("inventory")
      .select("*, products(sku, name, reorder_point), warehouses(name)")
      .order("updated_at", { ascending: false }),
    supabase.from("products").select("id, sku, name, spec").order("name"),
    supabase.from("warehouses").select("id, name").order("name"),
  ]);

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
            products={products ?? []}
            warehouses={warehouses ?? []}
            stockLevels={(inventory ?? []).map((row) => ({
              product_id: row.product_id,
              warehouse_id: row.warehouse_id,
              quantity: row.quantity,
            }))}
          />
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>상품명</th>
              <th>창고</th>
              <th className="num">수량</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {inventory?.map((row) => {
              const isLow = row.quantity <= (row.products?.reorder_point ?? 0);
              return (
                <tr key={row.id}>
                  <td>{row.products?.sku}</td>
                  <td>{row.products?.name}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.warehouses?.name}</td>
                  <td className="num">{row.quantity.toLocaleString()}</td>
                  <td>
                    <span className={`erp-badge ${isLow ? "erp-badge-danger" : "erp-badge-success"}`}>
                      {isLow ? "재주문 필요" : "정상"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!inventory?.length && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  재고 데이터가 없습니다. 매입 등록 또는 재고 조정 후 표시됩니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
