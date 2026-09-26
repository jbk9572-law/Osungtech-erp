import { redirect } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 환경설정 > 기능 관리(tenants.disabled_features, migration 104)로 테넌트가
// 끈 모듈은 메뉴에서만 가려지고(erp-menu.ts의 getVisibleMenuGroups) 화면
// 자체는 그대로 열려 있었다 — 전체 감사에서 발견. paper-calc은
// isPaperCalcEnabled(paper-calc-sync.ts)로 이미 화면 진입 자체를 막고
// 있었지만, 생산관리/영업관리(CRM)/전자결재/공문관리/인사관리/메일함은
// 그 검사가 아예 없어서 메뉴만 안 보일 뿐 URL을 직접 치면(북마크, 공유
// 링크 등) 꺼둔 기능의 데이터를 그대로 읽고 쓸 수 있었다. 그 6개 모듈의
// 진입 페이지에서 이 함수 하나로 통일해서 막는다.
export async function isFeatureEnabled(supabase: SupabaseServerClient, featureKey: string): Promise<boolean> {
  const { data: tenant } = await supabase.from("tenants").select("disabled_features").maybeSingle();
  return !(tenant?.disabled_features ?? []).includes(featureKey);
}

// 꺼진 기능이면 대시보드로 되돌린다 — paper-calc/page.tsx와 동일한 처리.
export async function requireFeatureEnabled(supabase: SupabaseServerClient, featureKey: string): Promise<void> {
  if (!(await isFeatureEnabled(supabase, featureKey))) {
    redirect("/dashboard");
  }
}
