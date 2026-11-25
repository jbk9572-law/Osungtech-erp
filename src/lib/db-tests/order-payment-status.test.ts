import { beforeEach, describe, expect, it } from "vitest";
import { createHarness, latestFunctionSql, type Harness } from "./pg-harness";

// 전표별 수금/지급 상태(get_*_order_payment_status)가 미수금 연령(선입선출)과 같은 규칙으로 계산되는지 확인한다.
// 하네스는 최소 스키마라 이 함수가 읽는 컬럼/테이블(is_demo, customer_payments, supplier_payments)을 여기서 덧붙인다.

let h: Harness;

async function setup() {
  h = await createHarness();
  await h.db.exec(`
    alter table public.sales_orders add column if not exists is_demo boolean not null default false;
    alter table public.purchase_orders add column if not exists is_demo boolean not null default false;
    alter table public.sales_order_items add column if not exists unit_price numeric;
    create table if not exists public.customer_payments (
      id uuid primary key default gen_random_uuid(), customer_id uuid, amount numeric not null,
      is_demo boolean not null default false, tenant_id uuid default public.current_tenant_id());
    create table if not exists public.supplier_payments (
      id uuid primary key default gen_random_uuid(), supplier_id uuid, amount numeric not null,
      is_demo boolean not null default false, tenant_id uuid default public.current_tenant_id());
  `).catch(() => undefined);
  await h.db.exec(latestFunctionSql("get_sales_order_payment_status"));
  await h.db.exec(latestFunctionSql("get_purchase_order_payment_status"));
}

beforeEach(async () => {
  await setup();
}, 60000);

async function addSale(date: string, total: number, opts: { method?: string | null; isReturn?: boolean } = {}) {
  const r = await h.db.query<{ id: string }>(
    `insert into public.sales_orders (customer_id, warehouse_id, order_date, payment_method, is_return)
     values ($1, $2, $3, $4, $5) returning id`,
    [h.ids.customer, h.ids.warehouse, date, opts.method ?? null, opts.isReturn ?? false],
  );
  await h.db.query(
    `insert into public.sales_order_items (sales_order_id, quantity, unit_price) values ($1, 1, $2)`,
    [r.rows[0].id, total],
  ).catch(async () => {
    // 하네스의 items 테이블 컬럼 구성이 다르면 product_id를 채워 다시 시도한다.
    const pid = await h.makeProduct({ name: "P", cost: 1 });
    await h.db.query(
      `insert into public.sales_order_items (sales_order_id, product_id, quantity, unit_price) values ($1, $2, 1, $3)`,
      [r.rows[0].id, pid, total],
    );
  });
  return r.rows[0].id;
}

async function pay(amount: number) {
  await h.db.query(`insert into public.customer_payments (customer_id, amount) values ($1, $2)`, [h.ids.customer, amount]);
}

async function status(ids: string[]) {
  const r = await h.db.query<{ order_id: string; outstanding: string; status: string }>(
    `select * from public.get_sales_order_payment_status($1::uuid[])`,
    [ids],
  );
  return Object.fromEntries(r.rows.map((x) => [x.order_id, { s: x.status, o: Number(x.outstanding) }]));
}

describe("get_sales_order_payment_status", () => {
  it("수금이 없으면 전부 미수", async () => {
    const a = await addSale("2026-11-01", 1000);
    const b = await addSale("2026-11-02", 500);
    const s = await status([a, b]);
    expect(s[a]).toEqual({ s: "unpaid", o: 1000 });
    expect(s[b]).toEqual({ s: "unpaid", o: 500 });
  });

  it("수금은 오래된 전표부터 갚는다(완료→일부→미수)", async () => {
    const a = await addSale("2026-11-01", 1000);
    const b = await addSale("2026-11-02", 500);
    const c = await addSale("2026-11-03", 700);
    await pay(1200);
    const s = await status([a, b, c]);
    expect(s[a]).toEqual({ s: "paid", o: 0 });
    expect(s[b]).toEqual({ s: "partial", o: 300 });
    expect(s[c]).toEqual({ s: "unpaid", o: 700 });
  });

  it("목록에 일부 전표만 넘겨도 그 거래처의 전체 이력 기준으로 계산한다", async () => {
    const a = await addSale("2026-11-01", 1000);
    const b = await addSale("2026-11-02", 500);
    await pay(1000);
    const s = await status([b]);
    expect(s[b]).toEqual({ s: "unpaid", o: 500 });
    expect(Object.keys(s)).toEqual([b]);
    void a;
  });

  it("현금 등 결제방법이 있는 주문은 완료, 반품은 return이며 수금 풀에 합쳐진다", async () => {
    const cash = await addSale("2026-11-01", 300, { method: "현금" });
    const a = await addSale("2026-11-02", 1000);
    const ret = await addSale("2026-11-03", 400, { isReturn: true });
    const s = await status([cash, a, ret]);
    expect(s[cash]).toEqual({ s: "paid", o: 0 });
    expect(s[ret].s).toBe("return");
    expect(s[a]).toEqual({ s: "partial", o: 600 });
  });

  it("다른 회사 전표는 계산하지 않는다(테넌트 격리)", async () => {
    const a = await addSale("2026-11-01", 1000);
    await h.db.query(`update public.sales_orders set tenant_id = gen_random_uuid() where id = $1`, [a]);
    const s = await status([a]);
    expect(s[a]).toBeUndefined();
  });
});

