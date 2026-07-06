import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const { from, to, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("purchase_order_items")
    .select(
      "*, purchase_orders!inner(id, purchase_date, memo, suppliers(name, contact_name, phone), warehouses(name)), products(sku, name, unit)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (from) query = query.gte("purchase_orders.purchase_date", from);
  if (to) query = query.lte("purchase_orders.purchase_date", to);

  const { data: rawItems } = await query;

  const keyword = q?.trim().toLowerCase();
  const items = keyword
    ? rawItems?.filter(
        (item) =>
          item.purchase_orders?.suppliers?.name?.toLowerCase().includes(keyword) ||
          item.products?.name?.toLowerCase().includes(keyword) ||
          item.products?.sku?.toLowerCase().includes(keyword)
      )
    : rawItems;

  const rows = (items ?? []).map((item) => ({
    ...item,
    amount: item.quantity * Number(item.unit_cost),
  }));

  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

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

      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-xs text-gray-500">시작일</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">종료일</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs text-gray-500">공급업체 / 상품 검색</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="공급업체명, 상품명, SKU"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          검색
        </button>
        {(from || to || q) && (
          <Link
            href="/purchases"
            className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            초기화
          </Link>
        )}
      </form>

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
            {rows.map((item) => {
              const order = item.purchase_orders;
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
                    {item.amount.toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-gray-400">
                  조건에 맞는 매입 거래가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-300 bg-gray-50 font-semibold text-gray-900">
                <td colSpan={7} className="px-4 py-3">
                  합계 ({rows.length}건)
                </td>
                <td className="px-4 py-3 text-right">{totalQuantity}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right">{totalAmount.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
