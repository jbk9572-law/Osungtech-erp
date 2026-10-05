"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyForTenant } from "@/lib/notify";
import { portalHref } from "@/lib/portal-path";

export async function portalCreateOrder(
  _prevState: { error: string } | undefined,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const itemsJson = String(formData.get("items") ?? "[]");
  const memo = String(formData.get("memo") ?? "").trim() || null;

  let items: { product_id: string; quantity: number }[];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "품목 정보가 올바르지 않습니다." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "품목을 하나 이상 담아주세요." };
  }

  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("portal_create_order", {
    p_items: items,
    p_memo: memo,
  });

  if (error || !orderId) {
    return { error: `발주 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  // 거래처 포털 세션은 tenant_members가 없어 current_tenant_id()가 비어
  // notify()의 자동 테넌트 판별을 못 쓴다 — 방금 만든 주문 행에서 직접
  // tenant_id를 읽어 notifyForTenant()로 그 테넌트 직원 전원에게 알린다.
  // 알림이 실패해도(네트워크 등) 주문 자체는 이미 등록된 뒤라 그대로
  // 둔다 — 여기서 에러를 돌려주면 성공한 발주가 실패로 보인다.
  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("customer_orders")
      .select("tenant_id, is_demo, customers(name)")
      .eq("id", orderId)
      .single();
    if (order?.tenant_id) {
      const { data: recipients } = await admin.from("profiles").select("id").eq("tenant_id", order.tenant_id);
      if (recipients?.length) {
        await notifyForTenant({
          tenantId: order.tenant_id,
          isDemo: order.is_demo ?? false,
          userIds: recipients.map((r) => r.id),
          type: "customer_order",
          title: "새 거래처 발주",
          body: `${order.customers?.name ?? "거래처"} · 품목 ${items.length}건`,
          url: "/customer-orders",
          sourceId: orderId,
        });
      }
    }
  } catch {
    // 알림 발송 실패는 발주 등록 자체를 막지 않는다.
  }

  redirect(await portalHref("/orders"));
}
