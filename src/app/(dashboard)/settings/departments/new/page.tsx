import { createClient } from "@/lib/supabase/server";
import { DepartmentForm } from "@/components/department-form";
import { createDepartment } from "@/app/(dashboard)/settings/departments/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function NewDepartmentPage() {
  const supabase = await createClient();
  const departments = await fetchAllRows<{ id: string; name: string }>((from, to) =>
    supabase.from("departments").select("id, name").order("sort_order").range(from, to),
  );

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/settings/departments" } }} />
      <ListPageHeader
        title="환경설정 > 조직도 관리 > 새 부서"
        actions={<CloseButton href="/settings/departments">ESC 목록으로</CloseButton>}
      />
      <FormSection tabLabel="부서 등록">
        <DepartmentForm action={createDepartment} submitLabel="추가" candidates={departments} />
      </FormSection>
    </div>
  );
}
