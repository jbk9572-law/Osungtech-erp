import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const { from, to, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("sales_order_items")
    .select(
      "*, sales_orders!inner(id, order_date, memo, customers(name)), products(sku, name, unit)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (from) query = query.gte("sales_orders.order_date", from);
  if (to) query = query.lte("sales_orders.order_date", to);

  const { data: rawItems } = await query;

  const keyword = q?.trim().toLowerCase();
  const items = keyword
    ? rawItems?.filter(
        (item) =>
          item.sales_orders?.customers?.name?.toLowerCase().includes(keyword) ||
          item.products?.name?.toLowerCase().includes(keyword) ||
          item.products?.sku?.toLowerCase().includes(keyword)
      )
    : rawItems;

  const rows = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_price);
    const taxAmount = Math.round(supplyAmount * 0.1);
    return { ...item, supplyAmount, taxAmount };
  });

  const totalSupply = rows.reduce((sum, row) => sum + row.supplyAmount, 0);
  const totalTax = rows.reduce((sum, row) => sum + row.taxAmount, 0);
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">매출</h1>
        <Link
          href="/sales/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          새 거래 등록
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
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs text-gray-500">거래처 / 상품 검색</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="거래처명, 상품명, SKU"
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
            href="/sales"
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
              <th className="whitespace-nowrap px-4 py-3 font-medium">거래일자</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">거래처</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">품목명</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">규격</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-right">수량</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-right">단가</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-right">공급가액</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-right">세액</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((item) => {
              const order = item.sales_orders;
              return (
                <ClickableRow key={item.id} href={order ? `/sales/${order.id}` : "#"}>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {order ? new Date(order.order_date).toLocaleDateString("ko-KR") : "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                    {order?.customers?.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                    {item.products?.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {item.products?.unit}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-gray-900">
                    {item.quantity}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-gray-500">
                    {Number(item.unit_price).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-gray-900">
                    {item.supplyAmount.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-gray-500">
                    {item.taxAmount.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {order && (
                      <Link
                        href={`/sales/${order.id}/print`}
                        className="text-sm font-medium text-gray-900 hover:underline"
                      >
                        명세표 →
                      </Link>
                    )}
                  </td>
                </ClickableRow>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                  조건에 맞는 판매 거래가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-300 bg-gray-50 font-semibold text-gray-900">
                <td colSpan={4} className="whitespace-nowrap px-4 py-3">
                  합계 ({rows.length}건)
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">{totalQuantity}</td>
                <td className="px-4 py-3" />
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {totalSupply.toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {totalTax.toLocaleString()}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
