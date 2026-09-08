import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { InventoryQrScanner } from "@/components/inventory-qr-scanner";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import type { ScanProduct } from "@/lib/qr-count-scan";

export default async function InventoryQrScanPage() {
  const supabase = await createClient();

  const [products, { data: warehouse }] = await Promise.all([
    fetchAllRows<{
      id: string;
      sku: string;
      name: string;
      spec: string | null;
      unit: string;
      inventory: { quantity: number }[];
    }>((from, to) =>
      supabase
        .from("products")
        .select("id, sku, name, spec, unit, inventory(quantity)")
        .order("name")
        .range(from, to),
    ),
    supabase.from("warehouses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const scanProducts: ScanProduct[] = products.map((p) => ({
    productId: p.id,
    sku: p.sku,
    name: p.name,
    spec: p.spec,
    unit: p.unit,
    systemQuantity: p.inventory?.[0]?.quantity ?? 0,
  }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory/count" } }} />
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">재고관리 &gt; QR 자동실사</h1>
      <PageGuide>
        품목 QR을 순서대로 스캔하세요. 다음 품목을 스캔하면 방금 품목은 전산 재고와 일치하는
        것으로 자동 처리되고, 실물 수량이 다르면 &quot;수량 다름&quot; 버튼을 눌러 그 자리에서 정정합니다.
      </PageGuide>

      <div className="erp-toolbar">
        <Link href="/inventory/count" className="erp-btn erp-btn-danger">
          ESC 목록 실사로
        </Link>
      </div>

      <InventoryQrScanner products={scanProducts} warehouseId={warehouse?.id ?? ""} />
    </div>
  );
}
