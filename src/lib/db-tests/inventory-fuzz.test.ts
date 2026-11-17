import { describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./pg-harness";

// 사람이 떠올린 시나리오만 시험하면 "예상 못 한 순서"의 구멍을 놓친다(동시등록 매입 삭제 불가, 불러오기 이중 사용 등이 그렇게 뒤늦게 나왔다).
// 이 테스트는 매입·매출을 무작위 순서로 만들고 고치고 지우면서, 어떤 순서에서도 깨지면 안 되는 "불변 규칙"을 매 단계마다 검사한다.
// 같은 시드(seed)는 항상 같은 순서를 만들어 실패를 그대로 재현할 수 있다 — 실패 메시지에 시드와 작업 기록이 같이 나온다.
//
// 불변 규칙:
//  R1 매입 품목의 남은 수량은 0 이상 입고 수량 이하이고, "입고 수량 − 소진 기록 합"과 같다
//  R2 매출 품목 하나의 소진 기록 합은 그 매출 수량을 넘지 않는다
//  R3 재고 이력(inventory_transactions) 순재고(입고 − 출고 + 되돌림) = 매입 수량 합 − 매출 수량 합
//  R4 실패한 작업(삭제 불가, 수정 불가 등)은 아무것도 바꾸지 않는다(문서 수가 그대로)
//  R5 모든 문서를 지우면 품목·소진 기록은 0행으로, 재고 이력(장부)은 순합계 0으로 돌아온다

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Doc = { id: string; qty: number };

// 업종마다 데이터 모양이 다르다 — 한 업종(종이 제조·유통)만 시험하면 그 업종의 가정이 DB 함수에 박혀도 모른다.
//  기본: 정수 수량, 모두 품목 있는 줄
//  식품·kg: 소수 수량(0.25 단위)과 소수 단가 — 반올림·부동소수 오차가 재고를 어긋나게 하지 않는지
//  서비스 혼합: 품목 없이 이름만 적는 줄(컨설팅·배송비 등)이 매출에 섞임 — 재고와 무관한 줄이 재고 계산을 건드리지 않는지
//  소매: 반품이 잦음 — 반품이 재고 이력과 맞는지
type Profile = { name: string; decimal: boolean; customLines: boolean; returns: boolean };
const PROFILES: Profile[] = [
  { name: "기본(정수 수량)", decimal: false, customLines: false, returns: false },
  { name: "식품·kg(소수 수량·단가)", decimal: true, customLines: false, returns: false },
  { name: "서비스 혼합(품목 없는 줄)", decimal: false, customLines: true, returns: false },
  { name: "소매(반품 잦음)", decimal: false, customLines: false, returns: true },
  { name: "전부 섞기", decimal: true, customLines: true, returns: true },
];

async function run(seed: number, steps: number, profile: Profile) {
  const h: Harness = await createHarness();
  const products = [await h.makeProduct({ name: "모조지", cost: 100 }), await h.makeProduct({ name: "골판지", cost: 60 })];
  const rand = rng(seed);
  const pick = (n: number) => Math.floor(rand() * n);
  const log: string[] = [];
  const purchases: Doc[] = [];
  const sales: Doc[] = [];
  // 한 전표에 1~3개 줄, 품목은 두 개 중 무작위(같은 품목이 두 줄에 나올 수도 있다)
  const qtyOf = (maxQty: number) => (profile.decimal ? (1 + pick(maxQty * 4)) / 4 : 1 + pick(maxQty));
  const items = (maxQty: number, price: Record<string, number>, sale = false) => {
    const lines = Array.from({ length: 1 + pick(3) }, () => {
      const quantity = qtyOf(maxQty);
      const unit = profile.decimal ? { ...price, ...Object.fromEntries(Object.entries(price).map(([k, v]) => [k, v + pick(100) / 100])) } : price;
      // 서비스 혼합: 매출 줄 일부는 품목 없이 이름만(재고와 무관)
      if (sale && profile.customLines && rand() < 0.35) return { customName: "컨설팅 용역", quantity, ...unit };
      return { productId: products[pick(products.length)], quantity, ...unit };
    });
    return { lines, total: lines.reduce((a, l) => a + l.quantity, 0) };
  };
  const day = () => `2026-11-${String(1 + pick(10)).padStart(2, "0")}`;
  const q = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => (await h.db.query<T>(sql, params)).rows;

  const fail = (msg: string) => {
    throw new Error(`${msg}\n  seed=${seed}\n  최근 작업:\n    ${log.slice(-12).join("\n    ")}`);
  };

  async function checkInvariants(after: string) {
    // R1
    const items = await q<{ quantity: string; remaining_quantity: string; consumed: string }>(
      `select poi.quantity, poi.remaining_quantity,
              coalesce((select sum(consumed_quantity) from public.fifo_consumptions fc where fc.purchase_order_item_id = poi.id), 0) as consumed
       from public.purchase_order_items poi`);
    for (const i of items) {
      const quantity = Number(i.quantity), remaining = Number(i.remaining_quantity), consumed = Number(i.consumed);
      if (remaining < 0 || remaining > quantity) fail(`R1 남은 수량 범위 위반(${after}): remaining=${remaining}, quantity=${quantity}`);
      if (Math.abs(quantity - consumed - remaining) > 1e-6) fail(`R1 남은 수량 불일치(${after}): quantity=${quantity}, consumed=${consumed}, remaining=${remaining}`);
    }
    // R2
    const over = await q<{ id: string; quantity: string; consumed: string }>(
      `select soi.id, soi.quantity,
              coalesce((select sum(consumed_quantity) from public.fifo_consumptions fc where fc.sales_order_item_id = soi.id), 0) as consumed
       from public.sales_order_items soi`);
    for (const s of over) if (Number(s.consumed) > Number(s.quantity) + 1e-6) fail(`R2 소진 합이 매출 수량 초과(${after}): sale item ${s.id}`);
    // R3 재고 이력은 장부식이다: 입고(+) 출고(−) 그리고 수정·삭제 때 남기는 되돌림(adjustment, 부호 있는 값)을 모두 합친 순재고가
    // "매입 수량 합 − 매출 수량 합 + 반품 수량 합"과 같아야 한다(품목 없는 줄은 재고와 무관해서 제외).
    const [net] = await q<{ n: string | null }>(
      `select sum(case type when 'in' then quantity when 'out' then -quantity else quantity end) as n from public.inventory_transactions`);
    const poiTotal = Number((await q<{ s: string | null }>(`select sum(quantity) as s from public.purchase_order_items where product_id is not null`))[0].s ?? 0);
    const soiTotal = Number((await q<{ s: string | null }>(
      `select sum(case when so.is_return then -s.quantity else s.quantity end) as s from public.sales_order_items s join public.sales_orders so on so.id = s.sales_order_id where s.product_id is not null`))[0].s ?? 0);
    if (Math.abs(Number(net.n ?? 0) - (poiTotal - soiTotal)) > 1e-6) fail(`R3 순재고 이력(${net.n ?? 0}) ≠ 매입 합(${poiTotal}) − 매출 순합(${soiTotal}) (${after})`);
  }

  async function counts() {
    const [p] = await q<{ n: string }>(`select count(*) as n from public.purchase_orders`);
    const [s] = await q<{ n: string }>(`select count(*) as n from public.sales_orders`);
    return { p: Number(p.n), s: Number(s.n) };
  }

  const ops: Record<string, () => Promise<void>> = {
    async createPurchase() {
      const { lines, total: qty } = items(100, { unitCost: 100 + pick(100) });
      const d = day();
      const r = await q<{ id: string }>(
        `select public.create_purchase_with_items(p_supplier_id => $1, p_warehouse_id => $2, p_purchase_date => $3, p_memo => null, p_created_by => $4, p_items => $5::jsonb) as id`,
        [h.ids.supplier, h.ids.warehouse, d, h.ids.staff, JSON.stringify(lines)]);
      purchases.push({ id: r[0].id, qty });
      log.push(`매입 등록 ${qty}개 ${d}`);
    },
    async createSale() {
      const { lines, total: qty } = items(80, { unitPrice: 300 }, true);
      const d = day();
      const r = await q<{ id: string }>(
        `select public.create_sale_with_items(p_customer_id => $1, p_warehouse_id => $2, p_order_date => $3, p_memo => null, p_created_by => $4, p_items => $5::jsonb) as id`,
        [h.ids.customer, h.ids.warehouse, d, h.ids.staff, JSON.stringify(lines)]);
      sales.push({ id: r[0].id, qty });
      log.push(`매출 등록 ${qty}개 ${d}`);
    },
    async createReturn() {
      const { lines, total: qty } = items(20, { unitPrice: 300 });
      const d = day();
      const r = await q<{ id: string }>(
        `select public.create_sale_with_items(p_customer_id => $1, p_warehouse_id => $2, p_order_date => $3, p_memo => null, p_created_by => $4, p_items => $5::jsonb, p_is_return => true) as id`,
        [h.ids.customer, h.ids.warehouse, d, h.ids.staff, JSON.stringify(lines)]);
      sales.push({ id: r[0].id, qty });
      log.push(`반품 등록 ${qty}개 ${d}`);
    },
    async updateSale() {
      if (!sales.length) return;
      const s = sales[pick(sales.length)];
      const { lines, total: qty } = items(80, { unitPrice: 300 }, true);
      await q(
        `select public.update_sale_with_items(p_id => $1, p_customer_id => $2, p_warehouse_id => $3, p_order_date => $4, p_memo => null, p_updated_by => $5, p_items => $6::jsonb)`,
        [s.id, h.ids.customer, h.ids.warehouse, day(), h.ids.staff, JSON.stringify(lines)]);
      s.qty = qty;
      log.push(`매출 수정 → ${qty}개`);
    },
    async updatePurchase() {
      if (!purchases.length) return;
      const p = purchases[pick(purchases.length)];
      const { lines, total: qty } = items(100, { unitCost: 150 });
      await q(
        `select public.update_purchase_with_items(p_id => $1, p_supplier_id => $2, p_warehouse_id => $3, p_purchase_date => $4, p_memo => null, p_updated_by => $5, p_items => $6::jsonb)`,
        [p.id, h.ids.supplier, h.ids.warehouse, day(), h.ids.staff, JSON.stringify(lines)]);
      p.qty = qty;
      log.push(`매입 수정 → ${qty}개`);
    },
    async deleteSale() {
      if (!sales.length) return;
      const i = pick(sales.length);
      await q(`select public.delete_sale_with_items($1, $2)`, [sales[i].id, h.ids.staff]);
      log.push(`매출 삭제 ${sales[i].qty}개`);
      sales.splice(i, 1);
    },
    async deletePurchase() {
      if (!purchases.length) return;
      const i = pick(purchases.length);
      await q(`select public.delete_purchase_with_items($1, $2)`, [purchases[i].id, h.ids.staff]);
      log.push(`매입 삭제 ${purchases[i].qty}개`);
      purchases.splice(i, 1);
    },
  };
  const names = ["createPurchase", "createPurchase", "createSale", "createSale", "updateSale", "updatePurchase", "deleteSale", "deletePurchase", ...(profile.returns ? ["createReturn", "createReturn"] : [])];

  let rejected = 0;
  for (let step = 0; step < steps; step++) {
    const name = names[pick(names.length)];
    const before = await counts();
    try {
      await ops[name]();
    } catch (e) {
      // 업무 규칙상 거절되는 작업(소진된 매입 삭제/수정 등)은 정상 — 단, 아무것도 바꾸면 안 된다(R4).
      rejected++;
      log.push(`${name} 거절: ${(e as Error).message.slice(0, 60)}`);
      const after = await counts();
      if (after.p !== before.p || after.s !== before.s) fail(`R4 거절된 작업이 문서 수를 바꿈(${name}): ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    }
    await checkInvariants(`${step + 1}번째 ${name}`);
  }

  // 이 시드가 업종 특성을 실제로 만들어 냈는지(안 만들었으면 시험이 헛돈 것이다)
  const [ex] = await q<{ custom: string; returns: string; decimals: string }>(
    `select (select count(*) from public.sales_order_items where product_id is null) as custom,
            (select count(*) from public.sales_orders where is_return) as returns,
            (select count(*) from public.purchase_order_items where quantity <> trunc(quantity)) as decimals`);
  const exercised = { custom: Number(ex.custom), returns: Number(ex.returns), decimals: Number(ex.decimals) };

  // R5: 모두 지우면 0으로 돌아와야 한다(매출 먼저, 그다음 매입)
  for (const s of [...sales]) await q(`select public.delete_sale_with_items($1, $2)`, [s.id, h.ids.staff]);
  for (const p of [...purchases]) await q(`select public.delete_purchase_with_items($1, $2)`, [p.id, h.ids.staff]);
  await checkInvariants("전부 삭제 후");
  for (const table of ["purchase_order_items", "sales_order_items", "fifo_consumptions", "purchase_orders", "sales_orders"]) {
    const [row] = await q<{ n: string }>(`select count(*) as n from public.${table}`);
    if (Number(row.n) !== 0) fail(`R5 전부 삭제 후 ${table}에 ${row.n}행이 남음`);
  }
  // 재고 이력은 장부라 행은 남지만(되돌림 줄), 순재고는 0이어야 한다.
  const [net] = await q<{ n: string | null }>(
    `select sum(case type when 'in' then quantity when 'out' then -quantity else quantity end) as n from public.inventory_transactions`);
  if (Number(net.n ?? 0) !== 0) fail(`R5 전부 삭제 후 순재고 이력이 0이 아님: ${net.n}`);
  return { rejected, exercised };
}

describe("재고·입출고 무작위 순서 검증(불변 규칙)", () => {
  for (const profile of PROFILES) {
    for (const seed of profile.name === "기본(정수 수량)" ? [1, 7, 42, 2026, 31337, 99, 123, 555] : [3, 11, 77]) {
      it(`[${profile.name}] 시드 ${seed}: 80번 무작위 작업 뒤에도 불변 규칙이 유지된다`, async () => {
        const r = await run(seed, 80, profile);
        if (profile.customLines) expect(r.exercised.custom, "품목 없는 줄이 만들어지지 않음").toBeGreaterThan(0);
        if (profile.returns) expect(r.exercised.returns, "반품이 만들어지지 않음").toBeGreaterThan(0);
        if (profile.decimal) expect(r.exercised.decimals, "소수 수량이 만들어지지 않음").toBeGreaterThan(0);
      }, 180000);
    }
  }
});
