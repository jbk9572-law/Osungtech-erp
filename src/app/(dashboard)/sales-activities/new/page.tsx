import { createClient } from "@/lib/supabase/server";
import { SalesActivityForm } from "@/components/sales-activity-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayKstStr } from "@/lib/kst-date";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

// 영업활동 새 기록(C형 모달 내용) — 목록과 같은 기능(crm) 사용 여부를 직접 접근에서도 확인한다.
export default async function NewSalesActivityPage() {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "crm");
  const customers = await fetchAllRows<{ id: string; name: string }>((f, t) => supabase.from("customers").select("id, name").order("name").range(f, t));
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/sales-activities" } }} />
      <ListPageHeader title="영업활동관리 &gt; 새 활동 기록" actions={<CloseButton href="/sales-activities">ESC 목록으로</CloseButton>} />
      <FormSection tabLabel="새 활동 기록">
        <SalesActivityForm today={todayKstStr()} customers={customers} />
      </FormSection>
    </div>
  );
}
