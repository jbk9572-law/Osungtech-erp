import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { PageGuide } from "@/components/erp/page-guide";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { LocationStockForm } from "@/components/location-stock-form";
import { LocationStockRow } from "@/components/location-stock-row";

type StockRow = {
  id: string;
  product_id: string;
  quantity: number;
  products: { sku: string; name: string; spec: string | null; unit: string; base_package_qty: number | null } | null;
};

export default async function LocationDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: location } = await supabase
    .from("locations")
    .select("id, code, rack, tier, position")
    .eq("code", code)
    .maybeSingle();

  if (!location) notFound();

  const [stockRows, productRows, inventoryRows, assignedElsewhereRows] = await Promise.all([
    supabase
      .from("inventory_locations")
      .select("id, product_id, quantity, products(sku, name, spec, unit, base_package_qty)")
      .eq("location_id", location.id)
      .order("updated_at", { ascending: false })
      .then((res) => (res.data ?? []) as StockRow[]),
    fetchAllRows<{ id: string; sku: string; name: string; spec: string | null; base_package_qty: number | null }>(
      (from, to) =>
        supabase.from("products").select("id, sku, name, spec, base_package_qty").order("name").range(from, to),
    ),
    fetchAllRows<{ product_id: string; quantity: number }>((from, to) =>
      supabase.from("inventory").select("product_id, quantity").range(from, to),
    ),
    fetchAllRows<{ product_id: string; quantity: number }>((from, to) =>
      supabase
        .from("inventory_locations")
        .select("product_id, quantity")
        .neq("location_id", location.id)
        .range(from, to),
    ),
  ]);

  // 위치별 수량을 처음부터 직접 타이핑하게 하면 막막하다는 요청 — 창고
  // 전체 재고(기존 inventory 합계)를 참고삼아 기본값으로 채워준다. 다만
  // 그대로 채우면 한 품목을 여러 위치에 나눠 보관할 때 두 번째 위치에도
  // 창고 전체 수량이 그대로 떠서 이중 입력을 유도하기 쉽다 — 다른
  // 위치에 이미 배정해 둔 만큼은 빼고, "아직 어디에도 안 배정한 나머지"
  // 만 기본값으로 보여준다.
  const totalByProduct = new Map<string, number>();
  for (const row of inventoryRows) {
    totalByProduct.set(row.product_id, (totalByProduct.get(row.product_id) ?? 0) + row.quantity);
  }
  const assignedElsewhereByProduct = new Map<string, number>();
  for (const row of assignedElsewhereRows) {
    assignedElsewhereByProduct.set(
      row.product_id,
      (assignedElsewhereByProduct.get(row.product_id) ?? 0) + row.quantity,
    );
  }
  const products = productRows.map((p) => {
    const total = totalByProduct.get(p.id) ?? 0;
    const assignedElsewhere = assignedElsewhereByProduct.get(p.id) ?? 0;
    return {
      ...p,
      totalQuantity: Math.max(0, total - assignedElsewhere),
      basePackageQty: p.base_package_qty,
    };
  });

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory/locations" } }} />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">
          보관 위치 {location.code} ({location.tier === 2 ? "2단·상단" : "1단·하단"}{" "}
          {location.position === 1 ? "좌측" : "우측"})
        </h1>
        <Link href="/inventory/locations" className="erp-btn erp-btn-danger">
          ESC 위치 목록으로
        </Link>
      </div>

      <PageGuide>이 위치에 현재 보관 중인 품목입니다. 실제로 확인한 수량과 다르면 아래에서 바로 수정하세요.</PageGuide>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 16 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">품목 등록/수정</span>
        </div>
        <div className="erp-detail-body">
          <LocationStockForm locationId={location.id} code={location.code} products={products} />
        </div>
      </div>

      {stockRows.length === 0 ? (
        <p className="erp-grid-empty">아직 이 위치에 등록된 품목이 없습니다.</p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>SKU</th>
                <th>품목명</th>
                <th>규격</th>
                <th className="num">수량</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stockRows.map((row) => (
                <LocationStockRow
                  key={row.id}
                  locationId={location.id}
                  code={location.code}
                  productId={row.product_id}
                  sku={row.products?.sku ?? "-"}
                  name={row.products?.name ?? "(삭제된 품목)"}
                  spec={row.products?.spec ?? null}
                  unit={row.products?.unit ?? "EA"}
                  quantity={row.quantity}
                  basePackageQty={row.products?.base_package_qty ?? null}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
