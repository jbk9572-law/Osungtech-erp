import { createClient } from "@/lib/supabase/server";
import { DepartmentForm } from "@/components/department-form";
import { createDepartment } from "@/app/(dashboard)/settings/departments/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function NewDepartmentPage() {
  const supabase = await createClient();
  const departments = await fetchAllRows<{ id: string; name: string }>((from, to) =>
    supabase.from("departments").select("id, name").order("sort_order").range(from, to),
  );

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/settings/departments" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 조직도 관리 &gt; 새 부서</h1>
      <div className="erp-toolbar">
        <CloseButton href="/settings/departments">ESC 목록으로</CloseButton>
      </div>
      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">부서 등록</span>
        </div>
        <div className="erp-detail-body">
          <DepartmentForm action={createDepartment} submitLabel="추가" candidates={departments} />
        </div>
      </div>
    </div>
  );
}
