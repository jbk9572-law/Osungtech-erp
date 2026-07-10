import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse, buildXlsxResponseFromWorkbook, currentMonthRange } from "@/lib/xlsx-response";
import {
  buildLeadersSpecialWorkbook,
  buildStandardLedgerWorkbook,
  type LedgerItem,
} from "@/lib/purchase-export-templates";

// 매입관리 엑셀 다운로드. 항상 이번달(오늘 기준) 1일~말일 범위를 뽑는다.
// 검색어(q)가 등록된 매입처 이름과 매칭되고 그 업체가 전용 양식을 쓰는
// 경우엔 업체별 고정 서식으로, 그 외엔 일반 컬럼 나열로 내려준다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const { from, to } = currentMonthRange();
  const now = new Date();

  const supabase = await createClient();

  let templatedSupplier: {
    id: string;
    name: string;
    purchase_export_template: string;
    purchase_price_basis: string;
  } | null = null;

  if (q) {
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("id, name, purchase_export_template, purchase_price_basis");
    const matches = (suppliers ?? []).filter((s) => s.name.toLowerCase().includes(q));
    if (matches.length === 1 && matches[0].purchase_export_template !== "generic") {
      templatedSupplier = matches[0];
    }
  }

  const { data } = await supabase
    .from("purchase_order_items")
    .select(
      "*, purchase_orders!inner(purchase_date, supplier_id, suppliers(name)), products(sku, name, spec, unit, base_package_qty)"
    )
    .gte("purchase_orders.purchase_date", from)
    .lte("purchase_orders.purchase_date", to)
    .order("created_at");

  if (templatedSupplier) {
    const items: LedgerItem[] = (data ?? [])
      .filter((item) => item.purchase_orders?.supplier_id === templatedSupplier!.id)
      .map((item) => ({
        date: item.purchase_orders?.purchase_date ?? "",
        productName: item.products?.name ?? "",
        spec: item.spec || item.products?.spec || "",
        unit: item.products?.unit ?? "",
        quantity: item.quantity,
        unitCost: Number(item.unit_cost),
        basePackageQty:
          item.products?.base_package_qty != null ? Number(item.products.base_package_qty) : null,
      }));

    const priceBasis = templatedSupplier.purchase_price_basis === "box" ? "box" : "quantity";
    const workbook =
      templatedSupplier.purchase_export_template === "leaders_special"
        ? await buildLeadersSpecialWorkbook(templatedSupplier.name, now.getFullYear(), now.getMonth() + 1, items)
        : await buildStandardLedgerWorkbook(
            templatedSupplier.name,
            now.getFullYear(),
            now.getMonth() + 1,
            items,
            priceBasis
          );

    return buildXlsxResponseFromWorkbook(workbook, `매입내역_${templatedSupplier.name}_${from}_${to}.xlsx`);
  }

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
