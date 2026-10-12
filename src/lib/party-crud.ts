// 거래처(customers)와 공급처(suppliers)의 actions.ts가 테이블명/필드명만
// 다를 뿐 거의 동일한 CRUD·단가등록·단가예약·결제 로직을 각자 복붙해서
// 들고 있던 걸 여기로 모았다(헌법검사 보류 항목 — 거래처/공급처 로직
// 중복). 엑셀 일괄등록(importCustomersExcel/importSuppliersExcel)과
// 거래내역 조회(getCustomerTransactionHistory/getSupplierTransactionHistory)는
// 반품 처리·헤더명 등 고유 로직이 많아 공용화 가치보다 복잡도가 더
// 커서 각 파일에 그대로 둔다.
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ActionResult = { error: string } | null;

// 이 파일의 함수들은 테이블명/컬럼명을 런타임 매개변수로 받는다 —
// 호출부가 이미 table과 필드명을 리터럴 유니온으로 짝지어 넘기므로(각
// 함수 시그니처가 그 짝을 강제한다) 런타임 정확성은 보장되지만, Supabase
// 생성 타입은 "넘어올 수 있는 두 테이블 스키마 모두에 맞는 공통 모양"을
// 요구해 insert/update 페이로드를 과잉 프로퍼티 오류로 거부한다. 이
// 브리지 함수 하나에서만 그 스키마 검증을 건너뛴다 — 일반 .from() 호출을
// 쓰는 다른 코드에는 전혀 영향이 없다.
function dynamicTable(supabase: SupabaseServerClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 위 주석 참고, 이 한 줄로만 범위를 좁혔다.
  return (supabase as unknown as { from: (t: string) => any }).from(table);
}

export async function deleteParty(
  supabase: SupabaseServerClient,
  table: "customers" | "suppliers",
  id: string,
  foreignKeyMessage: string,
): Promise<ActionResult> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (!error) return null;
  return {
    error: error.message.includes("foreign key") ? foreignKeyMessage : `삭제에 실패했습니다: ${error.message}`,
  };
}

export async function bulkDeleteParty(
  supabase: SupabaseServerClient,
  table: "customers" | "suppliers",
  ids: string[],
): Promise<{ failCount: number }> {
  const results = await Promise.all(ids.map((id) => supabase.from(table).delete().eq("id", id)));
  return { failCount: results.filter((r) => r.error).length };
}

export async function upsertPartyPrice(
  supabase: SupabaseServerClient,
  table: "customer_product_prices" | "supplier_product_prices",
  partyIdField: "customer_id" | "supplier_id",
  partyId: string,
  productId: string,
  priceField: "unit_price" | "unit_cost",
  priceValue: number,
): Promise<ActionResult> {
  const { error } = await dynamicTable(supabase, table).upsert(
    { [partyIdField]: partyId, product_id: productId, [priceField]: priceValue },
    { onConflict: `${partyIdField},product_id` },
  );
  return error ? { error: `저장에 실패했습니다: ${error.message}` } : null;
}

export async function updatePartyProductPriceNotes(
  supabase: SupabaseServerClient,
  table: "customer_product_prices" | "supplier_product_prices",
  id: string,
  notes: string,
): Promise<ActionResult> {
  const { error } = await supabase.from(table).update({ notes: notes || null }).eq("id", id);
  return error ? { error: `저장에 실패했습니다: ${error.message}` } : null;
}

// 단가 예약(schedulePriceChange/schedulePurchasePriceChange) — 미래 적용
// 단가를 별도 테이블에 쌓아두고, 그 날짜가 된 뒤 applyDuePriceSchedules가
// 실제 단가 테이블에 반영한다(customers/suppliers 양쪽 다 "거래처+상품당
// 최신 단가 하나"만 남기는 구조라 지금 당장 바꿀 수 없어서).
export async function schedulePartyPriceChange(
  supabase: SupabaseServerClient,
  table: "price_change_schedules" | "purchase_price_change_schedules",
  partyIdField: "customer_id" | "supplier_id",
  partyId: string,
  productId: string,
  priceField: "new_unit_price" | "new_unit_cost",
  priceValue: number,
  effectiveDate: string,
  createdBy: string | null,
): Promise<ActionResult> {
  const { error } = await dynamicTable(supabase, table).insert({
    [partyIdField]: partyId,
    product_id: productId,
    [priceField]: priceValue,
    effective_date: effectiveDate,
    created_by: createdBy,
  });
  return error ? { error: `예약에 실패했습니다: ${error.message}` } : null;
}

export async function updatePartyPriceSchedule(
  supabase: SupabaseServerClient,
  table: "price_change_schedules" | "purchase_price_change_schedules",
  id: string,
  priceField: "new_unit_price" | "new_unit_cost",
  priceValue: number,
  effectiveDate: string,
) {
  return dynamicTable(supabase, table)
    .update({ [priceField]: priceValue, effective_date: effectiveDate })
    .eq("id", id)
    .is("applied_at", null)
    .select("id");
}

export async function cancelPartyPriceSchedule(
  supabase: SupabaseServerClient,
  table: "price_change_schedules" | "purchase_price_change_schedules",
  id: string,
) {
  return supabase.from(table).delete().eq("id", id).is("applied_at", null).select("id");
}

// 수금/지급(addCustomerPayment·addSupplierPayment) — 매출/매입 데이터는
// 건드리지 않고 별도 원장에 쌓아, 잔액은 항상 (거래 누계 - 결제 누계)로
// 그때그때 계산한다(lib/ar-ap.ts).
export async function addPartyPayment(
  supabase: SupabaseServerClient,
  table: "customer_payments" | "supplier_payments",
  partyIdField: "customer_id" | "supplier_id",
  partyId: string,
  paidAt: string,
  amount: number,
  method: string | null,
  memo: string | null,
  createdBy: string | null,
): Promise<ActionResult> {
  const { error } = await dynamicTable(supabase, table).insert({
    [partyIdField]: partyId,
    paid_at: paidAt,
    amount,
    method,
    memo,
    created_by: createdBy,
  });
  return error ? { error: `저장에 실패했습니다: ${error.message}` } : null;
}

export async function deletePartyPayment(
  supabase: SupabaseServerClient,
  table: "customer_payments" | "supplier_payments",
  id: string,
) {
  return supabase.from(table).delete().eq("id", id).select("id");
}
