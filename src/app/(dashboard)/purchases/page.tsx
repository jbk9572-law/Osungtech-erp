import { createClient } from "@/lib/supabase/server";
import { PurchasesWorkspace } from "@/components/erp/purchases-workspace";

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; supplierId?: string; status?: string }>;
}) {
  const { from, to, supplierId, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("purchase_orders")
    .select(
      "*, suppliers(id, name, contact_name, phone, address), warehouses(name), purchase_order_items(id, quantity, unit_cost, products(name, unit, sku))"
    )
    .order("purchase_date", { ascending: false })
    .limit(300);

  if (from) query = query.gte("purchase_date", from);
  if (to) query = query.lte("purchase_date", to);
  if (supplierId) query = query.eq("supplier_id", supplierId);
  if (status) query = query.eq("status", status);

  const [{ data: orders }, { data: suppliers }] = await Promise.all([
    query,
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  const rows = (orders ?? []).map((order) => {
    const items = order.purchase_order_items ?? [];
    const supplyAmount = items.reduce(
      (sum, item) => sum + item.quantity * Number(item.unit_cost),
      0
    );
    const taxAmount = Math.round(supplyAmount * 0.1);
    return {
      id: order.id,
      purchaseDate: order.purchase_date,
      status: order.status,
      memo: order.memo,
      supplierName: order.suppliers?.name ?? "-",
      contactName: order.suppliers?.contact_name ?? "-",
      phone: order.suppliers?.phone ?? "-",
      address: order.suppliers?.address ?? "-",
      warehouseName: order.warehouses?.name ?? "-",
      supplyAmount,
      taxAmount,
      totalAmount: supplyAmount + taxAmount,
      items: items.map((item) => ({
        id: item.id,
        productName: item.products?.name ?? "-",
        unit: item.products?.unit ?? "-",
        quantity: item.quantity,
        unitCost: Number(item.unit_cost),
        amount: item.quantity * Number(item.unit_cost),
      })),
    };
  });

  return (
    <PurchasesWorkspace
      orders={rows}
      suppliers={suppliers ?? []}
      filters={{ from, to, supplierId, status }}
    />
  );
}
