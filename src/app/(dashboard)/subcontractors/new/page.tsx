import { createClient } from "@/lib/supabase/server";
import { SubcontractorForm } from "@/components/subcontractor-form";
import { createSubcontractor } from "@/app/(dashboard)/subcontractors/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { canViewPage } from "@/lib/department-page-access";
import { AccessWall } from "@/components/erp/access-wall";

// 하청업체 신규 등록(C형 모달 내용) — 목록과 같은 접근 권한(부서)을 직접 접근에서도 확인한다.
export default async function NewSubcontractorPage() {
  const supabase = await createClient();
  if (!(await canViewPage(supabase, "/subcontractors"))) {
    return <AccessWall title="생산관리 > 하청업체 추가" message="이 화면은 접근 권한이 있는 부서만 볼 수 있습니다. 필요하다면 관리자에게 요청하세요." backHref="/dashboard" />;
  }
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/subcontractors" } }} />
      <ListPageHeader title="생산관리 &gt; 하청업체 추가" />
      <SubcontractorForm action={createSubcontractor} submitLabel="추가" />
    </div>
  );
}
