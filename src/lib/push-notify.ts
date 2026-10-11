import { notify } from "@/lib/notify";
import { todayKstStr } from "@/lib/kst-date";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// 기안 등록 직후, 또는 결재 처리 직후(반려/최종승인이 아니라 다음 결재자로
// 넘어간 경우) 공통으로 부르는 함수 — 지금 이 문서가 "누구 차례인지"를
// 다시 조회해서 그 사람에게만 알린다. 문서가 승인/반려로 끝났으면 대신
// 기안자에게 결과를 알린다. 두 경우를 한 함수로 합쳐서, 제출 시점과
// 결재 처리 시점 양쪽에서 그대로 재사용한다.
export async function notifyApprovalDocumentEvent(
  supabase: SupabaseClient<Database>,
  documentId: string,
): Promise<void> {
  const { data: doc } = await supabase
    .from("approval_documents")
    .select("title, status, created_by")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return;

  const url = `/approvals/${documentId}`;

  if (doc.status === "pending") {
    const { data: nextStep } = await supabase
      .from("approval_steps")
      .select("approver_id")
      .eq("document_id", documentId)
      .eq("status", "pending")
      .order("step_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextStep?.approver_id) {
      // 전결권(대리결재) 위임 중이면 원래 승인자뿐 아니라 지금 실제로
      // 처리해야 하는 대리인에게도 알려야 한다 — 그렇지 않으면 위임
      // 기간 동안 들어온 기안을 대리인이 알림 없이 놓치고, 대시보드에서
      // 직접 찾아봐야만 알 수 있었다(my-pending-approvals.ts의 "내 차례"
      // 판정과 같은 위임 규칙).
      const today = todayKstStr();
      const { data: delegations } = await supabase
        .from("approval_delegations")
        .select("delegate_id, start_date, end_date")
        .eq("delegator_id", nextStep.approver_id);
      const activeDelegateIds = (delegations ?? [])
        .filter((d) => d.start_date <= today && today <= d.end_date)
        .map((d) => d.delegate_id);

      await notify(supabase, {
        userIds: [nextStep.approver_id, ...activeDelegateIds],
        type: "approval_pending",
        title: "새 결재 요청",
        body: doc.title,
        url,
      });
    }
    return;
  }

  if (doc.created_by) {
    await notify(supabase, {
      userIds: [doc.created_by],
      type: "approval_result",
      title: doc.status === "approved" ? "결재가 승인되었습니다" : "결재가 반려되었습니다",
      body: doc.title,
      url,
    });
  }
}
