import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { deleteSale } from "@/app/(dashboard)/sales/actions";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase
      .from("sales_orders")
      .select("*, customers(*), warehouses(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("*, products(sku, name, unit)")
      .eq("sales_order_id", id)
      .order("created_at"),
  ]);

  if (!order) {
    notFound();
  }

  const rows = (items ?? []).map((item) => ({
    ...item,
    amount: item.quantity * Number(item.unit_price),
  }));
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">매출 상세</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/sales/${id}/print`}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            명세표 보기
          </Link>
          <Link
            href={`/sales/${id}/edit`}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            수정
          </Link>
          <DeleteButton
            action={deleteSale}
            id={id}
            confirmMessage="이 매출 거래를 삭제하시겠습니까? 재고 수량이 자동으로 되돌아갑니다."
          />
        </div>
      </div>
      <p className="mb-6 text-sm text-gray-500">
        {new Date(order.order_date).toLocaleDateString("ko-KR")} · {order.warehouses?.name} 출고
      </p>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 text-sm shadow-sm">
        <p className="mb-2 font-semibold text-gray-900">거래처</p>
        <dl className="space-y-1 text-gray-600">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-gray-400">거래처명</dt>
            <dd>{order.customers?.name ?? "-"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-gray-400">담당자</dt>
            <dd>{order.customers?.contact_name ?? "-"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-gray-400">연락처</dt>
            <dd>{order.customers?.phone ?? "-"}</dd>
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
              <th className="whitespace-nowrap px-4 py-3 font-medium text-right">단가</th>
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
                  {Number(row.unit_price).toLocaleString()}
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
