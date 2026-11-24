import type { createClient } from "@/lib/supabase/server";
import { canViewPage } from "@/lib/department-page-access";

type Supa = Awaited<ReturnType<typeof createClient>>;

// 메신저 ERP 카드(erp_ref)를 읽는 사람의 열람 권한 — 권한 없는 사람에게는 금액·거래처 등을 가리고 "권한 없음"만 보인다.
// 서버 화면이 한 번 계산해 카드에 넘긴다. (서버 액션 파일에 두지 않는다 — 액션으로 내보내면 외부에서 임의 인자로 호출할 수 있다.)
export type ErpRefAccess = Record<"sale" | "inventory" | "followup" | "announcement", boolean>;

export async function getErpRefAccess(supabase: Supa): Promise<ErpRefAccess> {
  const [sale, inventory, followup, announcement] = await Promise.all([
    canViewPage(supabase, "/sales"),
    canViewPage(supabase, "/inventory"),
    canViewPage(supabase, "/sales-activities"),
    canViewPage(supabase, "/announcements"),
  ]);
  return { sale, inventory, followup, announcement };
}
