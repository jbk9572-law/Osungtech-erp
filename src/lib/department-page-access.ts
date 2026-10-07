import type { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// settings/page-access 화면에서 부서별로 켜고 끌 수 있는 화면 목록 —
// 각 page.tsx가 canViewPage(supabase, "<page_key>")를 부를 때 쓰는
// 문자열과 정확히 같아야 한다(라벨만 이 목록에서 가져다 쓰고, 실제 게이트
// 문자열은 각 page.tsx에 그대로 둔다 — erp-menu.ts의 href들도 각 화면에
// 흩어져 있는 것과 같은 결).
export const RESTRICTABLE_PAGES: { pageKey: string; label: string }[] = [
  { pageKey: "/receivables", label: "미수금현황" },
  { pageKey: "/payables", label: "미지급금현황" },
  { pageKey: "/subcontractors", label: "하청업체관리" },
  { pageKey: "/subcontractor-payables", label: "외주비정산" },
];

// 미수금현황/하청업체관리처럼 여러 화면이 같이 쓰는 원천 테이블
// (sales_orders 등) 위에 RLS로 부서 제한을 걸 수는 없어서(매출관리
// 화면까지 같이 막혀버린다), 화면(page_key) 단위로 "이 사용자가 지금
// 이 화면을 볼 수 있는가"를 서버 컴포넌트가 직접 확인하는 app-level
// 게이트로 둔다 — adminOnly 화면들이 지금까지 해온 것과 같은 수준의
// 보안 경계다.
//
// department_page_access에 이 page_key로 설정된 행이 하나도 없으면
// "전체공개"가 기본값이다(관리자가 opt-in으로 특정 화면만 특정 부서에
// 묶는 방식 — 전부 막아버리는 기본값이면 이 기능을 배포한 순간 아무도
// 못 보는 화면이 생길 수 있어 위험하다). 관리자는 항상 통과한다.
export async function canViewPage(supabase: SupabaseServerClient, pageKey: string): Promise<boolean> {
  const { userId, isAdmin, departmentId } = await getCurrentActor(supabase);
  if (!userId) return false;
  if (isAdmin) return true;

  const { data: rows } = await supabase
    .from("department_page_access")
    .select("department_id")
    .eq("page_key", pageKey);

  if (!rows || rows.length === 0) return true;
  if (!departmentId) return false;
  return rows.some((r) => r.department_id === departmentId);
}
