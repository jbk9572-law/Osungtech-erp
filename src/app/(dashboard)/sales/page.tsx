import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("sales_orders")
    .select("*, customers(name), warehouses(name), sales_order_items(quantity, unit_price)")
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">판매 거래 (거래명세표)</h1>
        <Link
          href="/sales/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          새 거래 등록
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">거래일자</th>
              <th className="px-4 py-3 font-medium">거래처</th>
              <th className="px-4 py-3 font-medium">창고</th>
              <th className="px-4 py-3 font-medium">품목수</th>
              <th className="px-4 py-3 font-medium">합계금액(VAT포함)</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders?.map((order) => {
              const supplyAmount = order.sales_order_items.reduce(
                (sum, item) => sum + item.quantity * Number(item.unit_price),
                0
              );
              const total = Math.round(supplyAmount * 1.1);
              return (
                <tr key={order.id}>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(order.order_date).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{order.customers?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{order.warehouses?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{order.sales_order_items.length}</td>
                  <td className="px-4 py-3 text-gray-900">{total.toLocaleString()}원</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/sales/${order.id}/print`}
                      className="text-sm font-medium text-gray-900 hover:underline"
                    >
                      거래명세표 →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!orders?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  등록된 판매 거래가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
