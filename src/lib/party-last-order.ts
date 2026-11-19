import type { createClient } from "@/lib/supabase/server";

// 거래처/공급처 목록 행의 "최근 거래일" — DB 함수(migration 274)가 요청한 id들의 마지막 거래일만 돌려준다.
// 보조 정보라 실패해도 목록은 떠야 한다(빈 Map).
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function fetchCustomerLastOrderDates(
  supabase: SupabaseServerClient,
  customerIds: string[],
): Promise<Map<string, string>> {
  if (customerIds.length === 0) return new Map();
  const { data, error } = await supabase.rpc("get_customer_last_order_dates", { p_customer_ids: customerIds });
  if (error) return new Map();
  return new Map((data ?? []).map((r) => [r.customer_id, r.last_order_date]));
}

export async function fetchSupplierLastOrderDates(
  supabase: SupabaseServerClient,
  supplierIds: string[],
): Promise<Map<string, string>> {
  if (supplierIds.length === 0) return new Map();
  const { data, error } = await supabase.rpc("get_supplier_last_order_dates", { p_supplier_ids: supplierIds });
  if (error) return new Map();
  return new Map((data ?? []).map((r) => [r.supplier_id, r.last_order_date]));
}
