import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InventoryCountForm, type CountRow } from "@/components/inventory-count-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function InventoryCountPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: warehouse }] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, name, spec, unit, inventory(quantity)")
      .order("name"),
    supabase
      .from("warehouses")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows: CountRow[] = (products ?? []).map((p) => ({
    productId: p.id,
    sku: p.sku,
    name: p.name,
    spec: p.spec,
    unit: p.unit,
    systemQuantity: p.inventory?.[0]?.quantity ?? 0,
  }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">
          재고관리 &gt; 재고 실사
        </h1>
        <Link href="/inventory" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">
        전산 재고와 실제로 세어본 수량을 비교합니다. 기본값은 전산 재고와 같으므로, 실제로 다른
        품목만 실사 수량 칸을 고쳐서 저장하면 차이가 있는 품목만 재고 조정 내역으로 남습니다.
      </p>
      <InventoryCountForm rows={rows} warehouseId={warehouse?.id ?? ""} />
    </div>
  );
}
