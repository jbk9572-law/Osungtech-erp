import { buildXlsxResponse } from "@/lib/xlsx-response";
import { requireAuthedApiUser } from "@/lib/require-auth";
import { currentMonth, getMonthRange } from "@/lib/date-presets";

const TYPE_LABEL: Record<string, string> = { in: "입고", out: "출고", adjustment: "조정" };

// 수불부 엑셀 다운로드 — 화면(reports/ledger/page.tsx)과 같은 품목/창고/월
// 필터를 그대로 받아, 이월(전월 이전 누적재고)부터 잔량까지 같은 방식으로 계산한다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id");
  const warehouseId = searchParams.get("warehouse_id");
  const month = searchParams.get("month") || currentMonth();
  const { from, to } = getMonthRange(month);

  const { supabase, user } = await requireAuthedApiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (!productId) {
    return buildXlsxResponse([], `수불부_${month}.xlsx`);
  }

  const { data: product } = await supabase.from("products").select("sku, name, unit").eq("id", productId).maybeSingle();

  // get_product_ledger_rows가 거래일자(transaction_date) 오름차순 +
  // 창고별 재고실사 리셋을 반영해 각 행의 "그 시점 잔량"까지 DB 안에서
  // 계산해 돌려준다 — 화면(reports/ledger/page.tsx)과 같은 계산을 쓴다.
  const { data: ledgerRowsRaw } = await supabase.rpc("get_product_ledger_rows", {
    p_product_id: productId,
    p_warehouse_id: warehouseId || null,
    p_from: from,
    p_to: to,
  });
  const periodRows = ledgerRowsRaw ?? [];

  const openingBalance = periodRows.length > 0
    ? periodRows[0].balance_after - (periodRows[0].type === "out" ? -Math.abs(periodRows[0].quantity) : periodRows[0].quantity)
    : 0;
  const rows = periodRows.map((r) => {
    const delta = r.type === "out" ? -Math.abs(Number(r.quantity)) : Number(r.quantity);
    return {
      일시: new Date(r.transaction_date).toLocaleDateString("ko-KR"),
      구분: TYPE_LABEL[r.type] ?? r.type,
      수량: delta,
      잔량: r.balance_after,
      참조: r.reference ?? "-",
      비고: r.note ?? "-",
    };
  });

  rows.unshift({
    일시: `${from} 이전 이월`,
    구분: "이월",
    수량: openingBalance,
    잔량: openingBalance,
    참조: "-",
    비고: "-",
  });

  const filenamePart = product ? `${product.sku}_${product.name}` : productId;
  return buildXlsxResponse(rows, `수불부_${filenamePart}_${month}.xlsx`);
}
