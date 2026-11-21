import { createClient } from "@/lib/supabase/server";
import { getTenantTheme } from "@/lib/tenant-theme";
import { getThemeFeatures } from "@/lib/erp-theme-config";
import ModernPaymentRequestsPage from "./modern";
import ClassicPaymentRequestsPage from "./classic";


// 테마별로 화면 코드를 완전히 나눈다 — 모던(grid-modern)은 modern.tsx, 클래식은 동결본 classic.tsx. 서로 코드를 공유하지 않는다.
async function PaymentRequestsPage(props: React.ComponentProps<typeof ClassicPaymentRequestsPage>) {
  const supabase = await createClient();
  const modern = getThemeFeatures(await getTenantTheme(supabase)).listSidePanel;
  return modern ? <ModernPaymentRequestsPage /> : <ClassicPaymentRequestsPage {...props} />;
}

export default PaymentRequestsPage;
