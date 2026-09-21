import { createClient, getUser } from "@/lib/supabase/server";

// 플랫폼(엘보닉스) 운영자 전용 권한 체크. profiles.role의 "admin"은
// 테넌트 안에서만 의미 있는 값이라(RLS로 테넌트별로 격리됨) 여러 회사를
// 넘나드는 이 화면의 권한 체크로는 쓸 수 없다 — 그래서 테넌트에 속하지
// 않는 별도의 platform_admins 테이블/is_platform_admin() 함수를 쓴다.
export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { supabase, isPlatformAdmin: false };

  const { data: isPlatformAdmin, error } = await supabase.rpc("is_platform_admin");
  // 조회 자체가 실패하면 권한이 있는지 없는지 알 수 없으므로, 안전하게
  // "권한 없음"으로 처리한다(fail-closed).
  if (error) return { supabase, isPlatformAdmin: false };

  return { supabase, isPlatformAdmin: isPlatformAdmin === true };
}
