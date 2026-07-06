import { createClient } from "@/lib/supabase/server";
import { ProductsWorkspace } from "@/components/erp/products-workspace";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; q?: string }>;
}) {
  const { categoryId, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("*, categories(id, name), suppliers(name)")
    .order("created_at", { ascending: false });

  if (categoryId) query = query.eq("category_id", categoryId);
  if (q) query = query.ilike("name", `%${q}%`);

  const [{ data: products }, { data: categories }, { data: inventory }] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("inventory").select("product_id, quantity, warehouses(name)"),
  ]);

  const stockByProduct = new Map<string, { total: number; byWarehouse: { name: string; quantity: number }[] }>();
  for (const row of inventory ?? []) {
    const entry = stockByProduct.get(row.product_id) ?? { total: 0, byWarehouse: [] };
    entry.total += row.quantity;
    entry.byWarehouse.push({ name: row.warehouses?.name ?? "-", quantity: row.quantity });
    stockByProduct.set(row.product_id, entry);
  }

  const rows = (products ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    categoryName: p.categories?.name ?? "-",
    supplierName: p.suppliers?.name ?? "-",
    unit: p.unit,
    price: Number(p.price),
    cost: Number(p.cost),
    reorderPoint: p.reorder_point,
    isActive: p.is_active,
    stock: stockByProduct.get(p.id) ?? { total: 0, byWarehouse: [] },
  }));

  return (
    <ProductsWorkspace products={rows} categories={categories ?? []} filters={{ categoryId, q }} />
  );
}
