"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  redirect(await portalHref("/orders"));
}
