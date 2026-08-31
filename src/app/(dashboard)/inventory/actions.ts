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
  // 제약과도 맞춰야 한다). 이 시점의 systemQuantity는 아직 쓰지 않는다 —
  // 화면을 띄워둔 동안 다른 매입/매출이 들어와 전산 재고가 이미 바뀌었을
  // 수 있어서, 클라이언트가 들고 있던 값을 그대로 믿으면 그 사이 변동분을
  // 이중으로 반영하거나 지워버리게 된다. 실제 델타는 저장 시점의 최신
  // 재고를 다시 조회해서 계산한다(아래).
  const candidateIds = rows
    .filter((r) => r.productId && r.countedQuantity !== r.systemQuantity)
    .map((r) => r.productId);
  if (candidateIds.length === 0) {
    return { error: "차이가 있는 품목이 없습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: liveInventory, error: fetchError } = await supabase
    .from("inventory")
    .select("product_id, quantity")
    .eq("warehouse_id", warehouseId)
    .in("product_id", candidateIds);
  if (fetchError) {
    return { error: `현재 재고를 확인하지 못했습니다: ${fetchError.message}` };
  }
  const liveQuantityByProduct = new Map(
    (liveInventory ?? []).map((row) => [row.product_id, row.quantity])
  );

  const changed = rows
    .filter((r) => candidateIds.includes(r.productId))
    .map((r) => ({
      productId: r.productId,
      countedQuantity: r.countedQuantity,
      delta: r.countedQuantity - (liveQuantityByProduct.get(r.productId) ?? 0),
    }))
    .filter((r) => r.delta !== 0);
  if (changed.length === 0) {
    return { error: "차이가 있는 품목이 없습니다(그 사이 다른 거래로 이미 일치하게 됐습니다)." };
  }

  const sessionRef = `stock_count:${new Date().toISOString()}`;
  const { error } = await supabase.from("inventory_transactions").insert(
    changed.map((r) => ({
      product_id: r.productId,
      warehouse_id: warehouseId,
      type: "adjustment" as const,
      quantity: r.delta,
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
