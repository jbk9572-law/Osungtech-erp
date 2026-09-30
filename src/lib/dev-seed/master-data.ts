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
