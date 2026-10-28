import { createClient, getUser } from "@/lib/supabase/server";

// 플랫폼 운영자 전용 권한 체크. profiles.role의 "admin"은 테넌트 안에서만
// 의미 있는 값이라(RLS로 테넌트별로 격리됨) 여러 회사를 넘나드는 이 화면의
// 권한 체크로 그대로 쓸 수 없다 — 그래서 is_platform_admin() RPC로
// 판정한다. 이 함수는 (1) platform_admins 테이블에 등록돼 있거나
// (2) tenants.is_platform_operator = true로 지정된 "플랫폼 운영 주체
// 테넌트" 소속이면서 profiles.role='admin'이면 true를 반환한다
// (migration 198) — 즉 그 테넌트의 관리자는 별도 등록 없이 자동으로
// 플랫폼 관리자가 된다. 어느 테넌트가 운영 주체인지는 고정된 슬러그가
// 아니라 데이터(tenants.is_platform_operator)로 정해지므로, 나중에
// 바뀌어도 코드 수정 없이 그 값만 옮기면 된다.
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
