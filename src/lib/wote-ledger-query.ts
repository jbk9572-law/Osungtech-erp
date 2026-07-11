import type { SupabaseClient } from "@supabase/supabase-js";
import type { LedgerEntry } from "@/lib/wote-ledger-template";

// WOTE(매입처)에서 원자재를 받아 신일베스텍(매출처)으로 내보내는 흐름은
// 매입/매출 양쪽 테이블을 같이 봐야 해서, 두 export 라우트(매입/매출)가
// 공유하는 조회 로직을 여기 하나로 모아둔다.
export async function fetchWoteLedgerEntries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  from: string,
  to: string
): Promise<LedgerEntry[]> {
  const [{ data: purchaseItems }, { data: saleItems }] = await Promise.all([
    supabase
      .from("purchase_order_items")
      .select("*, purchase_orders!inner(purchase_date, suppliers(name)), products(name)")
      .gte("purchase_orders.purchase_date", from)
      .lte("purchase_orders.purchase_date", to)
      .order("created_at"),
    supabase
      .from("sales_order_items")
      .select("*, sales_orders!inner(order_date, customers(name)), products(name)")
      .gte("sales_orders.order_date", from)
      .lte("sales_orders.order_date", to)
      .order("created_at"),
  ]);

  const inEntries: LedgerEntry[] = (purchaseItems ?? [])
    .filter((item) => normalize(item.purchase_orders?.suppliers?.name) === "wote")
    .map((item) => ({
      date: item.purchase_orders?.purchase_date ?? "",
      productName: item.products?.name ?? "",
      lotNo: item.spec || "",
      direction: "in" as const,
      partnerName: item.purchase_orders?.suppliers?.name ?? "WOTE",
      quantity: item.quantity,
    }));

  const outEntries: LedgerEntry[] = (saleItems ?? [])
    .filter((item) => normalize(item.sales_orders?.customers?.name) === "신일베스텍")
    .map((item) => ({
      date: item.sales_orders?.order_date ?? "",
      productName: item.products?.name ?? "",
      lotNo: item.spec || "",
      direction: "out" as const,
      partnerName: item.sales_orders?.customers?.name ?? "신일베스텍",
      quantity: item.quantity,
    }));

  return [...inEntries, ...outEntries];
}

function normalize(name: string | null | undefined): string {
  return (name ?? "").replace(/[㈜()주식회사\s]/g, "").toLowerCase();
}

export function isWoteQuery(q: string): boolean {
  return normalize(q) === "wote";
}

export function isShinilBestechQuery(q: string): boolean {
  return normalize(q) === "신일베스텍";
}
