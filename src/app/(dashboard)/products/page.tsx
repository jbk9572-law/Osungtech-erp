import { createClient } from "@/lib/supabase/server";
import { getTenantTheme } from "@/lib/tenant-theme";
import { getThemeFeatures } from "@/lib/erp-theme-config";
import ModernProductsPage from "./modern";
import ClassicProductsPage from "./classic";

// 테마별로 화면 코드를 완전히 나눈다 — 모던(grid-modern)은 modern.tsx, 클래식은 동결본 classic.tsx. 서로 코드를 공유하지 않는다.
async function ProductsPage(props: React.ComponentProps<typeof ClassicProductsPage>) {
  const supabase = await createClient();
  const modern = getThemeFeatures(await getTenantTheme(supabase)).listSidePanel;
  return modern ? <ModernProductsPage {...props} /> : <ClassicProductsPage {...props} />;
}

export default ProductsPage;
