import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { ApprovalQueueItem } from "@/lib/dashboard-todo";

// 지금 "내가 결재할 차례"인 문서 — 본인 몫과 대리 결재(위임) 받은 몫을 합친다. approvals 화면의 판정
// (순서대로 처리되므로 아직 pending인 첫 단계가 현재 차례)을 그대로 따르되, 대시보드에는 내 차례인
// 문서만 가볍게 가져온다. 접근 제한(RLS)은 approval_* 테이블 정책이 그대로 적용된다.
export async function getMyApprovalQueue(
  supabase: SupabaseClient<Database>,
  userId: string,
  todayStr: string,
  limit = 20,
): Promise<ApprovalQueueItem[]> {
  const { data: delegations } = await supabase
    .from("approval_delegations")
    .select("delegator_id, start_date, end_date")
    .eq("delegate_id", userId)
    .limit(50);
  const approverIds = [
    userId,
    ...(delegations ?? []).filter((d) => d.start_date <= todayStr && todayStr <= d.end_date).map((d) => d.delegator_id),
  ];

  const { data: mySteps } = await supabase
    .from("approval_steps")
    .select("document_id, step_order")
    .eq("role", "approver")
    .eq("status", "pending")
    .in("approver_id", approverIds)
    .limit(200);
  const docIds = [...new Set((mySteps ?? []).map((s) => s.document_id))];
  if (!docIds.length) return [];

  const [{ data: docs }, { data: pendingSteps }] = await Promise.all([
    supabase
      .from("approval_documents")
      .select("id, title, created_at, profiles!created_by(full_name)")
      .eq("status", "pending")
      .in("id", docIds)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("approval_steps")
      .select("document_id, step_order")
      .eq("role", "approver")
      .eq("status", "pending")
      .in("document_id", docIds)
      .limit(1000),
  ]);

  const firstPending = new Map<string, number>();
  for (const s of pendingSteps ?? []) {
    if (s.step_order == null) continue;
    const cur = firstPending.get(s.document_id);
    if (cur === undefined || s.step_order < cur) firstPending.set(s.document_id, s.step_order);
  }
  const myOrderByDoc = new Map<string, number>();
  for (const s of mySteps ?? []) {
    if (s.step_order == null) continue;
    const cur = myOrderByDoc.get(s.document_id);
    if (cur === undefined || s.step_order < cur) myOrderByDoc.set(s.document_id, s.step_order);
  }

  return (docs ?? [])
    .filter((d) => myOrderByDoc.get(d.id) === firstPending.get(d.id))
    .slice(0, limit)
    .map((d) => ({
      id: d.id,
      title: d.title,
      createdAt: d.created_at,
      authorName: (d.profiles as { full_name: string | null } | null)?.full_name ?? null,
    }));
}
