import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export const PAPER_STOCK_SKU = "TG0";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 모조지 계산은 원래 특정 거래처(SI) 업무 방식에 맞춰 만든 기능이라, 이
// SaaS의 다른 테넌트는 대부분 안 쓴다 — 환경설정 > 기능 관리에서
// featureKey "paper_calc"로 끈 테넌트는 매출/매입 등록 폼에 계산 진입
// 버튼 자체가 안 보이고(new-sale-form.tsx 등), 상세 화면의 계산 이력/
// 오버라이드 패널도, 대시보드의 모조지 집계도 전부 숨긴다 — 메뉴만 가려져
// 있고 안쪽 화면·로직은 여전히 노출되던 예전 상태를 이 함수 하나로 통일해
// 막는다. disabled_features 조회 자체가 실패하면(멀티테넌트 전환 이전
// 데이터 등) "안 꺼짐"을 기본값으로 삼아 기존 사용자(SI) 흐름을 깨지 않는다.
export async function isPaperCalcEnabled(supabase: SupabaseServerClient): Promise<boolean> {
  const { data: tenant } = await supabase.from("tenants").select("disabled_features").maybeSingle();
  return !(tenant?.disabled_features ?? []).includes("paper_calc");
}

// 모조지 자동반영은 매출(출고)/매입(입고) 양쪽에 똑같은 흐름(계산 합계로
// 품목 수량 재계산 → 오버라이드 확인 → 재고 반영)이 있는데, 예전엔 이
// 흐름 전체가 함수마다 복붙돼 있었다(sync/override/revert 각각 매출용,
// 매입용 한 쌍씩). 테이블명·재고 증감 방향만 다르고 나머지 로직은 100%
// 같아서, orderIdColumn(그 주문 타입을 구분하는 FK 컬럼명이자
// paper_calculations/paper_stock_overrides/주문품목 테이블 모두에서 그대로
// 쓰이는 값)을 매개변수로 받는 공용 함수로 합쳤다.
export type PaperOrderIdColumn = "sales_order_id" | "purchase_order_id";

