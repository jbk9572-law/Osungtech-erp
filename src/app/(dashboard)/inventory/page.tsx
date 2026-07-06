import { createClient } from "@/lib/supabase/server";
import { InventoryAdjustForm } from "@/components/inventory-adjust-form";

export default async function InventoryPage() {
  const supabase = await createClient();
  const [{ data: inventory }, { data: products }, { data: warehouses }] = await Promise.all([
    supabase
      .from("inventory")
      .select("*, products(sku, name, reorder_point), warehouses(name)")
      .order("updated_at", { ascending: false }),
    supabase.from("products").select("id, sku, name").order("name"),
    supabase.from("warehouses").select("id, name").order("name"),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">재고 현황</h1>
      <p className="mb-6 text-sm text-gray-500">
        재고 수량은 매입(입고) · 매출(출고) · 아래 재고 조정 내역의 합으로 자동 계산됩니다. 직접
        수량을 바꿀 수는 없고, 기초재고를 등록하거나 실사 후 수량을 맞출 때는 아래 재고 조정을
        사용하세요.
      </p>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-gray-700">재고 조정 (기초재고 등록 등)</h2>
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

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">상품명</th>
              <th className="px-4 py-3 font-medium">창고</th>
              <th className="px-4 py-3 font-medium">수량</th>
              <th className="px-4 py-3 font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inventory?.map((row) => {
              const isLow = row.quantity <= (row.products?.reorder_point ?? 0);
              return (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-gray-900">{row.products?.sku}</td>
                  <td className="px-4 py-3 text-gray-900">{row.products?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{row.warehouses?.name}</td>
                  <td className="px-4 py-3 text-gray-900">{row.quantity}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        isLow ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}
                    >
                      {isLow ? "재주문 필요" : "정상"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!inventory?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
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
