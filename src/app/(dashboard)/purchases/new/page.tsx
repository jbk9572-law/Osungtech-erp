import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPurchaseForm } from "@/components/new-purchase-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { applyDuePriceSchedules } from "@/lib/price-schedule";

export default async function NewPurchasePage() {
  const supabase = await createClient();

  // "매출도 같이 등록"에서 매출단가를 미리보기로 보여주므로, /sales/new와
  // 마찬가지로 오늘 도래한 단가 예약을 먼저 반영해둔다.
  await applyDuePriceSchedules(supabase);

  const [{ data: suppliers }, { data: products }, { data: warehouse }, { data: customers }, { data: prices }] =
    await Promise.all([
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("products").select("id, sku, name, spec, unit, cost, price, base_package_qty").order("name"),
      supabase.from("warehouses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("customer_product_prices").select("customer_id, product_id, unit_price"),
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
        customers={customers ?? []}
        prices={prices ?? []}
      />
    </div>
  );
}
