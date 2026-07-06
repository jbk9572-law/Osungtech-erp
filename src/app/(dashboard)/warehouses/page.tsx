import { createClient } from "@/lib/supabase/server";
import { CreateWarehouseForm } from "@/components/create-warehouse-form";

export default async function WarehousesPage() {
  const supabase = await createClient();
  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">거래처관리 &gt; 창고관리</h1>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">창고 추가</span>
        </div>
        <div className="erp-detail-body">
          <CreateWarehouseForm />
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>창고명</th>
              <th>위치</th>
            </tr>
          </thead>
          <tbody>
            {warehouses?.map((warehouse) => (
              <tr key={warehouse.id}>
                <td>{warehouse.name}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{warehouse.location ?? "-"}</td>
              </tr>
            ))}
            {!warehouses?.length && (
              <tr>
                <td colSpan={2} className="erp-grid-empty">
                  등록된 창고가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
