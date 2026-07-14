import { createClient } from "@/lib/supabase/server";
import { CreateCustomerForm } from "@/components/create-customer-form";
import { ClickableRow } from "@/components/clickable-row";
import { ExcelImportForm } from "@/components/excel-import-form";
import { importCustomersExcel } from "@/app/(dashboard)/customers/actions";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  const exportHref = "/api/customers/export";

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">거래처관리 &gt; 판매처관리</h1>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">거래처 추가</span>
        </div>
        <div className="erp-detail-body">
          <CreateCustomerForm />
        </div>
      </div>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">엑셀 일괄등록</span>
        </div>
        <div className="erp-detail-body">
          <ExcelImportForm
            action={importCustomersExcel}
            templateHref="/templates/customers-template.xlsx"
            exportHref={exportHref}
          />
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>거래처명</th>
              <th>사업자번호</th>
              <th>담당자</th>
              <th>연락처</th>
              <th>발행 문서</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {customers?.map((customer) => (
              <ClickableRow key={customer.id} href={`/customers/${customer.id}`}>
                <td>{customer.name}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{customer.business_number ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{customer.contact_name ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{customer.phone ?? "-"}</td>
                <td>
                  <span
                    className={`erp-badge ${
                      customer.document_type === "출고증" ? "erp-badge-warning" : "erp-badge-success"
                    }`}
                  >
                    {customer.document_type}
                  </span>
                </td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  수정 →
                </td>
              </ClickableRow>
            ))}
            {!customers?.length && (
              <tr>
                <td colSpan={6} className="erp-grid-empty">
                  등록된 거래처가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
