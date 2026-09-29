import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateSupplierForm } from "@/components/create-supplier-form";
import { ExcelImportForm } from "@/components/excel-import-form";
import { SupplierDetailPanel } from "@/components/supplier-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { DeleteButton } from "@/components/delete-button";
import { SplitListBulkSelect, type SplitListBulkRow } from "@/components/erp/split-list-bulk-select";
import { importSuppliersExcel, deleteSupplier, bulkDeleteSuppliers } from "@/app/(dashboard)/suppliers/actions";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import { isUuid } from "@/lib/is-uuid";
import type { Database } from "@/types/database.types";
import { formatNumber } from "@/lib/format-number";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; limit?: string; id?: string }>;
}) {
  const { q, limit: limitParam, id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
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

  const listParams = new URLSearchParams();
  if (q) listParams.set("q", q);
  if (limitParam) listParams.set("limit", limitParam);
  const rowHref = (supplierId: string) => {
    const p = new URLSearchParams(listParams);
    p.set("id", supplierId);
    return `/suppliers?${p.toString()}`;
  };
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/suppliers?${moreParams.toString()}`;
  const newHref = listParams.toString() ? `/suppliers?${listParams.toString()}` : "/suppliers";
  const currentHref = selectedId
    ? `/suppliers?${new URLSearchParams({ ...(q ? { q } : {}), ...(limitParam ? { limit: limitParam } : {}), id: selectedId }).toString()}`
    : newHref;

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: newHref },
          F5: { submitFormSelector: "#suppliers-search-form" },
          Escape: { href: selectedId ? newHref : "/dashboard" },
        }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">거래처관리 &gt; 공급처관리</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={newHref} className="erp-btn erp-btn-primary">
            F2 신규
          </Link>
          <Link href={currentHref} className="erp-btn">
            새로고침
          </Link>
          {selectedId && (
            <>
              <Link href={newHref} className="erp-btn">
                목록
              </Link>
              <DeleteButton
                action={deleteSupplier}
                id={selectedId}
                confirmMessage="이 공급처를 삭제하시겠습니까? 관련 매입/상품 내역이 있으면 삭제되지 않습니다."
              />
            </>
          )}
        </div>
      </div>

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>공급처 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>
              총 {formatNumber(suppliers.length)}건
            </span>
          </div>
          <form
            id="suppliers-search-form"
            method="get"
            className="erp-search"
            style={{ margin: 8, padding: 8, gap: 6 }}
          >
            <input
              type="text"
              name="q"
              autoComplete="off"
              defaultValue={q ?? ""}
              placeholder="업체명, 사업자번호, 담당자 검색"
              className="erp-input"
              style={{ width: "100%" }}
            />
            <button type="submit" className="erp-btn erp-btn-primary" style={{ width: "100%" }}>
              F5 조회
            </button>
          </form>
          <div className="erp-split-list-body">
            <SplitListBulkSelect
              rows={suppliers.map(
                (s): SplitListBulkRow => ({
                  id: s.id,
                  href: rowHref(s.id),
                  active: s.id === selectedId,
                  label: s.name,
                  content: (
                    <>
                      {s.name}
                      <div className="erp-split-list-row-sub">{s.supplier_code}</div>
                    </>
                  ),
                }),
              )}
              bulkDeleteAction={bulkDeleteSuppliers}
              warningText="관련 매입/상품 내역이 있는 공급처는 삭제되지 않습니다."
              emptyMessage="조건에 맞는 공급처가 없습니다."
            />
          </div>
          {!keyword && hasMore && (
            <div style={{ padding: 8, borderTop: "1px solid var(--erp-border)" }}>
              <Link href={moreHref} className="erp-btn" style={{ width: "100%" }}>
                더보기 ({formatNumber(LIST_LIMIT_STEP)}개 더)
              </Link>
            </div>
          )}
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <SupplierDetailPanel id={selectedId} />
          ) : (
            <>
              <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
                <div className="erp-detail-tabs">
                  <span className="erp-detail-tab active">공급처 추가</span>
                </div>
                <div className="erp-detail-body">
                  <CreateSupplierForm />
                </div>
              </div>

              <div className="erp-detail">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
