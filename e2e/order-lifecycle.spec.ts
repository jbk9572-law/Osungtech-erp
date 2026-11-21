import { expect, test } from "@playwright/test";
import { createSandboxApi, kstDate, type SandboxApi } from "./support/api";
import {
  cleanupTagged, createCombo, createPurchase, createSale, deletePurchase, deleteSale, remainingOf, uniqueTag,
} from "./support/orders";

// 실제 Supabase(운영 DB의 샌드박스 회사)에서 DB 함수가 매입/매출의 생성→삭제 흐름과
// 재고(FIFO) 기록을 맞게 처리하는지 확인한다. 과거에 "동시등록 매입이 영구히 삭제
// 안 됨", "오래된 매출이 새 매입을 가로챔" 같은 사고가 있었다.
test.describe("매입/매출 생애주기 (실DB)", () => {
  let api: SandboxApi;
  const tag = uniqueTag("life");

  test.beforeAll(async () => {
    api = await createSandboxApi();
  });
  test.afterEach(async () => {
    await cleanupTagged(api, tag);
  });

  test("동시등록: 매출이 남아 있으면 매입 삭제가 막히고(막은 매출 안내), 매출을 지우면 매입도 삭제된다", async () => {
    const { purchase_order_id: p, sale_order_id: s } = await createCombo(api, {
      date: kstDate(0), memo: `${tag} 동시등록`, purchaseQty: 100, saleQty: 100,
    });
    expect(await remainingOf(api, p)).toEqual({ quantity: 100, remaining: 0 });

    const blocked = await deletePurchase(api, p);
    expect(blocked.status).toBe(400);
    expect(JSON.stringify(blocked.body)).toContain("소진 내역");

    expect((await deleteSale(api, s)).status).toBe(204);
    expect(await remainingOf(api, p)).toEqual({ quantity: 100, remaining: 100 });
    expect((await deletePurchase(api, p)).status).toBe(204);
  });

  test("드롭십: 며칠 먼저 끊은 매출은 새 매입과 자동 연결된다", async () => {
    // 재고가 없을 때 출고를 막는 것이 기본(마이그레이션 266, 회사별 allow_negative_stock=false). 이 시나리오(입고 전에 먼저 끊은 매출)는
    // 음수 재고를 허용하는 회사에서만 성립하므로, 막히는 회사에서는 건너뛴다 — 막힘 자체는 "재고가 부족합니다"로 확인한다.
    let sale: string;
    try {
      sale = await createSale(api, { date: kstDate(-2), memo: `${tag} 드롭십`, quantity: 5 });
    } catch (e) {
      const msg = String(e);
      test.skip(msg.includes("재고가 부족합니다"), "이 샌드박스 회사는 음수 재고 금지(266) — 드롭십은 allow_negative_stock 회사에서만 성립");
      throw e;
    }
    const purchase = await createPurchase(api, { date: kstDate(0), memo: `${tag} 드롭십`, quantity: 20 });
    const lot = await remainingOf(api, purchase);
    expect(lot.remaining).toBe(15); // 20 - 5
    await deleteSale(api, sale);
    expect((await remainingOf(api, purchase)).remaining).toBe(20);
  });
});
