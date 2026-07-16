import { createClient } from "@/lib/supabase/server";
import { CreateSupplierForm } from "@/components/create-supplier-form";
import { ClickableRow } from "@/components/clickable-row";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">거래처관리 &gt; 공급처관리</h1>

      <div className="erp-toolbar" style={{ marginBottom: 12 }}>
        <a href="/api/suppliers/export" className="erp-btn">
          📥 엑셀로 내보내기
        </a>
      </div>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">공급업체 추가</span>
        </div>
        <div className="erp-detail-body">
          <CreateSupplierForm />
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>업체명</th>
              <th>담당자</th>
              <th>이메일</th>
              <th>연락처</th>
              <th>주소</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {suppliers?.map((supplier) => (
              <ClickableRow key={supplier.id} href={`/suppliers/${supplier.id}`}>
                <td>{supplier.name}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{supplier.contact_name ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{supplier.email ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{supplier.phone ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{supplier.address ?? "-"}</td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  수정 →
                </td>
              </ClickableRow>
            ))}
            {!suppliers?.length && (
              <tr>
                <td colSpan={6} className="erp-grid-empty">
                  등록된 공급업체가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
