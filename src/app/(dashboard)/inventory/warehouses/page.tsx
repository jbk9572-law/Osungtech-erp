import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { WarehouseForm } from "@/components/warehouse-form";
import { createWarehouse, deleteWarehouse } from "@/app/(dashboard)/inventory/warehouses/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function WarehousesPage() {
  const supabase = await createClient();
  const warehouses = await fetchAllRows<{ id: string; name: string; location: string | null; created_at: string }>(
    (from, to) => supabase.from("warehouses").select("id, name, location, created_at").order("created_at").range(from, to),
  );

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory" } }} />
      <ListPageHeader title="재고관리 > 창고 관리" />

      <PageGuide>
        창고를 2개 이상 등록해야 창고 간 이동을 등록할 수 있습니다. 창고를
        지우면 그 창고를 쓰는 재고/전표가 남아있는 한 삭제가 거부됩니다.
      </PageGuide>

      <FormSection tabLabel="창고 등록">
        <WarehouseForm action={createWarehouse} />
      </FormSection>

      <div style={{ marginTop: 14 }}>
        <FormSection tabLabel={`창고 목록 (${warehouses.length})`}>
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th>창고명</th>
                  <th>위치</th>
                  <th style={{ width: 90 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td style={{ color: "var(--erp-text-muted)" }}>{w.location || "-"}</td>
                    <td>
                      <InlineConfirmDelete
                        action={deleteWarehouse}
                        hiddenFields={{ id: w.id }}
                        warningText="이 창고를 삭제하시겠습니까? 재고/전표에서 쓰이고 있으면 삭제가 거부됩니다."
                        triggerStyle={{ minWidth: 0, height: 22, padding: "0 8px", fontSize: 11 }}
                      />
                    </td>
                  </tr>
                ))}
                {warehouses.length === 0 && (
                  <tr>
                    <td colSpan={3} className="erp-grid-empty">
                      등록된 창고가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </FormSection>
      </div>
    </div>
  );
}
