import { createClient } from "@/lib/supabase/server";
import { getTenantTheme } from "@/lib/tenant-theme";
import { getThemeFeatures } from "@/lib/erp-theme-config";
import { OfficialDocumentsList as ModernList } from "./modern";
import { OfficialDocumentsList as ClassicList } from "./classic";

// 내 공문함/받은 공문함 두 화면이 같이 쓰는 목록. 테마별로 화면 코드를 완전히 나눈다 — 모던은 modern.tsx, 클래식은 동결본 classic.tsx.
export async function OfficialDocumentsList(props: { box: "mine" | "received"; id?: string; status?: string }) {
  const supabase = await createClient();
  const modern = getThemeFeatures(await getTenantTheme(supabase)).listSidePanel;
  return modern ? <ModernList {...props} /> : <ClassicList box={props.box} id={props.id} />;
}
