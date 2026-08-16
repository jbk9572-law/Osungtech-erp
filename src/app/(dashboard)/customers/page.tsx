import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateCustomerForm } from "@/components/create-customer-form";
import { CustomerGridTable } from "@/components/customer-grid-table";
import { ExcelImportForm } from "@/components/excel-import-form";
import { importCustomersExcel } from "@/app/(dashboard)/customers/actions";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: allCustomers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  const keyword = q?.trim().toLowerCase();
  const customers = keyword
    ? (allCustomers ?? []).filter(
        (c) =>
          c.name.toLowerCase().includes(keyword) ||
          (c.business_number ?? "").toLowerCase().includes(keyword) ||
          (c.contact_name ?? "").toLowerCase().includes(keyword) ||
          (c.phone ?? "").toLowerCase().includes(keyword) ||
          (c.email ?? "").toLowerCase().includes(keyword)
      )
    : allCustomers ?? [];

  const exportHref = "/api/customers/export";

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">거래처관리 &gt; 출고처관리</h1>

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

      <form method="get" className="erp-search">
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="search-q">출고처 검색</label>
          <input
            id="search-q"
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="업체명, 사업자번호, 담당자, 연락처, 이메일"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          조회
        </button>
        {q && (
          <Link href="/customers" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <CustomerGridTable rows={customers} />
    </div>
  );
}
