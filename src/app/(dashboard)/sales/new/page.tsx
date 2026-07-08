import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewSaleForm } from "@/components/new-sale-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function NewSalePage() {
  const supabase = await createClient();
  const [{ data: customers }, { data: products }, { data: warehouse }, { data: prices }, { data: history }] =
    await Promise.all([
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("products").select("id, sku, name, spec, unit, price, inventory(quantity)").order("name"),
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
        <Link href="/sales" className="erp-btn">
          ESC 닫기
        </Link>
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
