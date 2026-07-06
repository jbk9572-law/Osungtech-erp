import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("*, suppliers(*), warehouses(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("purchase_order_items")
      .select("*, products(sku, name, unit)")
      .eq("purchase_order_id", id)
      .order("created_at"),
  ]);

  if (!order) {
    notFound();
  }

  const rows = (items ?? []).map((item) => ({
    ...item,
    amount: item.quantity * Number(item.unit_cost),
  }));
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">매입 상세</h1>
      <p className="mb-6 text-sm text-gray-500">
        {new Date(order.purchase_date).toLocaleDateString("ko-KR")} · {order.warehouses?.name} 입고
      </p>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 text-sm shadow-sm">
        <p className="mb-2 font-semibold text-gray-900">공급업체</p>
        <dl className="space-y-1 text-gray-600">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-gray-400">업체명</dt>
            <dd>{order.suppliers?.name ?? "-"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-gray-400">담당자</dt>
            <dd>{order.suppliers?.contact_name ?? "-"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-gray-400">연락처</dt>
            <dd>{order.suppliers?.phone ?? "-"}</dd>
          </div>
        </dl>
        {order.memo && <p className="mt-3 text-gray-500">메모: {order.memo}</p>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 font-medium">품목명</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">규격</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-right">수량</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-right">매입단가</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-right">금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                  {row.products?.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                  {row.products?.unit}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-gray-900">
                  {row.quantity}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-gray-500">
                  {Number(row.unit_cost).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-gray-900">
                  {row.amount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300 bg-gray-50 font-semibold text-gray-900">
              <td colSpan={4} className="px-4 py-3">
                합계
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                {totalAmount.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
