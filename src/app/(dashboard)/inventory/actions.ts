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
  const userNote = String(formData.get("note") ?? "").trim();

  let rows: {
    productId: string;
    systemQuantity: number;
    countedQuantity: number;
    // 랙별로 돌면서 실사한 경우에만 있다(QR 자동실사에서 위치 QR을 먼저
    // 찍고 품목을 스캔한 경우) — 있으면 창고 전체가 아니라 그 위치의
    // 재고(inventory_locations)를 기준으로 델타를 계산하고 반영한다.
    locationCode?: string | null;
  }[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: "잘못된 요청입니다." };
  }
  if (!Array.isArray(rows)) {
    return { error: "잘못된 요청입니다." };
  }
  // 화면에서 이미 차이 있는 행만 걸러서 보내지만, 요청이 조작됐을 가능성에
  // 대비해 서버에서도 시스템/실사 값이 같은 행은 한 번 더 걸러낸다. 이
  // 시점의 systemQuantity는 아직 쓰지 않는다 — 화면을 띄워둔 동안 다른
  // 매입/매출이 들어와 재고가 이미 바뀌었을 수 있어서, 클라이언트가 들고
  // 있던 값을 그대로 믿으면 그 사이 변동분을 이중으로 반영하거나 지워버리게
  // 된다. 실제 델타는 저장 시점의 최신 값을 다시 조회해서 계산한다(아래).
  const candidates = rows.filter((r) => r.productId && r.countedQuantity !== r.systemQuantity);
  if (candidates.length === 0) {
    return { error: "차이가 있는 품목이 없습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 위치 코드를 실제 위치 id로 바꾼다 — 이 창고에 없는 코드거나 그 사이
  // 위치 자체가 지워졌으면(드묾) 위치 구분 없이(창고 전체 기준) 처리한다.
  const locationCodes = [...new Set(candidates.map((r) => r.locationCode).filter((c): c is string => !!c))];
  const locationIdByCode = new Map<string, string>();
  if (locationCodes.length > 0) {
    const { data: locationRows } = await supabase
      .from("locations")
      .select("id, code")
      .eq("warehouse_id", warehouseId)
      .in("code", locationCodes);
    for (const row of locationRows ?? []) locationIdByCode.set(row.code, row.id);
  }

  const locationCandidates = candidates.filter((r) => r.locationCode && locationIdByCode.has(r.locationCode));
  const plainCandidates = candidates.filter((r) => !r.locationCode || !locationIdByCode.has(r.locationCode));

  const { data: liveInventory, error: fetchError } = await supabase
    .from("inventory")
    .select("product_id, quantity")
    .eq("warehouse_id", warehouseId)
    .in(
      "product_id",
      candidates.map((r) => r.productId),
    );
  if (fetchError) {
    return { error: `현재 재고를 확인하지 못했습니다: ${fetchError.message}` };
  }
  const liveQuantityByProduct = new Map((liveInventory ?? []).map((row) => [row.product_id, row.quantity]));

  const locationIds = [...new Set(locationCandidates.map((r) => locationIdByCode.get(r.locationCode!)!))];
  const { data: liveLocationStock } =
    locationIds.length > 0
      ? await supabase
          .from("inventory_locations")
          .select("product_id, location_id, quantity")
          .in("location_id", locationIds)
          .in(
            "product_id",
            locationCandidates.map((r) => r.productId),
          )
      : { data: [] };
  const liveLocationQtyByKey = new Map(
    (liveLocationStock ?? []).map((row) => [`${row.product_id}:${row.location_id}`, row.quantity]),
  );

  const changedPlain = plainCandidates
    .map((r) => ({
      productId: r.productId,
      delta: r.countedQuantity - (liveQuantityByProduct.get(r.productId) ?? 0),
    }))
    .filter((r) => r.delta !== 0);
  const changedLocation = locationCandidates
    .map((r) => {
      const locationId = locationIdByCode.get(r.locationCode!)!;
      return {
        productId: r.productId,
        locationId,
        delta: r.countedQuantity - (liveLocationQtyByKey.get(`${r.productId}:${locationId}`) ?? 0),
      };
    })
    .filter((r) => r.delta !== 0);

  if (changedPlain.length === 0 && changedLocation.length === 0) {
    return { error: "차이가 있는 품목이 없습니다(그 사이 다른 거래로 이미 일치하게 됐습니다)." };
  }

  const sessionRef = `stock_count:${new Date().toISOString()}`;
  const { error } = await supabase.from("inventory_transactions").insert(
    [...changedPlain, ...changedLocation].map((r) => ({
      product_id: r.productId,
      warehouse_id: warehouseId,
      type: "adjustment" as const,
      quantity: r.delta,
      reference: sessionRef,
      note: userNote ? `재고실사: ${userNote}` : "재고실사",
      created_by: user?.id ?? null,
    }))
  );

  if (error) {
    return { error: `재고 실사 저장에 실패했습니다: ${error.message}` };
  }

  // 위치 기준으로 실사한 품목은 그 위치의 재고(inventory_locations)도
  // 같이 맞춘다 — apply_location_stock_delta가 상대값(delta)만큼 더하고,
  // 부호에 따라 위치 이력에 "입고"/"출고"로 남긴다. 이 단계가 실패해도
  // 위의 재고 실사 자체는 이미 저장됐으니 등록을 막지 않는다.
  for (const r of changedLocation) {
    const { error: locationError } = await supabase.rpc("apply_location_stock_delta", {
      p_product_id: r.productId,
      p_location_id: r.locationId,
      p_delta: r.delta,
    });
    if (locationError) console.error("위치별 재고 실사 반영 실패:", locationError.message);
  }

  revalidatePath("/inventory");
  revalidatePath("/inventory/locations");
  revalidatePath("/dashboard");
  const changedCount = changedPlain.length + changedLocation.length;
  return { success: `${changedCount}건의 재고 실사 조정이 저장되었습니다.` };
}
