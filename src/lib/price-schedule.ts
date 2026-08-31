import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 오늘(effective_date <= 오늘) 도래한 예약 단가를 customer_product_prices에
// 반영한다. 별도 배치/크론 없이, 가격을 조회하는 화면(거래처 상세, 판매
// 등록)에 들어올 때마다 이 함수를 먼저 호출해서 "그 시점 기준으로 이미
// 지난 예약은 항상 반영돼 있게" 만든다 — 서버가 그날 하필 안 켜져 있어도
// 다음에 누가 화면을 열기만 하면 그때 적용되므로 놓칠 일이 없다.
//
// 예약을 등록한 사람이 아닌 다른 직원이 화면을 열어도 반영돼야 하는
// 정상적인 흐름이라, RLS(본인/관리자만 수정 가능)를 우회해야 한다 —
// apply_due_price_schedules는 그래서 security definer RPC로 구현돼 있다
// (migration 79). 같은 거래처+상품에 예약이 여러 개 겹쳐도 effective_date가
// 가장 늦은 것이 최종값으로 반영된다.
export async function applyDuePriceSchedules(supabase: SupabaseServerClient, customerId?: string) {
  await supabase.rpc("apply_due_price_schedules", { p_customer_id: customerId ?? null });
}

// applyDuePriceSchedules와 동일한 방식의 매입단가(공급처) 버전.
export async function applyDuePurchasePriceSchedules(supabase: SupabaseServerClient, supplierId?: string) {
  await supabase.rpc("apply_due_purchase_price_schedules", { p_supplier_id: supplierId ?? null });
}
