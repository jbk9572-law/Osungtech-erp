"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import type { FormState } from "@/components/form-message";

// 새 고객사(테넌트)를 만들고 그 회사의 첫 관리자 계정까지 한 번에
// 발급한다. 지금은 공개 회원가입 페이지가 없어서(모든 계정은 관리자가
// 직접 만들어줌) — 이 화면이 "타 업체 온보딩"의 유일한 입구다.
//
// handle_new_user() 트리거는 이제 하드코딩된 오성테크 대신
// user_metadata의 new_tenant_name/new_tenant_slug를 보고 새 테넌트를
// 만든다(마이그레이션 121 참고) — 여기서 그 값을 반드시 채워 보내야
// 계정 생성이 성공한다.
export async function createCompanyTenant(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 회사를 추가할 수 있습니다." };

  const companyName = String(formData.get("companyName") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const username = String(formData.get("username") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!companyName || !slug || !username || !fullName || !password) {
    return { error: "회사명, 슬러그, 관리자 아이디/이름/비밀번호를 모두 입력해주세요." };
  }
  if (!/^[a-z0-9-]{2,32}$/.test(slug)) {
    return { error: "슬러그는 영문 소문자/숫자/하이픈(2~32자)만 사용할 수 있습니다." };
  }
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
    return { error: "관리자 아이디는 영문/숫자/일부 기호(2~32자)만 사용할 수 있습니다." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  // 슬러그 중복은 tenants.slug의 unique 제약이 최종적으로 막아주지만,
  // 계정부터 만들고 나서 트리거 안에서 뒤늦게 막히면 auth 계정만 만들어진
  // 반쪽짜리 상태가 되므로 먼저 직접 확인해 더 이해하기 쉬운 에러로
  // 끝낸다.
  const { data: existingTenant } = await admin.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (existingTenant) {
    return { error: "이미 사용 중인 슬러그입니다. 다른 값을 입력해주세요." };
  }

  // profiles.username은 테넌트 구분 없이 전역으로 유니크하다(회사마다
  // "admin"을 그대로 쓰고 싶어하는 경우가 흔해서 충돌 확률이 높다) —
  // 이것도 계정 생성 트랜잭션 안에서 뒤늦게 막히면 에러 메시지가
  // 알아보기 어려운 DB 원문 그대로 나가므로 미리 확인한다.
  const { data: existingUsername } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existingUsername) {
    return { error: "이미 다른 회사에서 사용 중인 아이디입니다. 회사명을 붙이는 등 다른 아이디를 입력해주세요." };
  }

  const email = `${username}@${slug}.elvonix.local`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      username,
      new_tenant_name: companyName,
      new_tenant_slug: slug,
    },
  });

  if (error || !created.user) {
    const isDuplicate = error?.message?.toLowerCase().includes("already");
    return { error: isDuplicate ? "이미 존재하는 아이디입니다." : (error?.message ?? "계정 생성에 실패했습니다.") };
  }

  // handle_new_user() 트리거가 테넌트 생성 + tenant_members 편입까지
  // 끝내지만, 새 회사의 첫 계정은 그 회사 관리자여야 하므로 role은
  // 여기서 별도로 admin으로 올려준다(기존 createUserAccount와 동일한
  // 패턴 — 실패하면 반쪽짜리 계정을 남기지 않고 되돌린다).
  const { error: roleError } = await admin.from("profiles").update({ role: "admin" }).eq("id", created.user.id);
  if (roleError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `관리자 권한 지정에 실패해 계정 생성을 취소했습니다: ${roleError.message}` };
  }

  revalidatePath("/platform-admin");
  return { success: `"${companyName}" 테넌트와 관리자 계정을 만들었습니다.` };
}
