import type { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 매출/매입/할일/공지사항 상세·수정 화면에서 "이 문서를 지금 보고 있는
// 내가 수정/삭제할 수 있는 사람인가"를 판정할 때 공통으로 쓰는 조회.
// requireAdmin()과 달리 페이지가 이미 만들어둔 supabase 클라이언트를
// 그대로 받는다 — 같은 요청 안에서 클라이언트를 중복 생성하지 않기 위함.
// getUser()는 react cache()로 감싸져 있어, 같은 요청 안에서 레이아웃 등이
// 이미 한 번 검증했다면 여기서는 네트워크 호출 없이 그 결과를 재사용한다.
//
// isManagerOrAdmin/departmentId는 공지사항 작성 권한(관리자/매니저)이나
// 화면별 부서 접근 제한(department_page_access)을 판정하는 화면들을
// 위해 추가했다 — profiles를 한 번만 조회해서 role/department_id를
// 같이 내려주므로, 이 값들이 필요 없는 기존 호출부도 추가 쿼리 없이
// 그대로 쓸 수 있다.
export async function getCurrentActor(
  supabase: SupabaseServerClient
): Promise<{
  userId: string | null;
  isAdmin: boolean;
  isManagerOrAdmin: boolean;
  departmentId: string | null;
}> {
  const user = await getUser();
  if (!user) return { userId: null, isAdmin: false, isManagerOrAdmin: false, departmentId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, department_id")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role;
  return {
    userId: user.id,
    isAdmin: role === "admin",
    isManagerOrAdmin: role === "admin" || role === "manager",
    departmentId: profile?.department_id ?? null,
  };
}
