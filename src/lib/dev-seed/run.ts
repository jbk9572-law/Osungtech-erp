import { createAdminClient, resolveTenant, signInAsEmployee } from "./client";
import { ensureDepartments, ensureDummyEmployees } from "./employees";
import { ensureAndGrowCustomers, ensureAndGrowProducts, ensureAndGrowSuppliers, ensureWarehouse } from "./master-data";
import { pickMany } from "./korean-data";
import { seedPaymentRequests, seedPurchaseQuoteRequests, seedPurchaseRequests, seedPurchases, seedQuotes, seedSales } from "./boards/sales-purchases";
import { seedAnnouncements, seedOfficialDocuments, seedTodos } from "./boards/simple-posts";
import { seedApprovals } from "./boards/approvals";
import { seedHrDocuments } from "./boards/hr-documents";
import { seedMessenger } from "./boards/messenger";
import { seedMail } from "./boards/mail";
import { seedCalendar } from "./boards/calendar";
import type { ActingSession, BoardSeedResult, SeedContext } from "./types";

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
  const departments = await ensureDepartments(admin);

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
