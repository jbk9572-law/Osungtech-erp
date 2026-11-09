"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { signInAsEmployee } from "@/lib/dev-seed/client";
import { ensurePortalAccounts } from "@/lib/dev-seed/employees";
import { seedApprovals } from "@/lib/dev-seed/boards/approvals";
import { seedHrDocuments } from "@/lib/dev-seed/boards/hr-documents";
import { seedMessenger } from "@/lib/dev-seed/boards/messenger";
import { seedCustomerOrders } from "@/lib/dev-seed/boards/customer-portal-orders";
import { seedApprovalLinePresets, linkApprovalMatrixRules } from "@/lib/dev-seed/boards/approval-lines";
import { seedOfficialDocumentsWithApproval } from "@/lib/dev-seed/boards/official-documents-approval";
import type { ActingSession, DummyEmployee, PortalSession } from "@/lib/dev-seed/types";
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

// 더미 사원 12명(부서 10곳 각 1명 이상, 영업부만 2명) — profiles.id가
// auth.users를 참조해야 해서 SQL 함수(sandbox_seed) 혼자서는 못 만든다
// (settings/users/actions.ts의 createUserAccount와 같은 이유로
// service_role 클라이언트 필요). 반복 클릭 시 끝없이 쌓이지 않도록,
// 본인 말고 다른 직원이 이미 있으면 새로 안 만들고 건너뛴다. 부서는
// sandbox_seed()(migration 221)가 만드는 10개와 이름을 맞춘다.
const SANDBOX_EMPLOYEES = [
  { username: "sandbox.sales1", fullName: "김민준", role: "manager" as const, dept: "영업부", title: "영업팀장" },
  { username: "sandbox.sales2", fullName: "이서연", role: "staff" as const, dept: "영업부", title: "영업사원" },
  { username: "sandbox.purchase1", fullName: "박지훈", role: "staff" as const, dept: "구매부", title: "구매담당" },
  { username: "sandbox.purchase2", fullName: "정수아", role: "staff" as const, dept: "구매부", title: "구매사원" },
  { username: "sandbox.admin1", fullName: "최유진", role: "staff" as const, dept: "경영지원부", title: "총무" },
  { username: "sandbox.production1", fullName: "강도윤", role: "staff" as const, dept: "생산부", title: "생산담당" },
  { username: "sandbox.hr1", fullName: "윤하은", role: "staff" as const, dept: "인사부", title: "인사담당" },
  { username: "sandbox.finance1", fullName: "한지우", role: "staff" as const, dept: "재무회계부", title: "재무담당" },
  { username: "sandbox.it1", fullName: "임현우", role: "staff" as const, dept: "IT전산부", title: "전산담당" },
  { username: "sandbox.qc1", fullName: "신예은", role: "staff" as const, dept: "품질관리부", title: "품질담당" },
  { username: "sandbox.cs1", fullName: "조시우", role: "staff" as const, dept: "고객지원부", title: "고객지원담당" },
  { username: "sandbox.overseas1", fullName: "오다은", role: "staff" as const, dept: "해외영업부", title: "해외영업담당" },
];

