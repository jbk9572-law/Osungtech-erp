import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { InventoryQrScanner } from "@/components/inventory-qr-scanner";
import { WarehouseQuerySelect } from "@/components/warehouse-query-select";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import type { ScanProduct } from "@/lib/qr-count-scan";

export default async function InventoryQrScanPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouseId?: string }>;
}) {
  const { warehouseId: warehouseIdParam } = await searchParams;
  const supabase = await createClient();

  const [products, warehouses] = await Promise.all([
    fetchAllRows<{
      id: string;
      sku: string;
      name: string;
      spec: string | null;
      unit: string;
      base_package_qty: number | null;
      inventory: { quantity: number; warehouse_id: string }[];
    }>((from, to) =>
      supabase
        .from("products")
        .select("id, sku, name, spec, unit, base_package_qty, inventory(quantity, warehouse_id)")
        .order("name")
        .range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("warehouses").select("id, name").order("created_at", { ascending: true }).range(from, to),
    ),
  ]);

  const selectedWarehouseId = warehouseIdParam || warehouses[0]?.id || "";

  const scanProducts: ScanProduct[] = products.map((p) => ({
    productId: p.id,
    sku: p.sku,
    name: p.name,
    spec: p.spec,
    unit: p.unit,
    systemQuantity: p.inventory.find((inv) => inv.warehouse_id === selectedWarehouseId)?.quantity ?? 0,
    basePackageQty: p.base_package_qty,
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
        <Link href="/inventory/count" className="erp-btn erp-btn-dark">
          ESC 목록 실사로
        </Link>
        {warehouses.length > 1 && <WarehouseQuerySelect warehouses={warehouses} value={selectedWarehouseId} />}
      </div>

      <InventoryQrScanner products={scanProducts} warehouseId={selectedWarehouseId} />
    </div>
  );
}
