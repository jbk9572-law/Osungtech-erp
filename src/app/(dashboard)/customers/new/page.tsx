import { PartyNewSheet } from "@/components/erp/party-new-sheet";
import { CreateCustomerForm } from "@/components/create-customer-form";
import { importCustomersExcel } from "@/app/(dashboard)/customers/actions";

export default function NewCustomerPage() {
  return (
    <PartyNewSheet
      title="거래처관리 &gt; 출고처 추가"
      listHref="/customers"
      tabLabel="출고처 추가"
      form={<CreateCustomerForm />}
      importAction={importCustomersExcel}
      templateHref="/templates/customers-template.xlsx"
      exportHref="/api/customers/export"
    />
  );
}
