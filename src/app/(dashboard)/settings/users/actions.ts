"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import { cell, readExcelRows, summarize, type ImportRowError } from "@/lib/excel-import";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { ROLE_LABELS } from "@/lib/user-roles";
import type { FormState } from "@/components/form-message";

const ROLES = ["admin", "manager", "staff"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

// 관리자 전용 계정 생성. 이메일 대신 아이디만 입력받고, 실제 Supabase Auth용
// 이메일은 "아이디@<내 테넌트 슬러그>.elvonix.local"로 자동 생성한다(로그인
// 화면에서 아이디를 입력하면 이 이메일로 변환되어 로그인된다) — 예전엔
// "@osungtech.local"로 고정돼 있었는데, 타 업체(테넌트 #2)가 생기면서
// 회사마다 다른 슬러그를 써야 다른 회사의 같은 아이디와 이메일이
// 충돌하지 않는다. service_role 키가 필요해서 서버 환경변수
// (SUPABASE_SERVICE_ROLE_KEY)가 없으면 실패한다.
export async function createUserAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 계정을 생성할 수 있습니다." };

  // tenants_select_own RLS가 이미 "내 테넌트 한 행"으로만 걸러주므로
  // 별도 id 조건이 필요 없다.
  const { data: myTenant, error: tenantError } = await supabase.from("tenants").select("id, slug").maybeSingle();
  if (tenantError || !myTenant) {
    return { error: "소속 테넌트를 확인하지 못해 계정을 만들 수 없습니다." };
  }

  const username = String(formData.get("username") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "staff");

  if (!username || !password || !fullName) {
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

  const email = `${username}@${myTenant.slug}.elvonix.local`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, username, tenant_id: myTenant.id },
  });

  if (error || !created.user) {
    const isDuplicate = error?.message?.toLowerCase().includes("already");
    return { error: isDuplicate ? "이미 존재하는 아이디입니다." : (error?.message ?? "계정 생성에 실패했습니다.") };
  }

  // 데모(테스트) 계정 지정은 이 화면(테넌트 관리자)에는 없다 — 고객사
  // 자신이 아니라 플랫폼 운영자만 판단할 일이라, 플랫폼 관리 > 고객사
  // 상세 화면의 별도 계정 생성 경로(createTenantDemoAccount)로만 만들 수
  // 있다. is_demo는 컬럼 기본값(is_demo_actor())에 맡기면 되는데,
  // service_role 클라이언트로 만드는 이 경로에서는 auth.uid()가 없어
  // (서비스 계정이라 세션이 없음) 항상 false로 채워진다 — 이 화면에서
  // 만든 계정이 실수로 데모로 표시될 일이 없다는 뜻이다.
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", created.user.id);
  if (roleError) {
    // auth 계정은 이미 만들어졌는데 역할 지정이 실패하면, 기본 역할(staff)
    // 그대로 로그인 가능한 반쪽짜리 계정이 조용히 남는다 — 관리자에게는
    // "실패했다"고만 보이므로, 실패를 알리는 것에 그치지 않고 방금 만든
    // auth 계정 자체를 지워서 되돌린다.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `역할 지정에 실패해 계정 생성을 취소했습니다: ${roleError.message}` };
  }

  revalidatePath("/settings/users");
  return { success: "계정을 생성했습니다." };
}

