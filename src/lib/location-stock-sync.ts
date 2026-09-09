import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type OrderType = "sale" | "purchase";

export type LocationOption = {
  locationId: string;
  code: string;
  tier: number;
  position: number;
  quantity: number;
};

// 품목 하나가 위치 2곳 이상에 나뉘어 있을 때, 사용자가 저장 시점에 직접
// 고른("어느 위치에서 몇 개씩 뺄지/넣을지") 배분값. new-sale-form.tsx /
// new-purchase-form.tsx의 확인 모달에서 만들어져 hidden input으로 넘어온다.
export type LocationAllocationChoice = {
  productId: string;
  allocations: { locationId: string; quantity: number }[];
};

// 위치가 2곳 이상인 품목 중 사용자가 아무 것도 고르지 않고(모달을 거치지
// 않고) 저장된 경우를 대비한 기본값 — 재고가 가장 많은 위치 하나에 전량
// 배정한다. 판매 폼은 항상 모달을 거치게 되어 있어 정상 경로에서는 쓰이지
// 않지만, 그렇더라도 매출/매입 저장 자체가 막히면 안 되므로 안전망으로 둔다.
function fallbackAllocation(rows: LocationOption[], totalQty: number) {
  const top = [...rows].sort((a, b) => b.quantity - a.quantity)[0];
  return [{ locationId: top.locationId, amount: totalQty }];
}

// 매출/매입 한 건을 저장한 뒤 호출한다. 품목별로 위치가 0곳이면 건너뛰고,
// 1곳이면 자동으로 그 위치에 반영하고, 2곳 이상이면 allocationChoices에서
// 사용자가 고른 배분을 따른다. 실제로 반영한 만큼을
// order_item_location_stock에 남겨서, 이 건을 나중에 수정/삭제할 때
// reverseOrderLocationStock로 정확히 되돌릴 수 있게 한다.
export async function applyOrderLocationStock(
  supabase: SupabaseServerClient,
  params: {
    orderType: OrderType;
    orderId: string;
    warehouseId: string;
    items: { productId: string | null; quantity: number }[];
    // "in"이면 위치 재고를 늘리고(매입/입고, 매출 반품), "out"이면 줄인다(매출/출고).
    direction: "in" | "out";
    allocationChoices?: LocationAllocationChoice[];
  },
): Promise<void> {
  const { orderType, orderId, warehouseId, items, direction, allocationChoices } = params;
  const sign = direction === "in" ? 1 : -1;

  const qtyByProduct = new Map<string, number>();
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;
    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
  }
  if (qtyByProduct.size === 0) return;

  const productIds = [...qtyByProduct.keys()];
  const { data: existingRows } = await supabase
    .from("inventory_locations")
    .select("id, product_id, location_id, quantity, locations!inner(warehouse_id)")
    .in("product_id", productIds)
    .eq("locations.warehouse_id", warehouseId);

  const rowsByProduct = new Map<string, { id: string; location_id: string; quantity: number }[]>();
  for (const row of existingRows ?? []) {
    const list = rowsByProduct.get(row.product_id) ?? [];
    list.push({ id: row.id, location_id: row.location_id, quantity: row.quantity });
    rowsByProduct.set(row.product_id, list);
  }
  const choiceByProduct = new Map((allocationChoices ?? []).map((c) => [c.productId, c.allocations]));

  const historyRows: {
    order_type: OrderType;
    order_id: string;
    product_id: string;
    location_id: string;
    quantity_delta: number;
  }[] = [];

  for (const [productId, totalQty] of qtyByProduct) {
    const rows = rowsByProduct.get(productId) ?? [];
    if (rows.length === 0) continue; // 이 품목은 어느 위치에도 배정된 적이 없다 — 반영할 곳이 없으므로 건너뜀

    const options: LocationOption[] = rows.map((r) => ({
      locationId: r.location_id,
      code: "",
      tier: 0,
      position: 0,
      quantity: r.quantity,
    }));

    let plan: { locationId: string; amount: number }[];
    if (rows.length === 1) {
      plan = [{ locationId: rows[0].location_id, amount: totalQty }];
    } else {
      const chosen = choiceByProduct.get(productId);
      plan =
        chosen && chosen.length > 0
          ? chosen.map((c) => ({ locationId: c.locationId, amount: c.quantity })).filter((p) => p.amount > 0)
          : fallbackAllocation(options, totalQty);
    }

    for (const p of plan) {
      const row = rows.find((r) => r.location_id === p.locationId);
      if (!row) continue;
      const delta = sign * p.amount;
      // 절대값(quantity: row.quantity + delta)으로 직접 update하는 대신
      // 상대값(delta)만 함수에 넘긴다 — apply_location_stock_delta가 그
      // 자리에서 "quantity = quantity + delta"로 더하므로, 이 요청과 저
      // 요청 사이에 다른 변경이 끼어들어도(같은 위치에 다른 매출이 먼저
      // 반영되는 등) 값을 덮어쓰지 않는다. 이 함수가 트랜잭션 범위에
      // "입고/출고"를 남겨서 location_stock_history에도 그대로 찍힌다.
      const { error } = await supabase.rpc("apply_location_stock_delta", {
        p_product_id: productId,
        p_location_id: p.locationId,
        p_delta: delta,
      });
      if (error) {
        console.error("위치별 재고 반영 실패:", error.message);
        continue;
      }
      historyRows.push({ order_type: orderType, order_id: orderId, product_id: productId, location_id: p.locationId, quantity_delta: delta });
    }
  }

  if (historyRows.length > 0) {
    const { error } = await supabase.from("order_item_location_stock").insert(historyRows);
    if (error) console.error("위치별 재고 배정 이력 저장 실패:", error.message);
  }
}

