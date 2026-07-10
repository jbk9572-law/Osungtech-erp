import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse, currentMonthRange } from "@/lib/xlsx-response";

// 매입관리 엑셀 다운로드. 항상 이번달(오늘 기준) 1일~말일 범위를 뽑는다.
// 검색어(q)가 있으면 공급업체명/품목명/SKU/규격이 일치하는 건만 뽑는다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const { from, to } = currentMonthRange();

  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_order_items")
    .select("*, purchase_orders!inner(purchase_date, suppliers(name)), products(sku, name, spec, unit)")
    .gte("purchase_orders.purchase_date", from)
    .lte("purchase_orders.purchase_date", to)
    .order("created_at");

  const items = (data ?? []).filter((item) => {
    if (!q) return true;
    return (
      item.purchase_orders?.suppliers?.name?.toLowerCase().includes(q) ||
      item.products?.name?.toLowerCase().includes(q) ||
      item.products?.sku?.toLowerCase().includes(q) ||
      (item.spec || item.products?.spec)?.toLowerCase().includes(q)
    );
  });

  const rows = items.map((item) => ({
    매입일자: item.purchase_orders?.purchase_date ?? "",
    공급업체명: item.purchase_orders?.suppliers?.name ?? "",
    SKU: item.products?.sku ?? "",
    품목명: item.products?.name ?? "",
    규격: item.spec || item.products?.spec || "",
    단위: item.products?.unit ?? "",
    수량: item.quantity,
    매입가: Number(item.unit_cost),
    금액: item.quantity * Number(item.unit_cost),
  }));

  const suffix = q ? `_${q}` : "";
  return buildXlsxResponse(rows, `매입내역_${from}_${to}${suffix}.xlsx`);
}