// 초대링크 없이 엑셀 한 장으로 여러 직원을 한 번에 등록한다(초대링크
// 자가가입 방식은 이번 범위에서 제외 — 사용자 요청). Supabase Auth는
// 사용자 생성을 한 번에 여러 명 만드는 API가 없어서 행마다 순차로
// admin.auth.admin.createUser()를 호출한다 — 직원 수 규모(수십~수백
// 명)에서는 병렬화보다 실패한 행만 정확히 골라내는 게 더 중요하다.
// 아이디가 이미 있으면 새 계정을 또 만들지 않고 부서/직급/입사일/역할만
// 갱신한다 — "이미 등록된 직원까지 섞인 전체 인사대장"을 그대로
// 다시 올려도 안전하게 하기 위함(customers/products 엑셀 가져오기와
// 같은 원칙).
function generateTempPassword(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export async function importEmployeesExcel(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 일괄 등록할 수 있습니다." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "엑셀 파일을 선택해주세요." };
  }

  let rows: Awaited<ReturnType<typeof readExcelRows>>;
  try {
    rows = await readExcelRows(file);
  } catch {
    return { error: "엑셀 파일을 읽을 수 없습니다. .xlsx 파일인지 확인해주세요." };
  }
  if (rows.length === 0) {
    return { error: "엑셀에 데이터 행이 없습니다." };
  }

  const { data: myTenant, error: tenantError } = await supabase.from("tenants").select("id, slug").maybeSingle();
  if (tenantError || !myTenant) {
    return { error: "소속 테넌트를 확인하지 못해 일괄 등록할 수 없습니다." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const [departments, existingProfiles] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("departments").select("id, name").range(from, to),
    ),
    fetchAllRows<{ id: string; username: string | null }>((from, to) =>
      supabase.from("profiles").select("id, username").range(from, to),
    ),
  ]);
  const departmentIdByName = new Map(departments.map((d) => [d.name.trim(), d.id]));
  const profileIdByUsername = new Map(
    existingProfiles.filter((p) => p.username).map((p) => [p.username as string, p.id]),
  );
  const roleKeyByLabel = new Map(Object.entries(ROLE_LABELS).map(([key, label]) => [label, key]));

  const errors: ImportRowError[] = [];
  const createdCredentials: { username: string; password: string }[] = [];
  let updatedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    const username = cell(row, "아이디");
    const fullName = cell(row, "이름");
    if (!username || !fullName) {
      errors.push({ row: rowNum, reason: "아이디와 이름은 필수입니다." });
      continue;
    }
    if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
      errors.push({ row: rowNum, reason: "아이디는 영문/숫자/일부 기호(2~32자)만 가능합니다." });
      continue;
    }

    const departmentName = cell(row, "부서");
    const departmentId = departmentName ? (departmentIdByName.get(departmentName) ?? null) : null;
    if (departmentName && !departmentId) {
      errors.push({ row: rowNum, reason: `"${departmentName}" 부서를 찾을 수 없습니다(조직도에 먼저 등록해주세요).` });
      continue;
    }

    const positionTitle = cell(row, "직급") || null;
    const hireDateRaw = cell(row, "입사일");
    if (hireDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(hireDateRaw)) {
      errors.push({ row: rowNum, reason: "입사일 형식이 올바르지 않습니다(YYYY-MM-DD)." });
      continue;
    }
    const roleLabel = cell(row, "역할");
    const roleFromLabel = roleLabel ? roleKeyByLabel.get(roleLabel) : undefined;
    const role: Role = roleFromLabel && isRole(roleFromLabel) ? roleFromLabel : "staff";

    const profileUpdate = {
      full_name: fullName,
      department_id: departmentId,
      position_title: positionTitle,
      hire_date: hireDateRaw || null,
      role,
    };

    const existingId = profileIdByUsername.get(username);
    if (existingId) {
      const { error } = await admin.from("profiles").update(profileUpdate).eq("id", existingId);
      if (error) {
        errors.push({ row: rowNum, reason: `갱신 실패: ${error.message}` });
        continue;
      }
      updatedCount++;
      continue;
    }

    const password = generateTempPassword();
    const email = `${username}@${myTenant.slug}.elvonix.local`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, username, tenant_id: myTenant.id },
    });
    if (createError || !created.user) {
      const isDuplicate = createError?.message?.toLowerCase().includes("already");
      errors.push({ row: rowNum, reason: isDuplicate ? "이미 존재하는 아이디입니다." : (createError?.message ?? "계정 생성 실패") });
      continue;
    }

    const { error: profileError } = await admin.from("profiles").update(profileUpdate).eq("id", created.user.id);
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      errors.push({ row: rowNum, reason: `정보 저장 실패로 계정 생성을 취소했습니다: ${profileError.message}` });
      continue;
    }

    createdCredentials.push({ username, password });
  }

  revalidatePath("/settings/users");

  const okCount = createdCredentials.length + updatedCount;
  const base = summarize(rows.length, okCount, errors);
  if ("error" in base) return base;

  if (createdCredentials.length === 0) {
    return { success: `${base.success} (신규 생성 없음, 기존 ${updatedCount}건 정보만 갱신)` };
  }
  const shown = createdCredentials
    .slice(0, 20)
    .map((c) => `${c.username}:${c.password}`)
    .join(", ");
  const more = createdCredentials.length > 20 ? ` 외 ${createdCredentials.length - 20}건` : "";
  return {
    success: `${base.success} 새로 만든 계정(아이디:임시비밀번호) — 지금 복사해 전달하세요(다시 볼 수 없습니다): ${shown}${more}`,
  };
}

// 이미 만들어진 계정의 역할(권한)을 변경한다. service_role 없이도 RLS 정책
// (profiles_update_by_admin)으로 관리자 본인 세션에서 바로 처리된다.
export async function updateUserRole(formData: FormData): Promise<{ error: string } | undefined> {
  const { supabase, isAdmin, selfId } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 변경할 수 있습니다." };

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || userId === selfId || !isRole(role)) {
    return { error: "잘못된 요청입니다." };
  }

  const result = await supabase.from("profiles").update({ role }).eq("id", userId).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "역할 변경에 실패했습니다",
    onForbidden: "해당 계정을 찾을 수 없거나 변경 권한이 없습니다.",
  });
  if (mutationError) return mutationError;
  revalidatePath("/settings/users");
}

