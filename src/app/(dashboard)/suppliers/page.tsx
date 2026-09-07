import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateSupplierForm } from "@/components/create-supplier-form";
import { SupplierGridTable } from "@/components/supplier-grid-table";
import { ExcelImportForm } from "@/components/excel-import-form";
import { importSuppliersExcel } from "@/app/(dashboard)/suppliers/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import type { Database } from "@/types/database.types";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const allSuppliers = await fetchAllRows<SupplierRow>((from, to) =>
    supabase.from("suppliers").select("*").order("created_at", { ascending: false }).range(from, to),
  );

  const keyword = q?.trim().toLowerCase();
  const suppliers = keyword
    ? allSuppliers.filter((s) =>
        matchesSearch(
          keyword,
          s.name,
          s.business_number,
          s.contact_name,
          s.phone,
          s.email,
          s.representative_name,
          s.address,
          s.notes,
        ),
      )
    : allSuppliers;

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">거래처관리 &gt; 공급처관리</h1>

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

      <form method="get" className="erp-search">
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="search-q">공급처 검색</label>
          <input
            id="search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="업체명, 사업자번호, 대표자, 담당자, 연락처, 이메일, 주소, 메모"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          조회
        </button>
        {q && (
          <Link href="/suppliers" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <SupplierGridTable rows={suppliers} />
    </div>
  );
}
