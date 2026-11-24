import { createClient } from "@/lib/supabase/server";
import { LeaveRequestForm } from "@/components/leave-request-form";
import { requestLeave } from "@/app/(dashboard)/hr/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { todayKstStr } from "@/lib/kst-date";
import { loadApprovalFormData } from "@/lib/approval-form-data";

// 휴가 신청(C형 모달 내용) — 근태 화면 도구 줄의 [휴가 신청]이 연다.
export default async function NewLeaveRequestPage() {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "hr");
  const data = await loadApprovalFormData(supabase);
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/hr/attendance" } }} />
      <ListPageHeader title="인사관리 &gt; 근태 &gt; 휴가 신청" />
      <LeaveRequestForm action={requestLeave} today={todayKstStr()} {...data} />
    </div>
  );
}
