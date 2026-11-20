import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type CompanyProfileUpdate = Database["public"]["Tables"]["company_profile"]["Update"];

// 회사정보(company_profile) 쓰기는 항상 이 함수로 한다.
//  1) 저장 직전에 내 (회사, 데모 여부) 행을 보장한다(ensure_company_profile, migration 275) — 데모/샌드박스 계정은 행이 없을 수 있다.
//  2) UPDATE가 실제로 바꾼 행 수를 확인한다 — 0건이면 "저장되었습니다"라고 하지 않고 실패로 돌려준다(예전엔 조용히 성공 처리).
// id로 행을 고르지 않는다 — RLS가 내 행만 갱신되게 거른다(DB가 WHERE 없는 UPDATE를 막아 형식상 조건 .not("id","is",null)을 붙인다).
export async function writeCompanyProfile(
  supabase: SupabaseServerClient,
  patch: CompanyProfileUpdate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: ensureError } = await supabase.rpc("ensure_company_profile");
  if (ensureError) return { ok: false, error: ensureError.message };

  const { data, error } = await supabase.from("company_profile").update(patch).not("id", "is", null).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "저장할 회사 정보를 찾지 못했습니다. 잠시 후 다시 시도해 주세요." };
  return { ok: true };
}
