import { createClient } from "@/lib/supabase/server";
import { InventoryWorkspace } from "@/components/erp/inventory-workspace";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouseId?: string; q?: string }>;
}) {
  const { warehouseId, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("inventory")
    .select("*, products(sku, name, unit, reorder_point), warehouses(name)")
    .order("updated_at", { ascending: false });

  if (warehouseId) query = query.eq("warehouse_id", warehouseId);

  const [{ data: inventory }, { data: products }, { data: warehouses }, { data: transactions }] =
    await Promise.all([
      query,
      supabase.from("products").select("id, sku, name").order("name"),
      supabase.from("warehouses").select("id, name").order("name"),
      supabase
        .from("inventory_transactions")
        .select("id, product_id, warehouse_id, type, quantity, note, reference, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

  const keyword = q?.trim().toLowerCase();
  const rows = (inventory ?? [])
    .filter((row) => !keyword || row.products?.name?.toLowerCase().includes(keyword))
    .map((row) => ({
      id: row.id,
      productId: row.product_id,
      warehouseId: row.warehouse_id,
      sku: row.products?.sku ?? "-",
      name: row.products?.name ?? "-",
      unit: row.products?.unit ?? "-",
      warehouseName: row.warehouses?.name ?? "-",
      quantity: row.quantity,
      reorderPoint: row.products?.reorder_point ?? 0,
    }));

  return (
    <InventoryWorkspace
      inventory={rows}
      products={products ?? []}
      warehouses={warehouses ?? []}
      transactions={transactions ?? []}
      filters={{ warehouseId, q }}
    />
  );
}
