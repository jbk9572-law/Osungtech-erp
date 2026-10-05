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
      .select("tenant_id, is_demo, doc_no, customers(name)")
      .eq("id", orderId)
      .single();
    if (order?.tenant_id) {
      const isDemo = order.is_demo ?? false;
      const customerName = order.customers?.name ?? "거래처";
      // 토스트/알림함을 눌렀을 때 전체 목록이 아니라 바로 이 주문으로
      // 가도록 카드 id(#order-<id>)를 앵커로 붙인다 — 서버가 아니라
      // 브라우저가 알아서 그 위치로 스크롤해준다(쿼리 파라미터나 별도
      // 자바스크립트 없이).
      const orderUrl = `/customer-orders#order-${orderId}`;
      const { data: recipients } = await admin.from("profiles").select("id").eq("tenant_id", order.tenant_id);
      if (recipients?.length) {
        await notifyForTenant({
          tenantId: order.tenant_id,
          isDemo,
          userIds: recipients.map((r) => r.id),
          type: "customer_order",
          title: "새 거래처 발주",
          body: `${customerName} · 품목 ${items.length}건`,
          url: orderUrl,
          sourceId: orderId,
        });
      }

      // 탭을 안 보고 있으면 토스트/소리를 놓칠 수 있어서, 평소에도 직원들이
      // 들여다보는 그룹웨어 메신저 "전체" 채널에도 같은 소식을 남긴다 —
      // 실시간 구독이 걸려있어 메신저 화면을 열어둔 사람에겐 바로 보이고,
      // 안 봤더라도 안 읽은 메시지로 계속 남는다. get_or_create_all_channel()
      // RPC는 호출자 세션의 current_tenant_id()를 쓰는데 포털 세션은 그게
      // 비어 있어 못 쓰므로, 여기서는 이미 알고 있는 tenant_id로 직접
      // 조회/생성한다.
      let channelId: string | null = null;
      const { data: existingChannel } = await admin
        .from("messenger_channels")
        .select("id")
        .eq("tenant_id", order.tenant_id)
        .eq("is_demo", isDemo)
        .eq("type", "all")
        .maybeSingle();
      channelId = existingChannel?.id ?? null;
      if (!channelId) {
        const { data: createdChannel, error: channelError } = await admin
          .from("messenger_channels")
          .insert({ tenant_id: order.tenant_id, is_demo: isDemo, type: "all" })
          .select("id")
          .single();
        if (channelError) console.error("전체 채널 생성 실패:", channelError.message);
        channelId = createdChannel?.id ?? null;
      }
      if (channelId) {
        const { error: messageError } = await admin.from("messenger_messages").insert({
          channel_id: channelId,
          sender_id: null,
          content: `🔔 [거래처 발주 알림] ${customerName} · 주문 ${order.doc_no} · 품목 ${items.length}건 — 생산관리 > 거래처 발주 승인에서 확인해주세요.`,
        });
        if (messageError) console.error("발주 알림 메시지 전송 실패:", messageError.message);
      }
    }
  } catch {
    // 알림 발송 실패는 발주 등록 자체를 막지 않는다.
  }

  redirect(await portalHref("/orders"));
}
