import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPurchaseForm } from "@/components/new-purchase-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function NewPurchasePage() {
  const supabase = await createClient();
  const [{ data: suppliers }, { data: products }, { data: warehouse }] = await Promise.all([
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("products").select("id, sku, name, spec, unit, cost").order("name"),
    supabase.from("warehouses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/purchases" } }} />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">새 매입(입고) 등록</h1>
        <Link href="/purchases" className="erp-btn">
          ESC 닫기
        </Link>
      </div>
      <NewPurchaseForm
        suppliers={suppliers ?? []}
        products={products ?? []}
        warehouseId={warehouse?.id ?? ""}
      />
    </div>
  );
}
