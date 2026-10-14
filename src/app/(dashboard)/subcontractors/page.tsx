import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SubcontractorForm } from "@/components/subcontractor-form";
import { SubcontractorDetailPanel } from "@/components/subcontractor-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { DeleteButton } from "@/components/delete-button";
import { PageGuide } from "@/components/erp/page-guide";
import { SplitListBulkSelect, type SplitListBulkRow } from "@/components/erp/split-list-bulk-select";
import { createSubcontractor, deleteSubcontractor, bulkDeleteSubcontractors } from "@/app/(dashboard)/subcontractors/actions";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";
import { canViewPage } from "@/lib/department-page-access";
import { AccessWall } from "@/components/erp/access-wall";

type SubcontractorRow = { id: string; name: string; contact_name: string | null; phone: string | null };

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function SubcontractorsPage({
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

  if (!(await canViewPage(supabase, "/subcontractors"))) {
    return (
      <AccessWall
        title="생산관리 > 하청업체관리"
        message="이 화면은 접근 권한이 있는 부서만 볼 수 있습니다. 필요하다면 관리자에게 요청하세요."
        backHref="/dashboard"
      />
    );
  }

  // customers/page.tsx와 같은 이유 — 업체 수가 늘어날수록 전체를 매번
  // 다 내려받으면 안 된다. 검색 중이 아닐 때만 상한을 둔다.
  let allSubcontractors: SubcontractorRow[];
  let hasMore = false;
  if (keyword) {
    allSubcontractors = await fetchAllRows<SubcontractorRow>((from, to) =>
      supabase.from("subcontractors").select("id, name, contact_name, phone").order("created_at", { ascending: false }).range(from, to),
    );
  } else {
    const result = await fetchLimitedRows<SubcontractorRow>(
      (from, to) =>
        supabase.from("subcontractors").select("id, name, contact_name, phone").order("created_at", { ascending: false }).range(from, to),
      limit,
    );
    allSubcontractors = result.rows;
    hasMore = result.hasMore;
  }

  const subcontractors = keyword
    ? allSubcontractors.filter((s) => matchesSearch(keyword, s.name, s.contact_name, s.phone))
    : allSubcontractors;

  const listParams = new URLSearchParams();
  if (q) listParams.set("q", q);
  if (limitParam) listParams.set("limit", limitParam);
  const rowHref = (subcontractorId: string) => {
    const p = new URLSearchParams(listParams);
    p.set("id", subcontractorId);
    return `/subcontractors?${p.toString()}`;
  };
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/subcontractors?${moreParams.toString()}`;
  const newHref = listParams.toString() ? `/subcontractors?${listParams.toString()}` : "/subcontractors";

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: newHref },
          F5: { submitFormSelector: "#subcontractors-search-form" },
          Escape: { href: selectedId ? newHref : "/dashboard" },
        }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="erp-h1">생산관리 &gt; 하청업체관리</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={newHref} className="erp-btn erp-btn-primary">
            F2 신규
          </Link>
          {selectedId && (
            <>
              <Link href={newHref} className="erp-btn">
                목록
              </Link>
              <DeleteButton
                action={deleteSubcontractor}
                id={selectedId}
                confirmMessage="이 업체를 삭제하시겠습니까? 발급된 포털 계정도 함께 삭제됩니다."
              />
            </>
          )}
        </div>
      </div>

      <PageGuide>
        본청으로부터 받은 작업 중 일부 공정(예: PCB)을 다시 맡기는 외부
        업체입니다. 포털 계정을 발급하면 업체가 직접 로그인해 배정된 공정의
        LOT을 시작/완료/배송 처리할 수 있습니다.
      </PageGuide>

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>업체 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>
              총 {formatNumber(subcontractors.length)}건
            </span>
          </div>
          <form
            id="subcontractors-search-form"
            method="get"
            className="erp-field-grid"
            style={{ margin: 8, padding: 8, gap: 6 }}
          >
            <div className="erp-field erp-span-6">
              <input
                type="text"
                name="q"
                autoComplete="off"
                defaultValue={q ?? ""}
                placeholder="업체명, 담당자, 연락처 검색"
                className="erp-input"
                style={{ width: "100%" }}
              />
            </div>
            <button type="submit" className="erp-btn erp-btn-primary" style={{ width: "100%" }}>
              F5 조회
            </button>
          </form>
          <div className="erp-split-list-body">
            <SplitListBulkSelect
              rows={subcontractors.map(
                (s): SplitListBulkRow => ({
                  id: s.id,
                  href: rowHref(s.id),
                  active: s.id === selectedId,
                  label: s.name,
                  content: (
                    <>
                      {s.name}
                      <div className="erp-split-list-row-sub">{s.contact_name ?? s.phone ?? "-"}</div>
                    </>
                  ),
                }),
              )}
              bulkDeleteAction={bulkDeleteSubcontractors}
              warningText="발급된 포털 계정도 함께 삭제됩니다."
              emptyMessage="조건에 맞는 업체가 없습니다."
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
            <SubcontractorDetailPanel id={selectedId} />
          ) : (
            <div className="erp-detail" style={{ marginTop: 0 }}>
              <div className="erp-detail-tabs">
                <span className="erp-detail-tab active">업체 추가</span>
              </div>
              <div className="erp-detail-body">
                <SubcontractorForm action={createSubcontractor} submitLabel="추가" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
