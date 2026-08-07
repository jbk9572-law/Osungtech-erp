import { createClient } from "@/lib/supabase/server";
import { CreateSupplierForm } from "@/components/create-supplier-form";
import { SupplierGridTable } from "@/components/supplier-grid-table";
import { ExcelImportForm } from "@/components/excel-import-form";
import { importSuppliersExcel } from "@/app/(dashboard)/suppliers/actions";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#182338]">거래처관리 &gt; 공급처관리</h1>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">공급처 추가</span>
        </div>
        <div className="erp-detail-body">
          <CreateSupplierForm />
        </div>
      </div>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">엑셀 일괄등록</span>
        </div>
        <div className="erp-detail-body">
          <ExcelImportForm
            action={importSuppliersExcel}
            templateHref="/templates/suppliers-template.xlsx"
            exportHref="/api/suppliers/export"
          />
        </div>
      </div>

      <SupplierGridTable rows={suppliers ?? []} />
    </div>
  );
}