// 이 주문에 현재 적용 중인 수동 오버라이드가 있으면 그 수량을 돌려주고,
// 없으면 null을 돌려준다. reverted_at이 비어있는 가장 최근 행이 "지금
// 적용 중"인 값이다.
async function getActiveOverrideQuantity(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  orderId: string
): Promise<number | null> {
  const { data } = await supabase
    .from("paper_stock_overrides")
    .select("override_quantity")
    .eq(orderIdColumn, orderId)
    .is("reverted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.override_quantity ?? null;
}

// RPC(create/update_sale_with_items, create/update_purchase_with_items)를
// 거치지 않고 sales_order_items/purchase_order_items를 직접 건드리는 이
// 파일의 모든 함수는, 실제 재고가 inventory_transactions 행 삽입에만
// 반응한다는 점(apply_inventory_transaction 트리거)을 스스로 챙겨야 한다 —
// 그러지 않으면 모조지 계산으로 자동반영된 TG0 줄은 매출/매입 금액에는
// 잡히지만 재고는 전혀 움직이지 않는 채로 남는다. delta가 0이면(수량 변화
// 없음) 삽입하지 않는다 — inventory_transactions.quantity는 0을 허용하지 않는다.
async function insertInventoryAdjustment(
  supabase: SupabaseServerClient,
  productId: string,
  warehouseId: string,
  delta: number,
  reference: string
): Promise<string | null> {
  if (delta === 0) return null;
  const { error } = await supabase.from("inventory_transactions").insert({
    product_id: productId,
    warehouse_id: warehouseId,
    type: "adjustment",
    quantity: delta,
    reference,
    note: "모조지 자동반영",
    created_by: await getUserId(supabase),
  });
  return error ? `모조지 자동반영 재고 갱신에 실패했습니다: ${error.message}` : null;
}

// 매출(출고)은 계산 수량이 늘수록 재고가 줄고, 매입(입고)은 계산 수량이
// 늘수록 재고가 는다 — 부호만 다르고 계산 자체는 항상
// "방향 × (새 수량 - 이전 수량)"으로 동일하다. supabase 호출과 분리된
// 순수 함수로 빼둬서(paper-calc-sync.test.ts) DB 없이도 부호 실수를
// 바로 잡아낼 수 있게 한다 — 재고 수량을 다루는 계산이라 부호가 뒤집히면
// 조용히 실제 재고가 반대로 틀어진다.
export function computePaperStockDelta(
  orderIdColumn: PaperOrderIdColumn,
  oldQuantity: number,
  newQuantity: number
): number {
  const sign = orderIdColumn === "sales_order_id" ? -1 : 1;
  return sign * (newQuantity - oldQuantity);
}

function paperStockReference(orderIdColumn: PaperOrderIdColumn, orderId: string): string {
  const prefix = orderIdColumn === "sales_order_id" ? "sales_order_paper_calc" : "purchase_order_paper_calc";
  return `${prefix}:${orderId}`;
}

async function applyPaperStockDelta(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  productId: string,
  warehouseId: string,
  orderId: string,
  oldQuantity: number,
  newQuantity: number
): Promise<string | null> {
  const delta = computePaperStockDelta(orderIdColumn, oldQuantity, newQuantity);
  return insertInventoryAdjustment(supabase, productId, warehouseId, delta, paperStockReference(orderIdColumn, orderId));
}

// 이 주문(매출/매입 공통)에 지금까지 저장된 모조지 계산들의 합계(연)를
// 구한다. .eq()의 컬럼명을 orderIdColumn 변수로 동적으로 넘기지 않고
// 굳이 리터럴로 분기하는 이유: scripts/check-pagination.mjs가 "id로
// 끝나는 컬럼으로 좁히는 필터라 1000행을 넘을 수 없다"는 걸 정적으로
// 판단할 때 문자열 리터럴만 인식한다 — 변수로 넘기면 이 안전장치가
// 무력화돼(자동 검사 스크립트가 위반으로 오탐) 매번 사람이 다시 확인해야 한다.
async function sumPaperCalcReams(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  orderId: string
): Promise<number> {
  const { data } =
    orderIdColumn === "sales_order_id"
      ? await supabase.from("paper_calculations").select("total_sheet").eq("sales_order_id", orderId)
      : await supabase.from("paper_calculations").select("total_sheet").eq("purchase_order_id", orderId);
  return (data ?? []).reduce((sum, c) => sum + c.total_sheet, 0);
}

// price/cost 둘 다 항상 같이 가져온다 — 매출은 price, 매입은 cost를
// 쓰는데, select 컬럼명을 동적으로 바꾸면 supabase 타입이 좁혀지지 않아
// 오히려 매번 캐스팅이 필요해진다.
async function getPaperProduct(
  supabase: SupabaseServerClient
): Promise<{ id: string; price: number; cost: number } | null> {
  const { data } = await supabase
    .from("products")
    .select("id, price, cost")
    .eq("sku", PAPER_STOCK_SKU)
    .maybeSingle();
  return data;
}

type PaperOrderContext = { warehouseId: string; customerId: string | null };

// 매출/매입 주문 테이블 자체가 다르고(거래처 컬럼명도 customer_id만
// 존재), 조회 결과 모양도 달라서 이 부분만은 분기한다.
async function getPaperOrderContext(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  orderId: string
): Promise<PaperOrderContext | null> {
  if (orderIdColumn === "sales_order_id") {
    const { data } = await supabase
      .from("sales_orders")
      .select("customer_id, warehouse_id")
      .eq("id", orderId)
      .maybeSingle();
    return data ? { warehouseId: data.warehouse_id, customerId: data.customer_id } : null;
  }
  const { data } = await supabase
    .from("purchase_orders")
    .select("warehouse_id")
    .eq("id", orderId)
    .maybeSingle();
  return data ? { warehouseId: data.warehouse_id, customerId: null } : null;
}

async function getExistingPaperItem(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  orderId: string,
  productId: string
): Promise<{ id: string; quantity: number } | null> {
  if (orderIdColumn === "sales_order_id") {
    const { data } = await supabase
      .from("sales_order_items")
      .select("id, quantity")
      .eq("sales_order_id", orderId)
      .eq("product_id", productId)
      .maybeSingle();
    return data;
  }
  const { data } = await supabase
    .from("purchase_order_items")
    .select("id, quantity")
    .eq("purchase_order_id", orderId)
    .eq("product_id", productId)
    .maybeSingle();
  return data;
}

async function deletePaperItem(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  itemId: string
): Promise<string | null> {
  const { error } =
    orderIdColumn === "sales_order_id"
      ? await supabase.from("sales_order_items").delete().eq("id", itemId)
      : await supabase.from("purchase_order_items").delete().eq("id", itemId);
  return error ? `모조지 자동반영 줄 삭제에 실패했습니다: ${error.message}` : null;
}

async function updatePaperItemQuantity(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  itemId: string,
  quantity: number
): Promise<string | null> {
  const { error } =
    orderIdColumn === "sales_order_id"
      ? await supabase.from("sales_order_items").update({ quantity }).eq("id", itemId)
      : await supabase.from("purchase_order_items").update({ quantity }).eq("id", itemId);
  return error ? `모조지 자동반영 수량 갱신에 실패했습니다: ${error.message}` : null;
}

// 매출은 거래처별 협의 단가(customer_product_prices)가 있으면 그걸
// 우선한다 — 매입 쪽엔 그런 공급처별 자동단가 개념이 없어서(매입 등록
// 화면도 공급처 단가를 자동으로 끌어오지 않고 직접 입력만 받음)
// product.cost를 그대로 쓴다. 이 차이는 리팩터 이전부터 있던 실제
// 업무 규칙 차이라 통합하지 않고 그대로 유지한다.
async function resolveNewPaperItemUnitPrice(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  product: { id: string; price: number; cost: number },
  context: PaperOrderContext
): Promise<number> {
  if (orderIdColumn === "sales_order_id" && context.customerId) {
    const { data: customerPrice } = await supabase
      .from("customer_product_prices")
      .select("unit_price")
      .eq("customer_id", context.customerId)
      .eq("product_id", product.id)
      .maybeSingle();
    if (customerPrice) return customerPrice.unit_price;
  }
  return orderIdColumn === "sales_order_id" ? product.price : product.cost;
}

async function insertPaperItem(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  orderId: string,
  productId: string,
  quantity: number,
  unitPrice: number
): Promise<string | null> {
  const { error } =
    orderIdColumn === "sales_order_id"
      ? await supabase.from("sales_order_items").insert({
          sales_order_id: orderId,
          product_id: productId,
          quantity,
          unit_price: unitPrice,
        })
      : await supabase.from("purchase_order_items").insert({
          purchase_order_id: orderId,
          product_id: productId,
          quantity,
          unit_cost: unitPrice,
        });
  return error ? `모조지 자동반영 줄 추가에 실패했습니다: ${error.message}` : null;
}

// 모조지(TG0) 사용량을 이 주문에 저장된 계산들의 합계(연)로 판매/매입
// 품목에 자동 반영한다. 계산은 여러 번 저장/삭제될 수 있으므로 매번
// "이 주문에 저장된 모든 계산의 합"으로 다시 계산해서 TG0 한 줄만 갱신한다
// (계산마다 별도 줄을 쌓으면 저장할 때마다 중복 가산되어 버린다).
async function syncPaperStockItem(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  orderId: string
): Promise<string | null> {
  const product = await getPaperProduct(supabase);
  if (!product) {
    const itemKind = orderIdColumn === "sales_order_id" ? "판매" : "매입";
    return `품목관리에 SKU '${PAPER_STOCK_SKU}'(모조지) 품목이 없어서 ${itemKind} 품목에는 반영하지 못했습니다.`;
  }

  const context = await getPaperOrderContext(supabase, orderIdColumn, orderId);
  if (!context) {
    const orderKind = orderIdColumn === "sales_order_id" ? "매출" : "매입";
    return `${orderKind} 거래를 찾을 수 없어 모조지 자동반영을 처리하지 못했습니다.`;
  }

  const totalReams = await sumPaperCalcReams(supabase, orderIdColumn, orderId);
  const existingItem = await getExistingPaperItem(supabase, orderIdColumn, orderId, product.id);
  const oldQuantity = existingItem?.quantity ?? 0;

  if (totalReams <= 0) {
    if (!existingItem) return null;
    const deleteError = await deletePaperItem(supabase, orderIdColumn, existingItem.id);
    if (deleteError) return deleteError;
    return applyPaperStockDelta(supabase, orderIdColumn, product.id, context.warehouseId, orderId, oldQuantity, 0);
  }

  if (existingItem) {
    // 수동 오버라이드가 적용 중이면(거래처 협의로 다른 수량 청구 등) 자동
    // 재계산으로 덮어쓰지 않는다 — 오버라이드를 해제해야만 자동값이 다시 반영된다.
    const overrideQuantity = await getActiveOverrideQuantity(supabase, orderIdColumn, orderId);
    if (overrideQuantity !== null) return null;

    const updateError = await updatePaperItemQuantity(supabase, orderIdColumn, existingItem.id, totalReams);
    if (updateError) return updateError;
    return applyPaperStockDelta(supabase, orderIdColumn, product.id, context.warehouseId, orderId, oldQuantity, totalReams);
  }

  const unitPrice = await resolveNewPaperItemUnitPrice(supabase, orderIdColumn, product, context);
  const insertError = await insertPaperItem(supabase, orderIdColumn, orderId, product.id, totalReams, unitPrice);
  if (insertError) return insertError;
  return applyPaperStockDelta(supabase, orderIdColumn, product.id, context.warehouseId, orderId, 0, totalReams);
}

async function insertPaperStockOverrideRow(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  orderId: string,
  autoQuantity: number,
  overrideQuantity: number,
  note: string | null,
  userId: string | null
): Promise<string | null> {
  const { error } =
    orderIdColumn === "sales_order_id"
      ? await supabase.from("paper_stock_overrides").insert({
          sales_order_id: orderId,
          auto_quantity: autoQuantity,
          override_quantity: overrideQuantity,
          note,
          created_by: userId,
        })
      : await supabase.from("paper_stock_overrides").insert({
          purchase_order_id: orderId,
          auto_quantity: autoQuantity,
          override_quantity: overrideQuantity,
          note,
          created_by: userId,
        });
  return error ? "오버라이드 저장에 실패했습니다." : null;
}

// TG0 자동반영 수량을 거래처 협의 등의 이유로 수동값으로 고정한다. 이전에
// 적용 중이던 오버라이드가 있으면 새 값으로 갈아치우는 셈이라 먼저 되돌림
// 처리하고, 새 이력을 남긴 뒤 실제 품목 수량도 그 값으로 바로 바꾼다.
async function overridePaperStockQuantity(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  orderId: string,
  overrideQuantity: number,
  note: string | null
): Promise<string | null> {
  const product = await getPaperProduct(supabase);
  if (!product) return `품목관리에 SKU '${PAPER_STOCK_SKU}'(모조지) 품목이 없습니다.`;

  const context = await getPaperOrderContext(supabase, orderIdColumn, orderId);
  if (!context) {
    const orderKind = orderIdColumn === "sales_order_id" ? "매출" : "매입";
    return `${orderKind} 거래를 찾을 수 없습니다.`;
  }

  const autoQuantity = await sumPaperCalcReams(supabase, orderIdColumn, orderId);

  const existingItem = await getExistingPaperItem(supabase, orderIdColumn, orderId, product.id);
  if (!existingItem) {
    return "적용할 모조지(TG0) 품목이 이 주문에 없습니다. 모조지 계산을 먼저 저장해주세요.";
  }

  const { error: revertError } = await supabase
    .from("paper_stock_overrides")
    .update({ reverted_at: new Date().toISOString() })
    .eq(orderIdColumn, orderId)
    .is("reverted_at", null);
  if (revertError) {
    // 이 단계가 실패한 채로 아래에서 새 오버라이드를 또 insert하면, 같은
    // 주문에 "활성" 오버라이드가 둘 이상 남는 불일치가 생길 수 있다.
    return `기존 오버라이드 정리에 실패했습니다: ${revertError.message}`;
  }

  const userId = await getUserId(supabase);
  const insertError = await insertPaperStockOverrideRow(
    supabase,
    orderIdColumn,
    orderId,
    autoQuantity,
    overrideQuantity,
    note,
    userId
  );
  if (insertError) return insertError;

  const itemUpdateError = await updatePaperItemQuantity(supabase, orderIdColumn, existingItem.id, overrideQuantity);
  if (itemUpdateError) return itemUpdateError;

  return applyPaperStockDelta(
    supabase,
    orderIdColumn,
    product.id,
    context.warehouseId,
    orderId,
    existingItem.quantity,
    overrideQuantity
  );
}

async function revertPaperStockOverride(
  supabase: SupabaseServerClient,
  orderIdColumn: PaperOrderIdColumn,
  orderId: string
): Promise<string | null> {
  const { error } = await supabase
    .from("paper_stock_overrides")
    .update({ reverted_at: new Date().toISOString() })
    .eq(orderIdColumn, orderId)
    .is("reverted_at", null);
  if (error) return "되돌리기에 실패했습니다.";

  return syncPaperStockItem(supabase, orderIdColumn, orderId);
}

// 아래부터는 sales/actions.ts, purchases/actions.ts, todos/actions.ts,
// paper-calc/actions.ts가 실제로 부르는 공개 함수들 — 위 공용 로직에
// orderIdColumn만 고정해서 얇게 감싼다. 이름/시그니처는 리팩터 전과
// 동일하게 유지해서 호출부를 건드릴 필요가 없게 했다.
export async function syncPaperStockOrderItem(
  supabase: SupabaseServerClient,
  salesOrderId: string
): Promise<string | null> {
  return syncPaperStockItem(supabase, "sales_order_id", salesOrderId);
}

export async function syncPaperStockPurchaseItem(
  supabase: SupabaseServerClient,
  purchaseOrderId: string
): Promise<string | null> {
  return syncPaperStockItem(supabase, "purchase_order_id", purchaseOrderId);
}

export async function overrideSalesPaperStockQuantity(
  supabase: SupabaseServerClient,
  salesOrderId: string,
  overrideQuantity: number,
  note: string | null
): Promise<string | null> {
  return overridePaperStockQuantity(supabase, "sales_order_id", salesOrderId, overrideQuantity, note);
}

export async function revertSalesPaperStockOverride(
  supabase: SupabaseServerClient,
  salesOrderId: string
): Promise<string | null> {
  return revertPaperStockOverride(supabase, "sales_order_id", salesOrderId);
}

export async function overridePurchasePaperStockQuantity(
  supabase: SupabaseServerClient,
  purchaseOrderId: string,
  overrideQuantity: number,
  note: string | null
): Promise<string | null> {
  return overridePaperStockQuantity(supabase, "purchase_order_id", purchaseOrderId, overrideQuantity, note);
}

export async function revertPurchasePaperStockOverride(
  supabase: SupabaseServerClient,
  purchaseOrderId: string
): Promise<string | null> {
  return revertPaperStockOverride(supabase, "purchase_order_id", purchaseOrderId);
}

type PaperCalcOwner =
  | { column: "sales_order_id"; id: string }
  | { column: "purchase_order_id"; id: string }
  | { column: "todo_id"; id: string };

async function insertPaperCalcRow(
  supabase: SupabaseServerClient,
  owner: PaperCalcOwner,
  pending: PendingCalc,
  userId: string | null
): Promise<string | null> {
  const row = { ...pendingToRow(pending), created_by: userId };
  const { error } =
    owner.column === "sales_order_id"
      ? await supabase.from("paper_calculations").insert({ sales_order_id: owner.id, ...row })
      : owner.column === "purchase_order_id"
        ? await supabase.from("paper_calculations").insert({ purchase_order_id: owner.id, ...row })
        : await supabase.from("paper_calculations").insert({ todo_id: owner.id, ...row });
  return error ? `모조지 계산 저장에 실패했습니다: ${error.message}` : null;
}

// 새 판매/매입 등록 화면에서는 아직 주문 id가 없어서 모조지 계산을 미리
// 저장할 수 없다 — 계산 결과를 localStorage에 잠깐 담아뒀다가 주문이 실제로
// 생성된 직후 이 함수들로 한 번에 저장한다.
export async function attachPendingPaperCalculation(
  supabase: SupabaseServerClient,
  salesOrderId: string,
  pendingRaw: string
): Promise<string | null> {
  const pending = parsePendingCalc(pendingRaw);
  if (!pending) return null;

  const insertError = await insertPaperCalcRow(supabase, { column: "sales_order_id", id: salesOrderId }, pending, await getUserId(supabase));
  if (insertError) return insertError;
  return syncPaperStockItem(supabase, "sales_order_id", salesOrderId);
}

export async function attachPendingPaperCalculationToPurchase(
  supabase: SupabaseServerClient,
  purchaseOrderId: string,
  pendingRaw: string
): Promise<string | null> {
  const pending = parsePendingCalc(pendingRaw);
  if (!pending) return null;

  const insertError = await insertPaperCalcRow(supabase, { column: "purchase_order_id", id: purchaseOrderId }, pending, await getUserId(supabase));
  if (insertError) return insertError;
  return syncPaperStockItem(supabase, "purchase_order_id", purchaseOrderId);
}

// 할일 등록 화면에서도 아직 todo id가 없어서 계산을 미리 저장할 수 없다 —
// 다른 attachPendingPaperCalculation*과 동일한 방식이지만, 할일은 금액/재고
// 개념이 없어 주문 품목에 자동 반영할 필요가 없다(참고용 표시 + 도면 보기만).
export async function attachPendingPaperCalculationToTodo(
  supabase: SupabaseServerClient,
  todoId: string,
  pendingRaw: string
): Promise<string | null> {
  const pending = parsePendingCalc(pendingRaw);
  if (!pending) return null;

  return insertPaperCalcRow(supabase, { column: "todo_id", id: todoId }, pending, await getUserId(supabase));
}

async function attachCopiedPaperCalculationsCore(
  supabase: SupabaseServerClient,
  orderIdColumn: "sales_order_id" | "purchase_order_id",
  orderId: string,
  copiedRaw: string
): Promise<string | null> {
  let candidates: unknown[];
  try {
    const parsed = JSON.parse(copiedRaw);
    if (!Array.isArray(parsed)) return null;
    candidates = parsed;
  } catch {
    return null;
  }

  const userId = await getUserId(supabase);
  let insertedAny = false;
  let failedAny = false;
  for (const candidate of candidates) {
    if (!isPendingCalc(candidate)) continue;
    const error = await insertPaperCalcRow(supabase, { column: orderIdColumn, id: orderId }, candidate, userId);
    if (error) failedAny = true;
    else insertedAny = true;
  }

  const syncError = insertedAny ? await syncPaperStockItem(supabase, orderIdColumn, orderId) : null;
  if (syncError) return syncError;
  return failedAny ? "일부 모조지 계산을 복사하지 못했습니다." : null;
}

// 오늘 입고된 모조지(TG0) 품목을 매출로 그대로 옮겨 담을 때, 그 매입 건에
// 연결돼 있던 모조지 계산(사이즈별 배치 내역)도 그대로 복사해서 새 매출
// 건에 붙인다 — attachPendingPaperCalculation과 달리 한 건이 아니라 여러
// 계산을 한 번에 붙일 수 있다(매입 건 하나에 계산이 여러 번 저장됐을 수 있음).
export async function attachCopiedPaperCalculations(
  supabase: SupabaseServerClient,
  salesOrderId: string,
  copiedRaw: string
): Promise<string | null> {
  return attachCopiedPaperCalculationsCore(supabase, "sales_order_id", salesOrderId, copiedRaw);
}

// 매입 등록도 매출과 마찬가지로 "할일 가져오기"에서 할일에 붙어있던 계산을
// 통째로(여러 건일 수 있음) 복사해올 수 있어야 해서, attachCopiedPaperCalculations와
// 동일한 방식으로 purchase_order_id 버전을 둔다.
export async function attachCopiedPaperCalculationsToPurchase(
  supabase: SupabaseServerClient,
  purchaseOrderId: string,
  copiedRaw: string
): Promise<string | null> {
  return attachCopiedPaperCalculationsCore(supabase, "purchase_order_id", purchaseOrderId, copiedRaw);
}

export type PendingCalc = {
  paperW: number;
  paperH: number;
  inputItems: Json;
  layouts: Json;
  totalPaper: number;
  totalSheet: number;
  totalProd: number;
  overProd: number;
  fulfilled: boolean;
};

function isPendingCalc(value: unknown): value is PendingCalc {
  const pending = value as Partial<PendingCalc> | null;
  return Boolean(
    pending &&
      pending.paperW &&
      pending.paperH &&
      Array.isArray(pending.inputItems) &&
      pending.inputItems.length > 0
  );
}

function parsePendingCalc(pendingRaw: string): PendingCalc | null {
  let pending: unknown;
  try {
    pending = JSON.parse(pendingRaw);
  } catch {
    return null;
  }
  return isPendingCalc(pending) ? pending : null;
}

function pendingToRow(pending: PendingCalc) {
  return {
    paper_w: pending.paperW,
    paper_h: pending.paperH,
    input_items: pending.inputItems,
    layouts: Array.isArray(pending.layouts) ? pending.layouts : [],
    total_paper: pending.totalPaper,
    total_sheet: pending.totalSheet,
    total_prod: pending.totalProd,
    over_prod: pending.overProd,
    fulfilled: pending.fulfilled,
  };
}

async function getUserId(supabase: SupabaseServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
