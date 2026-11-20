import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./pg-harness";

// input_formulas(migration 277): 전표를 지우면 식도 같이 지워지고, 형식이 틀린 식은 DB가 막는다. 마이그레이션 파일을 그대로 실행한다.

let h: Harness;

beforeEach(async () => {
  h = await createHarness();
  await h.db.exec(`
    alter table public.sales_orders add column if not exists is_demo boolean not null default false;
    create table if not exists public.input_formulas_stub (x int);
  `);
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "00000000000277_input_formulas.sql"), "utf8");
  await h.db.exec(sql);
}, 60000);

async function addSale(): Promise<string> {
  const r = await h.db.query<{ id: string }>(
    `insert into public.sales_orders (customer_id, warehouse_id, order_date) values ($1, $2, '2026-11-19') returning id`,
    [h.ids.customer, h.ids.warehouse],
  );
  return r.rows[0].id;
}

describe("input_formulas", () => {
  it("매출 전표를 지우면 그 전표의 식도 지워진다(다른 전표 식은 남는다)", async () => {
    const a = await addSale();
    const b = await addSale();
    await h.db.query(
      `insert into public.input_formulas (entity, entity_id, line_key, field, formula) values
       ('sales_order', $1, 'p1', 'quantity', '=600*2'), ('sales_order', $2, 'p1', 'quantity', '=1+1')`,
      [a, b],
    );
    await h.db.query(`delete from public.sales_orders where id = $1`, [a]);
    const r = await h.db.query<{ entity_id: string }>(`select entity_id from public.input_formulas`);
    expect(r.rows.map((x) => x.entity_id)).toEqual([b]);
  });

  it("식이 '='로 시작하지 않거나 칸 이름이 틀리면 거부한다", async () => {
    const a = await addSale();
    await expect(
      h.db.query(`insert into public.input_formulas (entity, entity_id, line_key, field, formula) values ('sales_order', $1, 'p1', 'quantity', '600*2')`, [a]),
    ).rejects.toThrow();
    await expect(
      h.db.query(`insert into public.input_formulas (entity, entity_id, line_key, field, formula) values ('sales_order', $1, 'p1', 'color', '=1+1')`, [a]),
    ).rejects.toThrow();
  });
});
