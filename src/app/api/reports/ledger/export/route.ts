import { buildXlsxResponse } from "@/lib/xlsx-response";
import { requireAuthedApiUser } from "@/lib/require-auth";
import { currentMonth, getMonthRange } from "@/lib/date-presets";
import { fetchAllRows } from "@/lib/fetch-all-rows";

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

  // QR 자동실사 등으로 한 품목이 한 달에 1000건 넘는 재고 트랜잭션을
  // 만들 수 있어, .range() 없이 조회하면 엑셀의 입고/출고 합계·마감재고가
  // 조용히 틀어진다 — fetchAllRows로 끝까지 받는다(화면 쪽과 동일).
  const [{ data: opening }, periodRows] = await Promise.all([
    supabase.rpc("get_ledger_opening_balance", {
      p_product_id: productId,
      p_warehouse_id: warehouseId || null,
      p_before: fromIso,
    }),
    fetchAllRows((f, t) => {
      let q = supabase
        .from("inventory_transactions")
        .select("type, quantity, reference, note, created_at")
        .eq("product_id", productId)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true })
        .range(f, t);
      if (warehouseId) q = q.eq("warehouse_id", warehouseId);
      return q;
    }),
  ]);

  const openingBalance = Number(opening ?? 0);
  let balance = openingBalance;
  const rows = periodRows.map((r) => {
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
