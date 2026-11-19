import type { createClient } from "@/lib/supabase/server";
import { buildItemFormulas } from "@/lib/item-formulas";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 전표 저장(RPC) 직후 품목 칸 계산식을 전표(item_formulas)에 기록한다. 식은 보조 정보라 실패해도 전표 저장은 그대로 성공 처리한다
// (식만 안 남는다). 핵심 재고 DB 함수는 건드리지 않으려고 저장과 분리했다 — lib/item-formulas.ts 설명 참고.
export async function saveItemFormulas(
  supabase: SupabaseServerClient,
  table: "sales_orders" | "purchase_orders",
  orderId: string,
  items: Parameters<typeof buildItemFormulas>[0],
): Promise<void> {
  const formulas = buildItemFormulas(items);
  const { error } = await supabase
    .from(table)
    .update({ item_formulas: formulas.length > 0 ? formulas : null })
    .eq("id", orderId);
  if (error) console.error(`품목 계산식 저장 실패(${table}/${orderId}):`, error.message);
}
