"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function adjustInventory(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const productId = String(formData.get("product_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const note = String(formData.get("note") ?? "") || null;

  if (!productId || !warehouseId) {
    return { error: "상품과 창고를 선택해주세요." };
  }
  if (!quantity) {
    return { error: "0이 아닌 수량을 입력해주세요. (기초재고 등록은 양수, 재고 차감은 음수)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("inventory_transactions").insert({
    product_id: productId,
    warehouse_id: warehouseId,
    type: "adjustment",
    quantity,
    note,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: `재고 조정에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: "재고가 조정되었습니다." };
}

// 재고 실사: 화면에서 전산 재고와 다르게 고친 품목만 골라 한 번에 조정
// 트랜잭션으로 남긴다. 같은 회차에서 나온 조정임을 나중에 입출고내역에서
// 알아볼 수 있게 reference를 타임스탬프로 묶는다.
export async function submitStockCount(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  if (!warehouseId) {
    return { error: "창고 정보를 확인할 수 없습니다." };
  }

  let rows: { productId: string; systemQuantity: number; countedQuantity: number }[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: "잘못된 요청입니다." };
  }
  if (!Array.isArray(rows)) {
    return { error: "잘못된 요청입니다." };
  }
  // 화면에서 이미 차이 있는 행만 걸러서 보내지만, 요청이 조작됐을 가능성에
  // 대비해 서버에서도 delta가 0인 행은 한 번 더 걸러낸다(quantity <> 0
  // 제약과도 맞춰야 한다).
  const changed = rows.filter(
    (r) => r.productId && r.countedQuantity !== r.systemQuantity
  );
  if (changed.length === 0) {
    return { error: "차이가 있는 품목이 없습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sessionRef = `stock_count:${new Date().toISOString()}`;
  const { error } = await supabase.from("inventory_transactions").insert(
    changed.map((r) => ({
      product_id: r.productId,
      warehouse_id: warehouseId,
      type: "adjustment" as const,
      quantity: r.countedQuantity - r.systemQuantity,
      reference: sessionRef,
      note: "재고실사",
      created_by: user?.id ?? null,
    }))
  );

  if (error) {
    return { error: `재고 실사 저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: `${changed.length}건의 재고 실사 조정이 저장되었습니다.` };
}