// 매출/매입 건을 수정하거나 삭제하기 전에 호출한다. applyOrderLocationStock이
// 이 건 때문에 실제로 반영했던 만큼(quantity_delta)을 그대로 반대 부호로
// 되돌리고, 되돌린 기록은 지운다. 수정 화면은 "되돌리기 → (새 내용으로)
// 다시 반영"의 순서로 쓰면 된다.
export async function reverseOrderLocationStock(
  supabase: SupabaseServerClient,
  orderType: OrderType,
  orderId: string,
): Promise<void> {
  const { data: rows } = await supabase
    .from("order_item_location_stock")
    .select("id, product_id, location_id, quantity_delta")
    .eq("order_type", orderType)
    .eq("order_id", orderId);
  if (!rows || rows.length === 0) return;

  for (const row of rows) {
    // apply_location_stock_delta가 상대값으로 더하고(없으면 새로 만들고)
    // 부호에 따라 입고/출고를 이력에 남긴다 — applyOrderLocationStock과
    // 동일한 함수를 그대로 재사용한다.
    const { error } = await supabase.rpc("apply_location_stock_delta", {
      p_product_id: row.product_id,
      p_location_id: row.location_id,
      p_delta: -row.quantity_delta,
    });
    if (error) console.error("위치별 재고 되돌리기 실패:", error.message);
  }

  const { error: cleanupError } = await supabase
    .from("order_item_location_stock")
    .delete()
    .eq("order_type", orderType)
    .eq("order_id", orderId);
  if (cleanupError) console.error("위치별 재고 배정 이력 정리 실패:", cleanupError.message);
}

// 매출/매입 서버 액션에서 hidden input(location_allocations)으로 넘어온
// JSON을 파싱한다. 형식이 깨져 있거나 비어 있으면(모달을 거치지 않은
// 정상적인 경우 포함) 빈 배열을 돌려줘서, applyOrderLocationStock이 기본
// 배정(fallbackAllocation)으로 처리하게 둔다.
export function parseAllocationChoices(raw: string): LocationAllocationChoice[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

// new-sale-form.tsx / new-purchase-form.tsx에서, 현재 입력된 품목 중 위치가
// 2곳 이상인 것만 골라 확인 모달에 보여줄 형태로 정리한다. 페이지 로드 시
// 미리 내려받은 productLocations(품목별 위치 목록 전체)를 그대로 필터링만
// 하므로 추가 네트워크 요청이 없다.
export function findMultiLocationItems(
  items: { productId: string; quantity: number }[],
  productLocations: Record<string, LocationOption[]>,
): { productId: string; quantity: number; locations: LocationOption[] }[] {
  const qtyByProduct = new Map<string, number>();
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;
    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
  }
  const result: { productId: string; quantity: number; locations: LocationOption[] }[] = [];
  for (const [productId, quantity] of qtyByProduct) {
    const locations = productLocations[productId] ?? [];
    if (locations.length >= 2) {
      result.push({ productId, quantity, locations });
    }
  }
  return result;
}
