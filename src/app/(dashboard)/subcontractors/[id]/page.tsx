import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import { SubcontractorDetailPanel } from "@/components/subcontractor-detail-panel";
import { DeleteButton } from "@/components/delete-button";
import { deleteSubcontractor } from "@/app/(dashboard)/subcontractors/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { canViewPage } from "@/lib/department-page-access";
import { AccessWall } from "@/components/erp/access-wall";

// 하청업체 상세·수정(C형 모달 내용) — 목록과 같은 접근 권한(부서)을 직접 접근에서도 확인한다.
export default async function SubcontractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  if (!(await canViewPage(supabase, "/subcontractors"))) {
    return <AccessWall title="생산관리 > 하청업체관리" message="이 화면은 접근 권한이 있는 부서만 볼 수 있습니다. 필요하다면 관리자에게 요청하세요." backHref="/dashboard" />;
  }
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/subcontractors" } }} />
      <div className="mb-1 flex justify-end">
        <DeleteButton action={deleteSubcontractor} id={id} confirmMessage="이 업체를 삭제하시겠습니까? 발급된 포털 계정도 함께 삭제됩니다." />
      </div>
      <SubcontractorDetailPanel key={id} id={id} selfHref={`/subcontractors/${id}`} />
    </div>
  );
}
