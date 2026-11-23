import { createClient } from "@/lib/supabase/server";
import { ListSearchForm } from "@/components/erp/list-search-form";
import { PageGuide } from "@/components/erp/page-guide";
import { RecordPageA } from "@/components/grid/record-page-a";
import type { RecordRow } from "@/components/grid/record-list-a";
import { bulkDeleteSubcontractors } from "@/app/(dashboard)/subcontractors/actions";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import { canViewPage } from "@/lib/department-page-access";
import { AccessWall } from "@/components/erp/access-wall";

type SubcontractorRow = { id: string; name: string; contact_name: string | null; phone: string | null };

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

// 모던 테마(grid-modern) 전용 A형 하청업체관리 — 표 + 오른쪽 상세 패널, 신규·수정은 C형 모달. 클래식은 classic.tsx(동결본).
export default async function SubcontractorsPage({ searchParams }: { searchParams: Promise<{ q?: string; limit?: string }> }) {
  const { q, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const keyword = q?.trim().toLowerCase();
  const supabase = await createClient();

  if (!(await canViewPage(supabase, "/subcontractors"))) {
    return <AccessWall title="생산관리 > 하청업체관리" message="이 화면은 접근 권한이 있는 부서만 볼 수 있습니다. 필요하다면 관리자에게 요청하세요." backHref="/dashboard" />;
  }

  let all: SubcontractorRow[];
  let hasMore = false;
  if (keyword) {
    all = await fetchAllRows<SubcontractorRow>((from, to) =>
      supabase.from("subcontractors").select("id, name, contact_name, phone").order("created_at", { ascending: false }).range(from, to),
    );
  } else {
    const result = await fetchLimitedRows<SubcontractorRow>(
      (from, to) => supabase.from("subcontractors").select("id, name, contact_name, phone").order("created_at", { ascending: false }).range(from, to),
      limit,
    );
    all = result.rows;
    hasMore = result.hasMore;
  }
  const list = keyword ? all.filter((s) => matchesSearch(keyword, s.name, s.contact_name, s.phone)) : all;

  const moreParams = new URLSearchParams();
  if (q) moreParams.set("q", q);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));

  const rows: RecordRow[] = list.map((s) => {
    return {
      id: s.id,
      href: `/subcontractors/${s.id}`,
      cells: [s.name, s.contact_name ?? "-", s.phone ?? "-"],
      values: [s.name, s.contact_name, s.phone],
      card: { title: <span className="erp-row-card-partner">{s.name}</span>, sub: [s.contact_name, s.phone].filter(Boolean).join(" · ") },
      panel: {
        title: s.name,
        kv: [
          { label: "담당자", value: s.contact_name ?? "-" },
          { label: "연락처", value: s.phone ?? "-" },
        ],
        actions: [{ label: "수정·포털 계정", href: `/subcontractors/${s.id}` }],
      },
    };
  });

  return (
    <>
      <RecordPageA
        title="생산관리 &gt; 하청업체관리"
        basePath="/subcontractors"
        newLabel="신규"
        searchFormId="subcontractors-search-form"
        filters={
          <>
            <PageGuide>
              본청으로부터 받은 작업 중 일부 공정(예: PCB)을 다시 맡기는 외부 업체입니다. 포털 계정을 발급하면 업체가 직접 로그인해 배정된 공정의 LOT을 시작/완료/배송 처리할 수 있습니다.
            </PageGuide>
            <ListSearchForm formId="subcontractors-search-form" q={q} placeholder="업체명, 담당자, 연락처 검색" ariaLabel="하청업체 검색" resetHref="/subcontractors" hideSubmit />
          </>
        }
        columns={[{ label: "업체명" }, { label: "담당자" }, { label: "연락처" }]}
        rows={rows}
        panelAriaLabel="선택한 하청업체 상세"
        hasMore={!keyword && hasMore}
        moreHref={`/subcontractors?${moreParams.toString()}`}
        moreStep={LIST_LIMIT_STEP}
        emptyMessage="조건에 맞는 업체가 없습니다."
        bulkDelete={{
          action: bulkDeleteSubcontractors,
          warningText: "발급된 포털 계정도 함께 삭제됩니다.",
        }}
      />
    </>
  );
}
