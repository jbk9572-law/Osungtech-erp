import type { createClient } from "@/lib/supabase/server";
import { buildFormulaRows, type FormulaRow } from "@/lib/item-formulas";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 계산식 공용 저장소(input_formulas, migration 277) 읽기/쓰기 — 모든 화면이 이 두 함수만 쓴다.
// entity는 화면(전표/문서) 종류 이름이다. 새 화면을 붙일 때 여기 한 줄 추가하고, 삭제 시 식도 지우는 트리거를 마이그레이션에 같이 둔다.
export type FormulaEntity = "sales_order" | "purchase_order" | "quote" | "purchase_request" | "purchase_quote_request";

/** 전표 저장 직후: 그 전표의 식을 통째로 바꿔 기록한다. 식은 보조 정보라 실패해도 전표 저장은 성공 처리한다(식만 안 남음). */
export async function saveInputFormulas(
  supabase: SupabaseServerClient,
  entity: FormulaEntity,
  entityId: string,
  items: Parameters<typeof buildFormulaRows>[0],
): Promise<void> {
  const rows = buildFormulaRows(items);
  const { error: deleteError } = await supabase.from("input_formulas").delete().eq("entity", entity).eq("entity_id", entityId);
  if (deleteError) {
    console.error(`계산식 정리 실패(${entity}/${entityId}):`, deleteError.message);
    return;
  }
  if (rows.length === 0) return;
  const { error } = await supabase.from("input_formulas").insert(rows.map((r) => ({ ...r, entity, entity_id: entityId })));
  if (error) console.error(`계산식 저장 실패(${entity}/${entityId}):`, error.message);
}

/** 수정/상세 화면: 그 전표의 저장된 식. 읽기에 실패하면 빈 배열(화면은 식 없이 뜬다). */
export async function loadInputFormulas(supabase: SupabaseServerClient, entity: FormulaEntity, entityId: string): Promise<FormulaRow[]> {
  const { data, error } = await supabase.from("input_formulas").select("line_key, field, formula").eq("entity", entity).eq("entity_id", entityId);
  if (error) return [];
  return (data ?? []) as FormulaRow[];
}
