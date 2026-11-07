"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import type { FormState } from "@/components/form-message";

// 실제 안전장치(샌드박스 테넌트인지/관리자인지)는 sandbox_reset() RPC
// 안에서 전부 확인한다(migration 212) — 여기서는 그대로 호출만 한다.
export async function resetSandbox(_prevState: FormState, _formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("sandbox_reset");
  if (error) return { error: `초기화에 실패했습니다: ${error.message}` };

  revalidatePath("/", "layout");
  return { success: "초기화했습니다." };
}

// 더미 사원 6명 — profiles.id가 auth.users를 참조해야 해서 SQL 함수
// (sandbox_seed) 혼자서는 못 만든다(settings/users/actions.ts의
// createUserAccount와 같은 이유로 service_role 클라이언트 필요). 반복
// 클릭 시 끝없이 쌓이지 않도록, 본인 말고 다른 직원이 이미 있으면
// 새로 안 만들고 건너뛴다. 부서는 sandbox_seed()(migration 217)가 만드는
// 4개(영업부/구매부/경영지원부/생산부)와 이름을 맞춘다.
const SANDBOX_EMPLOYEES = [
  { username: "sandbox.sales1", fullName: "김민준", role: "manager" as const, dept: "영업부", title: "영업팀장" },
  { username: "sandbox.sales2", fullName: "이서연", role: "staff" as const, dept: "영업부", title: "영업사원" },
  { username: "sandbox.purchase1", fullName: "박지훈", role: "staff" as const, dept: "구매부", title: "구매담당" },
  { username: "sandbox.purchase2", fullName: "정수아", role: "staff" as const, dept: "구매부", title: "구매사원" },
  { username: "sandbox.admin1", fullName: "최유진", role: "staff" as const, dept: "경영지원부", title: "총무" },
  { username: "sandbox.production1", fullName: "강도윤", role: "staff" as const, dept: "생산부", title: "생산담당" },
];

async function seedSandboxEmployees(): Promise<string | null> {
  const { supabase, isAdmin, selfId } = await requireAdmin();
  if (!isAdmin || !selfId) return null;

  const { data: others } = await supabase.from("profiles").select("id").neq("id", selfId).limit(1);
  if (others && others.length > 0) return null; // 이미 다른 직원이 있으면 건너뜀

  const { data: myTenant } = await supabase.from("tenants").select("id, slug").maybeSingle();
  const { data: departments } = await supabase.from("departments").select("id, name").limit(500);
  if (!myTenant || !departments) return "사원 계정 생성을 건너뛰었습니다(테넌트/부서 조회 실패).";

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return `사원 계정 생성을 건너뛰었습니다: ${e instanceof Error ? e.message : "관리자 클라이언트 초기화 실패"}`;
  }

  const createdIds: string[] = [];
  for (const emp of SANDBOX_EMPLOYEES) {
    const deptId = departments.find((d) => d.name === emp.dept)?.id ?? null;
    const email = `${emp.username}@${myTenant.slug}.elvonix.local`;
    const password = `Sandbox-${Math.random().toString(36).slice(2, 10)}!`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: emp.fullName, username: emp.username, tenant_id: myTenant.id },
    });
    if (error || !created.user) continue; // 이미 존재(재시도) 등은 조용히 건너뜀

    const { error: profileError } = await admin
      .from("profiles")
      .update({ role: emp.role, department_id: deptId, position_title: emp.title })
      .eq("id", created.user.id);
    if (profileError) continue; // 역할/부서 지정이 실패해도 계정 자체는 남아 기본값(staff)으로 로그인 가능하다 — 메신저 발신자 목록에서만 뺀다
    createdIds.push(created.user.id);
  }

  if (createdIds.length === 0) return null;

  // 사내메신저 "전체" 채널에 이 사원들 이름으로 메시지를 몇 개 더
  // 추가해 혼자 떠드는 게 아니라 여러 명이 대화하는 것처럼 보이게
  // 한다 — sandbox_seed()가 이미 만들어 둔 같은 채널에, service_role로
  // RLS(sender_id = auth.uid())를 우회해서 다른 발신자로 넣는다.
  const { data: channel } = await admin
    .from("messenger_channels")
    .select("id")
    .eq("type", "all")
    .eq("tenant_id", myTenant.id)
    .eq("is_demo", false)
    .maybeSingle();
  if (channel) {
    const extraLines = [
      "입고 확인했습니다, 감사합니다!",
      "구매 견적요청 올려둔 건 검토 부탁드려요.",
      "네 확인하고 바로 답변드릴게요.",
      "생산 쪽 자재 수급 일정 공유드립니다.",
      "오늘 수금 건 입금 확인했습니다.",
      "다음 주 재고실사 참석 가능합니다!",
    ];
    const { error: messageError } = await admin.from("messenger_messages").insert(
      extraLines.map((content, i) => ({
        sender_id: createdIds[i % createdIds.length],
        content,
        channel_id: channel.id,
      })),
    );
    void messageError; // 더미 대화 추가일 뿐이라 실패해도 사원 계정 생성 자체는 이미 끝난 뒤다
  }

  return null;
}

export async function seedSandbox(_prevState: FormState, _formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("sandbox_seed");
  if (error) return { error: `더미 데이터 생성에 실패했습니다: ${error.message}` };

  const employeeNote = await seedSandboxEmployees();

  revalidatePath("/", "layout");
  return { success: employeeNote ? `더미 데이터를 생성했습니다. ${employeeNote}` : "더미 데이터를 생성했습니다." };
}