// 계정 상세(수정) 화면에서 이름/아이디/역할/비밀번호를 한 번에 바꾼다. 이름과
// 역할은 profiles 테이블만 건드리면 되지만(RLS로 처리), 아이디를 바꾸면
// 로그인에 쓰는 이메일("아이디@osungtech.local")도 같이 바뀌어야 하고
// 비밀번호 재설정도 auth.users를 직접 건드려야 해서 이 두 경우에만
// service_role 클라이언트가 필요하다.
export async function updateUserAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isAdmin, selfId } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 계정을 수정할 수 있습니다." };

  const userId = String(formData.get("userId") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");
  const submittedRole = String(formData.get("role") ?? "staff");

  if (!userId || !username || !fullName) {
    return { error: "아이디와 이름은 비워둘 수 없습니다." };
  }
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
    return { error: "아이디는 영문/숫자/일부 기호(2~32자)만 사용할 수 있습니다." };
  }
  if (newPassword && newPassword.length < 6) {
    return { error: "새 비밀번호는 6자 이상이어야 합니다." };
  }
  if (!isRole(submittedRole)) {
    return { error: "역할 값이 올바르지 않습니다." };
  }

  // userId가 정말 내 테넌트 소속인지 확인한다 — 아래에서 service_role
  // 클라이언트(RLS 우회)로 auth.users를 직접 수정하므로, 이 확인이 없으면
  // 폼 값 조작만으로 다른 회사 계정의 로그인 정보를 바꿀 수 있게 된다
  // (platform-admin/actions.ts의 resetTenantUserPassword와 동일한 확인).
  // profiles_tenant_isolation RLS 덕분에, 일반(RLS 적용) 클라이언트로
  // 조회해서 안 보이면 타 테넌트 소속(또는 존재하지 않음)이다.
  const { data: targetProfile } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!targetProfile) {
    return { error: "해당 계정을 찾을 수 없습니다." };
  }
  let role: Role = submittedRole;
  // updateUserRole과 동일한 규칙: 본인 계정의 역할은 바꿀 수 없다. 화면은
  // 숨김 input으로 현재 역할을 그대로 되돌려 보내지만, 그건 클라이언트
  // 값이라 변조될 수 있으므로 서버에서도 강제한다 — 폼 값을 무시하고 DB에
  // 이미 저장된 역할을 그대로 유지한다.
  if (userId === selfId) {
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (currentProfile && isRole(currentProfile.role)) {
      role = currentProfile.role;
    }
  }

  // createUserAccount와 동일하게 내 테넌트 슬러그로 이메일 도메인을
  // 만들어야 한다 — 예전엔 "@osungtech.local"로 고정돼 있어서, 타 업체
  // 계정의 아이디를 수정하면 엉뚱한(오성테크) 도메인으로 이메일이
  // 바뀌던 버그가 있었다.
  const { data: myTenant, error: tenantError } = await supabase.from("tenants").select("slug").maybeSingle();
  if (tenantError || !myTenant) {
    return { error: "소속 테넌트를 확인하지 못해 계정을 수정할 수 없습니다." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const email = `${username}@${myTenant.slug}.elvonix.local`;
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    email,
    ...(newPassword ? { password: newPassword } : {}),
    user_metadata: { full_name: fullName, username },
  });
  if (authError) {
    const isDuplicate = authError.message?.toLowerCase().includes("already");
    return { error: isDuplicate ? "이미 존재하는 아이디입니다." : authError.message };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ username, full_name: fullName, email, role })
    .eq("id", userId);
  if (profileError) {
    // 로그인 정보(auth)는 이미 새 값으로 바뀐 뒤라 되돌릴 수 없다(특히
    // 비밀번호는 해시만 남아 이전 값 자체를 모른다) — 목록 화면에는 예전
    // 정보가 그대로 보여서 "아무 일도 안 일어난 것"처럼 보이면 안 되므로,
    // 로그인 정보는 이미 바뀌었다는 사실을 명확히 알린다. 같은 값으로 다시
    // 저장을 시도하면 profiles만 갱신되어 정상화된다.
    return {
      error: `로그인 정보는 이미 변경됐지만 화면에 표시되는 계정 정보 저장에 실패했습니다: ${profileError.message} — 같은 값으로 다시 저장해주세요.`,
    };
  }

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { success: "계정 정보를 저장했습니다." };
}

// 계정 삭제. auth.users에서 지우면 profiles 행도 on delete cascade로 같이
// 지워진다. 본인 계정은 실수로 스스로를 잠그는 걸 막기 위해 삭제할 수 없다.
export async function deleteUserAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isAdmin, selfId } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 계정을 삭제할 수 있습니다." };

  const userId = String(formData.get("id") ?? "");
  if (!userId) return { error: "잘못된 요청입니다." };
  if (userId === selfId) return { error: "본인 계정은 삭제할 수 없습니다." };

  // updateUserAccount와 동일한 이유로 확인한다 — 아래 service_role
  // 클라이언트는 RLS를 우회하므로, 폼 값 조작만으로 다른 회사 계정을
  // 지울 수 있게 되는 걸 막는다.
  const { data: targetProfile } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!targetProfile) {
    return { error: "해당 계정을 찾을 수 없습니다." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/settings/users");
  return { success: "계정을 삭제했습니다." };
}
