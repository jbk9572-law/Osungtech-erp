import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewSaleTypeSwitcher } from "@/components/new-sale-type-switcher";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { applyDuePriceSchedules } from "@/lib/price-schedule";
import { todayKstStr } from "@/lib/kst-date";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { getGridColumnWidths } from "@/lib/grid-column-widths-actions";
import type { LocationOption } from "@/lib/location-stock-sync";

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const supabase = await createClient();

  // 오늘 이미 도래한 단가 예약(거래처별)을 먼저 반영해서, 이 화면의 단가
  // 자동입력이 예약된 인상/인하가 있으면 그걸 바로 반영하게 한다.
  await applyDuePriceSchedules(supabase);

  const [customers, products, { data: warehouse }, prices, { data: history }, locationStockRows, gridColWidths] = await Promise.all([
    fetchAllRows<{ id: string; name: string; notes: string | null }>((from, to) =>
      supabase.from("customers").select("id, name, notes").order("name").range(from, to),
    ),
    fetchAllRows<{
      id: string;
      sku: string;
      name: string;
      spec: string | null;
      unit: string;
      price: number;
      base_package_qty: number | null;
      inventory: { quantity: number }[];
    }>((from, to) =>
      supabase
        .from("products")
        .select("id, sku, name, spec, unit, price, base_package_qty, inventory(quantity)")
        .order("name")
        .range(from, to),
    ),
    supabase
      .from("warehouses")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    fetchAllRows<{ customer_id: string; product_id: string; unit_price: number; notes: string | null }>(
      (from, to) =>
        supabase.from("customer_product_prices").select("customer_id, product_id, unit_price, notes").range(from, to),
    ),
    supabase
      .from("sales_order_items")
      .select(
        "product_id, unit_price, lot_number, sales_orders!inner(customer_id, order_date)",
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    // 품목별 보관 위치 목록 — 2곳 이상인 품목만 저장 시 확인 모달에 쓰인다
    // (new-sale-form.tsx). 창고가 지금은 항상 1곳뿐이라 따로 필터링하지
    // 않는다.
    fetchAllRows<{
      product_id: string;
      location_id: string;
      quantity: number;
      locations: { code: string; tier: number; position: number } | null;
    }>((from, to) =>
      supabase.from("inventory_locations").select("product_id, location_id, quantity, locations(code, tier, position)").range(from, to),
    ),
    getGridColumnWidths("erp-item-grid-columns"),
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
      customerId: row.sales_orders.customer_id,
      productId: row.product_id,
      unitPrice: Number(row.unit_price),
      orderDate: row.sales_orders.order_date,
      lotNumber: row.lot_number,
    }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/sales" } }} />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">
          새 판매 거래 등록
        </h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <CloseButton href="/sales" />
        </div>
      </div>
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
          <Link href={`/sales/${saved}`} className="underline">
            방금 건 보기
          </Link>{" "}
          — 이어서 다음 건을 등록하세요.
        </p>
      )}
      <NewSaleTypeSwitcher
        // "저장 후 계속 등록"은 모달 안에서 같은 경로로(쿼리만 바뀌어)
        // 소프트 이동하므로, key를 saved 값에 묶어 저장할 때마다 폼을
        // 강제로 새로 마운트한다 — 안 그러면 방금 입력했던 품목 줄이
        // 그대로 남아있는다(예전 전체 페이지 이동 방식은 항상 새
        // 컴포넌트였어서 자동으로 비워졌다).
        key={saved ?? "new"}
        customers={customers ?? []}
        products={(products ?? []).map((p) => ({
          ...p,
          stock: p.inventory?.[0]?.quantity ?? 0,
        }))}
        warehouseId={warehouse?.id ?? ""}
        prices={prices ?? []}
        history={priceHistory}
        productLocations={productLocations}
        today={todayKstStr()}
        initialColWidths={gridColWidths}
      />
    </div>
  );
}
