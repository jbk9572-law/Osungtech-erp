"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { ROLE_LABELS } from "@/lib/user-roles";
import type { FormState } from "@/components/form-message";

type Role = "admin" | "manager" | "staff";
function isRole(value: string): value is Role {
  return value in ROLE_LABELS;
}

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

  // profiles.username은 이제 전역이 아니라 (테넌트, 아이디) 조합으로만
  // 유니크하다(migration 134) — 로그인도 회사코드(슬러그)를 같이 받으므로,
  // 새로 만드는 테넌트라면 다른 회사가 이미 "admin"을 쓰고 있어도 전혀
  // 문제되지 않는다. 방금 위에서 확인한 슬러그 중복만 막으면 충분하다.
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

// 고객사 소속 데모(테스트) 계정 생성. 테넌트 관리자 화면(settings/users)에는
// 이 기능이 없다 — 어떤 계정이 실제 거래 데이터 대신 가짜 데이터만 보이는
// 계정인지는 그 회사 스스로가 아니라 플랫폼(엘보닉스) 운영자가 판단/발급할
// 일이라는 지적으로, 여기 플랫폼 관리 전용 경로로만 만들 수 있게 옮겼다.
export async function createTenantDemoAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 데모 계정을 만들 수 있습니다." };

  const tenantId = String(formData.get("tenantId") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "staff");

  if (!tenantId || !username || !password || !fullName) {
    return { error: "아이디, 이름, 비밀번호를 모두 입력해주세요." };
  }
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
    return { error: "아이디는 영문/숫자/일부 기호(2~32자)만 사용할 수 있습니다." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }
  if (!isRole(role)) {
    return { error: "역할 값이 올바르지 않습니다." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const { data: tenant, error: tenantError } = await admin.from("tenants").select("slug").eq("id", tenantId).maybeSingle();
  if (tenantError || !tenant) {
    return { error: "고객사를 확인하지 못해 계정을 만들 수 없습니다." };
  }

  const email = `${username}@${tenant.slug}.elvonix.local`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, username, tenant_id: tenantId },
  });

  if (error || !created.user) {
    const isDuplicate = error?.message?.toLowerCase().includes("already");
    return { error: isDuplicate ? "이미 존재하는 아이디입니다." : (error?.message ?? "계정 생성에 실패했습니다.") };
  }

  // createUserAccount와 달리 여기서는 is_demo를 명시적으로 true로 저장한다 —
  // 이 계정으로 로그인하면 실제 거래처/매출/재고 등은 전혀 안 보이고, 이
  // 계정이 직접 입력한 가짜 데이터만 보고 등록/수정할 수 있다.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role, is_demo: true })
    .eq("id", created.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `데모 계정 설정에 실패해 계정 생성을 취소했습니다: ${profileError.message}` };
  }

  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/${tenantId}`);
  return { success: "데모 계정을 만들었습니다." };
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

// 이 회사가 실제로 구독 중인 요금제 상품(platform_plans.plan_key) 연결 —
// 위 updateTenantPlan(trial/active/suspended)은 "지금 서비스를 정상
// 이용 중인지" 상태값일 뿐, "어떤 요금제 상품을 쓰는지"와는 별개
// 축이었다(migration 129 설계 그대로). 그래서 tenants ↔ platform_plans가
// 전혀 연결돼 있지 않아, 테넌트 자신의 구독/결제 화면(settings/billing)이
// 요금제 카탈로그를 보여줄 순 있어도 "이 중에 지금 뭘 쓰고 있는지"는
// 표시할 방법이 없었다 — 전체 감사에서 발견. plan_key 컬럼(migration 153)을
// 여기서 설정한다.
export async function updateTenantPlanKey(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 변경할 수 있습니다." };

  const tenantId = String(formData.get("tenantId") ?? "");
  const planKey = String(formData.get("planKey") ?? "") || null;
  if (!tenantId) {
    return { error: "잘못된 요청입니다." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const { error } = await admin.from("tenants").update({ plan_key: planKey }).eq("id", tenantId);
  if (error) return { error: `변경에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/${tenantId}`);
  return { success: "요금제 상품을 저장했습니다." };
}

// "요금제 설명에 DB 50MB라고 적어놔도 실제로 그 숫자를 넣을 데가 없다"는
// 지적 — platform_plans에 구조화된 기본값(included_*, migration 191)을
// 추가했지만, 그 숫자가 tenants의 실제 쿼터 컬럼에 자동으로 동기화되진
// 않는다(플랜만 바꿔도 매번 조용히 덮어쓰면, 운영자가 개별 고객사에
// 수동으로 얹어준 여유 용량이 의도치 않게 날아간다 — migration 186의
// "수동 override 가능해야 함" 전제와 충돌). 그래서 자동 적용 대신, 지금
// 배정된 요금제의 기본값을 "지금 이 순간" 명시적으로 복사해 넣는 버튼
// 하나로 둔다 — 누른 뒤에도 평소처럼 TenantQuotaPanel/TenantAddonPanel에서
// 또 수동 조정할 수 있다.
export async function applyPlanDefaultsToTenant(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 적용할 수 있습니다." };

  const tenantId = String(formData.get("tenantId") ?? "");
  if (!tenantId) return { error: "잘못된 요청입니다." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("plan_key")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError) return { error: `조회에 실패했습니다: ${tenantError.message}` };
  if (!tenant?.plan_key) return { error: "이 고객사에 배정된 요금제 상품이 없습니다. 먼저 요금제 상품을 선택해주세요." };

  const { data: plan, error: planError } = await admin
    .from("platform_plans")
    .select(
      "included_db_mb, included_file_gb, included_vendor_limit, included_email_quota, included_fax_quota, included_invoice_quota, included_alimtalk_quota",
    )
    .eq("plan_key", tenant.plan_key)
    .maybeSingle();
  if (planError) return { error: `요금제 조회에 실패했습니다: ${planError.message}` };
  if (!plan) return { error: "배정된 요금제를 찾을 수 없습니다." };

  // 값이 지정 안 된(null) 항목은 손대지 않는다 — "이 요금제는 이
  // 항목에 대해 기본값을 정해두지 않았다"는 뜻이라, 비워서 덮어쓰면
  // 오히려 기존에 운영자가 넣어둔 값을 지우게 된다.
  const update: {
    db_quota_bytes?: number;
    file_quota_bytes?: number;
    vendor_limit?: number;
    monthly_email_quota?: number;
    monthly_fax_quota?: number;
    monthly_tax_invoice_quota?: number;
    monthly_alimtalk_quota?: number;
  } = {};
  if (plan.included_db_mb != null) update.db_quota_bytes = Math.round(plan.included_db_mb * 1024 * 1024);
  if (plan.included_file_gb != null) update.file_quota_bytes = Math.round(plan.included_file_gb * 1024 * 1024 * 1024);
  if (plan.included_vendor_limit != null) update.vendor_limit = plan.included_vendor_limit;
  if (plan.included_email_quota != null) update.monthly_email_quota = plan.included_email_quota;
  if (plan.included_fax_quota != null) update.monthly_fax_quota = plan.included_fax_quota;
  if (plan.included_invoice_quota != null) update.monthly_tax_invoice_quota = plan.included_invoice_quota;
  if (plan.included_alimtalk_quota != null) update.monthly_alimtalk_quota = plan.included_alimtalk_quota;

  if (Object.keys(update).length === 0) {
    return { error: "이 요금제에는 적용할 기본값이 설정돼 있지 않습니다(요금제 관리에서 먼저 숫자를 입력해주세요)." };
  }

  const { error } = await admin.from("tenants").update(update).eq("id", tenantId);
  if (error) return { error: `적용에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/${tenantId}`);
  return { success: "요금제 기본값을 적용했습니다." };
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

// DB/파일 저장소 쿼터 수동 조정. 지금은 "애드온 패키지를 결제로 산다"는
// 자동화가 없으므로(TODO_BILLING_AUTOMATION, settings/billing/page.tsx
// 참고) 특정 고객이 용량을 늘려달라고 운영자 문의를 넣으면 플랫폼
// 운영자가 여기서 직접 숫자를 올려준다. 입력은 MB 단위로 받고(운영자가
// 바이트 단위로 계산하게 하지 않기 위해) 저장은 바이트로 변환한다.
export async function updateTenantQuota(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 변경할 수 있습니다." };

  const tenantId = String(formData.get("tenantId") ?? "");
  const dbQuotaMb = Number(formData.get("dbQuotaMb") ?? 0);
  const fileQuotaMb = Number(formData.get("fileQuotaMb") ?? 0);

  if (!tenantId || !Number.isFinite(dbQuotaMb) || dbQuotaMb <= 0 || !Number.isFinite(fileQuotaMb) || fileQuotaMb <= 0) {
    return { error: "DB/파일 저장소 용량은 0보다 큰 숫자(MB)로 입력해주세요." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const { error } = await admin
    .from("tenants")
    .update({
      db_quota_bytes: Math.round(dbQuotaMb * 1024 * 1024),
      file_quota_bytes: Math.round(fileQuotaMb * 1024 * 1024),
    })
    .eq("id", tenantId);
  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/${tenantId}`);
  return { success: "저장 공간 쿼터를 저장했습니다." };
}

