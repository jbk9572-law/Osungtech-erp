import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { InventoryAdjustForm } from "@/components/inventory-adjust-form";
import { loadInventoryAdjustData } from "@/lib/inventory-adjust-data";

// 재고 조정(기초재고 등록 등) 입력 화면 — 목록 위에 입력칸을 붙여 두지 않고 C형 모달/전용 화면으로 연다.
export default async function InventoryAdjustPage() {
  const supabase = await createClient();
  const { pickerProducts, stockLevels, warehouses } = await loadInventoryAdjustData(supabase);
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory" } }} />
      <ListPageHeader title="재고관리 > 재고 조정" />
      <FormSection tabLabel="재고 조정 (기초재고 등록 등)">
        <InventoryAdjustForm products={pickerProducts} warehouseId={warehouses[0]?.id ?? ""} warehouses={warehouses} stockLevels={stockLevels} />
      </FormSection>
    </div>
  );
}
