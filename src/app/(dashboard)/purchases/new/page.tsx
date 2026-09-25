import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPurchaseTypeSwitcher } from "@/components/new-purchase-type-switcher";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import {
  applyDuePriceSchedules,
  applyDuePurchasePriceSchedules,
} from "@/lib/price-schedule";
import { todayKstStr } from "@/lib/kst-date";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { getGridColumnWidths } from "@/lib/grid-column-widths-actions";
import { deriveDualSplitWidths } from "@/lib/item-grid-columns";
import type { LocationOption } from "@/lib/location-stock-sync";
import { isPaperCalcEnabled } from "@/lib/paper-calc-sync";

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ supplier_id?: string; reorder_items?: string; saved?: string }>;
}) {
  const { supplier_id: prefillSupplierId, reorder_items: reorderItemsRaw, saved } = await searchParams;
  // 재고 부족 자동 발주 제안(/inventory/reorder-suggestions)의 "매입
  // 등록으로 보내기"에서만 넘어온다 — 잘못된 값이 와도 등록 자체는 막지
  // 않고 그냥 빈 폼으로 시작한다.
  let prefillItems: { productId: string; quantity: number }[] | undefined;
  if (reorderItemsRaw) {
    try {
      const parsed = JSON.parse(reorderItemsRaw);
      if (Array.isArray(parsed)) {
        prefillItems = parsed.filter(
          (item): item is { productId: string; quantity: number } =>
            typeof item?.productId === "string" && typeof item?.quantity === "number",
        );
      }
    } catch {
      // 무시: 프리필은 부가 기능이라 실패해도 등록 자체는 그대로 진행한다.
    }
  }

  const supabase = await createClient();

  // "매출도 같이 등록"에서 매출단가를 미리보기로 보여주므로, /sales/new와
  // 마찬가지로 오늘 도래한 단가 예약을 먼저 반영해둔다. 매입단가 자동
  // 반영에도 같은 이유로 공급처 단가 예약을 먼저 반영한다.
  await Promise.all([
    applyDuePriceSchedules(supabase),
    applyDuePurchasePriceSchedules(supabase),
  ]);

  const [suppliers, products, { data: warehouse }, customers, prices, supplierPrices, { data: history }, locationStockRows, baseColWidths, dualSplitColWidths, paperCalcEnabled] =
    await Promise.all([
      fetchAllRows<{ id: string; name: string; notes: string | null }>((from, to) =>
        supabase.from("suppliers").select("id, name, notes").order("name").range(from, to),
      ),
      fetchAllRows<{
        id: string;
        sku: string;
        name: string;
        spec: string | null;
        unit: string;
        cost: number;
        price: number;
        base_package_qty: number | null;
      }>((from, to) =>
        supabase
          .from("products")
          .select("id, sku, name, spec, unit, cost, price, base_package_qty")
          .order("name")
          .range(from, to),
      ),
      supabase
        .from("warehouses")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      fetchAllRows<{ id: string; name: string; notes: string | null }>((from, to) =>
        supabase.from("customers").select("id, name, notes").order("name").range(from, to),
      ),
      fetchAllRows<{ customer_id: string; product_id: string; unit_price: number; notes: string | null }>(
        (from, to) =>
          supabase.from("customer_product_prices").select("customer_id, product_id, unit_price, notes").range(from, to),
      ),
      fetchAllRows<{ supplier_id: string; product_id: string; unit_cost: number; notes: string | null }>(
        (from, to) =>
          supabase.from("supplier_product_prices").select("supplier_id, product_id, unit_cost, notes").range(from, to),
      ),
      supabase
        .from("purchase_order_items")
        .select(
          "product_id, unit_cost, lot_number, purchase_orders!inner(supplier_id, purchase_date)",
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      fetchAllRows<{
        product_id: string;
        location_id: string;
        quantity: number;
        locations: { code: string; tier: number; position: number } | null;
      }>((from, to) =>
        supabase.from("inventory_locations").select("product_id, location_id, quantity, locations(code, tier, position)").range(from, to),
      ),
      getGridColumnWidths("erp-item-grid-columns"),
      getGridColumnWidths("erp-purchase-item-grid-columns-dual-split"),
      isPaperCalcEnabled(supabase),
    ]);

  const productLocations: Record<string, LocationOption[]> = {};
  for (const row of locationStockRows) {
    if (!row.locations) continue;
    const list = productLocations[row.product_id] ?? [];
    list.push({
      locationId: row.location_id,
      code: row.locations.code,
      tier: row.locations.tier,
      position: row.locations.position,
      quantity: row.quantity,
    });
    productLocations[row.product_id] = list;
  }

  const priceHistory = (history ?? [])
    .filter((row): row is typeof row & { product_id: string } => row.product_id !== null)
    .map((row) => ({
      supplierId: row.purchase_orders.supplier_id,
      productId: row.product_id,
      unitCost: Number(row.unit_cost),
      purchaseDate: row.purchase_orders.purchase_date,
      lotNumber: row.lot_number,
    }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/purchases" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">
        새 매입(입고) 등록
      </h1>
      {saved && (
        <p
          className="mb-3 rounded p-2 text-xs"
          style={{
            background: "var(--erp-success-bg)",
            color: "var(--erp-success)",
            border: "1px solid var(--erp-success-border)",
          }}
        >
          방금 등록한 거래가 저장되었습니다.{" "}
          <Link href={`/purchases/${saved}`} className="underline">
            방금 건 보기
          </Link>{" "}
          — 이어서 다음 건을 등록하세요.
        </p>
      )}
      <NewPurchaseTypeSwitcher
        // "저장 후 계속 등록"은 모달 안에서 같은 경로로(쿼리만 바뀌어)
        // 소프트 이동하므로, key를 saved 값에 묶어 저장할 때마다 폼을
        // 강제로 새로 마운트한다 — 안 그러면 방금 입력했던 품목 줄이
        // 그대로 남아있는다.
        key={saved ?? "new"}
        suppliers={suppliers ?? []}
        products={products ?? []}
        warehouseId={warehouse?.id ?? ""}
        productLocations={productLocations}
        customers={customers ?? []}
        prices={prices ?? []}
        supplierPrices={supplierPrices ?? []}
        history={priceHistory}
        today={todayKstStr()}
        prefillSupplierId={prefillSupplierId}
        prefillItems={prefillItems}
        initialBaseColWidths={baseColWidths}
        initialDualSplitColWidths={dualSplitColWidths ?? deriveDualSplitWidths(baseColWidths)}
        paperCalcEnabled={paperCalcEnabled}
      />
    </div>
  );
}
