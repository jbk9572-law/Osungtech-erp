import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type PendingApproval = { id: string; title: string; authorName: string | null; createdAt: string };

// 대시보드 "결재 대기" 위젯 전용 — approvals/page.tsx의 "내 차례" 판정
// 로직(결재선 최소 step_order + 대리결재 위임)과 같은 원리이지만, 그
// 화면은 탭(전체/진행중/완료/반려/회수)별 페이지네이션까지 갖춘 전체
// 목록이라 그대로 재사용하기보다, 대시보드에 필요한 "지금 내 차례인
// 문서 상위 N건"만 뽑는 훨씬 좁은 범위로 따로 둔다.
export async function getMyPendingApprovals(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 5
): Promise<PendingApproval[]> {
  const { data: pendingDocs } = await supabase
    .from("approval_documents")
    .select("id, title, created_at, profiles!created_by(full_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!pendingDocs || pendingDocs.length === 0) return [];

  const { data: delegations } = await supabase
    .from("approval_delegations")
    .select("delegator_id, start_date, end_date")
    .eq("delegate_id", userId);

  const today = new Date().toISOString().slice(0, 10);
  const delegatedForIds = new Set(
    (delegations ?? []).filter((d) => d.start_date <= today && today <= d.end_date).map((d) => d.delegator_id)
  );

  const docIds = pendingDocs.map((d) => d.id);
  const { data: steps } = await supabase
    .from("approval_steps")
    .select("document_id, step_order, approver_id, status")
    .eq("role", "approver")
    .in("document_id", docIds)
    .order("step_order", { ascending: true });

  const currentStepByDoc = new Map<string, string>();
  for (const s of steps ?? []) {
    if (s.status !== "pending" || s.step_order == null) continue;
    if (!currentStepByDoc.has(s.document_id)) {
      currentStepByDoc.set(s.document_id, s.approver_id);
    }
  }

  return pendingDocs
    .filter((d) => {
      const approverId = currentStepByDoc.get(d.id);
      return approverId === userId || (approverId && delegatedForIds.has(approverId));
    })
    .slice(0, limit)
    .map((d) => ({
      id: d.id,
      title: d.title,
      authorName: d.profiles?.full_name ?? null,
      createdAt: d.created_at,
    }));
}
