import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { ClickableRow } from "@/components/clickable-row";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { deleteApprovalDraft } from "@/app/(dashboard)/approvals/actions";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
  recalled: { label: "회수됨", tone: "muted" },
};

// "임시저장"은 결재선도 없는 상신 전 문서라 다른 탭과 조회 조건이
// 완전히 다르다(created_by=본인만, approval_steps 계산 자체가 불필요) —
// 그래서 목록 렌더링을 별도 분기로 다룬다(아래 activeTab === "draft").
// 예전엔 /approvals/drafts라는 별도 화면이었는데, 같은
// approval_documents 테이블을 status로만 가른 것뿐이라 기안함의 탭
//하나로 합쳤다(감사에서 지적됨 — 화면 통폐합).
const TABS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "진행중" },
  { key: "approved", label: "완료" },
  { key: "rejected", label: "반려" },
  { key: "recalled", label: "회수" },
  { key: "draft", label: "임시저장" },
];

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const activeTab = TABS.some((t) => t.key === statusParam) ? statusParam! : "all";

  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "approvals");
  const user = await getUser();

  const header = (
    <>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/approvals/new" }, Escape: { href: "/dashboard" } }} />
      <ListPageHeader
        title="전자결재 > 기안함"
        actions={
          <>
            <Link href="/approvals/new" className="erp-btn erp-btn-primary">
              F2 기안
            </Link>
            <Link href="/approvals/lines" className="erp-btn">
              결재선 설정
            </Link>
            <Link href="/settings/delegations" className="erp-btn">
              전결권 관리
            </Link>
          </>
        }
      />

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
    </>
  );

  if (activeTab === "draft") {
    // RLS(approval_documents_select)가 created_by=본인 조건을 이미 걸어주지만,
    // 임시저장은 오직 본인만 봐야 하는 화면이라 쿼리에도 명시적으로 조건을
    // 반복해서 걸어둔다.
    const { data: drafts } = user
      ? await supabase
          .from("approval_documents")
          .select("id, title, created_at")
          .eq("status", "draft")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: [] };

    return (
      <div>
        {header}
        <PageGuide>
          결재선을 아직 확정하지 않고 저장해둔 문서입니다. 이어 쓰거나
          제출하기 전까지는 결재자에게 보이지 않습니다.
        </PageGuide>

        {!drafts || drafts.length === 0 ? (
          <p className="erp-grid-empty">임시저장된 문서가 없습니다.</p>
        ) : (
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>마지막 저장</th>
                  <th>제목</th>
                  <th style={{ width: 190 }} />
                </tr>
              </thead>
              <tbody>
                {drafts.map((d) => (
                  <tr key={d.id}>
                    <td>{new Date(d.created_at).toLocaleString("ko-KR")}</td>
                    <td>{d.title || "(제목 없음)"}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/approvals/new?draft=${d.id}`}
                          className="erp-btn erp-btn-primary"
                          style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}
                        >
                          이어 쓰기
                        </Link>
                        <InlineConfirmDelete
                          action={deleteApprovalDraft}
                          hiddenFields={{ id: d.id }}
                          warningText="이 임시저장 문서를 삭제하시겠습니까?"
                          triggerStyle={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // RLS(approval_documents_select)가 이미 "본인 기안 또는 본인이 결재선에
  // 있는 문서"로만 걸러주지만, 그와 별개로 한 화면에서 무한정 쌓이지
  // 않게 최근 200건으로 명시적으로도 상한을 둔다.
  let query = supabase
    .from("approval_documents")
    .select("id, title, status, created_at, profiles!created_by(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  // 임시저장(draft)은 위에서 이미 분기 처리했으니, 여기 "전체" 탭에는
  // 섞이지 않게 뺀다 — 안 그러면 "결재선도 없는 문서"가 목록에 나타나
  // 혼란스럽다.
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
      {header}

      <PageGuide>
        본인이 기안했거나 결재선/참조에 포함된 문서만 보입니다. &quot;내 차례&quot;
        배지가 붙은 문서는 지금 승인/반려를 기다리고 있고(대리 결재 중인
        문서도 포함), 아직 상신 전인 문서는 임시저장 탭에서 이어 씁니다.
      </PageGuide>

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
