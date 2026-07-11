import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse, buildXlsxResponseFromWorkbook, currentMonthRange } from "@/lib/xlsx-response";
import {
  buildFilterBoxStatementWorkbook,
  buildFilterNoBoxStatementWorkbook,
  buildPaperRollStatementWorkbook,
  type StatementItem,
} from "@/lib/sales-export-templates";
import { buildWoteLedgerWorkbook } from "@/lib/wote-ledger-template";
import { fetchWoteLedgerEntries, isShinilBestechQuery } from "@/lib/wote-ledger-query";

// 매출관리 엑셀 다운로드. 항상 이번달(오늘 기준) 1일~말일 범위를 뽑는다.
// 검색어(q)가 등록된 거래처 이름과 매칭되고 그 거래처가 전용 양식을 쓰는
// 경우엔 거래처별 고정 서식(명세표)으로, 그 외엔 일반 컬럼 나열로 내려준다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const { from, to } = currentMonthRange();
  const now = new Date();

  const supabase = await createClient();

  // WOTE(매입처)↔신일베스텍(매출처) 간 원자재 입출고는 매입/매출 양쪽 데이터를
  // 합쳐서 보여주는 전용 관리대장이 필요하다.
  if (isShinilBestechQuery(q)) {
    const entries = await fetchWoteLedgerEntries(supabase, from, to);
    const workbook = await buildWoteLedgerWorkbook(now.getFullYear(), now.getMonth() + 1, entries);
    return buildXlsxResponseFromWorkbook(workbook, `WOTE_관리대장_${from}_${to}.xlsx`);
  }

  let templatedCustomer: { id: string; name: string; sales_export_template: string } | null = null;

  if (q) {
    const { data: customers } = await supabase.from("customers").select("id, name, sales_export_template");
    const matches = (customers ?? []).filter((c) => c.name.toLowerCase().includes(q));
    if (matches.length === 1 && matches[0].sales_export_template !== "generic") {
      templatedCustomer = matches[0];
    }
  }

  const { data } = await supabase
    .from("sales_order_items")
    .select(
      "*, sales_orders!inner(order_date, customer_id, customers(name)), products(sku, name, spec, unit, base_package_qty)"
    )
    .gte("sales_orders.order_date", from)
    .lte("sales_orders.order_date", to)
    .order("created_at");

  if (templatedCustomer) {
    const items: StatementItem[] = (data ?? [])
      .filter((item) => item.sales_orders?.customer_id === templatedCustomer!.id)
      .map((item) => ({
        date: item.sales_orders?.order_date ?? "",
        productName: item.products?.name ?? "",
        spec: item.spec || item.products?.spec || "",
        unit: item.products?.unit ?? "",
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        basePackageQty:
          item.products?.base_package_qty != null ? Number(item.products.base_package_qty) : null,
      }));

    const { data: company } = await supabase.from("company_profile").select("name").eq("id", 1).maybeSingle();
    const companyName = company?.name || "㈜오성테크";

    const workbook =
      templatedCustomer.sales_export_template === "filter_no_box"
        ? await buildFilterNoBoxStatementWorkbook(templatedCustomer.name, companyName, from, to, items)
        : templatedCustomer.sales_export_template === "paper_roll"
          ? await buildPaperRollStatementWorkbook(templatedCustomer.name, companyName, from, to, items)
          : await buildFilterBoxStatementWorkbook(templatedCustomer.name, companyName, from, to, items);

    return buildXlsxResponseFromWorkbook(workbook, `매출내역_${templatedCustomer.name}_${from}_${to}.xlsx`);
  }

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
