import { createClient } from "@/lib/supabase/server";
import { WorkOrderForm } from "@/components/work-order-form";
import { createWorkOrder } from "@/app/(dashboard)/production/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayKstStr } from "@/lib/kst-date";

export default async function NewWorkOrderPage() {
  const supabase = await createClient();

  const [bomRows, allProducts, warehouses] = await Promise.all([
    // BOM 전체(품목마다 몇 줄 안 되지만, id 필터로 좁힐 수 있는 특정
    // 부모 하나가 없어 fetchAllRows로 안전하게 페이지네이션한다).
    fetchAllRows<{
      parent_product_id: string;
      component_product_id: string;
      quantity_per_unit: number;
    }>((from, to) =>
      supabase
        .from("bom_items")
        .select("parent_product_id, component_product_id, quantity_per_unit")
        .range(from, to),
    ),
    fetchAllRows<{ id: string; sku: string; name: string; unit: string }>((from, to) =>
      supabase.from("products").select("id, sku, name, unit").order("name").range(from, to),
    ),
    // warehouses는 창고 1곳 기준 운영이라 사실상 1~2행(check-pagination.mjs의
    // SAFE_UNBOUNDED_TABLES와 같은 근거).
    supabase.from("warehouses").select("id, name").order("name"),
  ]);

  const productById = new Map(allProducts.map((p) => [p.id, p]));

  const componentProductIds = Array.from(new Set(bomRows.map((r) => r.component_product_id)));
  const { data: inventoryRows } = componentProductIds.length
    ? await supabase
        .from("inventory")
        .select("product_id, quantity")
        .in("product_id", componentProductIds)
    : { data: [] as { product_id: string; quantity: number }[] };

  const stockByProduct = new Map<string, number>();
  for (const row of inventoryRows ?? []) {
    stockByProduct.set(row.product_id, (stockByProduct.get(row.product_id) ?? 0) + Number(row.quantity));
  }

  const bomByParent = new Map<string, typeof bomRows>();
  for (const row of bomRows) {
    const list = bomByParent.get(row.parent_product_id) ?? [];
    list.push(row);
    bomByParent.set(row.parent_product_id, list);
  }

  const producibleProducts = Array.from(bomByParent.entries())
    .map(([parentId, components]) => {
      const parent = productById.get(parentId);
      if (!parent) return null;
      return {
        id: parent.id,
        sku: parent.sku,
        name: parent.name,
        unit: parent.unit,
        components: components
          .map((c) => {
            const component = productById.get(c.component_product_id);
            if (!component) return null;
            return {
              productId: component.id,
              sku: component.sku,
              name: component.name,
              unit: component.unit,
              qtyPerUnit: Number(c.quantity_per_unit),
              currentStock: stockByProduct.get(component.id) ?? 0,
            };
          })
          .filter((c): c is NonNullable<typeof c> => c !== null),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/production" } }} />
      <ListPageHeader
        title="생산관리 > 생산지시 등록"
        actions={<CloseButton href="/production">ESC 목록으로</CloseButton>}
      />

      <PageGuide>
        완제품을 고르면 BOM에 등록된 구성품별 소요량과 현재 재고를 보여줍니다.
        등록하는 즉시 구성품이 출고 처리되고 완제품이 입고 처리됩니다(1차
        범위: 대기/진행 상태 없이 즉시 처리).
      </PageGuide>

      <FormSection tabLabel="생산지시 등록">
        <WorkOrderForm
          action={createWorkOrder}
          producibleProducts={producibleProducts}
          warehouses={warehouses.data ?? []}
          today={todayKstStr()}
        />
      </FormSection>
    </div>
  );
}
