import { PartyNewSheet } from "@/components/erp/party-new-sheet";
import { CreateSupplierForm } from "@/components/create-supplier-form";
import { importSuppliersExcel } from "@/app/(dashboard)/suppliers/actions";

export default function NewSupplierPage() {
  return (
    <PartyNewSheet
      title="거래처관리 &gt; 공급처 추가"
      listHref="/suppliers"
      tabLabel="공급처 추가"
      form={<CreateSupplierForm />}
      importAction={importSuppliersExcel}
      templateHref="/templates/suppliers-template.xlsx"
      exportHref="/api/suppliers/export"
    />
  );
}
