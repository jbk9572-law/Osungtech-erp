import { createClient } from "@/lib/supabase/server";
import { todayKstStr } from "@/lib/kst-date";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 외상잔액(미수금/미지급금)은 별도로 저장해두지 않고, 그때그때
// (매출·매입 누계) - (수금·지급 누계)로 계산한다 — 매출/매입 데이터가
// 나중에 수정/삭제돼도 잔액이 따로 안 맞는 문제가 없다.

export type UnpaidOrder = {
  id: string;
  date: string;
  docNo?: number;
  total: number;
  outstanding: number;
  daysOverdue: number;
};

// "YYYY-MM-DD" 문자열끼리는 Date.parse가 둘 다 UTC 자정으로 해석해서
// 빼주므로, 서버 타임존과 무관하게 정확한 일수 차이가 나온다.
export function daysSince(dateStr: string, today: string = todayKstStr()): number {
  const ms = Date.parse(today) - Date.parse(dateStr);
  return Math.max(0, Math.round(ms / 86400000));
}

export async function getCustomerBalance(supabase: SupabaseServerClient, customerId: string) {
  const [{ data: orders }, { data: payments }] = await Promise.all([
    supabase
      .from("sales_orders")
      .select("id, doc_no, order_date, payment_method, is_return, sales_order_items(quantity, unit_price)")
      .eq("customer_id", customerId)
      .order("order_date", { ascending: true }),
    supabase.from("customer_payments").select("id, paid_at, amount, method, memo").eq("customer_id", customerId).order("paid_at", { ascending: false }),
  ]);
  // 결제방법을 "항상 외상" 대신 현금/계좌이체 등으로 등록한 주문은 그
  // 자리에서 결제가 끝난 거래이므로 미수금 계산에서 아예 뺀다. 반품은
  // 미수금을 그만큼 깎아주는 것이므로 금액을 음수로 뒤집어서 더한다 —
  // consumeOldestFirst의 FIFO 소진 로직이 그대로 "추가 상계분"으로
  // 처리해준다(음수 total은 항상 pool보다 작아서 즉시 상계됨).
  const creditOrders = (orders ?? [])
    .filter((o) => !o.payment_method)
    .map((o) => ({
      id: o.id,
      docNo: o.doc_no,
      date: o.order_date,
      total:
        (o.sales_order_items ?? []).reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0) *
        (o.is_return ? -1 : 1),
    }));

  const totalSales = creditOrders.reduce((sum, o) => sum + o.total, 0);
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  // 반품(음수 total)을 그대로 날짜순 목록에 섞어서 훑으면, 반품이 원본
  // 매출보다 나중 날짜일 때(가장 흔한 경우) 이미 "미결제"로 확정해버린
  // 더 이전 전표의 미수금을 되돌리지 못한다 — pool은 그 시점 이후로만
  // 적용되기 때문이다. 그래서 반품 금액은 처음부터 결제 풀에 합쳐 넣고,
  // FIFO 소진 자체는 실제 매출 전표(양수)에만 적용한다 — balance(총
  // 잔액)는 어차피 totalSales에 이미 반품이 반영돼 있어 그대로 정확하고,
  // "미결제 전표" 목록도 그 총 잔액과 일치하게 된다.
  const totalReturns = creditOrders
    .filter((o) => o.total < 0)
    .reduce((sum, o) => sum - o.total, 0);
  const positiveOrders = creditOrders.filter((o) => o.total > 0);
  const unpaidOrders = consumeOldestFirst(positiveOrders, totalPaid + totalReturns);

  return { totalSales, totalPaid, balance: totalSales - totalPaid, payments: payments ?? [], unpaidOrders };
}

export async function getSupplierBalance(supabase: SupabaseServerClient, supplierId: string) {
  const [{ data: orders }, { data: payments }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id, doc_no, purchase_date, payment_method, purchase_order_items(quantity, unit_cost)")
      .eq("supplier_id", supplierId)
      .order("purchase_date", { ascending: true }),
    supabase.from("supplier_payments").select("id, paid_at, amount, method, memo").eq("supplier_id", supplierId).order("paid_at", { ascending: false }),
  ]);
  const creditOrders = (orders ?? [])
    .filter((o) => !o.payment_method)
    .map((o) => ({
      id: o.id,
      docNo: o.doc_no,
      date: o.purchase_date,
      total: (o.purchase_order_items ?? []).reduce((sum, i) => sum + i.quantity * Number(i.unit_cost), 0),
    }));

  const totalPurchases = creditOrders.reduce((sum, o) => sum + o.total, 0);
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const unpaidOrders = consumeOldestFirst(creditOrders, totalPaid);

  return { totalPurchases, totalPaid, balance: totalPurchases - totalPaid, payments: payments ?? [], unpaidOrders };
}

