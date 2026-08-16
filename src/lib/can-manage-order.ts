import type { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// sales/actions.ts, purchases/actions.ts, paper-calc/actions.ts에서 각자
// "주문 하나를 created_by만 뽑아 조회 + 현재 사용자와 비교"를 복제해서
// 쓰던 것을 하나로 모았다 — 모조지 수량 수동값 적용/되돌리기, 모조지
// 계산 반영이 모두 "이 매출/매입 건을 내가 관리할 수 있는가"를 같은
// 방식으로 확인한다.
export async function canManageOrder(
  supabase: SupabaseServerClient,
  table: "sales_orders" | "purchase_orders",
  orderId: string
): Promise<boolean> {
  const [{ data: order }, actor] = await Promise.all([
    supabase.from(table).select("created_by").eq("id", orderId).maybeSingle(),
    getCurrentActor(supabase),
  ]);
  return !!order && canManage(order.created_by, actor.userId, actor.isAdmin);
}
