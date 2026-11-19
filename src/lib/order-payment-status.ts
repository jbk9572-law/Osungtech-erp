import type { createClient } from "@/lib/supabase/server";

// 전표별 수금(매출)/지급(매입) 상태 — DB 함수(get_*_order_payment_status, migration 272)가
// 미수금 연령과 같은 "오래된 전표부터 선입선출" 규칙으로 계산한다. 화면(매출/매입 목록)은 이 모듈만 거친다.
export type OrderPaymentStatus = "paid" | "partial" | "unpaid" | "return" | "none";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const VALID = new Set<OrderPaymentStatus>(["paid", "partial", "unpaid", "return", "none"]);

function toMap(rows: { order_id: string; status: string }[] | null): Map<string, OrderPaymentStatus> {
  const map = new Map<string, OrderPaymentStatus>();
  for (const r of rows ?? []) {
    if (VALID.has(r.status as OrderPaymentStatus)) map.set(r.order_id, r.status as OrderPaymentStatus);
  }
  return map;
}

export async function fetchSalesPaymentStatus(
  supabase: SupabaseServerClient,
  orderIds: string[],
): Promise<Map<string, OrderPaymentStatus>> {
  if (orderIds.length === 0) return new Map();
  const { data, error } = await supabase.rpc("get_sales_order_payment_status", { p_order_ids: orderIds });
  // 상태 칸은 보조 정보 — 계산이 실패해도 목록 자체는 떠야 한다(칸만 "-").
  if (error) return new Map();
  return toMap(data);
}

export async function fetchPurchasePaymentStatus(
  supabase: SupabaseServerClient,
  orderIds: string[],
): Promise<Map<string, OrderPaymentStatus>> {
  if (orderIds.length === 0) return new Map();
  const { data, error } = await supabase.rpc("get_purchase_order_payment_status", { p_order_ids: orderIds });
  if (error) return new Map();
  return toMap(data);
}

/** 상태 → 뱃지 톤/글자. 반품·거래처 없음은 칸을 비운다(null). */
export function paymentStatusBadge(
  status: OrderPaymentStatus | undefined,
  labels: { paid: string; partial: string; unpaid: string },
): { tone: "ok" | "warn" | "danger"; label: string } | null {
  if (status === "paid") return { tone: "ok", label: labels.paid };
  if (status === "partial") return { tone: "warn", label: labels.partial };
  if (status === "unpaid") return { tone: "danger", label: labels.unpaid };
  return null;
}
