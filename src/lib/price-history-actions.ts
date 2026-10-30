"use server";

import { createClient } from "@/lib/supabase/server";

export type PriceChangeHistoryRow = {
  id: string;
  action: string;
  oldUnit: number | null;
  newUnit: number | null;
  actorName: string | null;
  createdAt: string;
};

// 거래처/공급처 단가 행 하나의 변경 이력. get_price_change_history()는
// audit_logs를 관리자 전용 RLS 없이 이 용도로만 좁게 열어주는
// security definer 함수다(migration 201) — 담당 직원도 평소 쓰는 거래처/
// 공급처 상세 화면에서 바로 단가 변동 추이를 볼 수 있게 하기 위함.
export async function getPriceChangeHistory(
  tableName: "customer_product_prices" | "supplier_product_prices",
  recordId: string,
): Promise<PriceChangeHistoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_price_change_history", {
    p_table_name: tableName,
    p_record_id: recordId,
  });
  if (error) {
    console.error(`단가 변경 이력 조회 실패(${tableName}/${recordId}):`, error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    oldUnit: row.old_unit,
    newUnit: row.new_unit,
    actorName: row.actor_name,
    createdAt: row.created_at,
  }));
}
