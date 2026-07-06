import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PurchasesPage() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("purchase_order_items")
    .select(
      "*, purchase_orders(id, purchase_date, memo, suppliers(name, contact_name, phone), warehouses(name)), products(sku, name, unit)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

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
              <th className="px-4 py-3 font-medium">담당자/연락처</th>
              <th className="px-4 py-3 font-medium">입고 창고</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">품목명</th>
              <th className="px-4 py-3 font-medium">규격</th>
              <th className="px-4 py-3 font-medium text-right">수량</th>
              <th className="px-4 py-3 font-medium text-right">매입단가</th>
              <th className="px-4 py-3 font-medium text-right">금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items?.map((item) => {
              const order = item.purchase_orders;
              const amount = item.quantity * Number(item.unit_cost);
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {order ? new Date(order.purchase_date).toLocaleDateString("ko-KR") : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{order?.suppliers?.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {order?.suppliers?.contact_name ?? "-"}
                    {order?.suppliers?.phone ? ` · ${order.suppliers.phone}` : ""}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{order?.warehouses?.name}</td>
                  <td className="px-4 py-3 text-gray-900">{item.products?.sku}</td>
                  <td className="px-4 py-3 text-gray-900">{item.products?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.products?.unit}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {Number(item.unit_cost).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {amount.toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {!items?.length && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-gray-400">
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
