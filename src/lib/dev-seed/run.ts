import { createAdminClient, resolveTenant, signInAsEmployee } from "./client";
import { ensureDepartments, ensureDummyEmployees, ensurePortalAccounts } from "./employees";
import {
  ensureAndGrowCustomers,
  ensureAndGrowProducts,
  ensureAndGrowSuppliers,
  ensureBomAndProcesses,
  ensureCustomerProductPrices,
  ensureEmployeePaySettings,
  ensureLeaveBalances,
  ensureSecondWarehouse,
  ensureWarehouse,
} from "./master-data";
import { pickMany } from "./korean-data";
import { seedPaymentRequests, seedPurchaseQuoteRequests, seedPurchaseRequests, seedPurchases, seedQuotes, seedSales } from "./boards/sales-purchases";
import { seedAnnouncements, seedOfficialDocuments, seedTodos } from "./boards/simple-posts";
import { seedApprovals } from "./boards/approvals";
import { seedHrDocuments } from "./boards/hr-documents";
import { seedMessenger } from "./boards/messenger";
import { seedMail } from "./boards/mail";
import { seedCalendar } from "./boards/calendar";
import { seedSalesActivities } from "./boards/sales-activities";
import { seedAttendance, seedLeaveRequests } from "./boards/hr-ops";
import { seedStockTransfers } from "./boards/stock-transfers";
import { seedWorkOrders } from "./boards/production";
import { seedCustomerOrders } from "./boards/customer-portal-orders";
import type { ActingSession, BoardSeedResult, PortalSession, SeedContext } from "./types";

export type DevSeedOptions = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  tenantSlug: string;
  employeeTarget?: number;
  postsPerBoard?: number;
  actorPoolSize?: number;
};

export type DevSeedResult = {
  tenant: { id: string; slug: string; name: string };
  employeeCount: number;
  boards: BoardSeedResult[];
};

