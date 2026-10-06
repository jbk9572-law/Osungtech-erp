import type { Db } from "./types";
import { PRODUCT_NAMES, PRODUCT_SPECS, pick, randomCompanyName } from "./korean-data";
import { fetchAllRows } from "../fetch-all-rows";

// 거래처/공급처/상품은 매출/매입/견적 등 다른 게시판이 참조할 수
// 있어야 하므로, 풀이 비어 있으면(최초 실행) minFloor개까지 먼저
// 채우고, 이미 충분하면 매 실행마다 dailyAdd개씩 새로 추가한다 —
// "거래처/공급처/상품도 매일 늘어난다"는 요청 범위를 그대로 반영.
// actingClient는 더미 직원으로 로그인한 클라이언트다(tenant_id
// 컬럼 기본값이 로그인 세션 기준으로 정확히 채워지게 하기 위함).

export async function ensureAndGrowCustomers(
  actingClient: Db,
  minFloor: number,
  dailyAdd: number,
): Promise<{ id: string; name: string }[]> {
  const rows = await fetchAllRows<{ id: string; name: string }>((from, to) =>
    actingClient.from("customers").select("id, name").range(from, to),
  );
  const addCount = rows.length < minFloor ? minFloor - rows.length : dailyAdd;

  const inserts = Array.from({ length: addCount }, () => ({ name: `${randomCompanyName()}(테스트)` }));
  if (inserts.length > 0) {
    const { data: created, error: insertError } = await actingClient.from("customers").insert(inserts).select("id, name");
    if (insertError) throw new Error(`거래처 더미 생성 실패: ${insertError.message}`);
    return [...rows, ...(created ?? [])];
  }
  return rows;
}

export async function ensureAndGrowSuppliers(
  actingClient: Db,
  minFloor: number,
  dailyAdd: number,
): Promise<{ id: string; name: string }[]> {
  const rows = await fetchAllRows<{ id: string; name: string }>((from, to) =>
    actingClient.from("suppliers").select("id, name").range(from, to),
  );
  const addCount = rows.length < minFloor ? minFloor - rows.length : dailyAdd;

  const inserts = Array.from({ length: addCount }, () => ({ name: `${randomCompanyName()}(테스트)` }));
  if (inserts.length > 0) {
    const { data: created, error: insertError } = await actingClient.from("suppliers").insert(inserts).select("id, name");
    if (insertError) throw new Error(`공급처 더미 생성 실패: ${insertError.message}`);
    return [...rows, ...(created ?? [])];
  }
  return rows;
}

