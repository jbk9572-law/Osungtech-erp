import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// 관리자가 새 계정을 만들 때(auth.admin.createUser)만 필요한 서비스 롤 키
// 클라이언트. RLS를 완전히 우회하므로 브라우저로 절대 노출되면 안 되고,
// 이 함수는 서버 액션에서만 호출해야 한다. 배포 환경변수에 아직 키를 넣지
// 않았을 수 있어서, 없으면 이 시점에 바로 알 수 있게 명확한 에러를 던진다.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다. Supabase 대시보드 > Project Settings > API에서 service_role 키를 복사해 배포 환경변수에 추가해주세요."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
