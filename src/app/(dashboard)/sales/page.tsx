import { createClient } from "@/lib/supabase/server";
import { SalesWorkspace } from "@/components/erp/sales-workspace";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; customerId?: string; status?: string }>;
}) {
  const { from, to, customerId, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("sales_orders")
    .select(
      "*, customers(id, name, contact_name, phone, address), warehouses(name), sales_order_items(id, quantity, unit_price, products(name, unit, sku))"
    )
    .order("order_date", { ascending: false })
    .limit(300);

  if (from) query = query.gte("order_date", from);
  if (to) query = query.lte("order_date", to);
  if (customerId) query = query.eq("customer_id", customerId);
  if (status) query = query.eq("status", status);

  const [{ data: orders }, { data: customers }] = await Promise.all([
    query,
    supabase.from("customers").select("id, name").order("name"),
  ]);

  const rows = (orders ?? []).map((order) => {
    const items = order.sales_order_items ?? [];
    const supplyAmount = items.reduce(
      (sum, item) => sum + item.quantity * Number(item.unit_price),
      0
    );
    const taxAmount = Math.round(supplyAmount * 0.1);
    return {
      id: order.id,
      orderDate: order.order_date,
      status: order.status,
      memo: order.memo,
      customerName: order.customers?.name ?? "-",
      contactName: order.customers?.contact_name ?? "-",
      phone: order.customers?.phone ?? "-",
      address: order.customers?.address ?? "-",
      warehouseName: order.warehouses?.name ?? "-",
      supplyAmount,
      taxAmount,
      totalAmount: supplyAmount + taxAmount,
      items: items.map((item) => ({
        id: item.id,
        productName: item.products?.name ?? "-",
        unit: item.products?.unit ?? "-",
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        amount: item.quantity * Number(item.unit_price),
      })),
    };
  });

  return (
    <SalesWorkspace
      orders={rows}
      customers={customers ?? []}
      filters={{ from, to, customerId, status }}
    />
  );
}
