import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SubcontractorForm } from "@/components/subcontractor-form";
import { SubcontractorDetailPanel } from "@/components/subcontractor-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { DeleteButton } from "@/components/delete-button";
import { PageGuide } from "@/components/erp/page-guide";
import { createSubcontractor, deleteSubcontractor } from "@/app/(dashboard)/subcontractors/actions";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";
import { canViewPage } from "@/lib/department-page-access";
import { AccessWall } from "@/components/erp/access-wall";

export default async function SubcontractorsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
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

  const { data: subcontractors } = await supabase
    .from("subcontractors")
    .select("id, name, contact_name, phone")
    .order("created_at", { ascending: false });

  const rowHref = (subcontractorId: string) => `/subcontractors?id=${subcontractorId}`;
  const newHref = "/subcontractors";

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: newHref },
          Escape: { href: selectedId ? newHref : "/dashboard" },
        }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">생산관리 &gt; 하청업체관리</h1>
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
              총 {formatNumber(subcontractors?.length ?? 0)}건
            </span>
          </div>
          <div className="erp-split-list-body">
            {(subcontractors ?? []).map((s) => (
              <Link
                key={s.id}
                href={rowHref(s.id)}
                className={`erp-split-list-row${s.id === selectedId ? " active" : ""}`}
              >
                {s.name}
                <div className="erp-split-list-row-sub">{s.contact_name ?? s.phone ?? "-"}</div>
              </Link>
            ))}
            {!subcontractors?.length && <p className="erp-grid-empty">등록된 업체가 없습니다.</p>}
          </div>
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
