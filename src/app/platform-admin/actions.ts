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

// 회사명/슬러그 수정. 슬러그는 로그인 이메일 도메인(아이디@슬러그.elvonix.local)에
// 그대로 쓰이므로, 바꾸면 그 회사의 모든 계정이 기존 아이디로 로그인이 안 되게
// 된다 — 화면에도 이 경고를 같이 보여준다.
export async function updateCompanyTenant(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 회사 정보를 수정할 수 있습니다." };

  const tenantId = String(formData.get("tenantId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();

  if (!tenantId || !name || !slug) {
    return { error: "회사명과 슬러그를 모두 입력해주세요." };
  }
  if (!/^[a-z0-9-]{2,32}$/.test(slug)) {
    return { error: "슬러그는 영문 소문자/숫자/하이픈(2~32자)만 사용할 수 있습니다." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const { data: existingTenant } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .neq("id", tenantId)
    .maybeSingle();
  if (existingTenant) {
    return { error: "이미 다른 회사가 사용 중인 슬러그입니다." };
  }

  const { error } = await admin.from("tenants").update({ name, slug }).eq("id", tenantId);
  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/${tenantId}`);
  return { success: "회사 정보를 저장했습니다." };
}

// 비활성화/재활성화 토글. 삭제와 달리 되돌릴 수 있어서 DeleteButton의
// 확인코드 절차 없이 바로 처리한다 — 화면에서 누른 즉시 반영된다.
export async function toggleTenantActive(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 변경할 수 있습니다." };

  const tenantId = String(formData.get("tenantId") ?? "");
  const nextDisabled = formData.get("disable") === "true";
  if (!tenantId) return { error: "잘못된 요청입니다." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const { error } = await admin
    .from("tenants")
    .update({ disabled_at: nextDisabled ? new Date().toISOString() : null })
    .eq("id", tenantId);
  if (error) return { error: `변경에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/${tenantId}`);
  return { success: nextDisabled ? "비활성화했습니다." : "다시 활성화했습니다." };
}

const PLANS = ["trial", "active", "suspended"] as const;

// 요금제 상태 변경. 실제 결제 연동은 없고, 지금은 운영자가 수동으로
// 붙이는 상태 표시일 뿐이다(백로그: 실제 결제 연동 전까지 임시).
export async function updateTenantPlan(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 변경할 수 있습니다." };

  const tenantId = String(formData.get("tenantId") ?? "");
  const plan = String(formData.get("plan") ?? "");
  if (!tenantId || !(PLANS as readonly string[]).includes(plan)) {
    return { error: "잘못된 요청입니다." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const { error } = await admin.from("tenants").update({ plan }).eq("id", tenantId);
  if (error) return { error: `변경에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/${tenantId}`);
  return { success: "요금제 상태를 저장했습니다." };
}

// 특정 회사 소속 사용자의 비밀번호를 강제로 재설정한다. 그 회사 관리자가
// 비밀번호를 잊어버려 본인 계정으로도, 같은 회사 다른 관리자 계정으로도
// 로그인할 수 없을 때 쓰는 최후 수단이라 플랫폼 운영자 권한으로만 연다.
export async function resetTenantUserPassword(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 비밀번호를 재설정할 수 있습니다." };

  const tenantId = String(formData.get("tenantId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!tenantId || !userId || newPassword.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  // userId가 정말 이 tenantId 소속인지 확인한다 — 화면에서 넘어온 값을
  // 그대로 믿고 비밀번호를 바꾸면, 폼 값 조작만으로 아무 회사 계정의
  // 비밀번호나 재설정할 수 있게 된다.
  const { data: membership } = await admin
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) {
    return { error: "해당 회사 소속 계정을 찾을 수 없습니다." };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { error: error.message };

  revalidatePath(`/platform-admin/${tenantId}`);
  return { success: "비밀번호를 재설정했습니다." };
}

// 이용기간(시작일/만료일) 설정. plan_expires_at이 지나면 로그인 자체가
// 막힌다(get_login_block_reason, login/actions.ts 참고) — "장식용
// 날짜"가 아니라 실제 이용 가능 여부를 가른다.
export async function updateTenantPlanPeriod(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 변경할 수 있습니다." };

  const tenantId = String(formData.get("tenantId") ?? "");
  const startedAt = String(formData.get("planStartedAt") ?? "").trim();
  const expiresAt = String(formData.get("planExpiresAt") ?? "").trim();
  if (!tenantId) return { error: "잘못된 요청입니다." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const { error } = await admin
    .from("tenants")
    .update({
      plan_started_at: startedAt || null,
      // 날짜 입력(date)만 받으므로 그날 자정이 아니라 하루의 끝(23:59:59)을
      // 만료 시점으로 잡는다 — "만료일 당일"에는 정상적으로 쓸 수 있어야
      // 하는데, 자정 기준으로 하면 만료일 당일 새벽부터 막혀버린다.
      plan_expires_at: expiresAt ? `${expiresAt}T23:59:59+09:00` : null,
    })
    .eq("id", tenantId);
  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/${tenantId}`);
  return { success: "이용기간을 저장했습니다." };
}

// 포인트 지급/차감. 지금은 실제로 포인트를 소모하는 곳이 없다(세금계산서/
// 계산서 발행이 전부 수기 표시라 — invoice-status-panel.tsx 참고) —
// 나중에 팝빌/바로빌 같은 실제 발행 API나 알림톡/팩스 기능을 붙일 때
// 그 호출 지점에서 이 잔액을 깎게 될 것을 미리 준비해두는 것이라, 지금은
// 플랫폼 운영자가 수동으로 지급/차감하는 이 경로만 있다.
export async function adjustTenantPoints(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 변경할 수 있습니다." };

  const tenantId = String(formData.get("tenantId") ?? "");
  const deltaRaw = String(formData.get("delta") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const delta = Number(deltaRaw);

  if (!tenantId || !Number.isInteger(delta) || delta === 0) {
    return { error: "포인트는 0이 아닌 정수로 입력해주세요(차감은 음수)." };
  }
  if (!reason) {
    return { error: "지급/차감 사유를 입력해주세요." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const { error } = await admin.rpc("adjust_tenant_points", {
    p_tenant_id: tenantId,
    p_delta: delta,
    p_action_type: "manual_admin_adjustment",
    p_reason: reason,
  });
  if (error) return { error: `처리에 실패했습니다: ${error.message}` };

  revalidatePath(`/platform-admin/${tenantId}`);
  return { success: `포인트를 ${delta > 0 ? `${delta}점 지급` : `${Math.abs(delta)}점 차감`}했습니다.` };
}
