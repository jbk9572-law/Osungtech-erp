import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPurchaseForm } from "@/components/new-purchase-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function NewPurchasePage() {
  const supabase = await createClient();
  const [{ data: suppliers }, { data: products }, { data: warehouse }] = await Promise.all([
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("products").select("id, sku, name, spec, unit, cost, base_package_qty").order("name"),
    supabase.from("warehouses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/purchases" } }} />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">새 매입(입고) 등록</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href="/paper-calc/manual?for=purchase" target="_blank" rel="noopener noreferrer" className="erp-btn">
            재단 배치 시뮬레이터
          </Link>
          <Link href="/purchases" className="erp-btn erp-btn-danger">
            ESC 닫기
          </Link>
        </div>
      </div>
      <NewPurchaseForm
        suppliers={suppliers ?? []}
        products={products ?? []}
        warehouseId={warehouse?.id ?? ""}
      />
    </div>
  );
}
