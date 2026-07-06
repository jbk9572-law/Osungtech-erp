import { createClient } from "@/lib/supabase/server";
import { NewPurchaseForm } from "@/components/new-purchase-form";

export default async function NewPurchasePage() {
  const supabase = await createClient();
  const [{ data: suppliers }, { data: products }, { data: warehouses }] = await Promise.all([
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("products").select("id, sku, name, cost").order("name"),
    supabase.from("warehouses").select("id, name").order("name"),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">새 매입(입고) 등록</h1>
      <NewPurchaseForm
        suppliers={suppliers ?? []}
        products={products ?? []}
        warehouses={warehouses ?? []}
      />
    </div>
  );
}
