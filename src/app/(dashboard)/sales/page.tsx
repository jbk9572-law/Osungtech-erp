import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("sales_order_items")
    .select(
      "*, sales_orders(id, order_date, memo, customers(name, contact_name, phone), warehouses(name)), products(sku, name, unit)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

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
              <th className="px-4 py-3 font-medium">담당자/연락처</th>
              <th className="px-4 py-3 font-medium">창고</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">품목명</th>
              <th className="px-4 py-3 font-medium">규격</th>
              <th className="px-4 py-3 font-medium text-right">수량</th>
              <th className="px-4 py-3 font-medium text-right">단가</th>
              <th className="px-4 py-3 font-medium text-right">공급가액</th>
              <th className="px-4 py-3 font-medium text-right">세액</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items?.map((item) => {
              const order = item.sales_orders;
              const supplyAmount = item.quantity * Number(item.unit_price);
              const taxAmount = Math.round(supplyAmount * 0.1);
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {order ? new Date(order.order_date).toLocaleDateString("ko-KR") : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{order?.customers?.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {order?.customers?.contact_name ?? "-"}
                    {order?.customers?.phone ? ` · ${order.customers.phone}` : ""}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{order?.warehouses?.name}</td>
                  <td className="px-4 py-3 text-gray-900">{item.products?.sku}</td>
                  <td className="px-4 py-3 text-gray-900">{item.products?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.products?.unit}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {Number(item.unit_price).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {supplyAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {taxAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {order && (
                      <Link
                        href={`/sales/${order.id}/print`}
                        className="text-sm font-medium text-gray-900 hover:underline"
                      >
                        명세표 →
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {!items?.length && (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-gray-400">
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
