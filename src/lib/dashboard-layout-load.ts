import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { normalizeDashboardLayout, type DashboardLayout } from "@/lib/dashboard-layout";

// 메인 화면 배치 읽기 — 우선순위: 내가 저장한 배치 → 관리자가 저장한 회사 기본 → 시스템 기본.
// companyLayout은 "기본값으로"를 눌렀을 때 돌아갈 곳이다. 저장값은 항상 검증·보정해서 돌려준다.
export async function loadDashboardLayouts(
  supabase: SupabaseClient<Database>,
  userId: string | null,
): Promise<{ layout: DashboardLayout; companyLayout: DashboardLayout }> {
  const [{ data: mine }, { data: company }] = await Promise.all([
    userId
      ? supabase.from("ui_dashboard_layout").select("layout").eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("tenant_dashboard_layout").select("layout").maybeSingle(),
  ]);
  const companyLayout = normalizeDashboardLayout(company?.layout);
  return { layout: mine ? normalizeDashboardLayout(mine.layout) : companyLayout, companyLayout };
}
