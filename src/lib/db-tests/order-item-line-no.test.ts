import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHarness } from "./pg-harness";

// 마이그레이션 286: 품목에 "입력한 순서"(line_no)를 저장한다 — 한 문장으로 여러 줄을 넣어도, 나중에 줄을 더해도 순서가 유지된다.
const SQL_286 = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "00000000000286_order_item_line_no.sql"), "utf8");

describe("품목 입력 순서 line_no (286)", () => {
  it("한 번에 넣은 줄은 넣은 순서대로, 다른 전표는 각자 1부터, 기존 전표는 생성 순서로 번호가 붙는다", async () => {
    const h = await createHarness();
    const old = await h.db.query<{ id: string }>(`insert into public.purchase_orders (purchase_date) values ('2026-11-01') returning id`);
    const oldId = old.rows[0].id;
    // 마이그레이션 전에 저장된 줄(번호 없음)
    await h.db.query(`insert into public.purchase_order_items (purchase_order_id, custom_name, quantity, created_at) values ($1,'먼저',1,'2026-11-01 09:00+09'),($1,'나중',1,'2026-11-01 09:01+09')`, [oldId]);
    await h.db.exec(SQL_286);
    const oldRows = await h.db.query<{ custom_name: string; line_no: number }>(`select custom_name, line_no from public.purchase_order_items where purchase_order_id=$1 order by line_no`, [oldId]);
    expect(oldRows.rows.map((r) => [r.custom_name, r.line_no])).toEqual([["먼저", 1], ["나중", 2]]);

    const a = (await h.db.query<{ id: string }>(`insert into public.purchase_orders (purchase_date) values ('2026-11-02') returning id`)).rows[0].id;
    const b = (await h.db.query<{ id: string }>(`insert into public.purchase_orders (purchase_date) values ('2026-11-02') returning id`)).rows[0].id;
    await h.db.query(
      `insert into public.purchase_order_items (purchase_order_id, custom_name, quantity)
       select $1, x, 1 from unnest(array['P.P 250','SMC 750','SMC 500','SMC 250','P.P 125','P.P 0.5']) with ordinality as u(x, n) order by n`,
      [a],
    );
    await h.db.query(`insert into public.purchase_order_items (purchase_order_id, custom_name, quantity) values ($1,'다른 전표',1),($2,'추가 줄',1)`, [b, a]);
    const rows = await h.db.query<{ custom_name: string; line_no: number }>(`select custom_name, line_no from public.purchase_order_items where purchase_order_id=$1 order by line_no`, [a]);
    expect(rows.rows.map((r) => r.custom_name)).toEqual(["P.P 250", "SMC 750", "SMC 500", "SMC 250", "P.P 125", "P.P 0.5", "추가 줄"]);
    expect(rows.rows.map((r) => r.line_no)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const other = await h.db.query<{ line_no: number }>(`select line_no from public.purchase_order_items where purchase_order_id=$1`, [b]);
    expect(other.rows[0].line_no).toBe(1);
  }, 60000);

  it("매출 품목도 같은 규칙", async () => {
    const h = await createHarness();
    await h.db.exec(SQL_286);
    const s = (await h.db.query<{ id: string }>(`insert into public.sales_orders (order_date) values ('2026-11-02') returning id`)).rows[0].id;
    await h.db.query(`insert into public.sales_order_items (sales_order_id, custom_name, quantity) values ($1,'가',1),($1,'나',1),($1,'다',1)`, [s]);
    const r = await h.db.query<{ custom_name: string; line_no: number }>(`select custom_name, line_no from public.sales_order_items where sales_order_id=$1 order by line_no`, [s]);
    expect(r.rows.map((x) => [x.custom_name, x.line_no])).toEqual([["가", 1], ["나", 2], ["다", 3]]);
  }, 60000);
});
