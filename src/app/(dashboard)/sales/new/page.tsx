import { createClient } from "@/lib/supabase/server";
import { NewSaleForm } from "@/components/new-sale-form";

export default async function NewSalePage() {
  const supabase = await createClient();
  const [{ data: customers }, { data: products }, { data: warehouses }, { data: prices }, { data: history }] =
    await Promise.all([
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("products").select("id, sku, name, price").order("name"),
      supabase.from("warehouses").select("id, name").order("name"),
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
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">새 판매 거래 등록</h1>
      <NewSaleForm
        customers={customers ?? []}
        products={products ?? []}
        warehouses={warehouses ?? []}
        prices={prices ?? []}
        history={priceHistory}
      />
    </div>
  );
}
