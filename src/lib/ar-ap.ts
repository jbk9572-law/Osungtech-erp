import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 외상잔액(미수금/미지급금)은 별도로 저장해두지 않고, 그때그때
// (매출·매입 누계) - (수금·지급 누계)로 계산한다 — 매출/매입 데이터가
// 나중에 수정/삭제돼도 잔액이 따로 안 맞는 문제가 없다.

export async function getCustomerBalance(supabase: SupabaseServerClient, customerId: string) {
  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase
      .from("sales_order_items")
      .select("quantity, unit_price, sales_orders!inner(customer_id)")
      .eq("sales_orders.customer_id", customerId),
    supabase.from("customer_payments").select("id, paid_at, amount, method, memo").eq("customer_id", customerId).order("paid_at", { ascending: false }),
  ]);
  const totalSales = (items ?? []).reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0);
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  return { totalSales, totalPaid, balance: totalSales - totalPaid, payments: payments ?? [] };
}

export async function getSupplierBalance(supabase: SupabaseServerClient, supplierId: string) {
  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase
      .from("purchase_order_items")
      .select("quantity, unit_cost, purchase_orders!inner(supplier_id)")
      .eq("purchase_orders.supplier_id", supplierId),
    supabase.from("supplier_payments").select("id, paid_at, amount, method, memo").eq("supplier_id", supplierId).order("paid_at", { ascending: false }),
  ]);
  const totalPurchases = (items ?? []).reduce((sum, i) => sum + i.quantity * Number(i.unit_cost), 0);
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  return { totalPurchases, totalPaid, balance: totalPurchases - totalPaid, payments: payments ?? [] };
}

export type PartyBalance = { id: string; name: string; total: number; paid: number; balance: number };

// 미수금현황 목록용 — 거래처마다 따로 조회하면 거래처 수만큼 왕복이
// 생기므로, 전체 매출/전체 수금을 한 번씩만 불러와 메모리에서 거래처별로
// 합산한다.
export async function getAllCustomerBalances(supabase: SupabaseServerClient): Promise<PartyBalance[]> {
  const [{ data: customers }, { data: items }, { data: payments }] = await Promise.all([
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("sales_order_items").select("quantity, unit_price, sales_orders!inner(customer_id)"),
    supabase.from("customer_payments").select("customer_id, amount"),
  ]);

  const salesByCustomer: Record<string, number> = {};
  for (const item of items ?? []) {
    const cid = item.sales_orders.customer_id;
    salesByCustomer[cid] = (salesByCustomer[cid] ?? 0) + item.quantity * Number(item.unit_price);
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
    supabase.from("purchase_order_items").select("quantity, unit_cost, purchase_orders!inner(supplier_id)"),
    supabase.from("supplier_payments").select("supplier_id, amount"),
  ]);

  const purchasesBySupplier: Record<string, number> = {};
  for (const item of items ?? []) {
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
