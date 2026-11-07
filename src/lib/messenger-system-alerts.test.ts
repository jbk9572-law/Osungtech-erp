import { describe, expect, it } from "vitest";
import { findOverdueCustomers } from "./messenger-system-alerts";
import { toKstDateStr } from "./kst-date";
import type { createAdminClient } from "./supabase/admin";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toKstDateStr(d);
}

// findOverdueCustomers는 admin 클라이언트의 .from(table).select(...)...range(from,to)
// 체인만 쓴다(실제 테이블은 sales_orders/customer_payments/customers 셋뿐) —
// 그 모양만 흉내내는 최소 가짜 클라이언트로 충분하다. 실제 쿼리 빌더처럼
// .is()/.select()가 전부 체이닝 가능해야 하고, 마지막 .range()만 Promise를
// 반환한다.
function fakeAdmin(tables: Record<string, unknown[]>): ReturnType<typeof createAdminClient> {
  function builder(rows: unknown[]) {
    const self = {
      is: () => self,
      select: () => self,
      range: (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
    };
    return self;
  }
  return {
    from: (table: string) => builder(tables[table] ?? []),
  } as unknown as ReturnType<typeof createAdminClient>;
}

describe("findOverdueCustomers", () => {
  it("30일 이상 연체된 미수금이 있는 거래처만 골라낸다", async () => {
    const admin = fakeAdmin({
      sales_orders: [
        {
          customer_id: "c1",
          order_date: daysAgo(40),
          is_return: false,
          sales_order_items: [{ quantity: 2, unit_price: 10000 }],
        },
      ],
      customer_payments: [],
      customers: [{ id: "c1", name: "연체거래처", tenant_id: "t1", is_demo: false }],
    });

    const result = await findOverdueCustomers(admin);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "c1", name: "연체거래처", balance: 20000 });
    expect(result[0].daysOverdue).toBeGreaterThanOrEqual(40);
  });

  it("연체일수가 기준(30일) 미만이면 포함하지 않는다", async () => {
    const admin = fakeAdmin({
      sales_orders: [
        {
          customer_id: "c1",
          order_date: daysAgo(10),
          is_return: false,
          sales_order_items: [{ quantity: 1, unit_price: 50000 }],
        },
      ],
      customer_payments: [],
      customers: [{ id: "c1", name: "최근거래처", tenant_id: "t1", is_demo: false }],
    });

    expect(await findOverdueCustomers(admin)).toHaveLength(0);
  });

  it("수금이 완료되어 잔액이 0 이하면 포함하지 않는다", async () => {
    const admin = fakeAdmin({
      sales_orders: [
        {
          customer_id: "c1",
          order_date: daysAgo(40),
          is_return: false,
          sales_order_items: [{ quantity: 1, unit_price: 30000 }],
        },
      ],
      customer_payments: [{ customer_id: "c1", paid_at: daysAgo(35), amount: 30000 }],
      customers: [{ id: "c1", name: "완납거래처", tenant_id: "t1", is_demo: false }],
    });

    expect(await findOverdueCustomers(admin)).toHaveLength(0);
  });

  it("반품(is_return)은 미수금에서 차감되어 오래된 미결제 전표를 되돌린다", async () => {
    const admin = fakeAdmin({
      sales_orders: [
        {
          customer_id: "c1",
          order_date: daysAgo(40),
          is_return: false,
          sales_order_items: [{ quantity: 1, unit_price: 20000 }],
        },
        {
          customer_id: "c1",
          order_date: daysAgo(5),
          is_return: true,
          sales_order_items: [{ quantity: 1, unit_price: 20000 }],
        },
      ],
      customer_payments: [],
      customers: [{ id: "c1", name: "반품거래처", tenant_id: "t1", is_demo: false }],
    });

    // 40일 전 매출 20,000원을 5일 전 반품 20,000원이 전액 상계 —
    // 남은 미수금이 없으므로 연체 알림 대상이 아니다.
    expect(await findOverdueCustomers(admin)).toHaveLength(0);
  });
});
