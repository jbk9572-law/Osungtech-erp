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

  const fromIso = `${from}T00:00:00+09:00`;
  const toIso = `${to}T23:59:59.999+09:00`;

  const [{ data: opening }, { data: periodRows }] = await Promise.all([
    supabase.rpc("get_ledger_opening_balance", {
      p_product_id: productId,
      p_warehouse_id: warehouseId || null,
      p_before: fromIso,
    }),
    (() => {
      let q = supabase
        .from("inventory_transactions")
        .select("type, quantity, reference, note, created_at")
        .eq("product_id", productId)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true });
      if (warehouseId) q = q.eq("warehouse_id", warehouseId);
      return q;
    })(),
  ]);

  const openingBalance = Number(opening ?? 0);
  let balance = openingBalance;
  const rows = (periodRows ?? []).map((r) => {
    const delta = r.type === "out" ? -Math.abs(Number(r.quantity)) : Number(r.quantity);
    balance += delta;
    return {
      일시: new Date(r.created_at).toLocaleString("ko-KR"),
      구분: TYPE_LABEL[r.type] ?? r.type,
      수량: delta,
      잔량: balance,
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
