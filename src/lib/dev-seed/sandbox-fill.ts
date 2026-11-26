import { ensureEmployeePaySettings, ensureLeaveBalances, ensureSecondWarehouse, ensureWarehouse } from "./master-data";
import { seedMail } from "./boards/mail";
import { seedCalendar } from "./boards/calendar";
import { seedAttendance, seedLeaveRequests } from "./boards/hr-ops";
import { seedStockTransfers } from "./boards/stock-transfers";
import { seedStockLoans } from "./boards/stock-loans";
import { seedPayslipSamples } from "./boards/payslips";
import type { ActingSession, BoardSeedResult, Db, DummyEmployee, PlatformAdminMember, SeedContext } from "./types";

// 샌드박스 도구의 「더미 데이터 생성」이 메일·캘린더·근태·급여·창고이동·일시반출까지 채우게 하는 묶음.
// 예전엔 이 메뉴들의 시드 코드가 개발자용 스크립트(CLI)에만 연결돼 있어 버튼으로는 비어 있었다(메일은 "가짜 계정이 깨진다"며 일부러 뺐었다).
// 메일은 동기화가 꺼진(is_active=false) "연동 전 샘플 계정"으로 만든다 — 나중에 실제 연동만 하면 된다.
// 여러 번 눌러도 쌓이지 않게 메뉴마다 "이미 데이터가 있으면 건너뜀"을 확인한다(건너뛴 것도 결과 표에 그대로 보인다).
type Args = {
  supabase: Db; // 지금 로그인한 관리자 세션(읽기용)
  admin: Db; // 서비스 키 클라이언트(RLS 우회가 필요한 insert용)
  tenantId: string;
  tenantSlug: string;
  self: PlatformAdminMember; // 지금 로그인한 관리자 — 이 사람의 메일함에도 샘플이 보이게 한다
  employees: DummyEmployee[];
  actors: ActingSession[];
};

async function isEmpty(db: Db, table: string): Promise<boolean> {
  const { count, error } = await db.from(table as "customers").select("*", { count: "exact", head: true });
  return !error && (count ?? 0) === 0;
}

export async function fillSandboxMenus(a: Args): Promise<BoardSeedResult[]> {
  const out: BoardSeedResult[] = [];
  const step = async (board: string, table: string | null, fn: () => Promise<BoardSeedResult | void>) => {
    try {
      if (table && !(await isEmpty(a.supabase, table))) {
        out.push({ board, created: 0, error: "이미 데이터가 있어 건너뜀" });
        return;
      }
      const r = await fn();
      out.push(r ?? { board, created: 0 });
    } catch (e) {
      out.push({ board, created: 0, error: e instanceof Error ? e.message : String(e) });
    }
  };

  const ids = a.employees.map((e) => e.id);
  const first = a.actors[0].client;
  let warehouseId = "";
  let warehouse2Id = "";
  try {
    warehouseId = await ensureWarehouse(first);
    warehouse2Id = await ensureSecondWarehouse(first, warehouseId);
  } catch (e) {
    out.push({ board: "창고 준비", created: 0, error: e instanceof Error ? e.message : String(e) });
  }

  const [{ data: customers }, { data: suppliers }, { data: products }, { data: departments }] = await Promise.all([
    a.supabase.from("customers").select("id, name").limit(60),
    a.supabase.from("suppliers").select("id, name").limit(60),
    a.supabase.from("products").select("id, sku, name, spec, price").limit(60),
    a.supabase.from("departments").select("id, name").limit(60),
  ]);
  const ctx: SeedContext = {
    tenantId: a.tenantId,
    tenantSlug: a.tenantSlug,
    employees: a.employees,
    departments: departments ?? [],
    customers: customers ?? [],
    suppliers: suppliers ?? [],
    products: (products ?? []).map((p) => ({ id: p.id, sku: p.sku, name: p.name, spec: p.spec, price: Number(p.price ?? 0), cost: 0 })),
    warehouseId,
  };

  await step("직원 급여 기준·연차", null, async () => {
    await ensureEmployeePaySettings(a.admin, a.tenantId, ids);
    await ensureLeaveBalances(a.admin, a.tenantId, ids);
    return { board: "직원 급여 기준·연차", created: ids.length };
  });
  await step("메일함(연동 전 샘플)", "mail_messages", () => seedMail(a.admin, a.tenantId, a.actors, [a.self], 10));
  await step("캘린더", "calendar_events", () => seedCalendar(ctx, a.actors, 14));
  await step("근태", "attendance_records", () => seedAttendance(a.employees, a.actors, a.actors.length));
  await step("연차 신청", "leave_requests", () => seedLeaveRequests(a.employees, a.actors, 4));
  await step("급여명세 샘플", "payslips", () => seedPayslipSamples(a.admin, a.tenantId, a.employees));
  if (warehouseId && warehouse2Id) {
    await step("창고 이동", "stock_transfers", () => seedStockTransfers(warehouseId, warehouse2Id, a.actors, 4));
    await step("일시반출", "stock_loans", () => seedStockLoans(ctx.customers, warehouseId, a.actors, 3));
  }
  return out;
}

export function formatFillResults(results: BoardSeedResult[]): string {
  return results.map((r) => (r.error && r.created === 0 ? `✗ ${r.board}: ${r.error}` : `✓ ${r.board} ${r.created}건${r.error ? ` (${r.error})` : ""}`)).join(" / ");
}
