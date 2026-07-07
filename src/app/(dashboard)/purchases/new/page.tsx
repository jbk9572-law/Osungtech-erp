import { createClient } from "@/lib/supabase/server";
import { NewPurchaseForm } from "@/components/new-purchase-form";

export default async function NewPurchasePage() {
  const supabase = await createClient();
  const [{ data: suppliers }, { data: products }, { data: warehouses }] = await Promise.all([
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("products").select("id, sku, name, spec, cost").order("name"),
    supabase.from("warehouses").select("id, name").order("name"),
  ]);

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">새 매입(입고) 등록</h1>
      <NewPurchaseForm
        suppliers={suppliers ?? []}
        products={products ?? []}
        warehouses={warehouses ?? []}
      />
    </div>
  );
}
