import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 서버 화면(인쇄 등)이 "이 회사의 테마"를 읽을 때 쓴다 — 전체 레이아웃이 한 번에 읽는 값(get_dashboard_layout_bootstrap)과 같은 tenants.theme.
// 회사 소속 직원은 RLS로 자기 회사 행만 보인다. 읽기에 실패하거나 값이 없으면 null(= 클래식과 같은 기본 동작).
export async function getTenantTheme(supabase: SupabaseServerClient): Promise<string | null> {
  try {
    const { data } = await supabase.from("tenants").select("theme").maybeSingle();
    return data?.theme ?? null;
  } catch {
    return null;
  }
}
