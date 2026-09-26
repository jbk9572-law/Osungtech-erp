import { buildXlsxResponse } from "@/lib/xlsx-response";
import { requireAuthedApiUser } from "@/lib/require-auth";
import { currentMonth, getMonthRange, shiftMonth } from "@/lib/date-presets";
import { effectiveMonth } from "@/lib/carryover";
import { fetchAllRows } from "@/lib/fetch-all-rows";

// 월별 리포트 > 거래처 상세내역 엑셀 다운로드 — 화면
// (reports/monthly/company/page.tsx)과 같은 조회/이월 처리 로직을 그대로 따른다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || currentMonth();
  const company = searchParams.get("company") ?? "";
  const { to } = getMonthRange(month);
  const { from: lookbackFrom } = getMonthRange(shiftMonth(month, -1));

  const [type, id] = company.split(":");
  if (type !== "s" && type !== "c") {
    return new Response("Bad Request", { status: 400 });
  }

  const { supabase, user } = await requireAuthedApiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let companyName = "";
  type Row = { date: string; type: "in" | "out"; productName: string; spec: string; unit: string | null; quantity: number; amount: number; isReturn?: boolean };
  let rows: Row[] = [];

  if (type === "s") {
    const [{ data: supplier }, data] = await Promise.all([
      supabase.from("suppliers").select("name").eq("id", id).maybeSingle(),
      fetchAllRows((f, t) =>
        supabase
          .from("purchase_order_items")
          .select("quantity, unit_cost, purchase_orders!inner(purchase_date, supplier_id, is_carryover), products(name, spec, unit)")
          .eq("purchase_orders.supplier_id", id)
          .gte("purchase_orders.purchase_date", lookbackFrom)
          .lte("purchase_orders.purchase_date", to)
          .order("purchase_orders(purchase_date)", { ascending: true })
          .range(f, t)
      ),
    ]);
    companyName = supplier?.name ?? "";
    rows = data
      .filter((row) => effectiveMonth(row.purchase_orders.purchase_date, row.purchase_orders.is_carryover) === month)
      .map((row) => ({
        date: row.purchase_orders.purchase_date,
        type: "in" as const,
        productName: row.products?.name ?? "-",
        spec: row.products?.spec ?? "-",
        unit: row.products?.unit ?? null,
        quantity: row.quantity,
        amount: row.quantity * Number(row.unit_cost),
      }));
  } else {
    const [{ data: customer }, data] = await Promise.all([
      supabase.from("customers").select("name").eq("id", id).maybeSingle(),
      fetchAllRows((f, t) =>
        supabase
          .from("sales_order_items")
          .select("quantity, unit_price, sales_orders!inner(order_date, customer_id, is_return, is_carryover), products(name, spec, unit)")
          .eq("sales_orders.customer_id", id)
          .gte("sales_orders.order_date", lookbackFrom)
          .lte("sales_orders.order_date", to)
          .order("sales_orders(order_date)", { ascending: true })
          .range(f, t)
      ),
    ]);
    companyName = customer?.name ?? "";
    rows = data
      .filter((row) => effectiveMonth(row.sales_orders.order_date, row.sales_orders.is_carryover) === month)
      .map((row) => {
        const isReturn = row.sales_orders.is_return;
        const sign = isReturn ? -1 : 1;
        return {
          date: row.sales_orders.order_date,
          type: "out" as const,
          productName: row.products?.name ?? "-",
          spec: row.products?.spec ?? "-",
          unit: row.products?.unit ?? null,
          quantity: row.quantity * sign,
          amount: row.quantity * Number(row.unit_price) * sign,
          isReturn,
        };
      });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.productName.localeCompare(b.productName));

  const exportRows = rows.map((r) => ({
    날짜: r.date,
    구분: r.type === "in" ? "입고" : r.isReturn ? "반품" : "출고",
    품목: r.productName,
    규격: r.spec !== "-" ? r.spec : "",
    수량: r.quantity,
    단위: r.unit ?? "",
    금액: r.amount,
  }));

  return buildXlsxResponse(exportRows, `월별리포트_${companyName || "거래처"}_${month}.xlsx`);
}