// 외주처(협력사) 연동 수/월간 이메일 발송 건수/자사 도메인 메일 애드온 —
// 기획서(2026-10-27)의 "확장 애드온" 항목 중 지금 당장 실제로 쓰이는
// 지점이 있는 것만 다룬다. DB 용량/파일 저장소 쿼터(위 updateTenantQuota)와
// 같은 이유로 platform_plans(카탈로그)가 아니라 tenants(실제 계약)에 직접
// 둔다 — 아직 결제 연동 전 수동 관리 단계라(기획서 1번 항목) "구매한
// 애드온 내역" 테이블로 따로 쪼개지 않고 컬럼 하나로 최종 숫자를 그대로
// 저장한다(migration 186의 같은 결정과 같은 이유 — PG 결제가 실제로
// 붙는 시점에 가서야 "애드온 구매 내역" 테이블이 필요해진다).
export async function updateTenantAddons(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 변경할 수 있습니다." };

  const tenantId = String(formData.get("tenantId") ?? "");
  const vendorLimit = Number(formData.get("vendorLimit") ?? 0);
  const monthlyEmailQuota = Number(formData.get("monthlyEmailQuota") ?? 0);
  const monthlyFaxQuota = Number(formData.get("monthlyFaxQuota") ?? 0);
  const monthlyInvoiceQuota = Number(formData.get("monthlyInvoiceQuota") ?? 0);
  const monthlyAlimtalkQuota = Number(formData.get("monthlyAlimtalkQuota") ?? 0);
  const customDomainMail = formData.get("customDomainMail") === "1";

  const quotaFields = [vendorLimit, monthlyEmailQuota, monthlyFaxQuota, monthlyInvoiceQuota, monthlyAlimtalkQuota];
  if (!tenantId || quotaFields.some((n) => !Number.isInteger(n) || n < 0)) {
    return { error: "외주처 수/이메일·팩스·계산서·알림톡 발송 건수는 0 이상의 정수로 입력해주세요." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const { error } = await admin
    .from("tenants")
    .update({
      vendor_limit: vendorLimit,
      monthly_email_quota: monthlyEmailQuota,
      monthly_fax_quota: monthlyFaxQuota,
      monthly_tax_invoice_quota: monthlyInvoiceQuota,
      monthly_alimtalk_quota: monthlyAlimtalkQuota,
      custom_domain_mail: customDomainMail,
    })
    .eq("id", tenantId);
  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/${tenantId}`);
  return { success: "애드온 설정을 저장했습니다." };
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

  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/${tenantId}`);
  return { success: `포인트를 ${delta > 0 ? `${delta}점 지급` : `${Math.abs(delta)}점 차감`}했습니다.` };
}
