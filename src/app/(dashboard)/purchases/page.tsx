import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PurchasesPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(name), warehouses(name), purchase_order_items(quantity, unit_cost)")
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">매입 (입고)</h1>
        <Link
          href="/purchases/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          새 매입 등록
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">매입일자</th>
              <th className="px-4 py-3 font-medium">공급업체</th>
              <th className="px-4 py-3 font-medium">입고 창고</th>
              <th className="px-4 py-3 font-medium">품목수</th>
              <th className="px-4 py-3 font-medium">매입금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders?.map((order) => {
              const total = order.purchase_order_items.reduce(
                (sum, item) => sum + item.quantity * Number(item.unit_cost),
                0
              );
              return (
                <tr key={order.id}>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(order.purchase_date).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{order.suppliers?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{order.warehouses?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{order.purchase_order_items.length}</td>
                  <td className="px-4 py-3 text-gray-900">{total.toLocaleString()}원</td>
                </tr>
              );
            })}
            {!orders?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  등록된 매입 거래가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
