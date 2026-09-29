import { notify } from "@/lib/notify";
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
      await notify(supabase, {
        userIds: [nextStep.approver_id],
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
