import type { Db, DummyEmployee } from "./types";
import { DEPARTMENTS, POSITIONS, randomFullName } from "./korean-data";
import { fetchAllRows } from "../fetch-all-rows";

// 더미 직원은 전부 이 접두어가 붙은 아이디(username)로 만든다 — "이미
// 몇 명 있는지" 셀 때, 그리고 나중에 관리자가 정리하고 싶을 때 실제
// 직원과 구분하는 유일한 표식이다. DB에 별도 컬럼을 새로 추가하지
// 않기 위해(스키마 변경은 사용자가 직접 마이그레이션을 적용해야 함)
// 일부러 아이디 규칙만으로 식별한다.
const DUMMY_USERNAME_PREFIX = "dummy";
// 실제 서비스 계정과 절대 헷갈리지 않을, 이 스크립트 전용 고정 비밀번호.
// 이 비밀번호를 아는 쪽만 더미 직원으로 로그인해 게시글을 만들 수 있다.
export const DUMMY_EMPLOYEE_PASSWORD = "DevSeed!2026Elvonix";

function usernameFor(n: number): string {
  return `${DUMMY_USERNAME_PREFIX}${String(n).padStart(2, "0")}`;
}

// departments 테이블에 DEPARTMENTS 풀에 있는 부서가 없으면 만들어
// 채운다 — 더미 직원을 부서 없이 만들면 조직도/기안 결재선 관련 화면이
// 휑하게 보인다.
export async function ensureDepartments(admin: Db): Promise<{ id: string; name: string }[]> {
  const existing = await fetchAllRows<{ id: string; name: string }>((from, to) =>
    admin.from("departments").select("id, name").range(from, to),
  );
  const existingNames = new Set(existing.map((d) => d.name));
  const missing = DEPARTMENTS.filter((name) => !existingNames.has(name));

  if (missing.length > 0) {
    const { error: insertError } = await admin.from("departments").insert(missing.map((name) => ({ name })));
    if (insertError) throw new Error(`부서 생성 실패: ${insertError.message}`);
  }

  return fetchAllRows<{ id: string; name: string }>((from, to) =>
    admin.from("departments").select("id, name").range(from, to),
  );
}

// 더미 직원을 targetCount명까지 채운다(이미 있으면 top-up만, 매번 새로
// 30명씩 더 만들지 않는다) — auth.admin.createUser + handle_new_user
// 트리거로 profiles/tenant_members가 함께 생기는, settings/users
// 화면의 계정 생성과 완전히 같은 경로를 그대로 쓴다.
export async function ensureDummyEmployees(
  admin: Db,
  tenantId: string,
  tenantSlug: string,
  targetCount: number,
): Promise<DummyEmployee[]> {
  const departments = await ensureDepartments(admin);

  const { data: existingProfiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, username, full_name, department_id, email")
    .like("username", `${DUMMY_USERNAME_PREFIX}%`)
    .eq("tenant_id", tenantId);
  if (profilesError) throw new Error(`기존 더미 직원 조회 실패: ${profilesError.message}`);

  const existing: DummyEmployee[] = (existingProfiles ?? [])
    .filter((p) => p.username && /^dummy\d+$/.test(p.username))
    .map((p) => ({
      id: p.id,
      email: p.email ?? `${p.username}@${tenantSlug}.elvonix.local`,
      password: DUMMY_EMPLOYEE_PASSWORD,
      fullName: p.full_name ?? "더미 직원",
      username: p.username as string,
      departmentId: p.department_id,
    }));

  const existingNumbers = new Set(existing.map((e) => Number(e.username.replace(DUMMY_USERNAME_PREFIX, ""))));
  const toCreate: number[] = [];
  for (let n = 1; existing.length + toCreate.length < targetCount && n <= targetCount * 2; n++) {
    if (!existingNumbers.has(n)) toCreate.push(n);
  }

  const created: DummyEmployee[] = [];
  for (const n of toCreate) {
    const username = usernameFor(n);
    const email = `${username}@${tenantSlug}.elvonix.local`;
    const fullName = randomFullName();
    const department = departments.length > 0 ? departments[n % departments.length] : null;

    const { data: authUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password: DUMMY_EMPLOYEE_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName, username, tenant_id: tenantId },
    });
    if (createError || !authUser.user) {
      // 이미 존재하는 이메일이면 건너뛰고 다음 번호로 — 그 외 오류는
      // 이 직원 하나만 실패로 남기고 나머지는 계속 진행한다.
      continue;
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        department_id: department?.id ?? null,
        position_title: POSITIONS[Math.floor(Math.random() * POSITIONS.length)],
        hire_date: randomPastDate(365 * 3),
        role: "staff",
      })
      .eq("id", authUser.user.id);
    if (profileError) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      continue;
    }

    created.push({
      id: authUser.user.id,
      email,
      password: DUMMY_EMPLOYEE_PASSWORD,
      fullName,
      username,
      departmentId: department?.id ?? null,
    });
  }

  return [...existing, ...created];
}

function randomPastDate(maxDaysAgo: number): string {
  const daysAgo = Math.floor(Math.random() * maxDaysAgo);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
