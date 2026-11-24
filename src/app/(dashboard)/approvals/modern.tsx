import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { formatKstDate, formatKstDateTime, todayKstStr } from "@/lib/kst-date";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, SplitDetailEmpty, SplitListFiller } from "@/components/erp/page-header";
import { GuardedLink } from "@/components/erp/guarded-link";
import { SplitFilterColumn } from "@/components/erp/split-filter-column";
import { PageGuide } from "@/components/erp/page-guide";
import { CheckCircleIcon } from "@/components/erp/groupware-icons";
import { GridBadge } from "@/components/grid/badge";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { ApprovalDetailPanel } from "@/components/approval-detail-panel";
import { deleteApprovalDraft } from "@/app/(dashboard)/approvals/actions";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { selectInChunks } from "@/lib/fetch-all-rows";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";
import { resolveStatusLabel } from "@/lib/status-label";
import { ListSummaryBar } from "@/components/grid/list-summary-bar";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
  recalled: { label: "회수됨", tone: "muted" },
};

// "임시저장"은 결재선도 없는 상신 전 문서라 다른 탭과 조회 조건이
// 완전히 다르다(created_by=본인만, approval_steps 계산 자체가 불필요) —
// 그래서 목록+상세 분할에도 안 태우고 지금처럼 전체 폭 표로 따로 둔다.
const TABS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "진행중" },
  { key: "approved", label: "완료" },
  { key: "rejected", label: "반려" },
  { key: "recalled", label: "회수" },
  { key: "draft", label: "임시저장" },
];