const EXTRA_MESSENGER_LINES = [
  "입고 확인했습니다, 감사합니다!",
  "구매 견적요청 올려둔 건 검토 부탁드려요.",
  "네 확인하고 바로 답변드릴게요.",
  "생산 쪽 자재 수급 일정 공유드립니다.",
  "오늘 수금 건 입금 확인했습니다.",
  "다음 주 재고실사 참석 가능합니다!",
  "인사 쪽 신규 입사자 서류 오늘까지 부탁드립니다.",
  "전산팀입니다 — 오전에 있었던 접속 지연은 지금 해결됐습니다.",
  "품질팀에서 이번 주 외주 입고분 검수 결과 공유드려요.",
  "해외영업 쪽 신규 거래처 문의가 들어와서 공유드립니다.",
  "재무팀입니다 — 이번 달 지급결의서 마감은 금요일까지입니다.",
  "고객지원팀입니다 — 거래처 문의 응대 완료했습니다.",
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const createdEmployees: DummyEmployee[] = [];
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
    createdEmployees.push({
      id: created.user.id,
      email,
      password,
      fullName: emp.fullName,
      username: emp.username,
      departmentId: deptId,
    });
  }

  if (createdEmployees.length === 0) return null;

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
    const { error: messageError } = await admin.from("messenger_messages").insert(
      EXTRA_MESSENGER_LINES.map((content, i) => ({
        sender_id: createdEmployees[i % createdEmployees.length].id,
        content,
        channel_id: channel.id,
      })),
    );
    void messageError; // 더미 대화 추가일 뿐이라 실패해도 사원 계정 생성 자체는 이미 끝난 뒤다
  }

  // 아래부터는 "여러 사원이 실제로 각자 기안/결재/발주했다"는 흐름이
  // 필요한 영역이다 — 서비스 롤 직접 insert로는 auth.uid() 기반 RLS/
  // 결재 RPC를 통과할 수 없어, 방금 만든 사원 비밀번호(이 요청 안에서만
  // 메모리에 들고 있음 — DB에는 저장되지 않는다)로 실제 로그인한
  // 세션을 몇 개 만들어 그 세션으로 호출한다(dev-seed CLI 스크립트와
  // 완전히 같은 방식, 테넌트만 이 샌드박스로 좁힌 것).
  if (!supabaseUrl || !anonKey) {
    return "사원 계정은 만들었지만, 메신저/기안/결재선/공문 결재 더미는 건너뛰었습니다(NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수 없음).";
  }

  const actors: ActingSession[] = [];
  for (const employee of createdEmployees) {
    try {
      const client = await signInAsEmployee(supabaseUrl, anonKey, employee.email, employee.password);
      actors.push({ employee, client });
    } catch {
      // 로그인 실패한 직원은 건너뛰고 나머지로 진행한다.
    }
  }
  if (actors.length === 0) {
    return `사원 계정 ${createdEmployees.length}명을 만들었습니다. (메신저/기안/결재선 추가 더미는 로그인 세션을 하나도 만들지 못해 건너뜀)`;
  }

  const notes: string[] = [];

  // 전체 채널에 더 자연스러운 대화량을 더한다(위 고정 문구 외 추가).
  const messengerResult = await seedMessenger(actors, 30);
  if (messengerResult.error) notes.push(`메신저 추가 대화 일부 실패: ${messengerResult.error}`);

  // 전자결재 기안함.
  const approvalsResult = await seedApprovals(createdEmployees, actors, [], 8);
  if (approvalsResult.error) notes.push(`기안함 일부 실패: ${approvalsResult.error}`);

  // 결재선(공유 프리셋) 6개 + 결재매트릭스 연결.
  const linesResult = await seedApprovalLinePresets(createdEmployees, actors, 6);
  if (linesResult.error) notes.push(`결재선 일부 실패: ${linesResult.error}`);
  // approval_matrix_rules insert/update는 is_admin()만 허용 — 지금 이
  // 액션을 실행 중인 관리자 본인의 실제 로그인 세션(supabase)으로 호출한다.
  const matrixResult = await linkApprovalMatrixRules(supabase);
  if (matrixResult.error) notes.push(`결재매트릭스 연결 일부 실패: ${matrixResult.error}`);

  // 인사문서(document_instances) — migration 221이 넣어둔 인사 템플릿
  // 기준으로 재직증명서 등을 실제로 몇 건 생성해둔다.
  const hrDocsResult = await seedHrDocuments(createdEmployees, actors, 10);
  if (hrDocsResult.error) notes.push(`인사문서 일부 실패: ${hrDocsResult.error}`);

  // 공문(official_documents) — 기안→상신→결재까지 실제로 태운다(게시판
  // 공지와 달리 "결재/기안"이 실제로 동작하는 모습을 보여주는 부분).
  const { data: officialTemplates } = await supabase
    .from("document_templates")
    .select("id, name, body")
    .eq("category", "official")
    .eq("is_active", true)
    .limit(100);
  const officialResult = await seedOfficialDocumentsWithApproval(createdEmployees, actors, officialTemplates ?? [], 8);
  if (officialResult.error) notes.push(`공문 결재 일부 실패: ${officialResult.error}`);

  // 거래처 발주승인 — migration 221이 판매단가를 넣어둔 거래처 중
  // 몇 곳에 포털 계정을 만들어 실제로 발주를 넣게 한 뒤, 절반 정도는
  // 직접 승인 처리해 "승인 대기"와 "승인 완료"를 함께 보여준다.
  try {
    const { data: pricedCustomerRows } = await supabase
      .from("customer_product_prices")
      .select("customer_id, customers(id, name)")
      .limit(100);
    const seen = new Set<string>();
    const pricedCustomers: { id: string; name: string }[] = [];
    for (const row of pricedCustomerRows ?? []) {
      const customer = row.customers;
      if (!customer || seen.has(customer.id)) continue;
      seen.add(customer.id);
      pricedCustomers.push({ id: customer.id, name: customer.name });
    }

    if (pricedCustomers.length > 0) {
      const portalAccounts = await ensurePortalAccounts(admin, myTenant.id, myTenant.slug, pricedCustomers.slice(0, 5));
      const portalSessions: PortalSession[] = [];
      for (const account of portalAccounts) {
        try {
          const client = await signInAsEmployee(supabaseUrl, anonKey, account.email, account.password);
          portalSessions.push({ customerId: account.customerId, client });
        } catch {
          // 로그인 실패한 포털 계정은 건너뛴다.
        }
      }
      const ordersResult = await seedCustomerOrders(portalSessions, 10);
      if (ordersResult.error) notes.push(`거래처 발주 일부 실패: ${ordersResult.error}`);

      const { data: requestedOrders } = await supabase
        .from("customer_orders")
        .select("id")
        .eq("status", "requested")
        .limit(10);
      const toApprove = (requestedOrders ?? []).filter((_, i) => i % 2 === 0);
      for (const order of toApprove) {
        const { error: approveError } = await supabase
          .from("customer_orders")
          .update({ status: "approved", reviewed_by: createdEmployees[0].id, reviewed_at: new Date().toISOString() })
          .eq("id", order.id)
          .eq("status", "requested");
        if (approveError) notes.push(`거래처 발주 승인 일부 실패: ${approveError.message}`);
      }
    }
  } catch (e) {
    notes.push(`거래처 발주승인 더미 실패: ${e instanceof Error ? e.message : String(e)}`);
  }

  const base = `사원 계정 ${createdEmployees.length}명 생성 — 메신저 대화/전자결재 기안함/결재선/인사문서/공문 결재/거래처 발주승인까지 채웠습니다.`;
  return notes.length > 0 ? `${base} (일부 보류: ${notes.join(" / ")})` : base;
}

export async function seedSandbox(_prevState: FormState, _formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("sandbox_seed");
  if (error) return { error: `더미 데이터 생성에 실패했습니다: ${error.message}` };

  const employeeNote = await seedSandboxEmployees();

  revalidatePath("/", "layout");
  return { success: employeeNote ? `더미 데이터를 생성했습니다. ${employeeNote}` : "더미 데이터를 생성했습니다." };
}