describe("get_purchase_order_payment_status", () => {
  async function addPurchase(date: string, total: number, method: string | null = null) {
    const pid = await h.makeProduct({ name: "P", cost: 1 });
    const r = await h.db.query<{ id: string }>(
      `insert into public.purchase_orders (supplier_id, warehouse_id, purchase_date, payment_method)
       values ($1, $2, $3, $4) returning id`,
      [h.ids.supplier, h.ids.warehouse, date, method],
    );
    await h.db.query(
      `insert into public.purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) values ($1, $2, 1, $3)`,
      [r.rows[0].id, pid, total],
    );
    return r.rows[0].id;
  }

  it("지급은 오래된 매입부터 갚고, 결제방법이 있는 매입은 완료", async () => {
    const a = await addPurchase("2026-11-01", 1000);
    const b = await addPurchase("2026-11-02", 500);
    const cash = await addPurchase("2026-11-03", 200, "현금");
    await h.db.query(`insert into public.supplier_payments (supplier_id, amount) values ($1, 1200)`, [h.ids.supplier]);
    const r = await h.db.query<{ order_id: string; outstanding: string; status: string }>(
      `select * from public.get_purchase_order_payment_status($1::uuid[])`,
      [[a, b, cash]],
    );
    const s = Object.fromEntries(r.rows.map((x) => [x.order_id, { s: x.status, o: Number(x.outstanding) }]));
    expect(s[a]).toEqual({ s: "paid", o: 0 });
    expect(s[b]).toEqual({ s: "partial", o: 300 });
    expect(s[cash]).toEqual({ s: "paid", o: 0 });
  });
});

describe("get_*_last_order_dates", () => {
  it("요청한 거래처/공급처의 마지막 거래일만 돌려주고, 다른 회사 것은 제외한다", async () => {
    await h.db.exec(latestFunctionSql("get_customer_last_order_dates"));
    await h.db.exec(latestFunctionSql("get_supplier_last_order_dates"));
    const a = await addSale("2026-11-01", 100);
    await addSale("2026-11-09", 100);
    const c = await h.db.query<{ customer_id: string; last_order_date: Date | string }>(
      `select * from public.get_customer_last_order_dates($1::uuid[])`,
      [[h.ids.customer]],
    );
    expect(String(c.rows[0].last_order_date)).toContain("2026");
    expect(new Date(c.rows[0].last_order_date).toISOString().slice(0, 10)).toBe("2026-11-09");
    await h.db.query(`update public.sales_orders set tenant_id = gen_random_uuid() where id = $1`, [a]);
    const c2 = await h.db.query(`select * from public.get_customer_last_order_dates($1::uuid[])`, [[h.ids.customer]]);
    expect(c2.rows.length).toBe(1); // 남은 같은 회사 전표(11-09)만
    const s = await h.db.query(`select * from public.get_supplier_last_order_dates($1::uuid[])`, [[h.ids.supplier]]);
    expect(s.rows.length).toBe(0);
  });
});

describe("부가세 포함 금액(마이그레이션 285)", () => {
  it("과세 전표는 공급가액의 10%를 더한 금액으로 수금 상태를 계산한다", async () => {
    const id = await addSale("2026-11-01", 1000);
    await h.db.query(`update public.sales_orders set tax_type = '과세' where id = $1`, [id]);
    // 공급가액만(1000) 받았으면 부가세 100이 남아 일부 수금이다.
    await pay(1000);
    expect((await status([id]))[id]).toEqual({ s: "partial", o: 100 });
    // 부가세까지 받으면 완료.
    await pay(100);
    expect((await status([id]))[id]).toEqual({ s: "paid", o: 0 });
  });

  it("면세·영세 전표는 부가세를 더하지 않는다", async () => {
    const id = await addSale("2026-11-01", 1000);
    await h.db.query(`update public.sales_orders set tax_type = '면세' where id = $1`, [id]);
    await pay(1000);
    expect((await status([id]))[id]).toEqual({ s: "paid", o: 0 });
  });

  it("과세 반품은 부가세 포함 금액만큼 먼저 상계한다", async () => {
    const sale = await addSale("2026-11-01", 1000);
    const ret = await addSale("2026-11-02", 500, { isReturn: true });
    await h.db.query(`update public.sales_orders set tax_type = '과세' where id in ($1, $2)`, [sale, ret]);
    // 1100 중 반품 550을 먼저 상계 → 남은 550
    expect((await status([sale]))[sale]).toEqual({ s: "partial", o: 550 });
  });
});
