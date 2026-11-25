"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import type { QuickSaleData } from "@/components/unified-sale-modal";

// "⚡ 빠른등록" 모달이 쓰는 거래처/품목/창고/단가/최근단가. 예전에는 매출관리 목록 화면을 열 때마다 이 전체를 같이 받아 왔는데
// (모달을 안 열어도 거래처·품목이 많을수록 목록이 느려졌다), 이제 버튼을 눌렀을 때 한 번만 불러온다.
// 로그인한 사용자의 권한(RLS) 그대로 조회한다.
export async function loadQuickSaleData(): Promise<QuickSaleData | null> {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const [customers, products, warehouses, prices, { data: historyRows }] = await Promise.all([
    fetchAllRows<{ id: string; name: string; notes: string | null }>((from, to) =>
      supabase.from("customers").select("id, name, notes").order("name").range(from, to),
    ),
    fetchAllRows<{ id: string; sku: string; name: string; spec: string | null; price: number }>((from, to) =>
      supabase.from("products").select("id, sku, name, spec, price").order("name").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("warehouses").select("id, name").order("created_at", { ascending: true }).range(from, to),
    ),
    fetchAllRows<{ customer_id: string; product_id: string; unit_price: number }>((from, to) =>
      supabase.from("customer_product_prices").select("customer_id, product_id, unit_price").range(from, to).order("id", { ascending: true }),
    ),
    // 정식 등록 폼(new-sale-form)의 단가 힌트와 같은 데이터 — 최근 500줄이면 충분하다.
    supabase
      .from("sales_order_items")
      .select("product_id, unit_price, sales_orders!inner(customer_id, order_date)")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const history = (historyRows ?? [])
    .filter((row): row is typeof row & { product_id: string } => row.product_id !== null)
    .map((row) => ({
      customerId: row.sales_orders.customer_id,
      productId: row.product_id,
      unitPrice: Number(row.unit_price),
      orderDate: row.sales_orders.order_date,
    }));
  return { customers, products, warehouses, prices, history };
}
