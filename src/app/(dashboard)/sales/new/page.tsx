import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewSaleForm } from "@/components/new-sale-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { applyDuePriceSchedules } from "@/lib/price-schedule";

export default async function NewSalePage() {
  const supabase = await createClient();

  // 오늘 이미 도래한 단가 예약(거래처별)을 먼저 반영해서, 이 화면의 단가
  // 자동입력이 예약된 인상/인하가 있으면 그걸 바로 반영하게 한다.
  await applyDuePriceSchedules(supabase);

  const [{ data: customers }, { data: products }, { data: warehouse }, { data: prices }, { data: history }] =
    await Promise.all([
      supabase.from("customers").select("id, name").order("name"),
      supabase
        .from("products")
        .select("id, sku, name, spec, unit, price, base_package_qty, inventory(quantity)")
        .order("name"),
      supabase.from("warehouses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("customer_product_prices").select("customer_id, product_id, unit_price"),
      supabase
        .from("sales_order_items")
        .select("product_id, unit_price, sales_orders!inner(customer_id, order_date)")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

  const priceHistory = (history ?? []).map((row) => ({
    customerId: row.sales_orders.customer_id,
    productId: row.product_id,
    unitPrice: Number(row.unit_price),
    orderDate: row.sales_orders.order_date,
  }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/sales" } }} />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">새 판매 거래 등록</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href="/paper-calc" target="_blank" rel="noopener noreferrer" className="erp-btn">
            모조지 계산
          </Link>
          <Link href="/paper-calc/manual" target="_blank" rel="noopener noreferrer" className="erp-btn">
            재단 배치 시뮬레이터
          </Link>
          <Link href="/sales" className="erp-btn erp-btn-danger">
            ESC 닫기
          </Link>
        </div>
      </div>
      <NewSaleForm
        customers={customers ?? []}
        products={(products ?? []).map((p) => ({ ...p, stock: p.inventory?.[0]?.quantity ?? 0 }))}
        warehouseId={warehouse?.id ?? ""}
        prices={prices ?? []}
        history={priceHistory}
      />
    </div>
  );
}
