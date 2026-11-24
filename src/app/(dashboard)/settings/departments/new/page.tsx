import { createClient } from "@/lib/supabase/server";
import { DepartmentForm } from "@/components/department-form";
import { createDepartment } from "@/app/(dashboard)/settings/departments/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
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
      />
      <DepartmentForm action={createDepartment} submitLabel="추가" candidates={departments} />
    </div>
  );
}