// 모던 테마(grid-modern) 전용 B형 기안함 — 필터 열(상태) | 목록 | 상세, 기안은 C형 모달(/approvals/new). 클래식은 classic.tsx(동결본).
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; id?: string }>;
}) {
  const { status: statusParam, id } = await searchParams;
  const activeTab = TABS.some((t) => t.key === statusParam) ? statusParam! : "all";
  const selectedId = id && isUuid(id) ? id : undefined;

  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "approvals");
  const user = await getUser();
    // 탭별 문서 수 — 건수만 필요해서 본문 없이 개수만 센다(head:true). 임시저장은 본인 것만.
  const tabCounts: Record<string, number> = {};
  {
    const countOf = async (key: string) => {
      let q = supabase.from("approval_documents").select("id", { count: "exact", head: true });
      if (key === "all") q = q.neq("status", "draft");
      else if (key === "draft") q = q.eq("status", "draft").eq("created_by", user?.id ?? "");
      else q = q.eq("status", key);
      const { count } = await q;
      return [key, count ?? 0] as const;
    };
    for (const [k, n] of await Promise.all(TABS.map((t) => countOf(t.key)))) tabCounts[k] = n;
  }

  const tabHref = (key: string) => (key === "all" ? "/approvals" : `/approvals?status=${key}`);
  const newHref = tabHref(activeTab);

  // B형 왼쪽 필터 열 — 상태 탭을 건수와 함께 세로로(탭 칩 대신)
  const filterColumn = (
    <SplitFilterColumn
      ariaLabel="결재 상태 필터"
      groups={[{ heading: "상태", items: TABS.map((t) => ({ key: t.key, label: t.label, count: tabCounts[t.key] ?? 0, active: activeTab === t.key, href: tabHref(t.key) })) }]}
    />
  );

  const header = (
    <>
      <KeyboardShortcuts
        shortcuts={{ F2: { href: "/approvals/new" }, Escape: { href: selectedId ? newHref : "/dashboard" } }}
      />
      <div className="erp-page-toolbar">
        <ListPageHeader
          title="전자결재 > 기안함"
          actions={
            <>
              <GuardedLink href="/approvals/new" className="erp-btn erp-btn-primary">
                기안
              </GuardedLink>
              <Link href="/approvals/lines" className="erp-btn">
                결재선 설정
              </Link>
              <Link href="/settings/delegations" className="erp-btn">
                전결권 관리
              </Link>
              {selectedId && (
                <Link href={newHref} className="erp-btn">
                  목록
                </Link>
              )}
            </>
          }
        />
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
      <div className="erp-comm-shell">
        {header}
        <div className="erp-split3-shell" data-mobile-view="list">
        {filterColumn}
        <section className="erp-split-list erp-split3-rest">
        <PageGuide>
          결재선을 아직 확정하지 않고 저장해둔 문서입니다. 이어 쓰거나
          제출하기 전까지는 결재자에게 보이지 않습니다.
        </PageGuide>

        {!drafts || drafts.length === 0 ? (
          <p className="erp-grid-empty">임시저장된 문서가 없습니다.</p>
        ) : (
          <>
            <div className="erp-grid-wrap has-card-view">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th className="erp-col-xl">마지막 저장</th>
                    <th>제목</th>
                    <th className="erp-col-w"  />
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => (
                    <tr key={d.id}>
                      <td>{formatKstDateTime(d.created_at)}</td>
                      <td>{d.title || "(제목 없음)"}</td>
                      <td>
                        <div className="erp-u-flex erp-u-items-center erp-u-gap-4">
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
                            triggerClassName="erp-btn erp-btn-danger erp-btn-xs"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="erp-row-card-list">
              {drafts.map((d) => (
                <div className="erp-row-card" key={d.id}>
                  <div className="erp-row-card-head">
                    <span className="erp-row-card-partner">{d.title || "(제목 없음)"}</span>
                  </div>
                  <div className="erp-row-card-item">
                    마지막 저장 {formatKstDateTime(d.created_at)}
                  </div>
                  <div className="erp-row-card-foot">
                    <Link
                      href={`/approvals/new?draft=${d.id}`}
                      className="erp-btn erp-btn-primary"
                      style={{ minWidth: 0, height: 28, padding: "0 10px" }}
                    >
                      이어 쓰기
                    </Link>
                    <InlineConfirmDelete
                      action={deleteApprovalDraft}
                      hiddenFields={{ id: d.id }}
                      warningText="이 임시저장 문서를 삭제하시겠습니까?"
                      triggerStyle={{ minWidth: 0, height: 28, padding: "0 10px" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        </section>
        </div>
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
  const today = todayKstStr();
  const delegatedForIds = new Set(
    (delegations ?? []).filter((d) => d.start_date <= today && today <= d.end_date).map((d) => d.delegator_id),
  );

  const docIds = (docs ?? []).map((d) => d.id);
  const { data: steps } = docIds.length
    ? await selectInChunks(docIds, (idChunk) =>
        supabase
          .from("approval_steps")
          .select("document_id, step_order, approver_id, status, role")
          .eq("role", "approver")
          .in("document_id", idChunk)
          .order("step_order", { ascending: true }),
      )
    : { data: [] as { document_id: string; step_order: number; approver_id: string; status: string; role: string }[] };

  // 문서별 "지금 결재할 차례인 사람"을 구한다 — 순서대로 처리되므로
  // 아직 pending인 첫 단계가 곧 현재 차례다(참조자는 순서에 안 끼므로
  // role='approver'만 본다).
  const currentStepByDoc = new Map<string, { approverId: string; stepOrder: number }>();
  for (const s of steps ?? []) {
    if (s.status !== "pending" || s.step_order == null) continue;
    const existing = currentStepByDoc.get(s.document_id);
    if (!existing || s.step_order < existing.stepOrder) {
      currentStepByDoc.set(s.document_id, { approverId: s.approver_id, stepOrder: s.step_order });
    }
  }

  // 문서별 결재 진행(승인한 단계/전체 단계)과 지금 차례인 사람 이름 — 목록 줄 보조 정보(테마 기능)
  const stepCountByDoc = new Map<string, { done: number; total: number }>();
  for (const s of steps ?? []) {
    const c = stepCountByDoc.get(s.document_id) ?? { done: 0, total: 0 };
    c.total += 1;
    if (s.status === "approved") c.done += 1;
    stepCountByDoc.set(s.document_id, c);
  }
  const approverNameById = new Map<string, string>();
  if (currentStepByDoc.size > 0) {
    const ids = [...new Set([...currentStepByDoc.values()].map((c) => c.approverId))];
    const { data: names } = await selectInChunks(ids, (idChunk) => supabase.from("profiles").select("id, full_name").in("id", idChunk));
    for (const n of names ?? []) approverNameById.set(n.id, n.full_name ?? "");
  }

  const rows = (docs ?? []).map((d) => {
    const current = currentStepByDoc.get(d.id);
    const myTurn =
      d.status === "pending" &&
      !!current &&
      (current.approverId === user?.id || delegatedForIds.has(current.approverId));
    const progress = stepCountByDoc.get(d.id);
    return {
      ...d,
      myTurn,
      progress: progress && d.status !== "recalled" ? `${progress.done}/${progress.total}` : null,
      waitingFor: d.status === "pending" && current ? approverNameById.get(current.approverId) || null : null,
    };
  });

  const listParams = new URLSearchParams();
  if (activeTab !== "all") listParams.set("status", activeTab);
  const rowHref = (docId: string) => {
    const p = new URLSearchParams(listParams);
    p.set("id", docId);
    return `/approvals?${p.toString()}`;
  };

  return (
    <div className="erp-comm-shell">
      {header}

      <PageGuide>
        본인이 기안했거나 결재선/참조에 포함된 문서만 보입니다. &quot;내 차례&quot;
        배지가 붙은 문서는 지금 승인/반려를 기다리고 있고(대리 결재 중인
        문서도 포함), 아직 상신 전인 문서는 임시저장 탭에서 이어 씁니다.
      </PageGuide>

      {(
        <ListSummaryBar
          items={[
            { label: "총", value: `${formatNumber(rows.length)}건` },
            { label: "내 차례", value: `${formatNumber(rows.filter((r) => r.myTurn).length)}건` },
            { label: "결재중", value: `${formatNumber(rows.filter((r) => r.status === "pending").length)}건` },
          ]}
        />
      )}

      <div className="erp-split3-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        {filterColumn}
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>기안 목록</span>
            <span className="erp-u-muted erp-u-normal">
              총 {formatNumber(rows.length)}건
            </span>
          </div>
          <div className="erp-split-list-body">
            {rows.map((d) => {
              const status = resolveStatusLabel(STATUS_LABEL, d.status);
              return (
                <Link
                  key={d.id}
                  href={rowHref(d.id)}
                  className={`erp-split-list-row${d.id === selectedId ? " active" : ""}${d.myTurn ? " is-my-turn" : ""}`}
                >
                  {d.title}
                  <span className="erp-u-ml-s2">
                    <GridBadge tone={status.tone}>{status.label}</GridBadge>
                  </span>
                  {d.myTurn && (
                    <span className="erp-u-ml-s2">
                      <GridBadge tone="warn">내 차례</GridBadge>
                    </span>
                  )}
                  <div className="erp-split-list-row-sub">
                    {d.profiles?.full_name ?? "-"} · {formatKstDate(d.created_at)}
                    {d.progress ? ` · 결재 ${d.progress}` : ""}
                    {d.waitingFor ? ` · 대기 ${d.waitingFor}` : ""}
                  </div>
                </Link>
              );
            })}
            <SplitListFiller
              icon={<CheckCircleIcon />}
              title={rows.length === 0 ? "해당하는 문서가 없습니다" : "새 기안을 작성해보세요"}
              actionHref="/approvals/new"
              actionLabel="기안"
            />
          </div>
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <ApprovalDetailPanel key={selectedId} id={selectedId} closeHref={newHref} />
          ) : (
            <SplitDetailEmpty icon={<CheckCircleIcon />} title="문서를 선택해주세요" hint="왼쪽 목록에서 기안을 누르면 여기에 내용이 표시됩니다. 새 기안은 [기안]으로 작성합니다." />
          )}
        </div>
      </div>
    </div>
  );
}
