import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";

export default async function SalesPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: company }] = await Promise.all([
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
    supabase.from("company_profile").select("*").eq("id", 1).maybeSingle(),
  ]);

  if (!order) {
    notFound();
  }

  const rows = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_price);
    const taxAmount = Math.round(supplyAmount * 0.1);
    return { ...item, supplyAmount, taxAmount };
  });

  const totalSupply = rows.reduce((sum, row) => sum + row.supplyAmount, 0);
  const totalTax = rows.reduce((sum, row) => sum + row.taxAmount, 0);
  const grandTotal = totalSupply + totalTax;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="rounded-lg border border-gray-300 bg-white p-8 print:border-0 print:p-0">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-widest text-gray-900">
          거래명세표
        </h1>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-md border border-gray-200 p-4">
            <p className="mb-2 font-semibold text-gray-900">공급자</p>
            <dl className="space-y-1 text-gray-600">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-400">상호</dt>
                <dd>{company?.name || "-"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-400">사업자번호</dt>
                <dd>{company?.business_number || "-"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-400">대표자</dt>
                <dd>{company?.representative_name || "-"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-400">주소</dt>
                <dd>{company?.address || "-"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-400">업태/종목</dt>
                <dd>
                  {company?.business_type || "-"} / {company?.business_item || "-"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-400">연락처</dt>
                <dd>{company?.phone || "-"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border border-gray-200 p-4">
            <p className="mb-2 font-semibold text-gray-900">공급받는자</p>
            <dl className="space-y-1 text-gray-600">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-400">상호</dt>
                <dd>{order.customers?.name || "-"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-400">사업자번호</dt>
                <dd>{order.customers?.business_number || "-"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-400">대표자</dt>
                <dd>{order.customers?.representative_name || "-"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-400">주소</dt>
                <dd>{order.customers?.address || "-"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-400">담당자</dt>
                <dd>{order.customers?.contact_name || "-"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-400">연락처</dt>
                <dd>{order.customers?.phone || "-"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mb-4 flex justify-between text-sm text-gray-600">
          <span>거래일자: {new Date(order.order_date).toLocaleDateString("ko-KR")}</span>
          <span>출고 창고: {order.warehouses?.name}</span>
        </div>

        <table className="mb-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-gray-300 bg-gray-50">
              <th className="border border-gray-300 px-2 py-2 text-left">품목</th>
              <th className="border border-gray-300 px-2 py-2">규격</th>
              <th className="border border-gray-300 px-2 py-2">수량</th>
              <th className="border border-gray-300 px-2 py-2">단가</th>
              <th className="border border-gray-300 px-2 py-2">공급가액</th>
              <th className="border border-gray-300 px-2 py-2">세액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="border border-gray-300 px-2 py-2">
                  {row.products?.sku} · {row.products?.name}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-center">
                  {row.products?.unit}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right">{row.quantity}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">
                  {Number(row.unit_price).toLocaleString()}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right">
                  {row.supplyAmount.toLocaleString()}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right">
                  {row.taxAmount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col items-end gap-1 text-sm">
          <div className="text-gray-600">공급가액 합계: {totalSupply.toLocaleString()}원</div>
          <div className="text-gray-600">세액 합계: {totalTax.toLocaleString()}원</div>
          <div className="text-lg font-bold text-gray-900">
            총 합계금액: {grandTotal.toLocaleString()}원
          </div>
        </div>

        {order.memo && (
          <p className="mt-4 border-t border-gray-200 pt-3 text-sm text-gray-500">
            비고: {order.memo}
          </p>
        )}
      </div>
    </div>
  );
}
