import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createHarness, latestFunctionSql, type Harness } from "./pg-harness";

// 일시반출(migration 280): 반출하면 재고가 빠지고, 반납하면 돌아오고, 취소하면 복원되며, 어떤 경우에도 재고 원장(inventory_transactions)과
// 재고 캐시(inventory)가 어긋나지 않는다. 마이그레이션 파일(280)과 재고 계산 트리거(266)를 그대로 실행한다.

let h: Harness;
let product: string;

beforeEach(async () => {
  h = await createHarness();
  await h.db.exec(`
    alter table public.tenants add column if not exists allow_negative_stock boolean not null default false;
    alter table public.tenants add column if not exists is_sandbox boolean not null default false;
    alter table public.inventory_transactions add column if not exists is_demo boolean not null default false;
    alter table public.inventory_transactions add column if not exists note text;
    create table public.inventory (
      id uuid primary key default gen_random_uuid(),
      product_id uuid not null, warehouse_id uuid not null, quantity numeric not null default 0,
      is_demo boolean not null default false, tenant_id uuid default public.current_tenant_id(), updated_at timestamptz,
      unique (product_id, warehouse_id)
    );
    create function public.is_sandbox_tenant() returns boolean language sql stable as $$ select false $$;
    create role authenticated;
  `);
  await h.db.exec(latestFunctionSql("apply_inventory_transaction"));
  await h.db.exec(latestFunctionSql("guard_internal_stock_write"));
  await h.db.exec(`create trigger apply_inventory_transaction after insert on public.inventory_transactions for each row execute function public.apply_inventory_transaction()`);
  await h.db.exec(fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "00000000000280_stock_loans.sql"), "utf8"));
  product = await h.makeProduct({ name: "필터지" });
  await stock(product, 100);
}, 60000);

async function stock(productId: string, qty: number) {
  await h.db.query(`insert into public.inventory_transactions (product_id, warehouse_id, type, quantity) values ($1, $2, 'in', $3)`, [productId, h.ids.warehouse, qty]);
}
async function onHand(productId = product): Promise<number> {
  const r = await h.db.query<{ quantity: string }>(`select quantity from public.inventory where product_id = $1 and warehouse_id = $2`, [productId, h.ids.warehouse]);
  return Number(r.rows[0]?.quantity ?? 0);
}
async function ledgerSum(productId = product): Promise<number> {
  const r = await h.db.query<{ s: string }>(
    `select coalesce(sum(case when type = 'out' then -quantity else quantity end), 0) as s from public.inventory_transactions where product_id = $1 and warehouse_id = $2`,
    [productId, h.ids.warehouse],
  );
  return Number(r.rows[0].s);
}
async function loan(items: { productId: string; quantity: number }[], due: string | null = "2026-12-31"): Promise<string> {
  const r = await h.db.query<{ id: string }>(`select public.create_stock_loan($1, $2, '2026-11-19', $3, '시연', $4::jsonb) as id`, [h.ids.customer, h.ids.warehouse, due, JSON.stringify(items)]);
  return r.rows[0].id;
}
async function itemId(loanId: string): Promise<string> {
  return (await h.db.query<{ id: string }>(`select id from public.stock_loan_items where loan_id = $1 order by created_at limit 1`, [loanId])).rows[0].id;
}
const ret = (loanId: string, items: { itemId: string; quantity: number }[]) =>
  h.db.query<{ s: string }>(`select public.return_stock_loan($1, $2::jsonb) as s`, [loanId, JSON.stringify(items)]);