export async function runDevSeed(options: DevSeedOptions): Promise<DevSeedResult> {
  const {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    tenantSlug,
    employeeTarget = 30,
    postsPerBoard = 10,
    actorPoolSize = 6,
  } = options;

  const admin = createAdminClient(supabaseUrl, serviceRoleKey);
  const tenant = await resolveTenant(admin, tenantSlug);

  const employees = await ensureDummyEmployees(admin, tenant.id, tenant.slug, employeeTarget);
  if (employees.length === 0) {
    throw new Error("더미 직원을 한 명도 만들지 못했습니다 — SUPABASE_SERVICE_ROLE_KEY 권한을 확인해주세요.");
  }
  const departments = await ensureDepartments(admin, tenant.id);

  // 게시글마다 매번 새로 로그인하지 않도록, 더미 직원 중 일부만 실제
  // 로그인시켜 세션 풀로 돌려쓴다(client.ts의 signInAsEmployee 주석 참고).
  const chosenActors = pickMany(employees, Math.min(actorPoolSize, employees.length));
  const actors: ActingSession[] = [];
  for (const employee of chosenActors) {
    try {
      const client = await signInAsEmployee(supabaseUrl, anonKey, employee.email, employee.password);
      actors.push({ employee, client });
    } catch {
      // 로그인 실패한 직원은 건너뛰고 나머지로 진행한다.
    }
  }
  if (actors.length === 0) {
    throw new Error("더미 직원으로 로그인한 세션을 하나도 만들지 못했습니다.");
  }

  // 거래처/공급처/상품은 최초 실행 시 20개까지 채우고, 이후로는 매
  // 실행마다 postsPerBoard개씩 추가한다(사용자가 명시적으로 포함을
  // 요청한 범위).
  const customers = await ensureAndGrowCustomers(actors[0].client, 20, postsPerBoard);
  const suppliers = await ensureAndGrowSuppliers(actors[0].client, 20, postsPerBoard);
  const products = await ensureAndGrowProducts(actors[0].client, 20, postsPerBoard);
  const warehouseId = await ensureWarehouse(actors[0].client);
  const warehouse2Id = await ensureSecondWarehouse(actors[0].client, warehouseId);

  // 생산지시(work_orders)는 BOM이 있는 품목에만 낼 수 있고, 거래처
  // 발주(customer_orders)는 거래처별 판매단가(customer_product_prices)가
  // 있어야 포털 카탈로그에 뜬다 — 둘 다 "매일 느는 더미"가 아니라 한 번만
  // 갖춰두면 되는 기준정보라 ensure 패턴으로 미리 준비한다.
  const bom = await ensureBomAndProcesses(actors[0].client, products);
  const pricedCustomers = await ensureCustomerProductPrices(actors[0].client, customers, products);
  await ensureEmployeePaySettings(actors[0].client, employees.map((e) => e.id));
  await ensureLeaveBalances(actors[0].client, employees.map((e) => e.id));

  // 거래처 포털 계정도 더미로 몇 개 만들어 실제 portal_create_order()
  // 경로로 발주를 넣는다 — "거래처 발주 승인" 화면이 빈 채로 남지 않게.
  const portalAccounts = await ensurePortalAccounts(admin, tenant.id, tenant.slug, pricedCustomers);
  const portalSessions: PortalSession[] = [];
  for (const account of portalAccounts) {
    try {
      const client = await signInAsEmployee(supabaseUrl, anonKey, account.email, account.password);
      portalSessions.push({ customerId: account.customerId, client });
    } catch {
      // 로그인 실패한 포털 계정은 건너뛴다.
    }
  }

  const ctx: SeedContext = {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    employees,
    departments,
    customers,
    suppliers,
    products,
    warehouseId,
  };

  // 한 게시판의 실패가 나머지 게시판까지 막지 않게, 게시판마다 개별
  // try/catch로 감싼다 — 라이브 DB에 직접 테스트해볼 수 없는 상태로
  // 작성된 스크립트라 일부 게시판이 스키마 차이 등으로 실패해도, 나머지
  // 게시판은 계속 채워지는 게 더 유용하다.
  //
  // 전체 메뉴 중 아래는 의도적으로 제외했다(판단 필요 — 더미로 자동
  // 채우기엔 위험하거나 구조가 안 맞음):
  //   - 재고 실사(/inventory/count): 실사는 "실제 재고를 센 숫자"로 덮어
  //     쓰는 델타 적용이라, 무작위 더미 숫자를 넣으면 매출/매입이 쌓아온
  //     실제 재고 수량이 뒤틀린다.
  //   - 급여명세(/hr/payroll 중 payslips): 원천징수 세율 테이블 기준으로
  //     실제 계산되는 민감한 산출물이라, 가짜로 생성하면 틀린 금액이
  //     "생성된" 것처럼 보일 위험이 있다. 급여관리 화면 자체는
  //     employee_pay_settings(기준 월급)만 채워 비어 보이지 않게 했다.
  //   - 모조지 계산 저장이력(/paper-calc): 저장 레코드가 재단 배치
  //     알고리즘 출력(JSON 구조)을 그대로 담아야 해서, 그 구조를 흉내
  //     낸 더미를 넣으면 상세화면이 깨질 위험이 있다.
  const boardRunners: (() => Promise<BoardSeedResult>)[] = [
    () => seedSales(ctx, actors, postsPerBoard),
    () => seedPurchases(ctx, actors, postsPerBoard),
    () => seedQuotes(ctx, actors, postsPerBoard),
    () => seedPurchaseRequests(ctx, actors, postsPerBoard),
    () => seedPurchaseQuoteRequests(ctx, actors, postsPerBoard),
    () => seedPaymentRequests(ctx, actors, postsPerBoard),
    () => seedTodos(ctx, actors, postsPerBoard),
    () => seedAnnouncements(ctx, actors, postsPerBoard),
    () => seedOfficialDocuments(ctx, actors, postsPerBoard),
    () => seedApprovals(employees, actors, postsPerBoard),
    () => seedHrDocuments(employees, actors, postsPerBoard),
    () => seedMessenger(actors, postsPerBoard),
    () => seedMail(actors, postsPerBoard),
    () => seedCalendar(ctx, actors, postsPerBoard),
    () => seedSalesActivities(ctx, actors, postsPerBoard),
    () => seedAttendance(employees, actors, postsPerBoard),
    () => seedLeaveRequests(employees, actors, postsPerBoard),
    () => seedStockTransfers(warehouseId, warehouse2Id, actors, postsPerBoard),
    ...(bom ? [() => seedWorkOrders(bom.parentProductId, warehouseId, actors, postsPerBoard)] : []),
    () => seedCustomerOrders(portalSessions, postsPerBoard),
  ];

  const boards: BoardSeedResult[] = [];
  for (const run of boardRunners) {
    try {
      boards.push(await run());
    } catch (e) {
      boards.push({ board: "알 수 없음", created: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { tenant, employeeCount: employees.length, boards };
}
