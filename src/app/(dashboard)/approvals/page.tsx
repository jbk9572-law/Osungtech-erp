import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { ClickableRow } from "@/components/clickable-row";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
  recalled: { label: "회수됨", tone: "muted" },
};

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "진행중" },
  { key: "approved", label: "완료" },
  { key: "rejected", label: "반려" },
  { key: "recalled", label: "회수" },
];

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const activeTab = TABS.some((t) => t.key === statusParam) ? statusParam! : "all";

  const supabase = await createClient();
  const user = await getUser();

  // RLS(approval_documents_select)가 이미 "본인 기안 또는 본인이 결재선에
  // 있는 문서"로만 걸러주지만, 그와 별개로 한 화면에서 무한정 쌓이지
  // 않게 최근 200건으로 명시적으로도 상한을 둔다.
  let query = supabase
    .from("approval_documents")
    .select("id, title, status, created_at, profiles!created_by(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  // 임시저장(draft)은 이 기안함이 아니라 /approvals/drafts에서만 보여준다
  // — 여기 섞이면 "결재선도 없는 문서"가 목록에 나타나 혼란스럽다.
  query = activeTab === "all" ? query.neq("status", "draft") : query.eq("status", activeTab);
  const { data: docs } = await query;

  // 지금 로그인한 사람이 대리 결재 중인 원 결재자 목록 — "내 차례" 판정에
  // 본인 몫뿐 아니라 위임받은 몫도 포함시킨다.
  const { data: delegations } = user
    ? await supabase
        .from("approval_delegations")
        .select("delegator_id, start_date, end_date")
        .eq("delegate_id", user.id)
    : { data: [] as { delegator_id: string; start_date: string; end_date: string }[] };
  const today = new Date().toISOString().slice(0, 10);
  const delegatedForIds = new Set(
    (delegations ?? []).filter((d) => d.start_date <= today && today <= d.end_date).map((d) => d.delegator_id),
  );

  const docIds = (docs ?? []).map((d) => d.id);
  const { data: steps } = docIds.length
    ? await supabase
        .from("approval_steps")
        .select("document_id, step_order, approver_id, status, role")
        .eq("role", "approver")
        .in("document_id", docIds)
        .order("step_order", { ascending: true })
    : { data: [] as { document_id: string; step_order: number; approver_id: string; status: string; role: string }[] };

  // 문서별 "지금 결재할 차례인 사람"을 구한다 — 순서대로 처리되므로
  // 아직 pending인 첫 단계가 곧 현재 차례다(참조자는 순서에 안 끼므로
  // role='approver'만 본다).
  const currentStepByDoc = new Map<string, { approverId: string; stepOrder: number }>();
  for (const s of steps ?? []) {
    // role="approver"로 이미 걸러서 조회했으니 실제로는 항상 값이
    // 있지만, 타입 상으로는 nullable(참조자용)이라 방어적으로 건너뛴다.
    if (s.status !== "pending" || s.step_order == null) continue;
    const existing = currentStepByDoc.get(s.document_id);
    if (!existing || s.step_order < existing.stepOrder) {
      currentStepByDoc.set(s.document_id, { approverId: s.approver_id, stepOrder: s.step_order });
    }
  }

  const rows = (docs ?? []).map((d) => {
    const current = currentStepByDoc.get(d.id);
    const myTurn =
      d.status === "pending" &&
      !!current &&
      (current.approverId === user?.id || delegatedForIds.has(current.approverId));
    return { ...d, myTurn };
  });

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/approvals/new" }, Escape: { href: "/dashboard" } }} />
      <ListPageHeader
        title="전자결재 > 기안함"
        actions={
          <>
            <Link href="/approvals/new" className="erp-btn erp-btn-primary">
              F2 기안
            </Link>
            <Link href="/approvals/drafts" className="erp-btn">
              임시저장함
            </Link>
            <Link href="/approvals/lines" className="erp-btn">
              공유 결재선
            </Link>
            <Link href="/approvals/matrix" className="erp-btn">
              결재매트릭스
            </Link>
            <Link href="/settings/delegations" className="erp-btn">
              전결권 관리
            </Link>
            <Link href="/dashboard" className="erp-btn erp-btn-dark">
              ESC 닫기
            </Link>
          </>
        }
      />

      <PageGuide>
        본인이 기안했거나 결재선/참조에 포함된 문서만 보입니다. &quot;내 차례&quot;
        배지가 붙은 문서는 지금 승인/반려를 기다리고 있고(대리 결재 중인
        문서도 포함), 아직 상신 전인 문서는 임시저장함에서 이어 씁니다.
      </PageGuide>

      <div className="erp-date-presets" style={{ marginBottom: 12 }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/approvals" : `/approvals?status=${t.key}`}
            className={`erp-date-preset-btn${activeTab === t.key ? " active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
          해당하는 문서가 없습니다.
        </p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th style={{ width: 130 }}>일시</th>
                <th>제목</th>
                <th style={{ width: 110 }}>기안자</th>
                <th style={{ width: 90 }}>상태</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const status = STATUS_LABEL[d.status] ?? { label: d.status, tone: "muted" as const };
                return (
                  <ClickableRow key={d.id} href={`/approvals/${d.id}`}>
                    <td>{new Date(d.created_at).toLocaleString("ko-KR")}</td>
                    <td>{d.title}</td>
                    <td>{d.profiles?.full_name ?? "-"}</td>
                    <td>
                      <GridBadge tone={status.tone}>{status.label}</GridBadge>
                    </td>
                    <td>
                      {d.myTurn && <GridBadge tone="warn">내 차례</GridBadge>}
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
