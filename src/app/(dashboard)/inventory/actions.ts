"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
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
  const user = await getUser();

  // 자연로스(공정 중 손실/환산단위 오차 등)는 일반 재고조정과 달리 실물
  // 재고만 줄이는 게 아니라 FIFO 매입 레이어도 실제로 소진해야 한다 —
  // 그래야 매입-매출 수량 체계(remaining_quantity)가 어긋나지 않는다
  // (parent_child_sku_fifo_cogs 마이그레이션의 record_natural_loss 참고).
  // 그래서 이 경우만 일반 insert 대신 그 RPC를 탄다.
  if (String(formData.get("is_natural_loss") ?? "") === "1") {
    if (quantity >= 0) {
      return { error: "자연로스는 차감(음수) 방향으로만 등록할 수 있습니다." };
    }
    const { error: lossError } = await supabase.rpc("record_natural_loss", {
      p_product_id: productId,
      p_warehouse_id: warehouseId,
      p_quantity: Math.abs(quantity),
      p_note: note,
    });
    if (lossError) {
      return { error: `자연로스 등록에 실패했습니다: ${lossError.message}` };
    }
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { success: "자연로스가 등록되었습니다." };
  }

  // 파생 SKU(parent_product_id가 있는 품목)는 독립 재고가 없다 — 재고
  // 원장은 항상 모품목 하나에서만 쌓인다(parent_child_sku_fifo_cogs
  // 마이그레이션). 자연로스 분기(위)는 record_natural_loss RPC가 내부에서
  // 이미 모품목으로 해석하지만, 이 일반 조정 경로는 직접 insert하므로
  // 여기서도 같은 방식으로 먼저 해석해야 한다 — 안 그러면 파생 SKU로
  // 조정을 등록했을 때 그 파생 SKU 자신에게 재고가 쌓여 실제 재고 흐름과
  // 어긋난다.
  const { data: productRow } = await supabase
    .from("products")
    .select("parent_product_id")
    .eq("id", productId)
    .maybeSingle();
  const effectiveProductId = productRow?.parent_product_id ?? productId;

  const { error } = await supabase.from("inventory_transactions").insert({
    product_id: effectiveProductId,
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
  const user = await getUser();

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

  // 창고 전체 기준 실사(plainCandidates)의 "차이"는 더 이상 inventory.quantity
  // 캐시와 비교해 계산하지 않는다 — 전표 입력이 밀려 있으면(예: 두 달 전
  // 거래를 오늘 입력) 그 순간의 캐시 자체가 이미 틀려 있어서, 캐시 기준
  // 델타를 실사 확정값(counted_absolute_quantity)으로 그대로 저장해도 화면에
  // 보이는 "조정 수량(±N개)"이 실제 변동과 달라지는 문제가 있었다(실제
  // 사례로 확인됨). get_ledger_opening_balance(이번에 거래일자+실사앵커
  // 기준으로 재작성한 함수, p_before='infinity'로 "지금까지의 정확한
  // 원장 누적 잔량"을 구함)로 바꿔서, 델타가 항상 "실사 직전까지의 진짜
  // 잔량"을 기준으로 정확히 계산되게 한다.
  // "지금까지의 전부"를 포함해야 하므로 p_before는 오늘보다 확실히 뒤인
  // 시점(내일)으로 둔다 — 오늘 날짜로 등록된 거래까지 전부 포함시키기 위함.
  const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const trueBalanceByProduct = new Map<string, number>();
  await Promise.all(
    plainCandidates.map(async (r) => {
      const { data, error: balanceError } = await supabase.rpc("get_ledger_opening_balance", {
        p_product_id: r.productId,
        p_warehouse_id: warehouseId,
        p_before: tomorrowIso,
      });
      if (balanceError) {
        console.error("원장 잔량 조회 실패:", balanceError.message);
        return;
      }
      trueBalanceByProduct.set(r.productId, Number(data ?? 0));
    }),
  );

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
      countedQuantity: r.countedQuantity,
      delta: r.countedQuantity - (trueBalanceByProduct.get(r.productId) ?? 0),
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
  // counted_absolute_quantity: 이 실사 시점에 확정한 "절대" 수량을 같이
  // 남긴다 — 잔량 계산(get_product_ledger_rows 등)이 이 값이 있는 행을
  // 만나면 그 이전 누적(과거에 섞여 있었을 수 있는 오차)을 버리고 이
  // 값을 새 기준점으로 삼는다. changedPlain은 창고 전체 기준 실사라
  // countedQuantity 그대로가 절대값이고, changedLocation(위치별 실사)은
  // 그 위치만의 수량이라 창고 전체의 절대값이 아니므로 앵커로 쓰지
  // 않는다(위치별 실사는 위치 재고만 바뀌고 창고 합계 잔량 기준의
  // "리셋 지점"이 될 수 없다 — 델타만 반영).
  const { error } = await supabase.from("inventory_transactions").insert([
    ...changedPlain.map((r) => ({
      product_id: r.productId,
      warehouse_id: warehouseId,
      type: "adjustment" as const,
      quantity: r.delta,
      counted_absolute_quantity: r.countedQuantity,
      reference: sessionRef,
      note: userNote ? `재고실사: ${userNote}` : "재고실사",
      created_by: user?.id ?? null,
    })),
    ...changedLocation.map((r) => ({
      product_id: r.productId,
      warehouse_id: warehouseId,
      type: "adjustment" as const,
      quantity: r.delta,
      reference: sessionRef,
      note: userNote ? `재고실사: ${userNote}` : "재고실사",
      created_by: user?.id ?? null,
    })),
  ]);

  if (error) {
    return { error: `재고 실사 저장에 실패했습니다: ${error.message}` };
  }

  // 방금 저장한 delta(quantity)는 이제 캐시가 아니라 원장 잔량 기준으로
  // 계산돼서, 캐시가 그 사이 밀려 있었다면 apply_inventory_transaction
  // 트리거가 "캐시 + delta"로 더한 값이 counted_absolute_quantity와
  // 정확히 일치하지 않을 수 있다 — 바로 이어서 캐시를 원장 기준 정답으로
  // 다시 맞춘다(recalculate_inventory_cache, migration 205). 이 호출이
  // 실패해도 실사 자체(원장)는 이미 정확히 저장됐으니 등록을 막지 않고,
  // /inventory/count의 "지금 자동 교정" 버튼으로 나중에 다시 맞출 수 있다.
  const { error: recalcError } = await supabase.rpc("recalculate_inventory_cache");
  if (recalcError) console.error("실사 후 캐시 자가치유 실패:", recalcError.message);

  // 위치 기준으로 실사한 품목은 그 위치의 재고(inventory_locations)도
  // 같이 맞춘다 — apply_location_stock_delta가 상대값(delta)만큼 더하고,
  // 부호에 따라 위치 이력에 "입고"/"출고"로 남긴다. 이 단계가 실패해도
  // 위의 재고 실사 자체는 이미 저장됐으니 등록을 막지 않는다. 서로 다른
  // 품목/위치라 완전히 독립적인데 예전엔 한 줄씩 순서대로 기다렸다 —
  // 위치 실사 대상이 많은 회차(예: 창고 전체 QR 실사)는 그만큼 Supabase
  // 왕복이 직렬로 쌓였다. 동시에 보낸다.
  await Promise.all(
    changedLocation.map(async (r) => {
      const { error: locationError } = await supabase.rpc("apply_location_stock_delta", {
        p_product_id: r.productId,
        p_location_id: r.locationId,
        p_delta: r.delta,
      });
      if (locationError) console.error("위치별 재고 실사 반영 실패:", locationError.message);
    }),
  );

  revalidatePath("/inventory");
  revalidatePath("/inventory/locations");
  revalidatePath("/dashboard");
  const changedCount = changedPlain.length + changedLocation.length;
  return { success: `${changedCount}건의 재고 실사 조정이 저장되었습니다.` };
}

// /inventory/count의 "재고 캐시 정합성 검증" 패널 — 불일치를 보여주기만
// 하던 것에서, 실제로 전산 재고(inventory.quantity 캐시)를 이력 합계
// (거래일자 오름차순 + 재고실사 리셋 기준 정답)에 맞춰 고치는 자가치유
// 액션으로 확장한다(recalculate_inventory_cache RPC, migration 205 참고).
export async function recalculateInventoryCache(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("recalculate_inventory_cache");
  if (error) console.error("재고 캐시 자가치유 실패:", error.message);
  revalidatePath("/inventory/count");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}
