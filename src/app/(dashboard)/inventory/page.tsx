import { createClient } from "@/lib/supabase/server";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: inventory } = await supabase
    .from("inventory")
    .select("*, products(sku, name, reorder_point), warehouses(name)")
    .order("updated_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">재고 현황</h1>

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
                  재고 데이터가 없습니다. 입출고 등록 후 표시됩니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
