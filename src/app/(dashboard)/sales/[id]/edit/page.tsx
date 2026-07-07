import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewSaleForm } from "@/components/new-sale-form";
import { updateSale } from "@/app/(dashboard)/sales/actions";

export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: order },
    { data: items },
    { data: customers },
    { data: products },
    { data: warehouses },
    { data: prices },
    { data: history },
  ] = await Promise.all([
    supabase.from("sales_orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("product_id, quantity, unit_price")
      .eq("sales_order_id", id)
      .order("created_at"),
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("products").select("id, sku, name, spec, price").order("name"),
    supabase.from("warehouses").select("id, name").order("name"),
    supabase.from("customer_product_prices").select("customer_id, product_id, unit_price"),
    supabase
      .from("sales_order_items")
      .select("product_id, unit_price, sales_orders!inner(customer_id, order_date)")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  if (!order) {
    notFound();
  }

  const priceHistory = (history ?? []).map((row) => ({
    customerId: row.sales_orders.customer_id,
    productId: row.product_id,
    unitPrice: Number(row.unit_price),
    orderDate: row.sales_orders.order_date,
  }));

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">매출 거래 수정</h1>
      <NewSaleForm
        customers={customers ?? []}
        products={products ?? []}
        warehouses={warehouses ?? []}
        prices={prices ?? []}
        history={priceHistory}
        action={updateSale}
        submitLabel="매출 수정"
        initial={{
          id: order.id,
          customerId: order.customer_id,
          warehouseId: order.warehouse_id,
          orderDate: order.order_date,
          memo: order.memo ?? "",
          items: (items ?? []).map((item) => ({
            productId: item.product_id,
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
          })),
        }}
      />
    </div>
  );
}