export async function ensureAndGrowProducts(
  actingClient: Db,
  minFloor: number,
  dailyAdd: number,
): Promise<{ id: string; sku: string; name: string; spec: string | null; price: number; cost: number }[]> {
  const rows = await fetchAllRows<{ id: string; sku: string; name: string; spec: string | null; price: number; cost: number }>(
    (from, to) => actingClient.from("products").select("id, sku, name, spec, price, cost").range(from, to),
  );
  const addCount = rows.length < minFloor ? minFloor - rows.length : dailyAdd;

  const inserts = Array.from({ length: addCount }, () => {
    const price = 10000 + Math.floor(Math.random() * 90000);
    return {
      sku: `TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: `${pick(PRODUCT_NAMES)}(테스트)`,
      spec: pick(PRODUCT_SPECS),
      unit: "EA",
      price,
      cost: Math.round(price * 0.7),
    };
  });
  if (inserts.length > 0) {
    const { data: created, error: insertError } = await actingClient
      .from("products")
      .insert(inserts)
      .select("id, sku, name, spec, price, cost");
    if (insertError) throw new Error(`상품 더미 생성 실패: ${insertError.message}`);
    return [...rows, ...(created ?? [])];
  }
  return rows;
}

// 창고는 매출/매입 전표에 반드시 필요한데 더미로 새로 늘릴 이유가
// 없는 값이라(실제 물리적 창고 개념), 기존 창고 중 하나를 그대로
// 쓰고 하나도 없을 때만 "테스트 창고"를 하나 만든다.
export async function ensureWarehouse(actingClient: Db): Promise<string> {
  const { data: existing, error } = await actingClient.from("warehouses").select("id").limit(1);
  if (error) throw new Error(`창고 조회 실패: ${error.message}`);
  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error: insertError } = await actingClient
    .from("warehouses")
    .insert({ name: "테스트 창고" })
    .select("id")
    .single();
  if (insertError || !created) throw new Error(`테스트 창고 생성 실패: ${insertError?.message}`);
  return created.id;
}

// 창고 이동(/inventory/transfers)은 출발/도착 창고가 서로 달라야 해서
// 창고가 하나뿐이면 테스트할 수 없다 — ensureWarehouse가 만든 첫 창고와
// 구분되는 두 번째 창고를 하나만 더 보장한다.
export async function ensureSecondWarehouse(actingClient: Db, firstWarehouseId: string): Promise<string> {
  const { data: existing, error } = await actingClient
    .from("warehouses")
    .select("id")
    .neq("id", firstWarehouseId)
    .limit(1);
  if (error) throw new Error(`창고 조회 실패: ${error.message}`);
  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error: insertError } = await actingClient
    .from("warehouses")
    .insert({ name: "테스트 창고 2" })
    .select("id")
    .single();
  if (insertError || !created) throw new Error(`테스트 창고2 생성 실패: ${insertError?.message}`);
  return created.id;
}

// 생산지시(work_orders)는 BOM(구성품)이 등록된 품목에만 낼 수 있다 —
// 더미 상품 중 하나를 완제품으로 고정해 구성품 1개 + 공정 라우팅
// 2단계(재단→포장)를 한 번만 만들어둔다(매 실행마다 늘릴 이유가 없는
// 기준정보라 ensure 패턴).
export async function ensureBomAndProcesses(
  actingClient: Db,
  products: { id: string; name: string }[],
): Promise<{ parentProductId: string } | null> {
  if (products.length < 2) return null;
  const parent = products[0];
  const component = products[1];

  const { data: existingBom } = await actingClient
    .from("bom_items")
    .select("id")
    .eq("parent_product_id", parent.id)
    .limit(1);
  if (!existingBom || existingBom.length === 0) {
    const { error: bomError } = await actingClient.from("bom_items").insert({
      parent_product_id: parent.id,
      component_product_id: component.id,
      quantity_per_unit: 1,
    });
    if (bomError) throw new Error(`BOM 기준정보 생성 실패: ${bomError.message}`);
  }

  const { data: existingProcesses } = await actingClient
    .from("production_processes")
    .select("id, name")
    .order("sort_order")
    .limit(100);
  let processes = existingProcesses ?? [];
  if (processes.length === 0) {
    const { data: created, error: processError } = await actingClient
      .from("production_processes")
      .insert([
        { name: "재단", sort_order: 1 },
        { name: "포장", sort_order: 2 },
      ])
      .select("id, name");
    if (processError) throw new Error(`공정 기준정보 생성 실패: ${processError.message}`);
    processes = created ?? [];
  }

  const { data: existingRoutes } = await actingClient
    .from("product_process_routes")
    .select("id")
    .eq("product_id", parent.id)
    .limit(1);
  if ((!existingRoutes || existingRoutes.length === 0) && processes.length > 0) {
    const { error: routeError } = await actingClient.from("product_process_routes").insert(
      processes.map((p, i) => ({ product_id: parent.id, process_id: p.id, sort_order: i + 1 })),
    );
    if (routeError) throw new Error(`공정 라우팅 생성 실패: ${routeError.message}`);
  }

  return { parentProductId: parent.id };
}

// 거래처 포털에서 발주하려면 그 거래처+품목 조합의 판매단가
// (customer_product_prices)가 등록돼 있어야 한다 — 포털 카탈로그 자체가
// 이 테이블을 기준으로 노출되기 때문. 처음 몇 거래처에게 처음 몇 품목의
// 단가를 한 번만 깔아둔다.
export async function ensureCustomerProductPrices(
  actingClient: Db,
  customers: { id: string; name: string }[],
  products: { id: string; price: number }[],
  customerCount = 5,
  productCount = 5,
): Promise<{ id: string; name: string }[]> {
  const targetCustomers = customers.slice(0, Math.min(customerCount, customers.length));
  const targetProducts = products.slice(0, Math.min(productCount, products.length));
  if (targetCustomers.length === 0 || targetProducts.length === 0) return [];

  const { data: existing } = await actingClient
    .from("customer_product_prices")
    .select("customer_id")
    .in("customer_id", targetCustomers.map((c) => c.id));
  const covered = new Set((existing ?? []).map((r) => r.customer_id));
  const toCover = targetCustomers.filter((c) => !covered.has(c.id));

  if (toCover.length > 0) {
    const rows = toCover.flatMap((c) =>
      targetProducts.map((p) => ({ customer_id: c.id, product_id: p.id, unit_price: p.price })),
    );
    const { error } = await actingClient.from("customer_product_prices").insert(rows);
    if (error) throw new Error(`거래처별 판매단가 생성 실패: ${error.message}`);
  }

  return targetCustomers;
}

// 급여관리 화면이 완전히 비어 보이지 않게, 직원별 기준 월급(기본급)만
// 한 번 채운다 — 실제 급여명세(payslips)는 세금 계산이 들어가는 민감한
// 산출물이라 더미로 자동 생성하지 않는다(판단 보류, 아래 run.ts 주석).
// employee_pay_settings는 급여정보라 insert 정책이 is_admin()만 허용한다
// (migration 106) — 더미 직원은 전부 role:'staff'라 로그인 세션
// (actingClient)으로는 전부 RLS에 막힌다. departments와 같은 이유로
// service-role(admin) 클라이언트를 쓰고 tenant_id를 직접 채운다.
export async function ensureEmployeePaySettings(admin: Db, tenantId: string, employeeIds: string[]): Promise<void> {
  const { data: existing } = await admin
    .from("employee_pay_settings")
    .select("user_id")
    .eq("tenant_id", tenantId);
  const covered = new Set((existing ?? []).map((r) => r.user_id));
  const rows = employeeIds
    .filter((id) => !covered.has(id))
    .map((id) => ({
      user_id: id,
      tenant_id: tenantId,
      monthly_base_pay: 2500000 + Math.floor(Math.random() * 15) * 100000,
      dependents_count: 1,
    }));
  if (rows.length > 0) {
    const { error } = await admin.from("employee_pay_settings").insert(rows);
    if (error) throw new Error(`직원 급여 기준정보 생성 실패: ${error.message}`);
  }
}

// 연차관리 화면(leave_balances)도 1년치 총일수를 한 번 깔아둔다 —
// submit_leave_request()는 이 값을 검증하진 않지만, 화면에
// "0/0"만 보이면 연차 신청 더미(seedLeaveRequests)가 떠도 맥락 없이
// 보인다. leave_balances도 insert 정책이 is_admin()만 허용해(migration
// 105) 위 employee_pay_settings와 같은 이유로 admin 클라이언트를 쓴다.
export async function ensureLeaveBalances(admin: Db, tenantId: string, employeeIds: string[]): Promise<void> {
  const year = new Date().getFullYear();
  const { data: existing } = await admin
    .from("leave_balances")
    .select("user_id")
    .eq("year", year)
    .eq("tenant_id", tenantId);
  const covered = new Set((existing ?? []).map((r) => r.user_id));
  const rows = employeeIds
    .filter((id) => !covered.has(id))
    .map((id) => ({ user_id: id, tenant_id: tenantId, year, total_days: 15 }));
  if (rows.length > 0) {
    const { error } = await admin.from("leave_balances").insert(rows);
    if (error) throw new Error(`연차 기준정보 생성 실패: ${error.message}`);
  }
}
