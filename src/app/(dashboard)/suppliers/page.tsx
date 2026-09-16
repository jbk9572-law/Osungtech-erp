import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateSupplierForm } from "@/components/create-supplier-form";
import { SupplierGridTable } from "@/components/supplier-grid-table";
import { ExcelImportForm } from "@/components/excel-import-form";
import { importSuppliersExcel } from "@/app/(dashboard)/suppliers/actions";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import type { Database } from "@/types/database.types";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; limit?: string }>;
}) {
  const { q, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const keyword = q?.trim().toLowerCase();
  const supabase = await createClient();

  // 검색 중이 아닐 때는 최근 등록순 상한(limit)까지만 가져온다 — 공급처
  // 수가 늘어날수록 전체를 매번 다 내려받아 렌더링하면 품목관리 화면이
  // 겪었던 것과 같은 클라우드플레어 CPU 한도(Error 1102) 위험이 있다.
  // 검색어가 있을 때는 오래된 공급처도 찾을 수 있어야 하므로 전체를 훑는다.
  let allSuppliers: SupplierRow[];
  let hasMore = false;
  if (keyword) {
    allSuppliers = await fetchAllRows<SupplierRow>((from, to) =>
      supabase.from("suppliers").select("*").order("created_at", { ascending: false }).range(from, to),
    );
  } else {
    const result = await fetchLimitedRows<SupplierRow>(
      (from, to) =>
        supabase.from("suppliers").select("*").order("created_at", { ascending: false }).range(from, to),
      limit,
    );
    allSuppliers = result.rows;
    hasMore = result.hasMore;
  }

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

  const moreParams = new URLSearchParams();
  if (q) moreParams.set("q", q);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/suppliers?${moreParams.toString()}`;

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

      {!keyword && (
        <p className="mb-2 text-xs" style={{ color: "var(--erp-text-muted)" }}>
          최근 등록순 {limit.toLocaleString()}개까지 표시 중{hasMore ? " — 더 있을 수 있습니다." : "."}
        </p>
      )}

      <SupplierGridTable rows={suppliers} />

      {hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <Link href={moreHref} className="erp-btn">
            더보기 ({LIST_LIMIT_STEP.toLocaleString()}개 더)
          </Link>
        </div>
      )}
    </div>
  );
}