describe("일시반출", () => {
  it("반출하면 재고가 빠지고 원장에 out이 남는다(재고 캐시 = 원장 합계)", async () => {
    const id = await loan([{ productId: product, quantity: 30 }]);
    expect(await onHand()).toBe(70);
    expect(await ledgerSum()).toBe(70);
    const s = await h.db.query<{ status: string }>(`select status from public.stock_loans where id = $1`, [id]);
    expect(s.rows[0].status).toBe("open");
  });

  it("재고보다 많이 반출하면 거부하고 아무것도 남기지 않는다", async () => {
    await expect(loan([{ productId: product, quantity: 101 }])).rejects.toThrow(/재고/);
    expect(await onHand()).toBe(100);
    expect((await h.db.query(`select 1 from public.stock_loans`)).rows).toHaveLength(0);
  });

  it("같은 품목을 여러 줄로 나눠도 합계로 재고를 확인한다", async () => {
    await expect(loan([{ productId: product, quantity: 60 }, { productId: product, quantity: 60 }])).rejects.toThrow(/재고/);
    expect(await onHand()).toBe(100);
  });

  it("수량이 0 이하이거나 품목이 없거나 반납 예정일이 반출일보다 빠르면 거부한다", async () => {
    await expect(loan([{ productId: product, quantity: 0 }])).rejects.toThrow();
    await expect(loan([])).rejects.toThrow();
    await expect(loan([{ productId: product, quantity: 5 }], "2026-11-01")).rejects.toThrow(/반납 예정일/);
    expect(await onHand()).toBe(100);
  });

  it("일부 반납하면 그만큼만 재고가 돌아오고 전표는 계속 '반출 중'이다", async () => {
    const id = await loan([{ productId: product, quantity: 30 }]);
    const status = (await ret(id, [{ itemId: await itemId(id), quantity: 10 }])).rows[0].s;
    expect(status).toBe("open");
    expect(await onHand()).toBe(80);
    expect(await ledgerSum()).toBe(80);
  });

  it("모두 반납하면 재고가 원래대로 돌아오고 전표가 닫힌다", async () => {
    const id = await loan([{ productId: product, quantity: 30 }]);
    const item = await itemId(id);
    await ret(id, [{ itemId: item, quantity: 10 }]);
    const status = (await ret(id, [{ itemId: item, quantity: 20 }])).rows[0].s;
    expect(status).toBe("returned");
    expect(await onHand()).toBe(100);
    expect(await ledgerSum()).toBe(100);
  });

  it("미반납 수량보다 많이 반납하거나 닫힌 전표를 다시 반납하면 거부한다", async () => {
    const id = await loan([{ productId: product, quantity: 30 }]);
    const item = await itemId(id);
    await expect(ret(id, [{ itemId: item, quantity: 31 }])).rejects.toThrow(/미반납/);
    await ret(id, [{ itemId: item, quantity: 30 }]);
    await expect(ret(id, [{ itemId: item, quantity: 1 }])).rejects.toThrow(/반납 완료/);
    expect(await onHand()).toBe(100);
  });

  it("같은 줄을 한 요청에 여러 번 넣어도 합산해서 한도를 지킨다", async () => {
    const id = await loan([{ productId: product, quantity: 30 }]);
    const item = await itemId(id);
    await expect(ret(id, [{ itemId: item, quantity: 20 }, { itemId: item, quantity: 20 }])).rejects.toThrow(/미반납/);
    expect(await onHand()).toBe(70);
  });

  it("반납이 없으면 취소로 재고가 복원된다 — 본인 또는 관리자만", async () => {
    const id = await loan([{ productId: product, quantity: 30 }]);
    await h.as(h.ids.admin);
    await h.db.query(`select public.cancel_stock_loan($1)`, [id]);
    expect(await onHand()).toBe(100);
    expect(await ledgerSum()).toBe(100);
    const s = await h.db.query<{ status: string }>(`select status from public.stock_loans where id = $1`, [id]);
    expect(s.rows[0].status).toBe("cancelled");
    await expect(ret(id, [{ itemId: await itemId(id), quantity: 1 }])).rejects.toThrow(/취소/);
  });

  it("다른 직원은 남의 반출 전표를 취소할 수 없다", async () => {
    const id = await loan([{ productId: product, quantity: 30 }]);
    // 다른 일반 직원
    const other = crypto.randomUUID();
    await h.db.exec(`insert into public.profiles (id, role) values ('${other}', 'staff'); insert into public.tenant_members (user_id, tenant_id) values ('${other}', '${h.ids.tenant}')`);
    await h.as(other);
    await expect(h.db.query(`select public.cancel_stock_loan($1)`, [id])).rejects.toThrow(/본인/);
    expect(await onHand()).toBe(70);
  });

  it("일부라도 반납된 전표는 취소할 수 없다(나머지를 반납 처리해야 한다)", async () => {
    const id = await loan([{ productId: product, quantity: 30 }]);
    await ret(id, [{ itemId: await itemId(id), quantity: 5 }]);
    await expect(h.db.query(`select public.cancel_stock_loan($1)`, [id])).rejects.toThrow(/일부 반납/);
    expect(await onHand()).toBe(75);
  });

  it("무작위로 반출·반납·취소를 섞어도 재고 캐시와 원장이 항상 같고, 모두 정리하면 처음 재고로 돌아온다", async () => {
    let seed = 7;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const open: string[] = [];
    for (let step = 0; step < 40; step++) {
      const pick = rnd(3);
      try {
        if (pick === 0 || open.length === 0) {
          open.push(await loan([{ productId: product, quantity: 1 + rnd(15) }]));
        } else if (pick === 1) {
          const id = open[rnd(open.length)];
          const left = (await h.db.query<{ q: string }>(`select (quantity - returned_quantity) as q from public.stock_loan_items where loan_id = $1`, [id])).rows[0].q;
          if (Number(left) > 0) await ret(id, [{ itemId: await itemId(id), quantity: 1 + rnd(Number(left)) }]);
        } else {
          await h.db.query(`select public.cancel_stock_loan($1)`, [open[rnd(open.length)]]);
        }
      } catch {
        /* 거부되는 경우(재고 부족·이미 닫힘 등)는 정상 — 불변식만 본다 */
      }
      expect(await onHand()).toBe(await ledgerSum());
      expect(await onHand()).toBeGreaterThanOrEqual(0);
    }
    // 모두 정리: 남은 수량 전부 반납
    for (const id of open) {
      const row = (await h.db.query<{ id: string; q: string; status: string }>(`select i.id, (i.quantity - i.returned_quantity) as q, l.status from public.stock_loan_items i join public.stock_loans l on l.id = i.loan_id where i.loan_id = $1`, [id])).rows[0];
      if (row.status === "open" && Number(row.q) > 0) await ret(id, [{ itemId: row.id, quantity: Number(row.q) }]);
    }
    expect(await onHand()).toBe(100);
  });
});
