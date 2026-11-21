import { createClient } from "@/lib/supabase/server";
import { getTenantTheme } from "@/lib/tenant-theme";
import { getThemeFeatures } from "@/lib/erp-theme-config";
import ModernApprovalsPage from "./modern";
import ClassicApprovalsPage from "./classic";

// 테마별로 화면 코드를 완전히 나눈다 — 모던(grid-modern)은 modern.tsx, 클래식은 동결본 classic.tsx. 서로 코드를 공유하지 않는다.
// 클래식 판정은 기존 기준(denseLists)을 그대로 쓴다.
async function ApprovalsPage(props: React.ComponentProps<typeof ClassicApprovalsPage>) {
  const supabase = await createClient();
  const modern = getThemeFeatures(await getTenantTheme(supabase)).denseLists;
  return modern ? <ModernApprovalsPage {...props} /> : <ClassicApprovalsPage {...props} />;
}

export default ApprovalsPage;
