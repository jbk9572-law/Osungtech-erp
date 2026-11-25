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

// 인쇄 서식처럼 "이 회사가 무엇을 쓸 수 있나"를 가를 때 쓰는 값 — 테마·회사 식별자(slug)·플랫폼 관리자가 지정한 서식 목록을 읽는다(DB 호출 1번).
// allowedForms가 null이면 "미지정"이라 invoice-form.ts의 기존 규칙을 따른다. 지정 열(migration 282)이 아직 없는 DB에서는 예전 조회로 한 번 더 시도한다.
export async function getTenantInvoiceScope(
  supabase: SupabaseServerClient,
): Promise<{ theme: string | null; slug: string | null; allowedForms: string[] | null }> {
  try {
    const { data, error } = await supabase.from("tenants").select("theme, slug, allowed_invoice_forms").maybeSingle();
    if (!error) return { theme: data?.theme ?? null, slug: data?.slug ?? null, allowedForms: data?.allowed_invoice_forms ?? null };
    const { data: old } = await supabase.from("tenants").select("theme, slug").maybeSingle();
    return { theme: old?.theme ?? null, slug: old?.slug ?? null, allowedForms: null };
  } catch {
    return { theme: null, slug: null, allowedForms: null };
  }
}