// 전표별로 얼마가 남았는지는 따로 저장하지 않으므로, 수금/지급 총액을
// 오래된 전표(이미 date 오름차순으로 정렬된 상태)부터 순서대로 상계해서
// 계산한다 — 실제로 어느 수금이 어느 전표를 갚았는지 지정하지 않고,
// "먼저 나간 것부터 먼저 받은 걸로 친다"는 가장 단순한 가정(선입선출)이다.
export function consumeOldestFirst<T extends { total: number; date: string }>(
  orders: T[],
  totalPaid: number,
  today: string = todayKstStr()
): (T & { outstanding: number; daysOverdue: number })[] {
  let pool = totalPaid;
  const unpaid: (T & { outstanding: number; daysOverdue: number })[] = [];
  for (const order of orders) {
    if (pool >= order.total) {
      pool -= order.total;
    } else {
      unpaid.push({ ...order, outstanding: order.total - pool, daysOverdue: daysSince(order.date, today) });
      pool = 0;
    }
  }
  return unpaid;
}

export type PartyBalance = { id: string; name: string; total: number; paid: number; balance: number };

// 미수금현황 목록용 — 거래처마다 따로 조회하면 거래처 수만큼 왕복이
// 생기므로, 전체 매출/전체 수금을 한 번씩만 불러와 메모리에서 거래처별로
// 합산한다.
export async function getAllCustomerBalances(supabase: SupabaseServerClient): Promise<PartyBalance[]> {
  const [{ data: customers }, { data: items }, { data: payments }] = await Promise.all([
    supabase.from("customers").select("id, name").order("name"),
    supabase
      .from("sales_order_items")
      .select("quantity, unit_price, sales_orders!inner(customer_id, payment_method, is_return)"),
    supabase.from("customer_payments").select("customer_id, amount"),
  ]);

  const salesByCustomer: Record<string, number> = {};
  for (const item of items ?? []) {
    if (item.sales_orders.payment_method) continue;
    const cid = item.sales_orders.customer_id;
    const amount = item.quantity * Number(item.unit_price) * (item.sales_orders.is_return ? -1 : 1);
    salesByCustomer[cid] = (salesByCustomer[cid] ?? 0) + amount;
  }
  const paidByCustomer: Record<string, number> = {};
  for (const p of payments ?? []) {
    paidByCustomer[p.customer_id] = (paidByCustomer[p.customer_id] ?? 0) + Number(p.amount);
  }

  return (customers ?? []).map((c) => {
    const total = salesByCustomer[c.id] ?? 0;
    const paid = paidByCustomer[c.id] ?? 0;
    return { id: c.id, name: c.name, total, paid, balance: total - paid };
  });
}

export async function getAllSupplierBalances(supabase: SupabaseServerClient): Promise<PartyBalance[]> {
  const [{ data: suppliers }, { data: items }, { data: payments }] = await Promise.all([
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("purchase_order_items").select("quantity, unit_cost, purchase_orders!inner(supplier_id, payment_method)"),
    supabase.from("supplier_payments").select("supplier_id, amount"),
  ]);

  const purchasesBySupplier: Record<string, number> = {};
  for (const item of items ?? []) {
    if (item.purchase_orders.payment_method) continue;
    const sid = item.purchase_orders.supplier_id;
    purchasesBySupplier[sid] = (purchasesBySupplier[sid] ?? 0) + item.quantity * Number(item.unit_cost);
  }
  const paidBySupplier: Record<string, number> = {};
  for (const p of payments ?? []) {
    paidBySupplier[p.supplier_id] = (paidBySupplier[p.supplier_id] ?? 0) + Number(p.amount);
  }

  return (suppliers ?? []).map((s) => {
    const total = purchasesBySupplier[s.id] ?? 0;
    const paid = paidBySupplier[s.id] ?? 0;
    return { id: s.id, name: s.name, total, paid, balance: total - paid };
  });
}
