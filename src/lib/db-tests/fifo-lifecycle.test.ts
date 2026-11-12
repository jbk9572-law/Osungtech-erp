import { beforeEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./pg-harness";

// 매입/매출의 "만들기 → 수정 → 삭제" 전체 생애주기와 FIFO 재고(남은수량)가
// 서로 어긋나지 않는지 운영과 같은 SQL 함수로 검증한다. 어긋나면 매입이
// 영구히 삭제/수정 안 되거나 재고가 틀어진다(실제로 "동시등록 매입 삭제 불가"
// 사고가 있었다). 새 DB 함수를 만들거나 고칠 때 같은 패턴의 테스트를 추가한다.

let h: Harness;
let product: string;

beforeEach(async () => {
  h = await createHarness();
  product = await h.makeProduct({ name: "모조지", cost: 100 });
}, 60000);

async function createPurchase(quantity: number, unitCost = 150): Promise<string> {
  const r = await h.db.query<{ id: string }>(
    `select public.create_purchase_with_items(
       p_supplier_id => $1, p_warehouse_id => $2, p_purchase_date => $3, p_memo => null,
       p_created_by => $4, p_items => $5::jsonb) as id`,
    [h.ids.supplier, h.ids.warehouse, "2026-11-10", h.ids.staff,
      JSON.stringify([{ productId: product, quantity, unitCost }])],
  );
  return r.rows[0].id;
}

async function createSale(quantity: number): Promise<string> {
  const r = await h.db.query<{ id: string }>(
    `select public.create_sale_with_items(
       p_customer_id => $1, p_warehouse_id => $2, p_order_date => $3, p_memo => null,
       p_created_by => $4, p_items => $5::jsonb) as id`,
    [h.ids.customer, h.ids.warehouse, "2026-11-11", h.ids.staff,
      JSON.stringify([{ productId: product, quantity, unitPrice: 300 }])],
  );
  return r.rows[0].id;
}

async function updateSale(id: string, quantity: number) {
  await h.db.query(
    `select public.update_sale_with_items(
       p_id => $1, p_customer_id => $2, p_warehouse_id => $3, p_order_date => $4, p_memo => null,
       p_updated_by => $5, p_items => $6::jsonb)`,
    [id, h.ids.customer, h.ids.warehouse, "2026-11-11", h.ids.staff,
      JSON.stringify([{ productId: product, quantity, unitPrice: 300 }])],
  );
}

const deleteSale = (id: string) =>
  h.db.query(`select public.delete_sale_with_items($1, $2)`, [id, h.ids.staff]);
const deletePurchase = (id: string) =>
  h.db.query(`select public.delete_purchase_with_items($1, $2)`, [id, h.ids.staff]);

async function remaining(purchaseId: string): Promise<number> {
  const r = await h.db.query<{ remaining_quantity: string }>(
    `select remaining_quantity from public.purchase_order_items where purchase_order_id = $1`,
    [purchaseId],
  );
  return Number(r.rows[0].remaining_quantity);
}

async function consumptionCount(): Promise<number> {
  const r = await h.db.query<{ n: string }>(`select count(*)::text as n from public.fifo_consumptions`);
  return Number(r.rows[0].n);
}

describe("일반 매입 → 매출 → 삭제", () => {
  it("매출이 매입 재고를 차감하고, 매출을 지우면 그대로 복원된다", async () => {
    const purchase = await createPurchase(100);
    expect(await remaining(purchase)).toBe(100);
    const sale = await createSale(30);
    expect(await remaining(purchase)).toBe(70);
    await deleteSale(sale);
    expect(await remaining(purchase)).toBe(100);
    expect(await consumptionCount()).toBe(0);
  });

  it("연결된 매출을 지운 뒤에는 매입도 삭제된다", async () => {
    const purchase = await createPurchase(100);
    const sale = await createSale(30);
    await deleteSale(sale);
    await deletePurchase(purchase);
    const r = await h.db.query(`select 1 from public.purchase_orders where id = $1`, [purchase]);
    expect(r.rows).toHaveLength(0);
  });

  it("매출이 소진 중인 매입은 삭제가 막히고, 막은 매출이 메시지에 나온다", async () => {
    const purchase = await createPurchase(100);
    await createSale(30);
    await expect(deletePurchase(purchase)).rejects.toThrow(/소진 내역: 매출 .*30/);
    expect(await remaining(purchase)).toBe(70);
  });

  it("매출 수량을 수정하면 남은수량이 새 수량 기준으로 다시 맞춰진다", async () => {
    const purchase = await createPurchase(100);
    const sale = await createSale(30);
    await updateSale(sale, 50);
    expect(await remaining(purchase)).toBe(50);
    await updateSale(sale, 10);
    expect(await remaining(purchase)).toBe(90);
    expect(await consumptionCount()).toBe(1);
  });
});

describe("매입+매출 동시등록 (create_purchase_and_sale_with_items)", () => {
  async function createCombo(purchaseQty: number, saleQty: number) {
    const r = await h.db.query<{ purchase_order_id: string; sale_order_id: string }>(
      `select * from public.create_purchase_and_sale_with_items(
         p_supplier_id => $1, p_customer_id => $2, p_warehouse_id => $3,
         p_purchase_date => $4, p_sale_date => $4, p_purchase_memo => null, p_sale_memo => null,
         p_created_by => $5, p_purchase_items => $6::jsonb, p_sale_items => $7::jsonb)`,
      [h.ids.supplier, h.ids.customer, h.ids.warehouse, "2026-11-12", h.ids.staff,
        JSON.stringify([{ productId: product, quantity: purchaseQty, unitCost: 150 }]),
        JSON.stringify([{ productId: product, quantity: saleQty, unitPrice: 300 }])],
    );
    return r.rows[0];
  }

  it("매입 로트가 가득 채워지고 매출 수량만큼 차감 기록이 남는다", async () => {
    const { purchase_order_id } = await createCombo(100, 60);
    expect(await remaining(purchase_order_id)).toBe(40);
    expect(await consumptionCount()).toBe(1);
  });

  it("매출을 지우면 매입도 삭제할 수 있다 (과거 사고 재발 방지)", async () => {
    const { purchase_order_id, sale_order_id } = await createCombo(100, 100);
    await expect(deletePurchase(purchase_order_id)).rejects.toThrow(/소진/);
    await deleteSale(sale_order_id);
    expect(await remaining(purchase_order_id)).toBe(100);
    await deletePurchase(purchase_order_id);
  });

  it("출고 수량이 매입 수량보다 크면 등록 자체가 거부된다", async () => {
    await expect(createCombo(10, 11)).rejects.toThrow(/출고 수량이 매입 수량보다/);
  });
});

describe("과거 사고로 남은 '기록 없이 남은수량만 줄어든' 매입 (migration 229)", () => {
  async function createOrphan() {
    const purchase = await createPurchase(100);
    // 228 이전 동시등록 매입처럼 남은수량만 0이고 소진 기록은 없는 상태를 재현한다.
    await h.db.query(
      `update public.purchase_order_items set remaining_quantity = 0 where purchase_order_id = $1`,
      [purchase],
    );
    return purchase;
  }

  it("소진 기록이 없으면 삭제할 수 있다", async () => {
    const purchase = await createOrphan();
    await deletePurchase(purchase);
    const r = await h.db.query(`select 1 from public.purchase_orders where id = $1`, [purchase]);
    expect(r.rows).toHaveLength(0);
  });

  it("소진 기록이 없으면 수정할 수 있다", async () => {
    const purchase = await createOrphan();
    await h.db.query(
      `select public.update_purchase_with_items(
         p_id => $1, p_supplier_id => $2, p_warehouse_id => $3, p_purchase_date => $4,
         p_memo => null, p_updated_by => $5, p_items => $6::jsonb)`,
      [purchase, h.ids.supplier, h.ids.warehouse, "2026-11-10", h.ids.staff,
        JSON.stringify([{ productId: product, quantity: 80, unitCost: 150 }])],
    );
    expect(await remaining(purchase)).toBe(80);
  });
});

describe("권한 / 마감일", () => {
  it("남이 등록한 매입은 일반 직원이 삭제할 수 없고 관리자는 할 수 있다", async () => {
    const purchase = await createPurchase(10);
    const otherStaff = crypto.randomUUID();
    await h.db.exec(`
      insert into public.profiles (id, role) values ('${otherStaff}', 'staff');
      insert into public.tenant_members (user_id, tenant_id) values ('${otherStaff}', '${h.ids.tenant}');`);
    await h.as(otherStaff);
    await expect(deletePurchase(purchase)).rejects.toThrow(/본인이 등록한 매입만/);
    await h.as(h.ids.admin);
    await deletePurchase(purchase);
  });

  it("마감일 이전 거래는 일반 직원이 삭제할 수 없고 관리자는 할 수 있다", async () => {
    const purchase = await createPurchase(10); // 2026-11-10
    await h.db.exec(`update public.tenants set closing_date = '2026-11-30'`);
    await expect(deletePurchase(purchase)).rejects.toThrow(/마감일/);
    await h.as(h.ids.admin);
    await deletePurchase(purchase);
  });

  it("로그인하지 않은 요청은 거부된다", async () => {
    await h.db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
    await expect(deletePurchase(crypto.randomUUID())).rejects.toThrow(/인증되지 않은/);
  });
});
