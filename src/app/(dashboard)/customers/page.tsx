import { createClient } from "@/lib/supabase/server";
import { CreateCustomerForm } from "@/components/create-customer-form";
import { CustomerGridTable } from "@/components/customer-grid-table";
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
      <h1 className="mb-3 text-lg font-bold text-[#182338]">거래처관리 &gt; 출고처관리</h1>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">출고처 추가</span>
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

      <CustomerGridTable rows={customers ?? []} />
    </div>
  );
}
