import { beforeEach, describe, expect, it } from "vitest";
import { createHarness, enableRowLevelSecurity, type Harness } from "./pg-harness";

// 회사(테넌트)별 데이터 분리 — 한 회사 직원이 다른 회사의 매출/매입/품목을 보거나
// 고치거나 지우거나, 남의 회사 이름으로 새 행을 만들 수 없어야 한다. 서비스 키로
// 우회하는 일부 코드 외에는 이 분리가 유일한 방어선이라 실제로 실행해서 확인한다.

let h: Harness;
let tenantB: string;
let userB: string;
let saleB: string;
let productB: string;

beforeEach(async () => {
  h = await createHarness();
  // 두 번째 회사(B)와 그 직원, B의 데이터를 만든다 — 기본 직원(h.ids.staff)은 회사 A.
  tenantB = crypto.randomUUID();
  userB = crypto.randomUUID();
  await h.db.exec(`
    insert into public.tenants (id) values ('${tenantB}');
    insert into public.profiles (id, role) values ('${userB}', 'staff');
    insert into public.tenant_members (user_id, tenant_id) values ('${userB}', '${tenantB}');
  `);
  await h.as(userB);
  productB = await h.makeProduct({ name: "B사 품목", cost: 50 });
  const sale = await h.db.query<{ id: string }>(
    `insert into public.sales_orders (customer_id, warehouse_id, order_date, created_by)
     values ($1, $2, '2026-11-01', $3) returning id`,
    [h.ids.customer, h.ids.warehouse, userB],
  );
  saleB = sale.rows[0].id;
  await h.db.query(
    `insert into public.sales_order_items (sales_order_id, product_id, quantity) values ($1, $2, 5)`,
    [saleB, productB],
  );
  await enableRowLevelSecurity(h.db);
  await h.as(h.ids.staff); // 이후 테스트는 회사 A 직원으로 실행
  await h.db.exec("set role authenticated");
}, 60000);

describe("회사 간 데이터 분리 (RLS)", () => {
  it("다른 회사의 행은 조회되지 않는다", async () => {
    for (const t of ["sales_orders", "sales_order_items", "products"]) {
      const r = await h.db.query(`select 1 from public.${t}`);
      expect(r.rows, t).toHaveLength(0);
    }
  });

  it("같은 회사 직원(B)은 자기 회사 행을 본다", async () => {
    await h.as(userB);
    const r = await h.db.query(`select id from public.sales_orders`);
    expect(r.rows).toHaveLength(1);
  });

  it("다른 회사의 행을 수정/삭제해도 0건만 영향받는다", async () => {
    const up = await h.db.query(`update public.sales_orders set memo = 'hacked' where id = $1`, [saleB]);
    expect(up.affectedRows).toBe(0);
    const del = await h.db.query(`delete from public.sales_orders where id = $1`, [saleB]);
    expect(del.affectedRows).toBe(0);
    await h.db.exec("reset role");
    const still = await h.db.query<{ memo: string | null }>(`select memo from public.sales_orders where id = $1`, [saleB]);
    expect(still.rows).toHaveLength(1);
    expect(still.rows[0].memo).toBeNull();
  });

  it("남의 회사 이름으로 새 행을 만들 수 없다", async () => {
    await expect(
      h.db.query(`insert into public.customers (name, tenant_id) values ('침투', $1)`, [tenantB]),
    ).rejects.toThrow(/row-level security/);
  });

  it("새 행의 회사는 항상 내 회사로 채워진다", async () => {
    const r = await h.db.query<{ tenant_id: string }>(
      `insert into public.customers (name) values ('내 거래처') returning tenant_id`,
    );
    expect(r.rows[0].tenant_id).toBe(h.ids.tenant);
  });

  it("다른 회사의 매출을 삭제하는 DB 함수는 '찾을 수 없음'으로 거부된다", async () => {
    await expect(
      h.db.query(`select public.delete_sale_with_items($1, $2)`, [saleB, h.ids.staff]),
    ).rejects.toThrow(/매출 거래를 찾을 수 없습니다/);
  });
});
