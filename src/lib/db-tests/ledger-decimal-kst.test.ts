import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHarness, latestFunctionSql } from "./pg-harness";

// 마이그레이션 284: ① 수불부가 소수 수량을 반올림하지 않는다 ② 전표 없는 재고 거래의 날짜는 한국 날짜다.
const SQL_284 = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "00000000000284_doc_no_per_tenant_kst_date_decimal_count.sql"), "utf8");

describe("수불부 소수 수량 · 거래일자 한국 시간 (284)", () => {
  it("소수 수량 실사·입출고가 반올림 없이 수불부에 나온다", async () => {
    const h = await createHarness();
    await h.db.exec(`alter table public.inventory_transactions add column if not exists transaction_date date, add column if not exists note text, add column if not exists counted_absolute_quantity integer, add column if not exists is_demo boolean not null default public.is_demo_actor()`);
    await h.db.exec(`alter table public.inventory_transactions alter column counted_absolute_quantity type numeric`);
    await h.db.exec(latestFunctionSql("get_product_ledger_rows"));
    const product = await h.makeProduct();
    await h.db.query(
      `insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, transaction_date, counted_absolute_quantity) values
       ($1, $2, 'in', 2.5, '2026-11-01', null), ($1, $2, 'adjust', 0.25, '2026-11-02', 10.75)`,
      [product, h.ids.warehouse],
    );
    const r = await h.db.query<{ quantity: string; balance_after: string }>(`select quantity, balance_after from public.get_product_ledger_rows($1, null, null, null)`, [product]);
    expect(r.rows.map((x) => Number(x.quantity))).toEqual([2.5, 0.25]);
    expect(Number(r.rows[1].balance_after)).toBe(10.75);
  }, 60000);

  it("마이그레이션이 문서번호를 회사별 유일로 바꾸고 날짜 기본값을 한국 시간으로 둔다", () => {
    expect(SQL_284).toMatch(/create unique index if not exists sales_orders_tenant_doc_no_key on public\.sales_orders \(tenant_id, doc_no\)/);
    expect(SQL_284).toMatch(/create unique index if not exists purchase_orders_tenant_doc_no_key on public\.purchase_orders \(tenant_id, doc_no\)/);
    expect(SQL_284).toMatch(/Asia\/Seoul/);
    expect(SQL_284).not.toMatch(/current_date,\n/);
  });
});
