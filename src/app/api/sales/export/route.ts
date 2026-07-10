import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse, currentMonthRange } from "@/lib/xlsx-response";

// 매출관리 엑셀 다운로드. 항상 이번달(오늘 기준) 1일~말일 범위를 뽑는다.
// 검색어(q)가 있으면 거래처명/품목명/SKU/규격이 일치하는 건만 뽑는다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const { from, to } = currentMonthRange();

  const supabase = await createClient();
  const { data } = await supabase
    .from("sales_order_items")
    .select("*, sales_orders!inner(order_date, customers(name)), products(sku, name, spec, unit)")
    .gte("sales_orders.order_date", from)
    .lte("sales_orders.order_date", to)
    .order("created_at");

  const items = (data ?? []).filter((item) => {
    if (!q) return true;
    return (
      item.sales_orders?.customers?.name?.toLowerCase().includes(q) ||
      item.products?.name?.toLowerCase().includes(q) ||
      item.products?.sku?.toLowerCase().includes(q) ||
      (item.spec || item.products?.spec)?.toLowerCase().includes(q)
    );
  });

  const rows = items.map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_price);
    const taxAmount = Math.round(supplyAmount * 0.1);
    return {
      거래일자: item.sales_orders?.order_date ?? "",
      거래처명: item.sales_orders?.customers?.name ?? "",
      SKU: item.products?.sku ?? "",
      품목명: item.products?.name ?? "",
      규격: item.spec || item.products?.spec || "",
      단위: item.products?.unit ?? "",
      수량: item.quantity,
      공급가: Number(item.unit_price),
      공급가액: supplyAmount,
      세액: taxAmount,
      합계: supplyAmount + taxAmount,
    };
  });

  const suffix = q ? `_${q}` : "";
  return buildXlsxResponse(rows, `매출내역_${from}_${to}${suffix}.xlsx`);
}
