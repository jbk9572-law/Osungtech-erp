import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { WarehouseForm } from "@/components/warehouse-form";
import { createWarehouse } from "@/app/(dashboard)/inventory/warehouses/actions";

// 새 창고 입력 화면 — 목록 위 인라인 폼 대신 C형 모달/전용 화면으로 연다.
export default function NewWarehousePage() {
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory/warehouses" } }} />
      <ListPageHeader title="재고관리 > 창고 > 새 창고" />
      <WarehouseForm action={createWarehouse} />
    </div>
  );
}
