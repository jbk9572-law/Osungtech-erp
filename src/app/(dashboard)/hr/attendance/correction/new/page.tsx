import { createClient } from "@/lib/supabase/server";
import { AttendanceCorrectionForm } from "@/components/attendance-correction-form";
import { requestAttendanceCorrection } from "@/app/(dashboard)/hr/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { todayKstStr } from "@/lib/kst-date";
import { loadApprovalFormData } from "@/lib/approval-form-data";

// 근태 정정 신청(C형 모달 내용) — 근태 화면 도구 줄의 [근태 정정 신청]이 연다.
export default async function NewAttendanceCorrectionPage() {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "hr");
  const data = await loadApprovalFormData(supabase);
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/hr/attendance" } }} />
      <ListPageHeader title="인사관리 &gt; 근태 &gt; 근태 정정 신청" />
      <AttendanceCorrectionForm action={requestAttendanceCorrection} today={todayKstStr()} {...data} />
    </div>
  );
}
