// products(...).select("...inventory(quantity, warehouse_id)")로 조인해오는
// inventory 배열은 매칭되는 행이 없으면 정상적으로는 빈 배열([])이어야
// 하지만, 그 상품의 재고 행이 RLS(테넌트/데모 격리)에 전부 가려지는 등의
// 상황에서 null/undefined로 내려오는 사례가 실제로 있었다 — 재고관리 >
// 재고현황 화면이 먼저 이 문제를 겪고 `p.inventory ?? []`로 방어했는데,
// 같은 조인을 그대로 쓰는 재고실사/QR 자동실사/신규 매출 등록 등 다른
// 화면에는 그 방어가 옮겨지지 않아 `p.inventory.find(...)` 같은 호출이
// TypeError로 그대로 화면을 죽였다. 이 세 헬퍼로 통일해서, 같은 조인을
// 새로 쓰는 화면도 항상 안전하게 만든다.
type InventoryQuantityRow = { quantity: number };
type InventoryWarehouseRow = InventoryQuantityRow & { warehouse_id: string };

export function sumInventoryQuantity(inventory: InventoryQuantityRow[] | null | undefined): number {
  return (inventory ?? []).reduce((sum, inv) => sum + Number(inv.quantity), 0);
}

export function findWarehouseQuantity(
  inventory: InventoryWarehouseRow[] | null | undefined,
  warehouseId: string
): number {
  return (inventory ?? []).find((inv) => inv.warehouse_id === warehouseId)?.quantity ?? 0;
}

export function inventoryQuantityByWarehouse(
  inventory: InventoryWarehouseRow[] | null | undefined
): Record<string, number> {
  return Object.fromEntries((inventory ?? []).map((inv) => [inv.warehouse_id, Number(inv.quantity)]));
}

type ProductWithInventory = {
  id: string;
  parent_product_id?: string | null;
  inventory?: InventoryWarehouseRow[] | null;
};

// 파생 SKU(products.parent_product_id가 있는 품목, 예: C105-1)는 독립
// 재고를 갖지 않는다 — 실물 재고 원장은 항상 모품목(C105) 하나에서만
// 쌓인다(parent_child_sku_fifo_cogs 마이그레이션 참고). 그래서 매출 등록
// 화면에서 파생 SKU를 고르면 그 자신의 inventory는 늘 비어 있어, 위
// sumInventoryQuantity/inventoryQuantityByWarehouse를 그대로 쓰면 재고가
// 항상 0으로 보이고 오버셀 경고도 엉뚱하게(또는 전혀 안) 뜬다. 매출 등록
// 화면(new-sale-form.tsx)에 넘기기 전에 이 함수로 파생 SKU → 모품목의
// inventory로 먼저 치환해둔다.
export function resolveEffectiveInventory<T extends ProductWithInventory>(
  products: T[]
): Map<string, InventoryWarehouseRow[]> {
  const byId = new Map(products.map((p) => [p.id, p]));
  const result = new Map<string, InventoryWarehouseRow[]>();
  for (const p of products) {
    const source = p.parent_product_id ? (byId.get(p.parent_product_id) ?? p) : p;
    result.set(p.id, source.inventory ?? []);
  }
  return result;
}
